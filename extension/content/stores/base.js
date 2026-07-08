// Moteur générique d'adaptateur d'enseigne, piloté par une config de sélecteurs.
//
// ⚠️ VALIDATION REQUISE : les sélecteurs CSS de chaque enseigne (fichiers
// chronodrive.js / intermarche.js / leclerc.js) sont des points de départ.
// Les sites de drive changent souvent leur HTML : ouvre le site, inspecte le
// DOM (clic droit → Inspecter), et ajuste les sélecteurs de la config concernée.
// Le moteur ci-dessous ne change pas ; seule la config par enseigne évolue.

(function () {
  const registry = {};
  window.PanierMalin = window.PanierMalin || {};
  window.PanierMalin.registry = registry;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);

  function parsePrice(text) {
    if (!text) return null;
    const m = String(text).replace(/\s/g, "").match(/(\d+[.,]?\d*)/);
    return m ? parseFloat(m[1].replace(",", ".")) : null;
  }

  // querySelector lève une exception sur un sélecteur invalide : on l'isole
  // pour qu'un sélecteur foireux n'interrompe pas toute la liste.
  function q(root, sel) {
    if (!sel) return null;
    for (const s of [].concat(sel)) {
      try {
        const el = root.querySelector(s);
        if (el) return el;
      } catch (_) { /* sélecteur invalide, on passe au suivant */ }
    }
    return null;
  }
  function qa(root, sel) {
    const out = [];
    for (const s of [].concat(sel || [])) {
      try {
        out.push(...root.querySelectorAll(s));
      } catch (_) { /* sélecteur invalide, ignoré */ }
    }
    return out;
  }

  // --- Heuristiques de secours -------------------------------------------
  // Quand le sélecteur configuré ne trouve rien DANS une carte produit, on
  // tente une extraction générique. Ça rend l'extension utilisable avant même
  // d'avoir affiné les sélecteurs d'une enseigne.

  const PRICE_RE = /(\d{1,4})[,.](\d{2})\s*€/;

  function heuristicPrice(card) {
    const m = (card.textContent || "").match(PRICE_RE);
    return m ? parseFloat(`${m[1]}.${m[2]}`) : null;
  }

  function heuristicName(card) {
    // 1. alt d'image produit  2. title d'un lien  3. un titre  4. classes parlantes
    const img = card.querySelector("img[alt]");
    if (img && img.alt.trim().length > 3) return img.alt.trim();
    const link = card.querySelector("a[title]");
    if (link && link.title.trim().length > 3) return link.title.trim();
    const h = card.querySelector("h1,h2,h3,h4");
    if (h && h.textContent.trim().length > 3) return h.textContent.trim();
    const cls = card.querySelector(
      "[class*='name' i],[class*='title' i],[class*='libelle' i],[class*='label' i]"
    );
    if (cls && cls.textContent.trim().length > 3) return cls.textContent.trim();
    // Dernier recours : le texte de lien le plus long de la carte.
    let best = "";
    for (const a of card.querySelectorAll("a")) {
      const t = a.textContent.trim();
      if (t.length > best.length && !PRICE_RE.test(t)) best = t;
    }
    return best.length > 3 ? best : null;
  }

  function heuristicAddButton(card) {
    const buttons = [...card.querySelectorAll("button, [role='button']")];
    const byLabel = buttons.find((b) =>
      /ajout|panier|add/i.test(
        (b.getAttribute("aria-label") || "") + " " + (b.title || "") + " " + b.textContent
      )
    );
    if (byLabel) return byLabel;
    const plus = buttons.find((b) => b.textContent.trim() === "+");
    if (plus) return plus;
    return buttons.length === 1 ? buttons[0] : null;
  }

  async function waitFor(sel, { timeout = 8000, root = document } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = q(root, sel);
      if (el) return el;
      await sleep(200);
    }
    return null;
  }

  class GenericAdapter {
    constructor(config) {
      this.c = config;
      this.name = config.name;
    }

    isBlocked() {
      const hay = (document.title + " " + document.body.innerText).toLowerCase();
      return (this.c.blockMarkers || []).some((m) => hay.includes(m));
    }

    async acceptCookies() {
      const btn = q(document, this.c.selectors.cookieAccept);
      if (btn) {
        btn.click();
        await sleep(600);
      }
    }

    // Identifiant produit d'un élément : attribut sur l'élément lui-même,
    // sinon sur un descendant qui le porte.
    idOf(el) {
      const attr = this.c.itemIdAttr;
      return (
        el.getAttribute(attr) ||
        q(el, `[${attr}]`)?.getAttribute(attr) ||
        null
      );
    }

    // Lit le panier réel : [{product_id, name, quantity}]
    async readCart() {
      await this.acceptCookies();
      const s = this.c.selectors;
      const rows = qa(document, s.cartItem);
      return rows.map((row) => {
        const nameEl = q(row, s.cartItemName);
        const qtyEl = q(row, s.cartItemQty);
        const id = this.idOf(row) || nameEl?.textContent?.trim();
        return {
          product_id: (id || "").toString().trim(),
          name: (nameEl?.textContent || "").trim(),
          quantity: parseInt((qtyEl?.value ?? qtyEl?.textContent ?? "1"), 10) || 1,
        };
      }).filter((i) => i.name);
    }

    // Extrait un produit d'une carte : sélecteurs configurés d'abord,
    // heuristiques génériques en secours.
    extractProduct(card) {
      const s = this.c.selectors;
      const name =
        (q(card, s.productName)?.textContent || "").trim() || heuristicName(card);
      const price =
        parsePrice(q(card, s.productPrice)?.textContent) ?? heuristicPrice(card);
      const promoEl = q(card, s.productPromo);
      let promo_label = (promoEl?.textContent || "").trim() || null;
      if (!promo_label) {
        const badge = card.querySelector("[class*='promo' i],[class*='discount' i],[class*='remise' i]");
        promo_label = (badge?.textContent || "").trim() || null;
      }
      return { product_id: this.idOf(card), name: name || "", price, promo_label };
    }

    // Relève les promotions visibles sur la page rayon promos.
    async readPromos() {
      const cards = qa(document, this.c.selectors.productCard);
      return cards.slice(0, 120).map((card) => this.extractProduct(card)).filter((p) => p.name);
    }

    // Recherche un produit et renvoie les meilleurs résultats.
    async search(query, { limit = 6 } = {}) {
      const s = this.c.selectors;
      const input = await waitFor(s.searchInput);
      if (!input) return [];
      input.focus();
      input.value = query;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const submit = q(document, s.searchSubmit);
      if (submit) submit.click();
      else input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await waitFor(s.productCard, { timeout: 8000 });
      await sleep(800);
      const cards = qa(document, s.productCard).slice(0, limit);
      return cards.map((card) => ({ ...this.extractProduct(card), _card: card }));
    }

    async addResult(result, quantity = 1) {
      const s = this.c.selectors;
      const card = result._card;
      if (!card) return false;
      const addBtn = q(card, s.productAddButton) || heuristicAddButton(card);
      if (!addBtn) return false;
      for (let i = 0; i < quantity; i++) {
        addBtn.click();
        await sleep(rand(400, 900));
      }
      return true;
    }

    // Diagnostic : pour chaque groupe de sélecteurs, combien d'éléments la
    // page courante fournit. Sert à valider/ajuster la config d'une enseigne.
    diagnose() {
      const s = this.c.selectors;
      const count = (sel) => qa(document, sel).length;
      const found = (sel) => (q(document, sel) ? 1 : 0);

      // Quel sélecteur de carte a réellement matché ?
      let matchedCardSelector = null;
      for (const sel of [].concat(s.productCard || [])) {
        try {
          if (document.querySelector(sel)) { matchedCardSelector = sel; break; }
        } catch (_) { /* sélecteur invalide */ }
      }

      const cards = qa(document, s.productCard);
      const firstCard = cards[0] || null;

      return {
        store: this.name,
        url: location.href,
        blocked: this.isBlocked(),
        matchedCardSelector,
        checks: {
          searchInput: found(s.searchInput),
          productCard: cards.length,
          productName: count(s.productName),
          productPrice: count(s.productPrice),
          productAddButton: count(s.productAddButton),
          cartItem: count(s.cartItem),
          cartItemName: count(s.cartItemName),
          cartItemQty: count(s.cartItemQty),
          cartItemRemove: count(s.cartItemRemove),
        },
        sampleCart: qa(document, s.cartItem).slice(0, 3).map((row) => ({
          id: this.idOf(row),
          name: (q(row, s.cartItemName)?.textContent || "").trim().slice(0, 60),
        })),
        // Extraction complète (sélecteurs + heuristiques) sur les 3 premières
        // cartes : montre ce que le run utiliserait vraiment.
        sampleProducts: cards.slice(0, 3).map((card) => {
          const p = this.extractProduct(card);
          return {
            id: p.product_id,
            name: (p.name || "").slice(0, 60),
            price: p.price,
            promo: p.promo_label,
            addButton: !!(q(card, s.productAddButton) || heuristicAddButton(card)),
          };
        }),
        // HTML de la première carte (tronqué) : à copier-coller pour affiner
        // les sélecteurs sans ouvrir les DevTools.
        firstCardHTML: firstCard ? firstCard.outerHTML.slice(0, 2500) : null,
      };
    }

    async removeFromCart(productId) {
      const s = this.c.selectors;
      const rows = qa(document, s.cartItem);
      for (const row of rows) {
        const id = this.idOf(row);
        if ((id || "").toString().trim() === productId) {
          const rm = q(row, s.cartItemRemove);
          if (rm) {
            rm.click();
            await sleep(rand(500, 1000));
            return true;
          }
        }
      }
      return false;
    }
  }

  window.PanierMalin.GenericAdapter = GenericAdapter;
  window.PanierMalin.helpers = { sleep, rand, parsePrice, q, qa, waitFor };
  window.PanierMalin.register = (config) => {
    registry[config.name] = config;
  };
  window.PanierMalin.detect = () => {
    const host = location.hostname;
    return Object.values(registry).find((c) => host.includes(c.hostMatch)) || null;
  };
})();
