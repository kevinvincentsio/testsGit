// Orchestrateur (service worker). Sur clic de "Run" dans le popup :
// détecte l'enseigne → relève l'état (panier/promos/commandes) → apprend des
// signaux → compose le panier cible via Claude → applique → notifie.

import * as store from "./core/store.js";
import { seasonalFor } from "./core/season.js";
import { planCart, updateProfile } from "./core/planner.js";

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function send(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (resp) => {
      if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
      else resolve(resp || {});
    });
  });
}

// Détecte ce que l'utilisateur a ajouté/retiré à la main depuis le dernier run.
function deriveSignals(cart, lastPlan, prefs) {
  if (!lastPlan) return [];
  const botSet = new Set(lastPlan.botItems || []);
  const cartIds = new Set(cart.map((i) => i.product_id));
  const staples = new Set((prefs.staples || []).map((s) => s.toLowerCase()));
  const signals = [];
  for (const item of cart) {
    if (!botSet.has(item.product_id) && !staples.has(item.name.toLowerCase())) {
      signals.push({ type: "manual_add", name: item.name, weight: "strong_positive" });
    }
  }
  for (const id of botSet) {
    if (!cartIds.has(id)) {
      signals.push({ type: "manual_remove", product_id: id, weight: "negative" });
    }
  }
  return signals;
}

async function runGrocery() {
  const tab = await activeTab();
  if (!tab) throw new Error("Aucun onglet actif.");

  const ping = await send(tab.id, { action: "ping" });
  if (ping.error) throw new Error("Ouvre d'abord la page d'un drive pris en charge (Chronodrive, Intermarché ou Leclerc Drive), connecté. Détail : " + ping.error);
  if (ping.blocked) throw new Error("La page affiche un blocage anti-bot. Recharge/valide le site à la main puis relance.");

  const { prefs, ai, profile, lastPlan } = await store.getAll();

  const scraped = await send(tab.id, { action: "scrape" });
  if (scraped.error) throw new Error(scraped.error);
  if (scraped.blocked) throw new Error("Blocage anti-bot détecté pendant la lecture.");

  // --- Apprentissage : signaux depuis le dernier run ---
  const signals = deriveSignals(scraped.cart, lastPlan, prefs);
  let profileNext = profile;
  if (signals.length) {
    for (const s of signals) await store.pushHistory({ type: "signal", data: s });
    try {
      profileNext = await updateProfile({ ai, profile, signals });
      await store.set("profile", profileNext);
    } catch (_) { /* apprentissage non bloquant */ }
  }

  // --- Planification par Claude ---
  const plan = await planCart({
    ai,
    prefs,
    profile: profileNext,
    seasonal: seasonalFor(),
    promos: scraped.promos || [],
    currentCart: scraped.cart || [],
    orderHistory: scraped.orders || [],
  });

  // --- Application sur le site ---
  const applied = await send(tab.id, {
    action: "apply",
    plan,
    lastBotItems: lastPlan?.botItems || [],
  });
  if (applied.error) throw new Error(applied.error);

  await store.set("lastPlan", {
    store: scraped.store,
    appliedAt: new Date().toISOString(),
    botItems: applied.botItems || [],
  });
  await store.pushHistory({ type: "run", data: { store: scraped.store, itemCount: (plan.items || []).length } });

  const summary = {
    store: scraped.store,
    coverDays: plan.cover_days,
    items: plan.items,
    recipes: plan.recipes,
    notes: plan.notes,
    log: applied.log,
    finalCartSize: (applied.finalCart || []).length,
    learnedSignals: signals.length,
    at: new Date().toISOString(),
  };
  await store.set("lastRun", summary);
  return summary;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "run") {
    runGrocery()
      .then((summary) => {
        chrome.runtime.sendMessage({ action: "runDone", summary }).catch(() => {});
        notify("Panier prêt", `${summary.items.length} articles préparés sur ${summary.store}. Vérifie puis commande.`);
        sendResponse({ summary });
      })
      .catch((err) => {
        chrome.runtime.sendMessage({ action: "runError", error: err.message }).catch(() => {});
        notify("Panier Malin — échec", err.message);
        sendResponse({ error: err.message });
      });
    return true; // asynchrone
  }
});

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title,
      message: message.slice(0, 250),
    });
  } catch (_) { /* icônes/notifs optionnelles */ }
}
