// Leclerc Drive — https://www.leclercdrive.fr
// ⚠️ Sélecteurs à VALIDER sur le site réel (voir base.js).
// Note : Leclerc Drive est protégé par Datadome ; l'extension tournant dans TA
// session/navigateur, l'anti-bot n'est pas un obstacle (c'est toi qui navigues).

window.PanierMalin.register({
  name: "leclerc",
  hostMatch: "leclercdrive.fr",
  blockMarkers: ["datadome", "captcha-delivery", "accès refusé"],
  urls: {
    promos: "https://www.leclercdrive.fr/promotions",
    cart: "https://www.leclercdrive.fr/mon-panier",
    orders: "https://www.leclercdrive.fr/mes-commandes",
  },
  itemIdAttr: "data-ean",
  selectors: {
    cookieAccept: ["#onetrust-accept-btn-handler", "button[aria-label*='ccepter']"],
    cartItem: [".ligne-panier", "[data-testid='cart-line']"],
    cartItemName: [".libelle-produit", ".product-name"],
    cartItemQty: ["input.quantite", "[data-testid='qty-input']"],
    cartItemId: ["[data-ean]"],
    cartItemRemove: ["button.supprimer", "button[aria-label*='upprimer']"],
    searchInput: ["input[type='search']", "input[name='texteRecherche']"],
    searchSubmit: ["button.rechercher", "button[type='submit']"],
    productCard: [".vignette-produit", "[data-testid='product-card']"],
    productName: [".libelle-produit", ".product-name"],
    productPrice: [".prix", ".price"],
    productPromo: [".promo", ".badge-promo"],
    productAddButton: ["button.ajouter-panier", "button[aria-label*='jouter']"],
  },
});
