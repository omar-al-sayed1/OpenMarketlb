/**
 * Map a notification to the in-app destination for the current role.
 *
 * Notifications carry an optional web-style `link` ("/shop/wallet") and a `type`
 * ("order" | "wallet" | "subscription" | "shop" | "agent" | "employee" | "delivery"
 *  | "message" | "ads" | "bonus" | "system"). We route by explicit web link first,
 * then fall back to the type, resolved per role because each dashboard is its own
 * navigator with its own screen names.
 *
 * Returns { screen, params } or null (null = no sensible target; just mark read).
 */

// Explicit web links the backend already emits → mobile screens, per role.
const LINK_MAP = {
  admin: {
    '/admin/advertising': 'AdminAdvertising',
    '/admin/cashout-requests': 'AdminPayouts',
    '/admin/shops': 'AdminShops',
  },
  shop: {
    '/shop/wallet': 'ShopWallet',
  },
};

// type → screen, per role. Screens verified against each role's navigator.
const TYPE_MAP = {
  admin: {
    order: 'AdminOrders', wallet: 'AdminFinance', subscription: 'AdminSubscriptionTiers',
    shop: 'AdminShops', agent: 'AdminAgents', employee: 'AdminEmployees',
    delivery: 'AdminOrders', message: 'AdminMessages', ads: 'AdminAdvertising',
    bonus: 'AdminHome', system: 'AdminHome',
  },
  shop: {
    order: 'ShopOrders', wallet: 'ShopWallet', subscription: 'ShopSettings',
    message: 'ShopMessages', ads: 'ShopAdvertising', bonus: 'ShopGifts',
    shop: 'ShopHome', system: 'ShopHome',
  },
  agent: {
    wallet: 'AgentWallet', agent: 'AgentCommissions', shop: 'AgentReferredShops',
    message: 'AgentMessages', bonus: 'AgentHome', system: 'AgentHome',
  },
  // Delivery is a single full-screen cockpit and employees use a menu dashboard —
  // no per-notification sub-screen, so these mark-read without navigating.
  delivery: {},
  employee: {},
};

export function notificationTarget(role, item) {
  if (!item) return null;
  const linkMap = LINK_MAP[role] || {};
  const typeMap = TYPE_MAP[role] || {};

  if (item.link && linkMap[item.link]) return { screen: linkMap[item.link], params: undefined };
  const screen = typeMap[item.type];
  if (screen) return { screen, params: item.order_id ? { focusOrderId: item.order_id } : undefined };
  return null;
}

// Per-type visual identity for the notification list (icon + tint pair).
export const NOTIF_STYLE = {
  order: { icon: 'bag-check', tint: '#2563eb', soft: '#eff6ff' },
  wallet: { icon: 'wallet', tint: '#059669', soft: '#ecfdf5' },
  subscription: { icon: 'ribbon', tint: '#7c3aed', soft: '#f5f3ff' },
  shop: { icon: 'storefront', tint: '#0891b2', soft: '#ecfeff' },
  agent: { icon: 'people', tint: '#db2777', soft: '#fdf2f8' },
  employee: { icon: 'id-card', tint: '#4f46e5', soft: '#eef2ff' },
  delivery: { icon: 'bicycle', tint: '#ea580c', soft: '#fff7ed' },
  message: { icon: 'chatbubble-ellipses', tint: '#0d9488', soft: '#f0fdfa' },
  ads: { icon: 'megaphone', tint: '#e11d48', soft: '#fff1f2' },
  bonus: { icon: 'gift', tint: '#d97706', soft: '#fffbeb' },
  system: { icon: 'information-circle', tint: '#475569', soft: '#f1f5f9' },
};

export const notifStyle = (type) => NOTIF_STYLE[type] || NOTIF_STYLE.system;
