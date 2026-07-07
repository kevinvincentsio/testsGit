// Chronodrive — https://www.chronodrive.com
// ⚠️ Sélecteurs à VALIDER sur le site réel (voir base.js). Enseigne prioritaire.

window.PanierMalin.register({
  name: "chronodrive",
  hostMatch: "chronodrive.com",
  blockMarkers: ["datadome", "captcha-delivery", "accès refusé", "vous n'êtes pas un robot"],
  urls: {
    promos: "https://www.chronodrive.com/promotions",
    cart: "https://www.chronodrive.com/panier",
    orders: "https://www.chronodrive.com/mes-commandes",
  },
  // Attribut portant l'identifiant produit sur les cartes / lignes de panier.
  itemIdAttr: "data-product-id",
  selectors: {
    cookieAccept: ["#onetrust-accept-btn-handler", "button[aria-label*='ccepter']", "button[title*='ccepter']"],
    // Panier
    cartItem: [".cart-item", "[data-testid='cart-line']", "li.basket-item"],
    cartItemName: [".cart-item__name", ".product-name", "[data-testid='product-name']"],
    cartItemQty: ["input.quantity", ".cart-item__qty input", "[data-testid='qty-input']"],
    cartItemId: ["[data-product-id]"],
    cartItemRemove: [".cart-item__remove", "button[aria-label*='upprimer']", "[data-testid='remove']"],
    // Recherche / rayon / promos
    searchInput: ["input[type='search']", "#search-input", "input[name='q']"],
    searchSubmit: ["button[type='submit'][aria-label*='echerch']", ".search__submit"],
    productCard: [".product-card", "[data-testid='product-card']", "article.product"],
    productName: [".product-card__name", ".product-title", "[data-testid='product-name']"],
    productPrice: [".product-card__price", ".price", "[data-testid='price']"],
    productPromo: [".product-card__promo", ".promo-flag", ".badge-promo"],
    productAddButton: ["button.add-to-cart", "[data-testid='add-to-cart']", "button[aria-label*='jouter']"],
  },
});
