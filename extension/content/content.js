// Point d'entrée injecté dans les pages du drive. Reçoit les ordres du
// background (le "cerveau" côté service worker) et agit sur la page.
//
// Conception V1 : à lancer de préférence depuis TA page panier, connecté.
// - 'scrape'  : lit le panier (DOM) + récupère promos & commandes en fetch
//               same-origin (cookies inclus) sans quitter la page.
// - 'apply'   : pour chaque article du plan, recherche sur la page, choisit le
//               meilleur résultat et l'ajoute ; retire les articles que le bot
//               avait ajoutés et qui ne sont plus dans le plan (jamais ceux que
//               TU as ajoutés à la main).

(function () {
  const PM = window.PanierMalin;
  const { q, qa, parsePrice } = PM.helpers;

  function currentAdapter() {
    const config = PM.detect();
    return config ? new PM.GenericAdapter(config) : null;
  }

  // Récupère une page same-origin et parse les cartes produits avec la config.
  async function fetchProducts(url, config, limit = 120) {
    try {
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) return [];
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const s = config.selectors;
      const cards = qa(doc, s.productCard).slice(0, limit);
      return cards.map((card) => ({
        product_id: (card.getAttribute(config.itemIdAttr) || "").trim() || null,
        name: (q(card, s.productName)?.textContent || "").trim(),
        price: parsePrice(q(card, s.productPrice)?.textContent),
        promo_label: (q(card, s.productPromo)?.textContent || "").trim() || null,
      })).filter((p) => p.name);
    } catch {
      return [];
    }
  }

  function chooseResult(results, item) {
    if (!results.length) return null;
    let pool = results;
    if (item.product_id) {
      const exact = pool.find((r) => r.product_id && r.product_id === item.product_id);
      if (exact) return exact;
    }
    if (item.max_unit_price != null) {
      const affordable = pool.filter((r) => r.price != null && r.price <= item.max_unit_price);
      if (affordable.length) pool = affordable;
    }
    if (item.prefer_promo) {
      const promo = pool.filter((r) => r.promo_label);
      if (promo.length) pool = promo;
    }
    const priced = pool.filter((r) => r.price != null);
    if (priced.length) return priced.sort((a, b) => a.price - b.price)[0];
    return pool[0];
  }

  async function handleScrape(adapter, config) {
    if (adapter.isBlocked()) return { blocked: true };
    const cart = await adapter.readCart();
    const promos = await fetchProducts(config.urls.promos, config);
    const orders = await fetchProducts(config.urls.orders, config, 40);
    return { blocked: false, store: config.name, cart, promos, orders };
  }

  async function handleApply(adapter, config, plan, lastBotItems) {
    const log = [];
    const botItems = [];
    for (const item of plan.items || []) {
      try {
        const results = await adapter.search(item.query, { limit: 6 });
        const pick = chooseResult(results, item);
        if (!pick) {
          log.push(`introuvable : ${item.query}`);
          continue;
        }
        const ok = await adapter.addResult(pick, item.quantity || 1);
        if (ok) {
          if (pick.product_id) botItems.push(pick.product_id);
          log.push(`+ ${pick.name} ×${item.quantity || 1} — ${item.reason}`);
        } else {
          log.push(`ajout impossible : ${pick.name}`);
        }
      } catch (e) {
        log.push(`erreur sur ${item.query} : ${e.message}`);
      }
    }
    // Retire uniquement ce que le bot avait ajouté et qui n'est plus au plan.
    const stillPlanned = new Set(botItems);
    for (const oldId of lastBotItems || []) {
      if (!stillPlanned.has(oldId)) {
        const removed = await adapter.removeFromCart(oldId);
        if (removed) log.push(`− (retiré, plus au plan) ${oldId}`);
      }
    }
    const finalCart = await adapter.readCart();
    return { log, botItems, finalCart };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const adapter = currentAdapter();
    if (!adapter) {
      sendResponse({ error: "Enseigne non reconnue sur cette page." });
      return true;
    }
    const config = adapter.c;
    (async () => {
      try {
        if (msg.action === "scrape") {
          sendResponse(await handleScrape(adapter, config));
        } else if (msg.action === "apply") {
          sendResponse(await handleApply(adapter, config, msg.plan, msg.lastBotItems));
        } else if (msg.action === "ping") {
          sendResponse({ ok: true, store: config.name, blocked: adapter.isBlocked() });
        } else if (msg.action === "diagnose") {
          sendResponse(adapter.diagnose());
        } else {
          sendResponse({ error: "Action inconnue : " + msg.action });
        }
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true; // réponse asynchrone
  });
})();
