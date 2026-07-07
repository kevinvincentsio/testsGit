// Intermarché Drive — https://www.intermarche.com
// ⚠️ Sélecteurs à VALIDER sur le site réel (voir base.js).

window.PanierMalin.register({
  name: "intermarche",
  hostMatch: "intermarche.com",
  blockMarkers: ["px-captcha", "perimeterx", "accès refusé", "vous n'êtes pas un robot"],
  urls: {
    promos: "https://www.intermarche.com/promotions",
    cart: "https://www.intermarche.com/panier",
    orders: "https://www.intermarche.com/mon-compte/mes-commandes",
  },
  itemIdAttr: "data-product-id",
  selectors: {
    cookieAccept: ["#onetrust-accept-btn-handler", "button[aria-label*='ccepter']"],
    cartItem: [".basket-item", "[data-testid='cart-line']"],
    cartItemName: [".product-name", "[data-testid='product-name']"],
    cartItemQty: ["input.quantity", "[data-testid='qty-input']"],
    cartItemId: ["[data-product-id]"],
    cartItemRemove: ["button[aria-label*='upprimer']", "[data-testid='remove']"],
    searchInput: ["input[type='search']", "input[name='q']"],
    searchSubmit: ["button[type='submit'][aria-label*='echerch']"],
    productCard: [".product-item", "[data-testid='product-card']", "article.product"],
    productName: [".product-item__name", "[data-testid='product-name']"],
    productPrice: [".product-item__price", ".price", "[data-testid='price']"],
    productPromo: [".promo", ".badge-promo"],
    productAddButton: ["button.add-to-cart", "[data-testid='add-to-cart']", "button[aria-label*='jouter']"],
  },
});
