// Accès typé au stockage de l'extension (chrome.storage.local).
// Contient : préférences, réglages IA (clé API, modèle), profil appris,
// journal des signaux, et le dernier plan appliqué (pour la synchro).

const DEFAULTS = {
  prefs: {
    householdSize: 2,
    coverDays: 4,
    weeklyBudget: null, // € pour la période, null = pas de contrainte
    diet: "", // ex. "végétarien", "sans porc"
    allergies: [], // ex. ["arachide", "gluten"]
    dislikes: [], // aversions explicites
    staples: [], // indispensables toujours au frigo (lait, œufs…)
  },
  ai: {
    apiKey: "",
    model: "claude-opus-4-8",
    effort: "medium",
  },
  // Profil appris, maintenu par l'IA au fil des runs.
  profile: {
    favorites: [], // [{name, brand, cadenceDays, note}]
    dislikes: [], // appris (distinct des aversions explicites des prefs)
    freeText: "", // notes libres de l'IA
    updatedAt: null,
  },
  history: [], // journal des signaux [{ts, type, data}]
  lastPlan: null, // dernier plan appliqué : { store, appliedAt, botItems: [productId] }
  lastRun: null, // dernier résumé affiché dans le popup
};

export async function getAll() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const out = {};
  for (const k of Object.keys(DEFAULTS)) {
    out[k] = { ...structuredCloneSafe(DEFAULTS[k]), ...(stored[k] || {}) };
  }
  // Les tableaux/valeurs nullables ne se mergent pas ; on remplace si présent.
  for (const k of ["history", "lastPlan", "lastRun"]) {
    if (stored[k] !== undefined) out[k] = stored[k];
  }
  return out;
}

export async function get(key) {
  const all = await chrome.storage.local.get(key);
  if (all[key] === undefined) return structuredCloneSafe(DEFAULTS[key]);
  if (Array.isArray(DEFAULTS[key]) || DEFAULTS[key] === null) return all[key];
  return { ...structuredCloneSafe(DEFAULTS[key]), ...all[key] };
}

export async function set(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

export async function pushHistory(entry, cap = 500) {
  const history = (await chrome.storage.local.get("history")).history || [];
  history.push({ ts: new Date().toISOString(), ...entry });
  while (history.length > cap) history.shift();
  await chrome.storage.local.set({ history });
}

function structuredCloneSafe(v) {
  return JSON.parse(JSON.stringify(v));
}
