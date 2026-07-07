// Le « cerveau » : appelle l'API Claude pour composer le panier cible.
//
// Le choix des produits n'est PAS piloté seulement par l'historique. On demande
// explicitement au modèle un panier pragmatique fondé sur : promos du jour,
// produits de saison, quelques recettes concrètes à cuisiner sur la période,
// le budget, les indispensables, et le profil de goûts appris.

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Schéma de sortie structurée (contraint la réponse à du JSON valide).
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    cover_days: { type: "integer" },
    currency: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string", description: "Terme de recherche produit sur le site, ex. 'lait demi-écrémé 1L'" },
          category: { type: "string" },
          quantity: { type: "integer" },
          reason: { type: "string", description: "Pourquoi cet article : promo, de saison, recette X, indispensable…" },
          product_id: { type: ["string", "null"], description: "ID d'un produit précis choisi parmi les promos fournies, sinon null" },
          max_unit_price: { type: ["number", "null"], description: "Prix unitaire max acceptable en €, sinon null" },
          prefer_promo: { type: "boolean" },
        },
        required: ["query", "category", "quantity", "reason", "product_id", "max_unit_price", "prefer_promo"],
      },
    },
    recipes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          servings: { type: "integer" },
          uses: { type: "string", description: "Ingrédients clés du panier utilisés par cette recette" },
        },
        required: ["name", "servings", "uses"],
      },
    },
    notes: { type: "string" },
  },
  required: ["cover_days", "currency", "items", "recipes", "notes"],
};

const SYSTEM = `Tu es l'assistant de courses d'un drive français. Tu composes un panier optimisé
pour couvrir quelques jours, que l'utilisateur vérifiera puis commandera lui-même.

Principes de choix (dans cet ordre d'importance) :
1. Respecter STRICTEMENT le régime, les allergies et les aversions.
2. Toujours réassortir les indispensables selon leur cadence de consommation.
3. Saisir les promotions intéressantes du jour quand elles correspondent aux goûts et aux besoins.
4. Privilégier les fruits et légumes DE SAISON (liste fournie), plus frais et moins chers.
5. Proposer 2 à 4 recettes concrètes et réalistes pour la période, et lister leurs ingrédients dans le panier.
6. Tenir compte du profil de goûts appris, SANS s'y limiter : l'historique est un signal, pas une contrainte.
   Introduis de la variété et des nouveautés pertinentes plutôt que de recopier les dernières commandes.
7. Respecter le budget indiqué s'il y en a un.

Quand tu choisis un produit précis parmi les promos fournies, renseigne son product_id.
Sinon, laisse product_id à null et fournis un 'query' de recherche clair (le site cherchera le produit).
Chaque article doit avoir une 'reason' courte et utile (promo -30%, de saison, recette gratin, indispensable…).`;

export async function planCart({ ai, prefs, profile, seasonal, promos, currentCart, orderHistory }) {
  if (!ai.apiKey) {
    throw new Error("Clé API Anthropic absente. Renseigne-la dans les options de l'extension.");
  }

  const userPayload = {
    date: new Date().toISOString().slice(0, 10),
    household_size: prefs.householdSize,
    cover_days: prefs.coverDays,
    weekly_budget_eur: prefs.weeklyBudget,
    diet: prefs.diet,
    allergies: prefs.allergies,
    dislikes: [...(prefs.dislikes || []), ...(profile.dislikes || [])],
    staples: prefs.staples,
    learned_profile: {
      favorites: profile.favorites,
      notes: profile.freeText,
    },
    seasonal_now: seasonal,
    promotions_today: promos.slice(0, 80),
    current_cart: currentCart,
    recent_orders: orderHistory.slice(0, 8),
  };

  const body = {
    model: ai.model || "claude-opus-4-8",
    max_tokens: 8000,
    system: SYSTEM,
    output_config: {
      effort: ai.effort || "medium",
      format: { type: "json_schema", schema: OUTPUT_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content:
          "Compose le panier cible à partir de ces données (JSON) :\n\n" +
          JSON.stringify(userPayload, null, 2),
      },
    ],
  };

  const resp = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ai.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      // Autorise l'appel depuis un contexte navigateur (extension).
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`API Claude ${resp.status} : ${text.slice(0, 300)}`);
  }

  const data = await resp.json();
  if (data.stop_reason === "refusal") {
    throw new Error("La requête a été refusée par le modèle.");
  }
  const textBlock = (data.content || []).find((b) => b.type === "text");
  if (!textBlock) throw new Error("Réponse du modèle sans contenu texte.");

  let plan;
  try {
    plan = JSON.parse(textBlock.text);
  } catch (e) {
    throw new Error("Réponse du modèle non parsable en JSON.");
  }
  return plan;
}

// Mise à jour du profil appris à partir des signaux récents (édition manuelle,
// commandes, feedback). Deuxième appel LLM, léger, qui réécrit le profil.
export async function updateProfile({ ai, profile, signals }) {
  if (!ai.apiKey || !signals.length) return profile;

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      favorites: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            brand: { type: ["string", "null"] },
            cadenceDays: { type: ["integer", "null"] },
            note: { type: ["string", "null"] },
          },
          required: ["name", "brand", "cadenceDays", "note"],
        },
      },
      dislikes: { type: "array", items: { type: "string" } },
      freeText: { type: "string" },
    },
    required: ["favorites", "dislikes", "freeText"],
  };

  const body = {
    model: ai.model || "claude-opus-4-8",
    max_tokens: 3000,
    system:
      "Tu maintiens le profil de goûts d'un utilisateur de drive. À partir du profil actuel " +
      "et des nouveaux signaux (produits ajoutés à la main = goût positif fort ; produits retirés = " +
      "signal négatif ; commandes validées = confirmation et calibrage des cadences ; feedback en " +
      "langage naturel). Réécris un profil consolidé, concis et non redondant. Ne garde pas d'infos " +
      "obsolètes ou contredites.",
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    messages: [
      {
        role: "user",
        content:
          "Profil actuel :\n" +
          JSON.stringify({ favorites: profile.favorites, dislikes: profile.dislikes, freeText: profile.freeText }, null, 2) +
          "\n\nNouveaux signaux :\n" +
          JSON.stringify(signals, null, 2),
      },
    ],
  };

  const resp = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ai.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) return profile; // pas bloquant
  const data = await resp.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  if (!textBlock) return profile;
  try {
    const next = JSON.parse(textBlock.text);
    return { ...next, updatedAt: new Date().toISOString() };
  } catch {
    return profile;
  }
}
