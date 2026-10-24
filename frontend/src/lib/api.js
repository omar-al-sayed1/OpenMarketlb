import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const getSessionId = () => {
  let sessionId = localStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    localStorage.setItem('session_id', sessionId);
  }
  return sessionId;
};

export const api = {
  auth: {
    signup: (data) => axios.post(`${API}/auth/signup`, data),
    signupSendOtp: (data) => axios.post(`${API}/auth/signup/send-otp`, data),
    signupVerify: (data) => axios.post(`${API}/auth/signup/verify`, data),
    signupResendOtp: (pendingId) => axios.post(`${API}/auth/signup/resend-otp`, { pending_id: pendingId }),
    login: (data) => axios.post(`${API}/auth/login`, data),
    loginStart: (data) => axios.post(`${API}/auth/login/start`, data),
    loginVerify: (data) => axios.post(`${API}/auth/login/verify`, data),
    loginResend: (challengeId) => axios.post(`${API}/auth/login/resend`, null, { params: { challenge_id: challengeId } }),
    getMe: () => axios.get(`${API}/auth/me`, { headers: getAuthHeaders() }),
    // Google OAuth
    googleLogin: (intent = 'login') => axios.get(`${API}/auth/google/login`, { params: { intent } }),
    googlePending: (pendingId) => axios.get(`${API}/auth/google/pending/${pendingId}`),
    googleComplete: (data) => axios.post(`${API}/auth/google/complete`, data),
    googleOtpSend: (pendingId, phone) => axios.post(`${API}/auth/google/otp/send`, { pending_id: pendingId, phone }),
    googleOtpVerify: (pendingId, phone, code) => axios.post(`${API}/auth/google/otp/verify`, { pending_id: pendingId, phone, code }),
  },
  categories: {
    getAll: (activeOnly = false) => axios.get(`${API}/categories`, { params: { active_only: activeOnly } }),
    getTree: (activeOnly = false) => axios.get(`${API}/categories/tree`, { params: { active_only: activeOnly } }),
    getChildrenWithPreview: (categoryId) => axios.get(`${API}/categories/${categoryId}/children-with-preview`),
    getTopLevelWithPreview: () => axios.get(`${API}/categories/top-level-with-preview`),
    create: (data) => axios.post(`${API}/categories`, data, { headers: getAuthHeaders() }),
    update: (id, data) => axios.put(`${API}/categories/${id}`, data, { headers: getAuthHeaders() }),
    delete: (id) => axios.delete(`${API}/categories/${id}`, { headers: getAuthHeaders() }),
  },
  products: {
    getAll: (params) => axios.get(`${API}/products`, { params }),
    getById: (id) => axios.get(`${API}/products/${id}`),
    getWithGifts: () => axios.get(`${API}/products/with-gifts`),
    getVariantSummary: (params) => axios.get(`${API}/products/variant-summary`, { params }),
    create: (data) => axios.post(`${API}/products`, data, { headers: getAuthHeaders() }),
    update: (id, data) => axios.put(`${API}/products/${id}`, data, { headers: getAuthHeaders() }),
    delete: (id) => axios.delete(`${API}/products/${id}`, { headers: getAuthHeaders() }),
  },
  cart: {
    get: () => {
      const headers = getAuthHeaders();
      const params = Object.keys(headers).length === 0 ? { session_id: getSessionId() } : {};
      return axios.get(`${API}/cart`, { headers, params });
    },
    add: (data) => {
      const headers = getAuthHeaders();
      const params = Object.keys(headers).length === 0 ? { session_id: getSessionId() } : {};
      return axios.post(`${API}/cart`, data, { headers, params });
    },
    update: (data) => {
      const headers = getAuthHeaders();
      const params = Object.keys(headers).length === 0 ? { session_id: getSessionId() } : {};
      return axios.put(`${API}/cart`, data, { headers, params });
    },
    remove: (productId) => {
      const headers = getAuthHeaders();
      const params = Object.keys(headers).length === 0 ? { session_id: getSessionId() } : {};
      return axios.delete(`${API}/cart/${productId}`, { headers, params });
    },
    merge: (sessionId) => axios.post(`${API}/cart/merge`, { session_id: sessionId }, { headers: getAuthHeaders() }),
  },
  orders: {
    create: (data) => {
      const headers = getAuthHeaders();
      const params = Object.keys(headers).length === 0 ? { session_id: getSessionId() } : {};
      return axios.post(`${API}/orders`, data, { headers, params });
    },
    getAll: () => axios.get(`${API}/orders`, { headers: getAuthHeaders() }),
    getById: (id) => axios.get(`${API}/orders/${id}`, { headers: getAuthHeaders() }),
    track: (id) => axios.get(`${API}/orders/track/${id}`),
    updateStatus: (id, status) => axios.put(`${API}/orders/${id}/status?order_status=${status}`, {}, { headers: getAuthHeaders() }),
    delete: (id) => axios.delete(`${API}/orders/${id}`, { headers: getAuthHeaders() }),
    cancel: (id) => axios.post(`${API}/orders/${id}/cancel`, {}, { headers: getAuthHeaders() }),
    requestCancel: (id, reason) => axios.post(`${API}/orders/${id}/cancel-request`, { reason }, { headers: getAuthHeaders() }),
    getCancelRequestStatus: (id) => axios.get(`${API}/orders/${id}/cancel-request-status`, { headers: getAuthHeaders() }),
  },
  wishlist: {
    get: () => {
      const headers = getAuthHeaders();
      const params = Object.keys(headers).length === 0 ? { session_id: getSessionId() } : {};
      return axios.get(`${API}/wishlist`, { headers, params });
    },
    add: (productId) => {
      const headers = getAuthHeaders();
      const params = Object.keys(headers).length === 0 ? { session_id: getSessionId() } : {};
      return axios.post(`${API}/wishlist/${productId}`, {}, { headers, params });
    },
    remove: (productId) => {
      const headers = getAuthHeaders();
      const params = Object.keys(headers).length === 0 ? { session_id: getSessionId() } : {};
      return axios.delete(`${API}/wishlist/${productId}`, { headers, params });
    },
  },
  payment: {
    createCheckout: (orderId, originUrl) => {
      const headers = getAuthHeaders();
      return axios.post(`${API}/payment/checkout`, null, {
        params: { order_id: orderId, origin_url: originUrl },
        headers,
      });
    },
    checkStatus: (sessionId) => axios.get(`${API}/payment/status/${sessionId}`),
  },
  admin: {
    getAnalytics: () => axios.get(`${API}/admin/analytics`, { headers: getAuthHeaders() }),
    getRevenue: () => axios.get(`${API}/admin/revenue`, { headers: getAuthHeaders() }),
    getUsers: () => axios.get(`${API}/admin/users`, { headers: getAuthHeaders() }),
    getBadgeCounts: () => axios.get(`${API}/admin/badge-counts`, { headers: getAuthHeaders() }),
    getContactMessages: () => axios.get(`${API}/admin/contact-messages`, { headers: getAuthHeaders() }),
    updateMessageStatus: (id, status) => axios.put(`${API}/admin/contact-messages/${id}/status?status=${status}`, {}, { headers: getAuthHeaders() }),
    updateSettings: (data) => axios.put(`${API}/admin/settings`, data, { headers: getAuthHeaders() }),
    updateProfile: (data) => axios.put(`${API}/admin/profile`, data, { headers: getAuthHeaders() }),
    // Shop management
    getShops: (payment_method) => axios.get(`${API}/admin/shops`, { params: { payment_method }, headers: getAuthHeaders() }),
    getShopDetails: (id) => axios.get(`${API}/admin/shops/${id}`, { headers: getAuthHeaders() }),
    approveShop: (id, months = 1, subscription_required = true, commission_percentage = null, commission_type = 'on_customer') => {
      const params = { months, subscription_required, commission_type };
      if (commission_percentage !== null && commission_percentage !== undefined) params.commission_percentage = commission_percentage;
      return axios.put(`${API}/admin/shops/${id}/approve`, null, { params, headers: getAuthHeaders() });
    },
    suspendShop: (id) => axios.put(`${API}/admin/shops/${id}/suspend`, {}, { headers: getAuthHeaders() }),
    verifyShop: (id) => axios.put(`${API}/admin/shops/${id}/verify`, {}, { headers: getAuthHeaders() }),
    unverifyShop: (id) => axios.put(`${API}/admin/shops/${id}/unverify`, {}, { headers: getAuthHeaders() }),
    activateSubscription: (id, months) => axios.put(`${API}/admin/shops/${id}/activate-subscription?months=${months}`, {}, { headers: getAuthHeaders() }),
    updateShopSubscription: (id, data) => {
      const params = {};
      if (data.subscription_end) params.subscription_end = data.subscription_end;
      // Always send subscription_status to prevent it from being cleared
      if (data.subscription_status !== undefined) params.subscription_status = data.subscription_status;
      if (data.payment_amount) params.payment_amount = data.payment_amount;
      return axios.put(`${API}/admin/shops/${id}/update-subscription`, null, { params, headers: getAuthHeaders() });
    },
    updateShopCommission: (id, commission_percentage) => axios.put(`${API}/admin/shops/${id}/commission`, null, { params: { commission_percentage }, headers: getAuthHeaders() }),
    updateShop: (id, data) => axios.put(`${API}/admin/shops/${id}`, data, { headers: getAuthHeaders() }),
    getShopProducts: (id) => axios.get(`${API}/admin/shops/${id}/products`, { headers: getAuthHeaders() }),
    getShopOrders: (id) => axios.get(`${API}/admin/shops/${id}/orders`, { headers: getAuthHeaders() }),
    getShopAnalytics: (id) => axios.get(`${API}/admin/shops/${id}/analytics`, { headers: getAuthHeaders() }),
    // Delivery users
    getDeliveryUsers: () => axios.get(`${API}/admin/delivery-users`, { headers: getAuthHeaders() }),
    createDeliveryUser: (data) => axios.post(`${API}/admin/create-delivery-user`, null, { params: data, headers: getAuthHeaders() }),
    // Platform settings
    getPlatformSettings: () => axios.get(`${API}/platform-settings`),
    updatePlatformSettings: (data) => axios.put(`${API}/admin/platform-settings`, data, { headers: getAuthHeaders() }),
    // Revenue management
    resetRevenue: () => axios.post(`${API}/admin/reset-revenue`, {}, { headers: getAuthHeaders() }),
    adjustRevenue: (data) => axios.put(`${API}/admin/revenue/adjust`, data, { headers: getAuthHeaders() }),
    getRevenueAdjustments: () => axios.get(`${API}/admin/revenue/adjustments`, { headers: getAuthHeaders() }),
    getMonthlyAnalytics: () => axios.get(`${API}/admin/revenue/monthly-analytics`, { headers: getAuthHeaders() }),
    downloadReport: () => axios.get(`${API}/admin/report/pdf`, { headers: getAuthHeaders(), responseType: 'blob' }),
    // Payouts management
    getPendingPayouts: () => axios.get(`${API}/admin/payouts/pending`, { headers: getAuthHeaders() }),
    markPayoutPaid: (shopId) => axios.post(`${API}/admin/payouts/mark-paid/${shopId}`, {}, { headers: getAuthHeaders() }),
    // Cancel requests management
    getCancelRequests: (status) => axios.get(`${API}/admin/cancel-requests`, { params: status ? { status } : {}, headers: getAuthHeaders() }),
    approveCancelRequest: (id, adminNote) => axios.post(`${API}/admin/cancel-requests/${id}/approve`, { admin_note: adminNote }, { headers: getAuthHeaders() }),
    rejectCancelRequest: (id, adminNote) => axios.post(`${API}/admin/cancel-requests/${id}/reject`, { admin_note: adminNote }, { headers: getAuthHeaders() }),
    // User orders
    getUserOrders: (userId, createdAfter) => axios.get(`${API}/admin/users/${userId}/orders`, { params: createdAfter ? { created_after: createdAfter } : {}, headers: getAuthHeaders() }),
    editOrderRedemption: (orderId, data) => axios.put(`${API}/admin/orders/${orderId}/loyalty-redemption`, data, { headers: getAuthHeaders() }),
    // User points management
    getUserPoints: (userId) => axios.get(`${API}/admin/users/${userId}/points`, { headers: getAuthHeaders() }),
    updateUserPoints: (userId, data) => axios.put(`${API}/admin/users/${userId}/points`, data, { headers: getAuthHeaders() }),
    // State management
    getStates: () => axios.get(`${API}/states`),
    createState: (data) => axios.post(`${API}/admin/states`, data, { headers: getAuthHeaders() }),
    updateState: (id, data) => axios.put(`${API}/admin/states/${id}`, data, { headers: getAuthHeaders() }),
    deleteState: (id) => axios.delete(`${API}/admin/states/${id}`, { headers: getAuthHeaders() }),
    // Delete users and shops
    deleteUser: (id) => axios.delete(`${API}/admin/users/${id}`, { headers: getAuthHeaders() }),
    updateUser: (id, data) => axios.put(`${API}/admin/users/${id}`, data, { headers: getAuthHeaders() }),
    deleteShop: (id) => axios.delete(`${API}/admin/shops/${id}`, { headers: getAuthHeaders() }),
    // Create user
    createUser: (data) => axios.post(`${API}/admin/users`, data, { headers: getAuthHeaders() }),
    // Order details
    getOrderDetails: (id) => axios.get(`${API}/admin/orders/${id}/details`, { headers: getAuthHeaders() }),
    // Admin products (with commission info)
    getAllProducts: () => axios.get(`${API}/admin/products-all`, { headers: getAuthHeaders() }),
    // Finance Center
    getFinanceCenter: (params = {}) => axios.get(`${API}/admin/finance-center`, { params, headers: getAuthHeaders() }),
    getFinanceTimeseries: (year) => axios.get(`${API}/admin/finance-center/timeseries`, { params: year ? { year } : {}, headers: getAuthHeaders() }),
    getDatabaseOverview: () => axios.get(`${API}/admin/database/overview`, { headers: getAuthHeaders() }),
    getDatabaseCollection: (name, page = 1, limit = 25, search = '') => axios.get(`${API}/admin/database/collection/${name}`, { params: { page, limit, search }, headers: getAuthHeaders() }),
    getFinanceTransactions: (type, page = 1, limit = 50) => axios.get(`${API}/admin/finance/transactions`, { params: { type, page, limit }, headers: getAuthHeaders() }),
    exportFinanceCsv: (type) => axios.get(`${API}/admin/finance/export-csv`, { params: { type }, headers: getAuthHeaders(), responseType: 'blob' }),
    releaseDeliveryFee: (feeId) => axios.post(`${API}/admin/delivery-fees/${feeId}/release`, {}, { headers: getAuthHeaders() }),
    settleDeliveryCash: (orderId) => axios.post(`${API}/admin/delivery-cash/settle/${orderId}`, {}, { headers: getAuthHeaders() }),
    settleDeliveryCashBulk: (deliveryUserId) => axios.post(`${API}/admin/delivery-cash/settle-bulk`, { delivery_user_id: deliveryUserId }, { headers: getAuthHeaders() }),
    // Admin cashout from revenue
    cashoutRevenue: (data) => axios.post(`${API}/admin/revenue/cashout`, data, { headers: getAuthHeaders() }),
    getRevenueCashouts: () => axios.get(`${API}/admin/revenue/cashouts`, { headers: getAuthHeaders() }),
    // Verification Requests
    getVerificationRequests: (status) => axios.get(`${API}/admin/verification-requests`, { params: status ? { status } : {}, headers: getAuthHeaders() }),
    approveVerification: (shopId) => axios.put(`${API}/admin/verification-requests/${shopId}/approve`, {}, { headers: getAuthHeaders() }),
    rejectVerification: (shopId, reason) => axios.put(`${API}/admin/verification-requests/${shopId}/reject`, null, { params: { reason }, headers: getAuthHeaders() }),
    // Tier descriptions & sale badge
    updateTierDescriptions: (data) => axios.put(`${API}/admin/subscription-tiers/descriptions`, data, { headers: getAuthHeaders() }),
    // Storefront themes
    getStorefrontThemes: () => axios.get(`${API}/admin/storefront/themes`, { headers: getAuthHeaders() }),
    updateStorefrontTheme: (key, data) => axios.put(`${API}/admin/storefront/themes/${key}`, data, { headers: getAuthHeaders() }),
    setThemeSalePercent: (percent) => axios.put(`${API}/admin/theme-sale-percent`, { theme_sale_percent: percent }, { headers: getAuthHeaders() }),
    // Employees (formerly "Agents" — internal staff with admin page access)
    listEmployees: () => axios.get(`${API}/admin/employees`, { headers: getAuthHeaders() }),
    getAvailableEmployeePages: () => axios.get(`${API}/admin/employees/available-pages`, { headers: getAuthHeaders() }),
    createEmployee: (data) => axios.post(`${API}/admin/employees`, data, { headers: getAuthHeaders() }),
    updateEmployee: (id, data) => axios.put(`${API}/admin/employees/${id}`, data, { headers: getAuthHeaders() }),
    setEmployeePages: (id, allowed_pages) => axios.put(`${API}/admin/employees/${id}/pages`, { allowed_pages }, { headers: getAuthHeaders() }),
    deleteEmployee: (id) => axios.delete(`${API}/admin/employees/${id}`, { headers: getAuthHeaders() }),
    // Referral Agents (NEW — agents who refer shops and earn commission)
    listReferralAgents: () => axios.get(`${API}/admin/agents`, { headers: getAuthHeaders() }),
    createReferralAgent: (data) => axios.post(`${API}/admin/agents`, data, { headers: getAuthHeaders() }),
    updateReferralAgent: (id, data) => axios.put(`${API}/admin/agents/${id}`, data, { headers: getAuthHeaders() }),
    deleteReferralAgent: (id) => axios.delete(`${API}/admin/agents/${id}`, { headers: getAuthHeaders() }),
    getReferralAgentTransactions: (id) => axios.get(`${API}/admin/agents/${id}/transactions`, { headers: getAuthHeaders() }),
    getReferralAgentReferredShops: (id) => axios.get(`${API}/admin/agents/${id}/referred-shops`, { headers: getAuthHeaders() }),
    assignShopToAgent: (agentId, shopId) => axios.post(`${API}/admin/agents/${agentId}/assign-shop`, { shop_id: shopId }, { headers: getAuthHeaders() }),
    removeAgentReferredShop: (agentId, shopId) => axios.delete(`${API}/admin/agents/${agentId}/referred-shops/${shopId}`, { headers: getAuthHeaders() }),
    getAgentsSummary: () => axios.get(`${API}/admin/agents-summary`, { headers: getAuthHeaders() }),
    // Agent cash-out requests
    getAgentPayouts: () => axios.get(`${API}/admin/agent-payouts`, { headers: getAuthHeaders() }),
    listAgentCashoutRequests: (status) => axios.get(`${API}/admin/agent-cashout-requests`, { params: status ? { status } : {}, headers: getAuthHeaders() }),
    approveAgentCashout: (reqId) => axios.post(`${API}/admin/agent-cashout-requests/${reqId}/approve`, {}, { headers: getAuthHeaders() }),
    rejectAgentCashout: (reqId, reason) => axios.post(`${API}/admin/agent-cashout-requests/${reqId}/reject`, { reason: reason || '' }, { headers: getAuthHeaders() }),
    // Gallery (all shops aggregated)
    getAllGallery: () => axios.get(`${API}/admin/gallery/all`, { headers: getAuthHeaders() }),
    deleteShopGalleryPhoto: (shopId, photoId) => axios.delete(`${API}/admin/gallery/${shopId}/${photoId}`, { headers: getAuthHeaders() }),
    setGalleryPhotoStatus: (shopId, photoId, status) => axios.put(`${API}/admin/gallery/${shopId}/${photoId}/status`, { status }, { headers: getAuthHeaders() }),
  },
  // Employee (internal staff — formerly "agent")
  employee: {
    me: () => axios.get(`${API}/employee/me`, { headers: getAuthHeaders() }),
  },
  // Referral Agent (NEW — agents who refer shops, have wallet, earn commissions)
  agent: {
    me: () => axios.get(`${API}/agent/me`, { headers: getAuthHeaders() }),
    dashboard: () => axios.get(`${API}/agent/dashboard`, { headers: getAuthHeaders() }),
    wallet: () => axios.get(`${API}/agent/wallet`, { headers: getAuthHeaders() }),
    referredShops: () => axios.get(`${API}/agent/referred-shops`, { headers: getAuthHeaders() }),
    commissions: () => axios.get(`${API}/agent/commissions`, { headers: getAuthHeaders() }),
    fillShop: (data) => axios.post(`${API}/agent/fill-shop`, data, { headers: getAuthHeaders() }),
    cashoutRequest: (data) => axios.post(`${API}/agent/cashout-request`, data, { headers: getAuthHeaders() }),
    myCashouts: () => axios.get(`${API}/agent/cashout-requests`, { headers: getAuthHeaders() }),
  },
  referral: {
    validate: (code) => axios.get(`${API}/referral/validate`, { params: { code } }),
  },
  settings: {
    get: () => axios.get(`${API}/settings`),
  },
  states: {
    getAll: () => axios.get(`${API}/states?active_only=true`),
  },
  users: {
    updateProfile: (data) => axios.put(`${API}/users/profile`, data, { headers: getAuthHeaders() }),
    getWalletInfo: () => axios.get(`${API}/user/wallet-info`, { headers: getAuthHeaders() }),
  },
  contact: {
    send: (data) => axios.post(`${API}/contact`, data),
  },
  // Shop API (for shop users)
  shop: {
    register: (data) => axios.post(`${API}/shop/register`, data, { headers: getAuthHeaders() }),
    registerGuest: (data) => axios.post(`${API}/shop/register-guest`, data),
    createCheckoutWithShopData: (shopData) => {
      const originUrl = window.location.origin;
      return axios.post(`${API}/shop/create-checkout-with-data`, shopData, {
        params: { origin_url: originUrl },
        headers: getAuthHeaders()
      });
    },
    getProfile: () => axios.get(`${API}/shop/profile`, { headers: getAuthHeaders() }),
    updateProfile: (data) => axios.put(`${API}/shop/profile`, data, { headers: getAuthHeaders() }),
    getSubscription: () => axios.get(`${API}/shop/subscription`, { headers: getAuthHeaders() }),
    getStatus: () => axios.get(`${API}/shop/status`, { headers: getAuthHeaders() }),
    startTrial: () => axios.post(`${API}/shop/start-trial`, {}, { headers: getAuthHeaders() }),
    getSubscriptionPricing: () => axios.get(`${API}/shop/subscription-pricing`),
    getWelcomePopup: () => axios.get(`${API}/shop/welcome-popup`, { headers: getAuthHeaders() }),
    dismissWelcomePopup: () => axios.post(`${API}/shop/welcome-popup/dismiss`, {}, { headers: getAuthHeaders() }),
    renewSubscription: () => axios.post(`${API}/shop/renew-subscription`, {}, { headers: getAuthHeaders() }),
    subscribe: (paymentMethod, months = 1) => {
      const originUrl = window.location.origin;
      return axios.post(`${API}/shop/subscribe`, null, { 
        params: { payment_method: paymentMethod, months, origin_url: originUrl }, 
        headers: getAuthHeaders() 
      });
    },
    createPaymentIntent: (months = 1) => axios.post(`${API}/shop/create-payment-intent`, null, { params: { months }, headers: getAuthHeaders() }),
    confirmPayment: (paymentIntentId, months = 1) => axios.post(`${API}/shop/confirm-payment`, null, { params: { payment_intent_id: paymentIntentId, months }, headers: getAuthHeaders() }),
    verifySubscription: (sessionId) => axios.get(`${API}/shop/subscription/verify/${sessionId}`, { headers: getAuthHeaders() }),
    getProducts: () => axios.get(`${API}/shop/products`, { headers: getAuthHeaders() }),
    createProduct: (data) => axios.post(`${API}/shop/products`, data, { headers: getAuthHeaders() }),
    updateProduct: (id, data) => axios.put(`${API}/shop/products/${id}`, data, { headers: getAuthHeaders() }),
    deleteProduct: (id) => axios.delete(`${API}/shop/products/${id}`, { headers: getAuthHeaders() }),
    aiGenerateProduct: (data) => axios.post(`${API}/shop/products/ai-generate`, data, { headers: getAuthHeaders() }),
    getOrders: () => axios.get(`${API}/shop/orders`, { headers: getAuthHeaders() }),
    updateOrderStatus: (id, status) => axios.put(`${API}/shop/orders/${id}/status?status=${status}`, {}, { headers: getAuthHeaders() }),
    getAnalytics: () => axios.get(`${API}/shop/analytics`, { headers: getAuthHeaders() }),
    cancelSubscription: () => axios.post(`${API}/shop/cancel-subscription`, {}, { headers: getAuthHeaders() }),
    createOrder: (data) => axios.post(`${API}/shop/create-order`, data, { headers: getAuthHeaders() }),
    downloadReport: () => axios.get(`${API}/shop/report/pdf`, { headers: getAuthHeaders(), responseType: 'blob' }),
    getBadgeCounts: () => axios.get(`${API}/shop/badge-counts`, { headers: getAuthHeaders() }),
    // Subscription auto-renew
    getSubscriptionStatus: () => axios.get(`${API}/shop/subscription/status`, { headers: getAuthHeaders() }),
    toggleAutoRenew: (data) => axios.post(`${API}/shop/subscription/auto-renew`, data, { headers: getAuthHeaders() }),
    renewNow: (data) => axios.post(`${API}/shop/subscription/renew-now`, data, { headers: getAuthHeaders() }),
    // Storefront themes
    getStorefrontThemes: () => axios.get(`${API}/shop/storefront/themes`, { headers: getAuthHeaders() }),
    purchaseTheme: (data) => axios.post(`${API}/shop/storefront/theme/purchase`, data, { headers: getAuthHeaders() }),
    applyTheme: (data) => axios.post(`${API}/shop/storefront/theme/apply`, data, { headers: getAuthHeaders() }),
    updateLocation: (data) => axios.put(`${API}/shop/location`, data, { headers: getAuthHeaders() }),
    getLocation: () => axios.get(`${API}/shop/location`, { headers: getAuthHeaders() }),
    getOnboardingStatus: () => axios.get(`${API}/shop/onboarding-status`, { headers: getAuthHeaders() }),
    dismissOnboarding: () => axios.post(`${API}/shop/onboarding-dismiss`, {}, { headers: getAuthHeaders() }),
    // Verification
    getVerificationStatus: () => axios.get(`${API}/shop/verification/status`, { headers: getAuthHeaders() }),
    sendVerificationEmail: () => axios.post(`${API}/shop/verification/email/send-code`, {}, { headers: getAuthHeaders() }),
    verifyEmail: (code) => axios.post(`${API}/shop/verification/email/verify`, null, { params: { code }, headers: getAuthHeaders() }),
    uploadVerificationDocument: (formData, docType) => axios.post(`${API}/shop/verification/document/upload`, formData, { params: { doc_type: docType || 'id_front' }, headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' } }),
    deleteVerificationDocument: (docType) => axios.delete(`${API}/shop/verification/document/${docType}`, { headers: getAuthHeaders() }),
    submitVerification: () => axios.post(`${API}/shop/verification/submit`, {}, { headers: getAuthHeaders() }),
    // Shop Sales
    getSales: () => axios.get(`${API}/shop/sales`, { headers: getAuthHeaders() }),
    createSale: (data) => axios.post(`${API}/shop/sales`, data, { headers: getAuthHeaders() }),
    previewSale: (data) => axios.post(`${API}/shop/sales/preview`, data, { headers: getAuthHeaders() }),
    updateSale: (id, data) => axios.put(`${API}/shop/sales/${id}`, data, { headers: getAuthHeaders() }),
    deleteSale: (id) => axios.delete(`${API}/shop/sales/${id}`, { headers: getAuthHeaders() }),
    getActiveSale: () => axios.get(`${API}/shop/sales/active`, { headers: getAuthHeaders() }),
    // Shop Gallery
    getGallery: () => axios.get(`${API}/shop/gallery`, { headers: getAuthHeaders() }),
    addGalleryPhotos: (photos) => axios.post(`${API}/shop/gallery`, { photos }, { headers: getAuthHeaders() }),
    updateGalleryPhoto: (photoId, data) => axios.put(`${API}/shop/gallery/${photoId}`, data, { headers: getAuthHeaders() }),
    deleteGalleryPhoto: (photoId) => axios.delete(`${API}/shop/gallery/${photoId}`, { headers: getAuthHeaders() }),
    reorderGallery: (order) => axios.put(`${API}/shop/gallery/reorder`, { order }, { headers: getAuthHeaders() }),
    // Generic file upload (returns { url, filename })
    uploadFile: (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return axios.post(`${API}/upload`, formData, {
        headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' },
        timeout: 120000
      });
    },
  },
  // Public shop endpoints
  shops: {
    getAll: () => axios.get(`${API}/shops`),
    getById: (id) => axios.get(`${API}/shops/${id}`),
    getProducts: (id) => axios.get(`${API}/shops/${id}/products`),
    getByState: (state) => axios.get(`${API}/shops/by-state/${encodeURIComponent(state)}`),
    getMap: () => axios.get(`${API}/shops/map`),
    getActiveSale: (id) => axios.get(`${API}/shops/${id}/active-sale`),
    getGallery: (id) => axios.get(`${API}/shops/${id}/gallery`),
  },
  // Public seller settings
  sellerSettings: {
    get: () => axios.get(`${API}/public/seller-settings`),
  },
  // Public storefront themes
  storefrontThemes: {
    getAll: () => axios.get(`${API}/storefront/themes`),
  },
  themeSale: {
    get: () => axios.get(`${API}/theme-sale-info`),
  },
  // Product Reviews API
  reviews: {
    getByProduct: (productId) => axios.get(`${API}/products/${productId}/reviews`),
    create: (productId, data) => axios.post(`${API}/products/${productId}/reviews`, data, { headers: getAuthHeaders() }),
    markHelpful: (reviewId) => axios.put(`${API}/reviews/${reviewId}/helpful`, {}, { headers: getAuthHeaders() }),
    delete: (reviewId) => axios.delete(`${API}/reviews/${reviewId}`, { headers: getAuthHeaders() }),
  },
  // Delivery API
  delivery: {
    getAvailableOrders: () => axios.get(`${API}/delivery/available-orders`, { headers: getAuthHeaders() }),
    getMyOrders: () => axios.get(`${API}/delivery/my-orders`, { headers: getAuthHeaders() }),
    claimOrder: (id) => axios.post(`${API}/delivery/claim/${id}`, {}, { headers: getAuthHeaders() }),
    updateStatus: (id, status, notes) => axios.put(`${API}/delivery/orders/${id}/status`, null, { params: { status, notes }, headers: getAuthHeaders() }),
    getOrderDetails: (id) => axios.get(`${API}/delivery/orders/${id}/details`, { headers: getAuthHeaders() }),
  },
  otp: {
    send: (phoneNumber) => axios.post(`${API}/otp/send`, { phone_number: phoneNumber }),
    verify: (phoneNumber, code) => axios.post(`${API}/otp/verify`, { phone_number: phoneNumber, code }, { headers: getAuthHeaders() }),
    checkVerified: (phoneNumber) => axios.get(`${API}/otp/check/${encodeURIComponent(phoneNumber)}`),
  },
  loyalty: {
    getStatus: () => axios.get(`${API}/loyalty/me`, { headers: getAuthHeaders() }),
    redeemPreview: (points, cartTotal) => axios.post(`${API}/loyalty/redeem/preview`, { points_to_redeem: points, cart_total: cartTotal }, { headers: getAuthHeaders() }),
    getHistory: () => axios.get(`${API}/loyalty/history`, { headers: getAuthHeaders() }),
    getActiveBonus: () => axios.get(`${API}/loyalty/active-bonus`, { headers: getAuthHeaders() }),
    claimBonus: (eventId) => axios.post(`${API}/loyalty/claim-bonus/${eventId}`, {}, { headers: getAuthHeaders() }),
    // Points to wallet for sellers
    previewPointsToWallet: (points) => axios.get(`${API}/user/points-to-wallet-preview`, { params: { points }, headers: getAuthHeaders() }),
    redeemPointsToWallet: (points) => axios.post(`${API}/user/redeem-points-to-wallet`, { points }, { headers: getAuthHeaders() }),
  },
  adminLoyalty: {
    getSettings: () => axios.get(`${API}/admin/loyalty/settings`, { headers: getAuthHeaders() }),
    updateSettings: (data) => axios.put(`${API}/admin/loyalty/settings`, data, { headers: getAuthHeaders() }),
    getAnalytics: () => axios.get(`${API}/admin/loyalty/analytics`, { headers: getAuthHeaders() }),
    addBonusEvent: (data) => axios.post(`${API}/admin/loyalty/bonus-event`, data, { headers: getAuthHeaders() }),
    deleteBonusEvent: (id) => axios.delete(`${API}/admin/loyalty/bonus-event/${id}`, { headers: getAuthHeaders() }),
  },
  messages: {
    send: (data) => axios.post(`${API}/messages/send`, data, { headers: getAuthHeaders() }),
    edit: (id, message) => axios.put(`${API}/messages/${id}`, { message }, { headers: getAuthHeaders() }),
    remove: (id) => axios.delete(`${API}/messages/${id}`, { headers: getAuthHeaders() }),
    getConversations: () => axios.get(`${API}/messages/conversations`, { headers: getAuthHeaders() }),
    getConversation: (conversationId) => axios.get(`${API}/messages/conversation/${conversationId}`, { headers: getAuthHeaders() }),
    getUnreadCount: () => axios.get(`${API}/messages/unread-count`, { headers: getAuthHeaders() }),
    markAsRead: (messageId) => axios.put(`${API}/messages/${messageId}/read`, {}, { headers: getAuthHeaders() }),
    getShopsList: () => axios.get(`${API}/shops/list`, { headers: getAuthHeaders() }),
    getUsersList: () => axios.get(`${API}/users/list`, { headers: getAuthHeaders() }),
    uploadAttachment: (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return axios.post(`${API}/upload/attachment`, formData, { headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' } });
    },
    heartbeat: () => axios.post(`${API}/heartbeat`, {}, { headers: getAuthHeaders() }),
    // Admin oversight
    adminGetConversations: () => axios.get(`${API}/admin/conversations`, { headers: getAuthHeaders() }),
    adminGetConversation: (conversationId) => axios.get(`${API}/admin/conversations/${conversationId}`, { headers: getAuthHeaders() }),
    adminDeleteMessage: (id) => axios.delete(`${API}/admin/messages/${id}`, { headers: getAuthHeaders() }),
    adminGetBlocks: () => axios.get(`${API}/admin/messaging/blocks`, { headers: getAuthHeaders() }),
    adminBlock: (data) => axios.post(`${API}/admin/messaging/block`, data, { headers: getAuthHeaders() }),
    adminUnblock: (data) => axios.post(`${API}/admin/messaging/unblock`, data, { headers: getAuthHeaders() }),
  },
  typeImages: {
    get: () => axios.get(`${API}/type-images`),
    update: (images) => axios.put(`${API}/admin/type-images`, images, { headers: getAuthHeaders() }),
  },
  aboutPage: {
    get: () => axios.get(`${API}/about-page`),
    update: (sections) => axios.put(`${API}/admin/about-page`, { sections }, { headers: getAuthHeaders() }),
  },
  tos: {
    get: () => axios.get(`${API}/tos`),
    update: (content) => axios.put(`${API}/admin/tos`, { content }, { headers: getAuthHeaders() }),
  },
  adminBadges: {
    markSeen: (section) => axios.post(`${API}/admin/badges/mark-seen`, { section }, { headers: getAuthHeaders() }),
  },
  shopBadges: {
    markSeen: (section) => axios.post(`${API}/shop/badges/mark-seen`, { section }, { headers: getAuthHeaders() }),
  },
  publicStats: {
    get: () => axios.get(`${API}/stats/public`),
  },
  teamMembers: {
    getAll: () => axios.get(`${API}/team-members`),
    create: (data) => axios.post(`${API}/admin/team-members`, data, { headers: getAuthHeaders() }),
    update: (id, data) => axios.put(`${API}/admin/team-members/${id}`, data, { headers: getAuthHeaders() }),
    delete: (id) => axios.delete(`${API}/admin/team-members/${id}`, { headers: getAuthHeaders() }),
  },
  testimonials: {
    getAll: () => axios.get(`${API}/testimonials`),
    create: (data) => axios.post(`${API}/admin/testimonials`, data, { headers: getAuthHeaders() }),
    update: (id, data) => axios.put(`${API}/admin/testimonials/${id}`, data, { headers: getAuthHeaders() }),
    delete: (id) => axios.delete(`${API}/admin/testimonials/${id}`, { headers: getAuthHeaders() }),
  },
  guestApplications: {
    getAll: (status) => axios.get(`${API}/admin/guest-applications${status ? `?status=${status}` : ''}`, { headers: getAuthHeaders() }),
    update: (id, data) => axios.put(`${API}/admin/guest-applications/${id}`, data, { headers: getAuthHeaders() }),
    approve: (id, data) => axios.post(`${API}/admin/guest-applications/${id}/approve`, data, { headers: getAuthHeaders() }),
    reject: (id) => axios.delete(`${API}/admin/guest-applications/${id}`, { headers: getAuthHeaders() }),
  },
  blockedIps: {
    getAll: () => axios.get(`${API}/admin/blocked-ips`, { headers: getAuthHeaders() }),
    block: (data) => axios.post(`${API}/admin/blocked-ips`, data, { headers: getAuthHeaders() }),
    unblock: (id) => axios.delete(`${API}/admin/blocked-ips/${id}`, { headers: getAuthHeaders() }),
  },
  ai: {
    smartSearch: (query) => axios.post(`${API}/ai/smart-search`, { query }),
    chat: (message, session_id) => axios.post(`${API}/ai/chat`, { message, session_id }, { headers: getAuthHeaders() }),
  },
  geocode: {
    reverse: (lat, lng) => axios.get(`${API}/geocode/reverse`, { params: { lat, lng } }),
  },
  notifications: {
    getAll: () => axios.get(`${API}/notifications`, { headers: getAuthHeaders() }),
    getUnreadCount: () => axios.get(`${API}/notifications/unread-count`, { headers: getAuthHeaders() }),
    markAsRead: (id) => axios.put(`${API}/notifications/${id}/read`, {}, { headers: getAuthHeaders() }),
    markAllRead: () => axios.put(`${API}/notifications/mark-all-read`, {}, { headers: getAuthHeaders() }),
  },
  adminEvents: {
    getAll: () => axios.get(`${API}/admin/events`, { headers: getAuthHeaders() }),
    create: (data) => axios.post(`${API}/admin/events`, data, { headers: getAuthHeaders() }),
    update: (id, data) => axios.put(`${API}/admin/events/${id}`, data, { headers: getAuthHeaders() }),
    delete: (id) => axios.delete(`${API}/admin/events/${id}`, { headers: getAuthHeaders() }),
  },
  publicEvents: {
    getActive: () => axios.get(`${API}/events/active`),
    getHomeBanners: () => axios.get(`${API}/home-banners`),
  },
  // Promotions API
  promotions: {
    getActive: (params) => axios.get(`${API}/promotions/active`, { params }),
  },
  shopPromotions: {
    getAll: () => axios.get(`${API}/shop/promotions`, { headers: getAuthHeaders() }),
    create: (data) => axios.post(`${API}/shop/promotions`, data, { headers: getAuthHeaders() }),
    cancel: (id) => axios.put(`${API}/shop/promotions/${id}/cancel`, {}, { headers: getAuthHeaders() }),
  },
  shopWallet: {
    get: () => axios.get(`${API}/shop/wallet`, { headers: getAuthHeaders() }),
    requestTopup: (amount) => axios.post(`${API}/shop/wallet/request`, { amount }, { headers: getAuthHeaders() }),
    requestCashout: (amount, method, methodNumber) => axios.post(`${API}/shop/wallet/cashout`, { amount, method, method_number: methodNumber }, { headers: getAuthHeaders() }),
    getCashoutSettings: () => axios.get(`${API}/shop/cashout-settings`, { headers: getAuthHeaders() }),
  },
  adminPromotions: {
    getAll: (status) => axios.get(`${API}/admin/promotions`, { params: status ? { status } : {}, headers: getAuthHeaders() }),
  },
  // Advertising API (shop)
  ads: {
    overview: () => axios.get(`${API}/shop/advertising/overview`, { headers: getAuthHeaders() }),
    campaigns: () => axios.get(`${API}/shop/advertising/campaigns`, { headers: getAuthHeaders() }),
    aiSuggest: (data) => axios.post(`${API}/shop/advertising/email/ai-suggest`, data, { headers: getAuthHeaders() }),
    previewRecipients: (data) => axios.post(`${API}/shop/advertising/email/preview-recipients`, data, { headers: getAuthHeaders() }),
    sendBlast: (data) => axios.post(`${API}/shop/advertising/email/blast`, data, { headers: getAuthHeaders() }),
    sendTestEmail: (data) => axios.post(`${API}/shop/advertising/email/test`, data, { headers: getAuthHeaders() }),
    startPpc: (data) => axios.post(`${API}/shop/advertising/email/ppc`, data, { headers: getAuthHeaders() }),
    getEvents: () => axios.get(`${API}/shop/advertising/events`, { headers: getAuthHeaders() }),
    joinEvent: (id, data) => axios.post(`${API}/shop/advertising/events/${id}/join`, data || {}, { headers: getAuthHeaders() }),
    updateSponsorContent: (id, data) => axios.put(`${API}/shop/advertising/events/${id}/sponsor-content`, data || {}, { headers: getAuthHeaders() }),
  },
  // Advertising API (admin)
  adminAds: {
    overview: () => axios.get(`${API}/admin/advertising/overview`, { headers: getAuthHeaders() }),
    updateSettings: (data) => axios.put(`${API}/admin/advertising/settings`, data, { headers: getAuthHeaders() }),
    campaigns: (params) => axios.get(`${API}/admin/advertising/campaigns`, { params, headers: getAuthHeaders() }),
    events: () => axios.get(`${API}/admin/advertising/events`, { headers: getAuthHeaders() }),
    updateEventSponsorship: (id, data) => axios.put(`${API}/admin/advertising/events/${id}/sponsorship`, data, { headers: getAuthHeaders() }),
    removeEventSponsor: (id) => axios.delete(`${API}/admin/advertising/events/${id}/sponsor`, { headers: getAuthHeaders() }),
    clicks: (limit) => axios.get(`${API}/admin/advertising/clicks`, { params: { limit: limit || 100 }, headers: getAuthHeaders() }),
  },
  // Tier API
  shopTier: {
    getInfo: () => axios.get(`${API}/shop/tier`, { headers: getAuthHeaders() }),
    upgrade: (data) => axios.post(`${API}/shop/upgrade-tier`, data, { headers: getAuthHeaders() }),
    getRequests: () => axios.get(`${API}/shop/tier-upgrade-requests`, { headers: getAuthHeaders() }),
  },
  adminTier: {
    setShopTier: (shopId, tier) => axios.put(`${API}/admin/shops/${shopId}/tier`, { tier }, { headers: getAuthHeaders() }),
    getRevenue: () => axios.get(`${API}/admin/tiers/revenue`, { headers: getAuthHeaders() }),
    getUpgradeRequests: (status) => axios.get(`${API}/admin/tier-upgrade-requests`, { params: status ? { status } : {}, headers: getAuthHeaders() }),
    approveUpgrade: (requestId, note) => axios.put(`${API}/admin/tier-upgrade-requests/${requestId}/approve`, { admin_note: note || '' }, { headers: getAuthHeaders() }),
    rejectUpgrade: (requestId, note) => axios.put(`${API}/admin/tier-upgrade-requests/${requestId}/reject`, { admin_note: note || '' }, { headers: getAuthHeaders() }),
  },
  adminWallet: {
    getShopWallet: (shopId) => axios.get(`${API}/admin/shops/${shopId}/wallet`, { headers: getAuthHeaders() }),
    addFunds: (shopId, amount, note) => axios.put(`${API}/admin/shops/${shopId}/wallet/add`, { amount, note }, { headers: getAuthHeaders() }),
    decreaseFunds: (shopId, amount, note) => axios.put(`${API}/admin/shops/${shopId}/wallet/decrease`, { amount, note }, { headers: getAuthHeaders() }),
    bulkAdd: (amount, note) => axios.post(`${API}/admin/wallet/bulk-add`, { amount, note }, { headers: getAuthHeaders() }),
    runMonthlyCredit: () => axios.post(`${API}/admin/wallet/monthly-credit`, {}, { headers: getAuthHeaders() }),
    getAllRequests: (status) => axios.get(`${API}/admin/wallet/requests`, { params: status ? { status } : {}, headers: getAuthHeaders() }),
    getCashoutRequests: (status) => axios.get(`${API}/admin/cashout-requests`, { params: status ? { status } : {}, headers: getAuthHeaders() }),
    approveCashout: (id) => axios.put(`${API}/admin/cashout-requests/${id}/approve`, {}, { headers: getAuthHeaders() }),
    rejectCashout: (id, reason) => axios.put(`${API}/admin/cashout-requests/${id}/reject`, { reason }, { headers: getAuthHeaders() }),
    getCashoutSettings: () => axios.get(`${API}/admin/cashout-settings`, { headers: getAuthHeaders() }),
    updateCashoutSettings: (data) => axios.put(`${API}/admin/cashout-settings`, data, { headers: getAuthHeaders() }),
  },
  adminSubscriptionTiers: {
    get: () => axios.get(`${API}/admin/subscription-tiers`, { headers: getAuthHeaders() }),
    update: (data) => axios.put(`${API}/admin/subscription-tiers`, data, { headers: getAuthHeaders() }),
  },
  // Recommendations & Tracking API
  tracking: {
    view: (productId) => {
      const sessionId = getSessionId();
      return axios.post(`${API}/track/view`, { product_id: productId, session_id: sessionId }, { headers: getAuthHeaders() });
    },
  },
  recommendations: {
    forProduct: (productId) => axios.get(`${API}/recommendations/product/${productId}`),
    personalized: () => {
      const headers = getAuthHeaders();
      const sessionId = getSessionId();
      return axios.get(`${API}/recommendations/personalized`, { params: { session_id: sessionId }, headers });
    },
  },
  // Gift API (shop)
  shopGifts: {
    setGift: (productId, data) => axios.post(`${API}/shop/products/${productId}/gift`, data, { headers: getAuthHeaders() }),
    removeGift: (productId) => axios.delete(`${API}/shop/products/${productId}/gift`, { headers: getAuthHeaders() }),
    getProductGift: (productId) => axios.get(`${API}/shop/products/${productId}/gift`, { headers: getAuthHeaders() }),
    getAll: () => axios.get(`${API}/shop/gifts`, { headers: getAuthHeaders() }),
  },
  // Spin API (shop)
  shopSpin: {
    getInfo: () => axios.get(`${API}/shop/spin/info`, { headers: getAuthHeaders() }),
    play: (data) => axios.post(`${API}/shop/spin/play`, data, { headers: getAuthHeaders() }),
    getHistory: () => axios.get(`${API}/shop/spin/history`, { headers: getAuthHeaders() }),
  },
  // Spin API (admin)
  adminSpin: {
    getSettings: () => axios.get(`${API}/admin/spin/settings`, { headers: getAuthHeaders() }),
    updateSettings: (data) => axios.put(`${API}/admin/spin/settings`, data, { headers: getAuthHeaders() }),
    getHistory: () => axios.get(`${API}/admin/spin/history`, { headers: getAuthHeaders() }),
    grantFreeSpins: (data) => axios.post(`${API}/admin/spin/grant-free-spin`, data, { headers: getAuthHeaders() }),
  },
  // Admin Shop Sales
  adminShopSales: {
    getAll: () => axios.get(`${API}/admin/shop-sales`, { headers: getAuthHeaders() }),
    update: (id, data) => axios.put(`${API}/admin/shop-sales/${id}`, data, { headers: getAuthHeaders() }),
    delete: (id) => axios.delete(`${API}/admin/shop-sales/${id}`, { headers: getAuthHeaders() }),
  },
  // Saved Locations
  savedLocations: {
    getAll: () => axios.get(`${API}/user/saved-locations`, { headers: getAuthHeaders() }),
    save: (data) => axios.post(`${API}/user/saved-locations`, data, { headers: getAuthHeaders() }),
  },
  // Order Tracking
  orderTracking: {
    get: (orderId) => axios.get(`${API}/orders/${orderId}/tracking`),
    updateDriverLocation: (data) => axios.post(`${API}/delivery/update-location`, data, { headers: getAuthHeaders() }),
  },
};