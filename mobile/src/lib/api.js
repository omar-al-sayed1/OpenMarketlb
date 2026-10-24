import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

export const client = axios.create({ baseURL: API_BASE_URL, timeout: 20000 });

// Uploads get their own budget: 20s is fine for JSON but far too short for a file
// on a weak mobile connection. Images are shrunk client-side first (lib/imagePick),
// so this ceiling is really for large documents, not photos.
const UPLOAD_TIMEOUT = 300000; // 5 minutes

// In-memory auth token (set by AuthContext on login / boot). Persisted separately.
let authToken = null;
export const setAuthToken = (token) => {
  authToken = token || null;
};
export const getAuthToken = () => authToken;

client.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Stable guest session id for the cart (mirrors the web app's localStorage id).
let sessionIdCache = null;
export async function getSessionId() {
  if (sessionIdCache) return sessionIdCache;
  let id = await AsyncStorage.getItem('session_id');
  if (!id) {
    id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await AsyncStorage.setItem('session_id', id);
  }
  sessionIdCache = id;
  return id;
}

const guestParams = async () => (authToken ? {} : { session_id: await getSessionId() });

export const api = {
  auth: {
    login: (data) => client.post('/auth/login', data),
    signup: (data) => client.post('/auth/signup', data),
    me: () => client.get('/auth/me'),
    googleLogin: (intent, mobileRedirect) => client.get('/auth/google/login', { params: { intent, mobile_redirect: mobileRedirect } }),
    // Complete a NEW Google account in-app (instead of bouncing to the website):
    googlePending: (pendingId) => client.get(`/auth/google/pending/${pendingId}`),
    googleOtpSend: (pendingId, phone) => client.post('/auth/google/otp/send', { pending_id: pendingId, phone }),
    googleOtpVerify: (pendingId, phone, code) => client.post('/auth/google/otp/verify', { pending_id: pendingId, phone, code }),
    googleComplete: (data) => client.post('/auth/google/complete', data),
  },
  categories: {
    getAll: (activeOnly = false) => client.get('/categories', { params: { active_only: activeOnly } }),
    getTree: (activeOnly = false) => client.get('/categories/tree', { params: { active_only: activeOnly } }),
    getChildrenWithPreview: (categoryId) => client.get(`/categories/${categoryId}/children-with-preview`),
    getTopLevelWithPreview: () => client.get('/categories/top-level-with-preview'),
    create: (data) => client.post('/categories', data),
    update: (id, data) => client.put(`/categories/${id}`, data),
    delete: (id) => client.delete(`/categories/${id}`),
  },
  products: {
    getAll: (params) => client.get('/products', { params }),
    getById: (id) => client.get(`/products/${id}`),
    getVariantSummary: (params) => client.get('/products/variant-summary', { params }),
    getWithGifts: () => client.get('/products/with-gifts'),
    update: (id, data) => client.put(`/products/${id}`, data),
    delete: (id) => client.delete(`/products/${id}`),
  },
  shops: {
    getAll: () => client.get('/shops'),
    getById: (id) => client.get(`/shops/${id}`),
    getByState: (state) => client.get(`/shops/by-state/${encodeURIComponent(state)}`),
    getProducts: (id) => client.get(`/shops/${id}/products`),
    getActiveSale: (id) => client.get(`/shops/${id}/active-sale`),
    getGallery: (id) => client.get(`/shops/${id}/gallery`),
    getMap: () => client.get('/shops/map'),
  },
  promotions: {
    getActive: (params) => client.get('/promotions/active', { params }),
  },
  reviews: {
    getByProduct: (productId) => client.get(`/products/${productId}/reviews`),
    create: (productId, data) => client.post(`/products/${productId}/reviews`, data),
    markHelpful: (reviewId) => client.put(`/reviews/${reviewId}/helpful`, {}),
  },
  tracking: {
    view: async (productId) => client.post('/track/view', { product_id: productId, ...(await guestParams()) }),
  },
  typeImages: {
    get: () => client.get('/type-images'),
  },
  contact: {
    send: (data) => client.post('/contact', data),
  },
  wishlist: {
    get: async () => client.get('/wishlist', { params: await guestParams() }),
    add: async (productId) => client.post(`/wishlist/${productId}`, {}, { params: await guestParams() }),
    remove: async (productId) => client.delete(`/wishlist/${productId}`, { params: await guestParams() }),
  },
  settings: {
    get: () => client.get('/settings'),
    getPlatform: () => client.get('/platform-settings'),
  },
  publicStats: {
    get: () => client.get('/stats/public'),
  },
  teamMembers: {
    getAll: () => client.get('/team-members'),
  },
  testimonials: {
    getAll: () => client.get('/testimonials'),
  },
  aboutPage: {
    get: () => client.get('/about-page'),
  },
  states: {
    getAll: () => client.get('/states', { params: { active_only: true } }),
  },
  users: {
    getWalletInfo: () => client.get('/user/wallet-info'),
  },
  savedLocations: {
    getAll: () => client.get('/user/saved-locations'),
    save: (data) => client.post('/user/saved-locations', data),
  },
  geocode: {
    reverse: (lat, lng) => client.get('/geocode/reverse', { params: { lat, lng } }),
    search: (q) => client.get('/geocode/search', { params: { q } }),
  },
  banners: {
    getHome: () => client.get('/home-banners'),
  },
  cart: {
    get: async () => client.get('/cart', { params: await guestParams() }),
    add: async (data) => client.post('/cart', data, { params: await guestParams() }),
    update: async (data) => client.put('/cart', data, { params: await guestParams() }),
    remove: async (productId) => client.delete(`/cart/${productId}`, { params: await guestParams() }),
  },
  orders: {
    getAll: () => client.get('/orders'),
    updateStatus: (id, status) => client.put(`/orders/${id}/status`, {}, { params: { order_status: status } }),
    create: async (data) => client.post('/orders', data, { params: await guestParams() }),
    getById: (id) => client.get(`/orders/${id}`),
    track: (id) => client.get(`/orders/track/${id}`),
    cancel: (id) => client.post(`/orders/${id}/cancel`, {}),
    requestCancel: (id, reason) => client.post(`/orders/${id}/cancel-request`, { reason }),
    getCancelRequestStatus: (id) => client.get(`/orders/${id}/cancel-request-status`),
  },
  messages: {
    getConversations: () => client.get('/messages/conversations'),
    getConversation: (conversationId) => client.get(`/messages/conversation/${conversationId}`),
    send: (data) => client.post('/messages/send', data),
    edit: (id, message) => client.put(`/messages/${id}`, { message }),
    remove: (id) => client.delete(`/messages/${id}`),
    markAsRead: (messageId) => client.put(`/messages/${messageId}/read`, {}),
    getUnreadCount: () => client.get('/messages/unread-count'),
    getShopsList: () => client.get('/shops/list'),
    getUsersList: () => client.get('/users/list'),
    uploadAttachment: (file) => {
      const form = new FormData();
      form.append('file', { uri: file.uri, name: file.name || 'upload', type: file.mimeType || file.type || 'application/octet-stream' });
      return client.post('/upload/attachment', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: UPLOAD_TIMEOUT });
    },
    // Admin oversight
    adminGetConversations: () => client.get('/admin/conversations'),
    adminGetConversation: (conversationId) => client.get(`/admin/conversations/${conversationId}`),
    adminDeleteMessage: (id) => client.delete(`/admin/messages/${id}`),
  },
  loyalty: {
    getStatus: () => client.get('/loyalty/me'),
    redeemPreview: (points, cartTotal) => client.post('/loyalty/redeem/preview', { points_to_redeem: points, cart_total: cartTotal }),
  },
  otp: {
    send: (phoneNumber) => client.post('/otp/send', { phone_number: phoneNumber }),
    verify: (phoneNumber, code) => client.post('/otp/verify', { phone_number: phoneNumber, code }),
  },
  tos: {
    get: () => client.get('/tos'),
  },
  payment: {
    createCheckout: (orderId, originUrl) => client.post('/payment/checkout', null, { params: { order_id: orderId, origin_url: originUrl } }),
  },
  admin: {
    getBadgeCounts: () => client.get('/admin/badge-counts'),
    getAnalytics: () => client.get('/admin/analytics'),
    getRevenue: () => client.get('/admin/revenue'),
    getShops: (payment_method) => client.get('/admin/shops', { params: { payment_method } }),
    adjustRevenue: (data) => client.put('/admin/revenue/adjust', data),
    resetRevenue: () => client.post('/admin/reset-revenue', {}),
    getRevenueAdjustments: () => client.get('/admin/revenue/adjustments'),
    getMonthlyAnalytics: () => client.get('/admin/revenue/monthly-analytics'),
    // PDF report — downloaded natively with FileSystem (needs the raw endpoint + token)
    reportPdfPath: '/admin/report/pdf',
    getFinanceCenter: (params = {}) => client.get('/admin/finance-center', { params }),
    getFinanceTimeseries: (year) => client.get('/admin/finance-center/timeseries', { params: year ? { year } : {} }),
    getFinanceTransactions: (type, page = 1, limit = 50) => client.get('/admin/finance/transactions', { params: { type, page, limit } }),
    getRevenueCashouts: () => client.get('/admin/revenue/cashouts'),
    cashoutRevenue: (data) => client.post('/admin/revenue/cashout', data),
    releaseDeliveryFee: (feeId) => client.post(`/admin/delivery-fees/${feeId}/release`, {}),
    settleDeliveryCash: (orderId) => client.post(`/admin/delivery-cash/settle/${orderId}`, {}),
    settleDeliveryCashBulk: (deliveryUserId) => client.post('/admin/delivery-cash/settle-bulk', { delivery_user_id: deliveryUserId }),
    // Finance CSV export — downloaded natively with FileSystem (blob endpoint + token)
    financeCsvPath: '/admin/finance/export-csv',
    getAllProducts: () => client.get('/admin/products-all'),
    getShopProducts: (id) => client.get(`/admin/shops/${id}/products`),
    getShopOrders: (id) => client.get(`/admin/shops/${id}/orders`),
    // Admin product write endpoints (require_admin). createProduct takes shop_id in
    // the body to target a specific shop; the server looks up + fills shop_name.
    createProduct: (data) => client.post('/products', data),
    updateProduct: (id, data) => client.put(`/products/${id}`, data),
    deleteProduct: (id) => client.delete(`/products/${id}`),
    getShopAnalytics: (id) => client.get(`/admin/shops/${id}/analytics`),
    updateShopSubscription: (id, data) => {
      const params = {};
      if (data.subscription_end) params.subscription_end = data.subscription_end;
      if (data.subscription_status !== undefined) params.subscription_status = data.subscription_status;
      if (data.payment_amount) params.payment_amount = data.payment_amount;
      return client.put(`/admin/shops/${id}/update-subscription`, null, { params });
    },
    updateShopCommission: (id, commission_percentage) => client.put(`/admin/shops/${id}/commission`, null, { params: { commission_percentage } }),
    decreaseFunds: (shopId, amount, note) => client.put(`/admin/shops/${shopId}/wallet/decrease`, { amount, note }),
    getShopWallet: (shopId) => client.get(`/admin/shops/${shopId}/wallet`),
    getOrderDetails: (id) => client.get(`/admin/orders/${id}/details`),
    approveShop: (id, params = {}) => client.put(`/admin/shops/${id}/approve`, {}, { params: { months: 1, subscription_required: true, commission_type: 'on_customer', ...params } }),
    suspendShop: (id) => client.put(`/admin/shops/${id}/suspend`, {}),
    verifyShop: (id) => client.put(`/admin/shops/${id}/verify`, {}),
    unverifyShop: (id) => client.put(`/admin/shops/${id}/unverify`, {}),
    deleteShop: (id) => client.delete(`/admin/shops/${id}`),
    updateShop: (id, data) => client.put(`/admin/shops/${id}`, data),
    getMap: () => client.get('/shops/map'),
    // ---- Requests hub ----
    getCancelRequests: (status) => client.get('/admin/cancel-requests', { params: status ? { status } : {} }),
    approveCancelRequest: (id, note) => client.post(`/admin/cancel-requests/${id}/approve`, { admin_note: note || '' }),
    rejectCancelRequest: (id, note) => client.post(`/admin/cancel-requests/${id}/reject`, { admin_note: note || '' }),
    getVerificationRequests: (status) => client.get('/admin/verification-requests', { params: status ? { status } : {} }),
    approveVerification: (shopId) => client.put(`/admin/verification-requests/${shopId}/approve`, {}),
    rejectVerification: (shopId, reason) => client.put(`/admin/verification-requests/${shopId}/reject`, {}, { params: { reason: reason || '' } }),
    getAgentCashouts: (status) => client.get('/admin/agent-cashout-requests', { params: status ? { status } : {} }),
    approveAgentCashout: (id) => client.post(`/admin/agent-cashout-requests/${id}/approve`, {}),
    rejectAgentCashout: (id, reason) => client.post(`/admin/agent-cashout-requests/${id}/reject`, { reason: reason || '' }),
    getCashoutRequests: (status) => client.get('/admin/cashout-requests', { params: status ? { status } : {} }),
    approveCashout: (id) => client.put(`/admin/cashout-requests/${id}/approve`, {}),
    rejectCashout: (id, reason) => client.put(`/admin/cashout-requests/${id}/reject`, { reason: reason || '' }),
    getWalletRequests: (status) => client.get('/admin/wallet/requests', { params: status ? { status } : {} }),
    addFunds: (shopId, amount, note) => client.put(`/admin/shops/${shopId}/wallet/add`, { amount, note }),
    getShopSales: () => client.get('/admin/shop-sales'),
    deleteShopSale: (id) => client.delete(`/admin/shop-sales/${id}`),
    // ---- People & Money ----
    getUsers: () => client.get('/admin/users'),
    updateUser: (id, data) => client.put(`/admin/users/${id}`, data),
    deleteUser: (id) => client.delete(`/admin/users/${id}`),
    updateUserPoints: (id, data) => client.put(`/admin/users/${id}/points`, data),
    getUserOrders: (id) => client.get(`/admin/users/${id}/orders`),
    listReferralAgents: () => client.get('/admin/agents'),
    createReferralAgent: (data) => client.post('/admin/agents', data),
    updateReferralAgent: (id, data) => client.put(`/admin/agents/${id}`, data),
    deleteReferralAgent: (id) => client.delete(`/admin/agents/${id}`),
    getReferralAgentReferredShops: (id) => client.get(`/admin/agents/${id}/referred-shops`),
    listEmployees: () => client.get('/admin/employees'),
    getAvailableEmployeePages: () => client.get('/admin/employees/available-pages'),
    createEmployee: (data) => client.post('/admin/employees', data),
    updateEmployee: (id, data) => client.put(`/admin/employees/${id}`, data),
    setEmployeePages: (id, allowed_pages) => client.put(`/admin/employees/${id}/pages`, { allowed_pages }),
    deleteEmployee: (id) => client.delete(`/admin/employees/${id}`),
    getPendingPayouts: () => client.get('/admin/payouts/pending'),
    markPayoutPaid: (shopId) => client.post(`/admin/payouts/mark-paid/${shopId}`, {}),
    getAgentPayouts: () => client.get('/admin/agent-payouts'),
    // ---- Communications ----
    getContactMessages: () => client.get('/admin/contact-messages'),
    updateMessageStatus: (id, status) => client.put(`/admin/contact-messages/${id}/status`, {}, { params: { status } }),
    // ---- Growth: themes / gallery / settings ----
    getStorefrontThemes: () => client.get('/admin/storefront/themes'),
    updateStorefrontTheme: (key, data) => client.put(`/admin/storefront/themes/${key}`, data),
    setThemeSalePercent: (percent) => client.put('/admin/theme-sale-percent', { theme_sale_percent: percent }),
    getAllGallery: () => client.get('/admin/gallery/all'),
    deleteShopGalleryPhoto: (shopId, photoId) => client.delete(`/admin/gallery/${shopId}/${photoId}`),
    setGalleryPhotoStatus: (shopId, photoId, status) => client.put(`/admin/gallery/${shopId}/${photoId}/status`, { status }),
    getPlatformSettings: () => client.get('/platform-settings'),
    // ---- Control room: settings & database ----
    updatePlatformSettings: (data) => client.put('/admin/platform-settings', data),
    updateSettings: (data) => client.put('/admin/settings', data),
    updateProfile: (data) => client.put('/admin/profile', data),
    updateTypeImages: (images) => client.put('/admin/type-images', images),
    getDatabaseOverview: () => client.get('/admin/database/overview'),
    getDatabaseCollection: (name, page = 1, limit = 25, search = '') => client.get(`/admin/database/collection/${name}`, { params: { page, limit, search } }),
  },
  adminPromotions: {
    getAll: (status) => client.get('/admin/promotions', { params: status ? { status } : {} }),
  },
  adminLoyalty: {
    getSettings: () => client.get('/admin/loyalty/settings'),
    updateSettings: (data) => client.put('/admin/loyalty/settings', data),
    getAnalytics: () => client.get('/admin/loyalty/analytics'),
    addBonusEvent: (data) => client.post('/admin/loyalty/bonus-event', data),
    deleteBonusEvent: (id) => client.delete(`/admin/loyalty/bonus-event/${id}`),
  },
  adminSpin: {
    getSettings: () => client.get('/admin/spin/settings'),
    updateSettings: (data) => client.put('/admin/spin/settings', data),
    getHistory: () => client.get('/admin/spin/history'),
    grantFreeSpins: (data) => client.post('/admin/spin/grant-free-spin', data),
  },
  adminSubscriptionTiers: {
    get: () => client.get('/admin/subscription-tiers'),
    update: (data) => client.put('/admin/subscription-tiers', data),
  },
  guestApplications: {
    getAll: (status) => client.get('/admin/guest-applications', { params: status ? { status } : {} }),
    update: (id, data) => client.put(`/admin/guest-applications/${id}`, data),
    approve: (id, data) => client.post(`/admin/guest-applications/${id}/approve`, data),
    reject: (id) => client.delete(`/admin/guest-applications/${id}`),
  },
  adminTier: {
    setShopTier: (shopId, tier) => client.put(`/admin/shops/${shopId}/tier`, { tier }),
    getUpgradeRequests: (status) => client.get('/admin/tier-upgrade-requests', { params: status ? { status } : {} }),
    approveUpgrade: (requestId, note) => client.put(`/admin/tier-upgrade-requests/${requestId}/approve`, { admin_note: note || '' }),
    rejectUpgrade: (requestId, note) => client.put(`/admin/tier-upgrade-requests/${requestId}/reject`, { admin_note: note || '' }),
  },
  adminEvents: {
    getAll: () => client.get('/admin/events'),
    create: (data) => client.post('/admin/events', data),
    update: (id, data) => client.put(`/admin/events/${id}`, data),
    delete: (id) => client.delete(`/admin/events/${id}`),
  },
  adminAds: {
    overview: () => client.get('/admin/advertising/overview'),
    updateSettings: (data) => client.put('/admin/advertising/settings', data),
    campaigns: (params) => client.get('/admin/advertising/campaigns', { params }),
    events: () => client.get('/admin/advertising/events'),
    updateEventSponsorship: (id, data) => client.put(`/admin/advertising/events/${id}/sponsorship`, data),
    removeEventSponsor: (id) => client.delete(`/admin/advertising/events/${id}/sponsor`),
    clicks: (limit) => client.get('/admin/advertising/clicks', { params: { limit: limit || 100 } }),
  },
  adminWallet: {
    runMonthlyCredit: () => client.post('/admin/wallet/monthly-credit', {}),
  },
  themeSale: {
    get: () => client.get('/theme-sale-info'),
  },
  shop: {
    getBadgeCounts: () => client.get('/shop/badge-counts'),
    getProfile: () => client.get('/shop/profile'),
    updateProfile: (data) => client.put('/shop/profile', data),
    register: (data) => client.post('/shop/register', data),
    registerGuest: (data) => client.post('/shop/register-guest', data),
    getStatus: () => client.get('/shop/status'),
    getSubscription: () => client.get('/shop/subscription'),
    getSubscriptionPricing: () => client.get('/shop/subscription-pricing'),
    startTrial: () => client.post('/shop/start-trial', {}),
    subscribe: (paymentMethod, months = 1) => client.post('/shop/subscribe', null, { params: { payment_method: paymentMethod, months } }),
    renewSubscription: () => client.post('/shop/renew-subscription', {}),
    getWelcomePopup: () => client.get('/shop/welcome-popup'),
    dismissWelcomePopup: () => client.post('/shop/welcome-popup/dismiss', {}),
    getOnboardingStatus: () => client.get('/shop/onboarding-status'),
    // Location
    getLocation: () => client.get('/shop/location'),
    updateLocation: (data) => client.put('/shop/location', data),
    // Verification
    getVerificationStatus: () => client.get('/shop/verification/status'),
    sendVerificationEmail: () => client.post('/shop/verification/email/send-code', {}),
    verifyEmail: (code) => client.post('/shop/verification/email/verify', null, { params: { code } }),
    uploadVerificationDocument: (file, docType) => {
      const form = new FormData();
      form.append('file', { uri: file.uri, name: file.name || 'document.jpg', type: file.mimeType || 'image/jpeg' });
      return client.post('/shop/verification/document/upload', form, {
        params: { doc_type: docType || 'id_front' },
        headers: { 'Content-Type': 'multipart/form-data' }, timeout: UPLOAD_TIMEOUT,
      });
    },
    deleteVerificationDocument: (docType) => client.delete(`/shop/verification/document/${docType}`),
    submitVerification: () => client.post('/shop/verification/submit', {}),
    // Subscription auto-renew
    getSubscriptionStatus: () => client.get('/shop/subscription/status'),
    toggleAutoRenew: (data) => client.post('/shop/subscription/auto-renew', data),
    renewNow: (data) => client.post('/shop/subscription/renew-now', data),
    cancelSubscription: () => client.post('/shop/cancel-subscription', {}),
    getAnalytics: () => client.get('/shop/analytics'),
    getOrders: () => client.get('/shop/orders'),
    updateOrderStatus: (id, status) => client.put(`/shop/orders/${id}/status`, {}, { params: { status } }),
    createOrder: (data) => client.post('/shop/create-order', data),
    getProducts: () => client.get('/shop/products'),
    // Shop Sales
    getSales: () => client.get('/shop/sales'),
    createSale: (data) => client.post('/shop/sales', data),
    previewSale: (data) => client.post('/shop/sales/preview', data),
    updateSale: (id, data) => client.put(`/shop/sales/${id}`, data),
    deleteSale: (id) => client.delete(`/shop/sales/${id}`),
    // Storefront themes
    purchaseTheme: (data) => client.post('/shop/storefront/theme/purchase', data),
    applyTheme: (data) => client.post('/shop/storefront/theme/apply', data),
    // Shop Gallery
    getGallery: () => client.get('/shop/gallery'),
    addGalleryPhotos: (photos) => client.post('/shop/gallery', { photos }),
    updateGalleryPhoto: (photoId, data) => client.put(`/shop/gallery/${photoId}`, data),
    deleteGalleryPhoto: (photoId) => client.delete(`/shop/gallery/${photoId}`),
    reorderGallery: (order) => client.put('/shop/gallery/reorder', { order }),
    createProduct: (data) => client.post('/shop/products', data),
    updateProduct: (id, data) => client.put(`/shop/products/${id}`, data),
    deleteProduct: (id) => client.delete(`/shop/products/${id}`),
    aiGenerateProduct: (data) => client.post('/shop/products/ai-generate', data),
    getStorefrontThemes: () => client.get('/shop/storefront/themes'),
    // PDF report — downloaded natively with FileSystem (needs the raw endpoint + token)
    reportPdfPath: '/shop/report/pdf',
    // Generic file upload (returns { url, filename })
    uploadFile: (file) => {
      const form = new FormData();
      form.append('file', { uri: file.uri, name: file.name || 'upload.jpg', type: file.mimeType || file.type || 'image/jpeg' });
      return client.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: UPLOAD_TIMEOUT });
    },
  },
  shopGifts: {
    setGift: (productId, data) => client.post(`/shop/products/${productId}/gift`, data),
    removeGift: (productId) => client.delete(`/shop/products/${productId}/gift`),
    getProductGift: (productId) => client.get(`/shop/products/${productId}/gift`),
    getAll: () => client.get('/shop/gifts'),
  },
  shopPromotions: {
    getAll: () => client.get('/shop/promotions'),
    create: (data) => client.post('/shop/promotions', data),
    cancel: (id) => client.put(`/shop/promotions/${id}/cancel`, {}),
  },
  shopSpin: {
    getInfo: () => client.get('/shop/spin/info'),
    play: (data) => client.post('/shop/spin/play', data),
    getHistory: () => client.get('/shop/spin/history'),
  },
  shopTier: {
    getInfo: () => client.get('/shop/tier'),
  },
  // Advertising API (shop)
  ads: {
    overview: () => client.get('/shop/advertising/overview'),
    campaigns: () => client.get('/shop/advertising/campaigns'),
    aiSuggest: (data) => client.post('/shop/advertising/email/ai-suggest', data),
    previewRecipients: (data) => client.post('/shop/advertising/email/preview-recipients', data),
    sendBlast: (data) => client.post('/shop/advertising/email/blast', data),
    sendTestEmail: (data) => client.post('/shop/advertising/email/test', data),
    startPpc: (data) => client.post('/shop/advertising/email/ppc', data),
    getEvents: () => client.get('/shop/advertising/events'),
    joinEvent: (id, data) => client.post(`/shop/advertising/events/${id}/join`, data || {}),
    updateSponsorContent: (id, data) => client.put(`/shop/advertising/events/${id}/sponsor-content`, data || {}),
  },
  shopWallet: {
    get: () => client.get('/shop/wallet'),
    requestTopup: (amount) => client.post('/shop/wallet/request', { amount }),
    requestCashout: (amount, method, methodNumber) => client.post('/shop/wallet/cashout', { amount, method, method_number: methodNumber }),
    getCashoutSettings: () => client.get('/shop/cashout-settings'),
  },
  agent: {
    me: () => client.get('/agent/me'),
    getDashboard: () => client.get('/agent/dashboard'),
    dashboard: () => client.get('/agent/dashboard'),
    wallet: () => client.get('/agent/wallet'),
    referredShops: () => client.get('/agent/referred-shops'),
    commissions: () => client.get('/agent/commissions'),
    fillShop: (data) => client.post('/agent/fill-shop', data),
    cashoutRequest: (data) => client.post('/agent/cashout-request', data),
    myCashouts: () => client.get('/agent/cashout-requests'),
  },
  referral: {
    validate: (code) => client.get('/referral/validate', { params: { code } }),
  },
  delivery: {
    getAvailableOrders: () => client.get('/delivery/available-orders'),
    getMyOrders: () => client.get('/delivery/my-orders'),
    claimOrder: (id) => client.post(`/delivery/claim/${id}`, {}),
    updateStatus: (id, status, notes) => client.put(`/delivery/orders/${id}/status`, null, { params: { status, notes } }),
    getOrderDetails: (id) => client.get(`/delivery/orders/${id}/details`),
  },
  orderTracking: {
    updateDriverLocation: (data) => client.post('/delivery/update-location', data),
  },
  notifications: {
    getAll: () => client.get('/notifications'),
    markRead: (id) => client.put(`/notifications/${id}/read`, {}),
    markAllRead: () => client.put('/notifications/read-all', {}),
  },
  ai: {
    chat: (message, session_id) => client.post('/ai/chat', { message, session_id }),
  },
};
