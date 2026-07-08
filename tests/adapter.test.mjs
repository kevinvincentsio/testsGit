// Tests DOM du moteur d'adaptateur (GenericAdapter) contre la page fixture.
// Lancer : node tests/adapter.test.mjs   (nécessite `npm install --no-save jsdom`)

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const here = dirname(fileURLToPath(import.meta.url));
const ext = join(here, "..", "extension");

function loadDom(html, url) {
  const dom = new JSDOM(html, { url, runScripts: "outside-only" });
  for (const file of ["content/stores/base.js", "content/stores/chronodrive.js"]) {
    dom.window.eval(readFileSync(join(ext, file), "utf-8"));
  }
  return dom;
}

const fixture = readFileSync(join(here, "fixture-drive.html"), "utf-8");
const dom = loadDom(fixture, "https://www.chronodrive.com/panier");
const PM = dom.window.PanierMalin;

// 1. Détection d'enseigne par hostname
const config = PM.detect();
assert.equal(config?.name, "chronodrive", "détection Chronodrive par hostname");

const adapter = new PM.GenericAdapter(config);

// 2. Pas de blocage sur une page normale
assert.equal(adapter.isBlocked(), false, "page normale non bloquée");

// Les objets viennent du realm jsdom (autre Object.prototype) : on les
// normalise pour pouvoir utiliser deepStrictEqual.
const plain = (v) => JSON.parse(JSON.stringify(v));

// 3. Lecture du panier
const cart = plain(await adapter.readCart());
assert.equal(cart.length, 2, "2 lignes de panier lues");
assert.deepEqual(cart[0], { product_id: "P100", name: "Lait demi-écrémé 1L", quantity: 6 });
assert.equal(cart[1].quantity, 1);

// 4. Lecture des promos (cartes produit + prix FR "1,49 €")
const promos = plain(await adapter.readPromos());
assert.equal(promos.length, 2, "2 cartes produit lues");
assert.equal(promos[0].price, 1.49, "prix français parsé");
assert.equal(promos[0].promo_label, "-30%");
assert.equal(promos[1].promo_label, null, "pas de promo sur la 2e carte");

// 5. Suppression d'une ligne du panier (le clic est bien émis)
let removed = false;
dom.window.document
  .querySelector("[data-product-id='P200'] .cart-item__remove")
  .addEventListener("click", () => {
    removed = true;
    dom.window.document.querySelector("li[data-product-id='P200']").remove();
  });
const ok = await adapter.removeFromCart("P200");
assert.equal(ok, true, "removeFromCart trouve et clique");
assert.equal(removed, true, "clic Supprimer émis");
assert.equal((await adapter.readCart()).length, 1, "panier réduit à 1 ligne");

// 6. Diagnostic : tous les groupes clés trouvés sur la fixture
const diag = adapter.diagnose();
assert.equal(diag.store, "chronodrive");
assert.equal(diag.blocked, false);
assert.ok(diag.checks.searchInput >= 1, "champ de recherche trouvé");
assert.ok(diag.checks.productCard === 2, "cartes produit comptées");
assert.ok(diag.checks.cartItem === 1, "lignes panier comptées (après suppression)");
assert.equal(diag.sampleProducts[0].name, "Courge butternut");

// 7. Détection de blocage anti-bot
const blockedDom = loadDom(
  "<html><head><title>Accès refusé</title></head><body>Vérification datadome en cours…</body></html>",
  "https://www.chronodrive.com/"
);
const blockedAdapter = new blockedDom.window.PanierMalin.GenericAdapter(
  blockedDom.window.PanierMalin.detect()
);
assert.equal(blockedAdapter.isBlocked(), true, "page Datadome détectée comme bloquée");

// 8. Un sélecteur invalide dans une config ne casse pas la lecture
const weirdDom = loadDom(fixture, "https://www.chronodrive.com/panier");
const weirdConfig = weirdDom.window.PanierMalin.detect();
weirdConfig.selectors.cartItemName = [":::invalid:::", ".cart-item__name"];
const weirdCart = await new weirdDom.window.PanierMalin.GenericAdapter(weirdConfig).readCart();
assert.equal(weirdCart[0].name, "Lait demi-écrémé 1L", "sélecteur invalide ignoré sans casser");

// 9. Heuristiques de secours : carte avec classes inconnues (cas Chronodrive
//    réel — les cartes matchent mais rien à l'intérieur).
const heuristicFixture = `<!doctype html><html><head><title>Rayon</title></head><body>
  <input type="search" name="q" />
  <article class="product-card" data-product-id="H1">
    <a href="/p/h1"><img alt="Yaourt nature x8" src="y.jpg" /></a>
    <div class="xyz-obscure-1">Bio</div>
    <div class="xyz-obscure-2">2,15 €</div>
    <div class="xyz-remise">-25%</div>
    <button aria-label="Ajouter au panier">+</button>
  </article>
</body></html>`;
const hDom = loadDom(heuristicFixture, "https://www.chronodrive.com/rayon");
const hPM = hDom.window.PanierMalin;
const hConfig = hPM.detect();
// Simule des sélecteurs internes qui ne matchent pas (comme sur le vrai site).
hConfig.selectors.productName = [".does-not-exist"];
hConfig.selectors.productPrice = [".does-not-exist"];
hConfig.selectors.productPromo = [".does-not-exist"];
hConfig.selectors.productAddButton = [".does-not-exist"];
const hAdapter = new hPM.GenericAdapter(hConfig);
const hPromos = plain(await hAdapter.readPromos());
assert.equal(hPromos.length, 1, "carte extraite malgré les sélecteurs KO");
assert.equal(hPromos[0].name, "Yaourt nature x8", "nom via alt d'image");
assert.equal(hPromos[0].price, 2.15, "prix via motif '2,15 €'");
assert.equal(hPromos[0].promo_label, "-25%", "promo via classe *remise*");
assert.equal(hPromos[0].product_id, "H1");

// 10. Le diagnostic reflète l'extraction réelle (heuristiques incluses)
const hDiag = plain(hAdapter.diagnose());
assert.equal(hDiag.matchedCardSelector, ".product-card", "sélecteur de carte identifié");
assert.equal(hDiag.checks.productName, 0, "sélecteur nom KO signalé");
assert.equal(hDiag.sampleProducts[0].name, "Yaourt nature x8", "mais extraction OK");
assert.equal(hDiag.sampleProducts[0].addButton, true, "bouton Ajouter trouvé par libellé");
assert.ok(hDiag.firstCardHTML.includes("data-product-id=\"H1\""), "HTML de carte exposé");

console.log("✓ 10 groupes d'assertions passés — moteur d'adaptateur OK");
