import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import Navbar from './components/Navbar';
import CategoryBar from './components/CategoryBar';
import Footer from './components/Footer';
import AIChatbot from './components/AIChatbot';
import SubscriptionSalePopup from './components/SubscriptionSalePopup';
import LoyaltyBonusPopup from './components/LoyaltyBonusPopup';
import EventPopup from './components/EventPopup';
import HomePage from './pages/HomePage';
import '@/App.css';
import { LanguageProvider } from './lib/i18n';
import { api } from './lib/api';
import { loadBrandColors } from './lib/brandTheme';

// Lazy loaded pages
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrderSuccessPage = lazy(() => import('./pages/OrderSuccessPage'));
const OrderTrackingPage = lazy(() => import('./pages/OrderTrackingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const GoogleAuthCallback = lazy(() => import('./pages/GoogleAuthCallback'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages'));
const AdminAllConversations = lazy(() => import('./pages/admin/AdminAllConversations'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminShops = lazy(() => import('./pages/admin/AdminShops'));
const AdminPayouts = lazy(() => import('./pages/admin/AdminPayouts'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminContactMessages = lazy(() => import('./pages/admin/AdminContactMessages'));
const AdminLoyalty = lazy(() => import('./pages/admin/AdminLoyalty'));
const AdminCancelRequests = lazy(() => import('./pages/admin/AdminCancelRequests'));
const AdminEvents = lazy(() => import('./pages/admin/AdminEvents'));
const AdminPromotions = lazy(() => import('./pages/admin/AdminPromotions'));
const AdminSubscriptionTiers = lazy(() => import('./pages/admin/AdminSubscriptionTiers'));
const AdminCreditRequests = lazy(() => import('./pages/admin/AdminCreditRequests'));
const AdminSpinWheel = lazy(() => import('./pages/admin/AdminSpinWheel'));
const AdminCashoutRequests = lazy(() => import('./pages/admin/AdminCashoutRequests'));
const AdminFinanceCenter = lazy(() => import('./pages/admin/AdminFinanceCenter'));
const AdminThemes = lazy(() => import('./pages/admin/AdminThemes'));
const AdminVerificationRequests = lazy(() => import('./pages/admin/AdminVerificationRequests'));
const AdminMap = lazy(() => import('./pages/admin/AdminMap'));
const AdminShopSales = lazy(() => import('./pages/admin/AdminShopSales'));
const AdminAgents = lazy(() => import('./pages/admin/AdminAgents'));
const AdminEmployees = lazy(() => import('./pages/admin/AdminEmployees'));
const AdminAgentCashouts = lazy(() => import('./pages/admin/AdminAgentCashouts'));
const AdminAgentPayouts = lazy(() => import('./pages/admin/AdminAgentPayouts'));
const AdminGallery = lazy(() => import('./pages/admin/AdminGallery'));
const AdminDatabase = lazy(() => import('./pages/admin/AdminDatabase'));
// Employee (internal staff, formerly "agent")
const EmployeeDashboard = lazy(() => import('./pages/employee/EmployeeDashboard'));
// Referral Agent (NEW)
const AgentDashboard = lazy(() => import('./pages/agent/AgentDashboard'));
const AgentWallet = lazy(() => import('./pages/agent/AgentWallet'));
const AgentReferredShops = lazy(() => import('./pages/agent/AgentReferredShops'));
const AgentCommissions = lazy(() => import('./pages/agent/AgentCommissions'));
const AgentReferShop = lazy(() => import('./pages/agent/AgentReferShop'));
const AgentCashout = lazy(() => import('./pages/agent/AgentCashout'));
const AgentMessages = lazy(() => import('./pages/agent/AgentMessages'));
const ShopGallery = lazy(() => import('./pages/shop/ShopGallery'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const BecomeSellerPage = lazy(() => import('./pages/BecomeSellerPage'));
const ShopPublicPage = lazy(() => import('./pages/ShopPublicPage'));
const ShopDashboard = lazy(() => import('./pages/shop/ShopDashboard'));
const ShopProducts = lazy(() => import('./pages/shop/ShopProducts'));
const ShopOrders = lazy(() => import('./pages/shop/ShopOrders'));
const ShopMyOrders = lazy(() => import('./pages/shop/ShopMyOrders'));
const ShopMessages = lazy(() => import('./pages/shop/ShopMessages'));
const ShopAnalytics = lazy(() => import('./pages/shop/ShopAnalytics'));
const ShopSettings = lazy(() => import('./pages/shop/ShopSettings'));
const ShopBoostProducts = lazy(() => import('./pages/shop/ShopBoostProducts'));
const ShopAdvertising = lazy(() => import('./pages/shop/ShopAdvertising'));
const AdminAdvertising = lazy(() => import('./pages/admin/AdminAdvertising'));
const ShopCreateOrder = lazy(() => import('./pages/shop/ShopCreateOrder'));
const ShopGifts = lazy(() => import('./pages/shop/ShopGifts'));
const ShopSpin = lazy(() => import('./pages/shop/ShopSpin'));
const ShopWallet = lazy(() => import('./pages/shop/ShopWallet'));
const ShopTheme = lazy(() => import('./pages/shop/ShopTheme'));
const ShopLocation = lazy(() => import('./pages/shop/ShopLocation'));
const ShopVerification = lazy(() => import('./pages/shop/ShopVerification'));
const ShopSales = lazy(() => import('./pages/shop/ShopSales'));
const DeliveryDashboard = lazy(() => import('./pages/delivery/DeliveryDashboard'));
const SubscriptionSuccessPage = lazy(() => import('./pages/SubscriptionSuccessPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const DeleteAccountPage = lazy(() => import('./pages/DeleteAccountPage'));
const ShopsPage = lazy(() => import('./pages/ShopsPage'));
const ShopsMapPage = lazy(() => import('./pages/ShopsMapPage'));

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-[3px] border-violet-200 animate-spin" style={{ borderTopColor: '#5df6fc' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 animate-pulse" />
        </div>
      </div>
      <div className="flex gap-1">
        <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

export const AuthContext = React.createContext();

// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

// Wrapper component to handle shop/employee/agent user redirects
const ShopRedirect = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}')?.role || null; } catch { return null; }
  });

  useEffect(() => {
    const checkRole = () => {
      try {
        const role = JSON.parse(localStorage.getItem('user') || '{}')?.role || null;
        setUserRole(prev => prev !== role ? role : prev);
      } catch { setUserRole(null); }
    };
    window.addEventListener('storage', checkRole);
    return () => window.removeEventListener('storage', checkRole);
  }, []);

  useEffect(() => {
    if (userRole === 'shop') {
      if (location.pathname.startsWith('/shop')) return;
      if (location.pathname.startsWith('/become-seller')) return;
      if (location.pathname === '/auth') return;
      if (location.pathname.includes('session_id')) return;
      const allowedPaths = ['/', '/products', '/shops', '/shops/map', '/cart', '/checkout', '/wishlist', '/contact', '/about', '/track-order', '/order-success', '/terms-of-service', '/profile', '/messages'];
      const isProductDetail = location.pathname.startsWith('/products/');
      const isShopPublicPage = location.pathname.match(/^\/shop\/[a-zA-Z0-9-]+$/);
      const isTrackOrder = location.pathname.startsWith('/track-order');
      if (!allowedPaths.includes(location.pathname) && !isProductDetail && !isShopPublicPage && !isTrackOrder) {
        navigate('/shop/dashboard');
      }
      return;
    }
    if (userRole === 'employee') {
      if (location.pathname.startsWith('/employee')) return;
      if (location.pathname.startsWith('/admin')) {
        navigate('/employee');
        return;
      }
      if (location.pathname === '/auth') return;
      const allowedEmployeePublicPaths = ['/', '/products', '/shops', '/shops/map', '/contact', '/about', '/terms-of-service', '/profile'];
      const isProductDetail = location.pathname.startsWith('/products/');
      const isShopPublicPage = location.pathname.match(/^\/shop\/[a-zA-Z0-9-]+$/);
      if (!allowedEmployeePublicPaths.includes(location.pathname) && !isProductDetail && !isShopPublicPage) {
        navigate('/employee');
      }
    }
    if (userRole === 'agent') {
      if (location.pathname.startsWith('/agent')) return;
      if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/employee') || location.pathname.startsWith('/shop/dashboard')) {
        navigate('/agent');
        return;
      }
      if (location.pathname === '/auth') return;
      const allowedAgentPublicPaths = ['/', '/products', '/shops', '/shops/map', '/contact', '/about', '/terms-of-service', '/profile'];
      const isProductDetail = location.pathname.startsWith('/products/');
      const isShopPublicPage = location.pathname.match(/^\/shop\/[a-zA-Z0-9-]+$/);
      if (!allowedAgentPublicPaths.includes(location.pathname) && !isProductDetail && !isShopPublicPage) {
        navigate('/agent');
      }
    }
  }, [userRole, location.pathname, navigate]);

  return children;
};

function AppContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      if (parsed?.role === 'shop' && !parsed.shop_id) {
        api.auth.getMe().then(({ data }) => {
          if (data) {
            const merged = { ...parsed, ...data };
            localStorage.setItem('user', JSON.stringify(merged));
            setUser(merged);
          }
        }).catch(() => {});
      }
    }
    setLoading(false);
  }, []);

  // Apply admin-configured brand colors (primary/secondary) at startup.
  useEffect(() => { loadBrandColors(api.admin || api); }, []);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    api.messages.heartbeat().catch(() => {});
    const id = setInterval(() => { api.messages.heartbeat().catch(() => {}); }, 45000);
    return () => clearInterval(id);
  }, [user]);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    const sessionId = localStorage.getItem('session_id');
    if (sessionId) {
      api.cart.merge(sessionId).then(() => {
        window.dispatchEvent(new Event('cart-updated'));
      }).catch(() => {});
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const shopDashboardPaths = ['/shop/dashboard', '/shop/products', '/shop/orders', '/shop/my-orders', '/shop/messages', '/shop/analytics', '/shop/settings', '/shop/create-order', '/shop/boost', '/shop/advertising', '/shop/gifts', '/shop/spin', '/shop/wallet', '/shop/theme', '/shop/location', '/shop/verification', '/shop/sales', '/shop/gallery'];
  const deliveryPaths = ['/delivery'];
  const adminPaths = location.pathname.startsWith('/admin');
  const employeePaths = location.pathname.startsWith('/employee');
  const agentPaths = location.pathname.startsWith('/agent');
  const isShopDashboard = shopDashboardPaths.some(p => location.pathname.startsWith(p));
  const isDelivery = deliveryPaths.some(p => location.pathname.startsWith(p));

  const showNavbar = !adminPaths && !employeePaths && !agentPaths && !isShopDashboard && !isDelivery;

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      <ScrollToTop />
      <ShopRedirect>
        <div className={`min-h-screen ${document.documentElement.classList.contains('dark') ? 'bg-gray-950' : 'bg-gradient-to-br from-violet-50 via-white to-teal-50'}`}>
          {showNavbar && <Navbar />}
          {showNavbar && <CategoryBar />}
          <div className={showNavbar ? 'pt-[calc(2.75rem+2.25rem)] sm:pt-[calc(3.5rem+2.25rem)]' : ''}>
            <Suspense fallback={<PageLoader />}>
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-success" element={<OrderSuccessPage />} />
            <Route path="/track-order" element={<OrderTrackingPage />} />
            <Route path="/track-order/:orderId" element={<OrderTrackingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/google/result" element={<GoogleAuthCallback />} />
            <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
            <Route path="/profile" element={user ? <ProfilePage /> : <Navigate to="/auth" />} />
            <Route path="/messages" element={user ? <MessagesPage /> : <Navigate to="/auth" />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/become-seller" element={<BecomeSellerPage />} />
            <Route path="/shop/:shopId" element={<ShopPublicPage />} />
            <Route path="/shops" element={<ShopsPage />} />
            <Route path="/shops/map" element={<ShopsMapPage />} />
            <Route path="/terms-of-service" element={<TermsOfServicePage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/delete-account" element={<DeleteAccountPage />} />
            <Route path="/account-deletion" element={<DeleteAccountPage />} />

            {/* Admin Routes */}
            <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} />
            <Route path="/admin/shops" element={user?.role === 'admin' ? <AdminShops /> : <Navigate to="/" />} />
            <Route path="/admin/payouts" element={user?.role === 'admin' ? <AdminPayouts /> : <Navigate to="/" />} />
            <Route path="/admin/agent-payouts" element={user?.role === 'admin' ? <AdminAgentPayouts /> : <Navigate to="/" />} />
            <Route path="/admin/products" element={user?.role === 'admin' ? <AdminProducts /> : <Navigate to="/" />} />
            <Route path="/admin/orders" element={user?.role === 'admin' ? <AdminOrders /> : <Navigate to="/" />} />
            <Route path="/admin/categories" element={user?.role === 'admin' ? <AdminCategories /> : <Navigate to="/" />} />
            <Route path="/admin/users" element={user?.role === 'admin' ? <AdminUsers /> : <Navigate to="/" />} />
            <Route path="/admin/messages" element={user?.role === 'admin' ? <AdminMessages /> : <Navigate to="/" />} />
            <Route path="/admin/all-conversations" element={user?.role === 'admin' ? <AdminAllConversations /> : <Navigate to="/" />} />
            <Route path="/admin/settings" element={user?.role === 'admin' ? <AdminSettings /> : <Navigate to="/" />} />
            <Route path="/admin/analytics" element={user?.role === 'admin' ? <AdminAnalytics /> : <Navigate to="/" />} />
            <Route path="/admin/contact-messages" element={user?.role === 'admin' ? <AdminContactMessages /> : <Navigate to="/" />} />
            <Route path="/admin/loyalty" element={user?.role === 'admin' ? <AdminLoyalty /> : <Navigate to="/" />} />
            <Route path="/admin/cancel-requests" element={user?.role === 'admin' ? <AdminCancelRequests /> : <Navigate to="/" />} />
            <Route path="/admin/events" element={user?.role === 'admin' ? <AdminEvents /> : <Navigate to="/" />} />
            <Route path="/admin/promotions" element={user?.role === 'admin' ? <AdminPromotions /> : <Navigate to="/" />} />
            <Route path="/admin/advertising" element={user?.role === 'admin' ? <AdminAdvertising /> : <Navigate to="/" />} />
            <Route path="/admin/subscription-tiers" element={user?.role === 'admin' ? <AdminSubscriptionTiers /> : <Navigate to="/" />} />
            <Route path="/admin/credit-requests" element={user?.role === 'admin' ? <AdminCreditRequests /> : <Navigate to="/" />} />
            <Route path="/admin/spin-wheel" element={user?.role === 'admin' ? <AdminSpinWheel /> : <Navigate to="/" />} />
            <Route path="/admin/cashout-requests" element={user?.role === 'admin' ? <AdminCashoutRequests /> : <Navigate to="/" />} />
            <Route path="/admin/finance-center" element={user?.role === 'admin' ? <AdminFinanceCenter /> : <Navigate to="/" />} />
            <Route path="/admin/themes" element={user?.role === 'admin' ? <AdminThemes /> : <Navigate to="/" />} />
            <Route path="/admin/verification-requests" element={user?.role === 'admin' ? <AdminVerificationRequests /> : <Navigate to="/" />} />
            <Route path="/admin/map" element={user?.role === 'admin' ? <AdminMap /> : <Navigate to="/" />} />
            <Route path="/admin/shop-sales" element={user?.role === 'admin' ? <AdminShopSales /> : <Navigate to="/" />} />
            <Route path="/admin/agents" element={user?.role === 'admin' ? <AdminAgents /> : <Navigate to="/" />} />
            <Route path="/admin/agent-cashouts" element={user?.role === 'admin' ? <AdminAgentCashouts /> : <Navigate to="/" />} />
            <Route path="/admin/employees" element={user?.role === 'admin' ? <AdminEmployees /> : <Navigate to="/" />} />
            <Route path="/admin/gallery" element={user?.role === 'admin' ? <AdminGallery /> : <Navigate to="/" />} />
            <Route path="/admin/database" element={user?.role === 'admin' ? <AdminDatabase /> : <Navigate to="/" />} />

            {/* Employee Routes (internal staff — formerly "agent"). Reuses admin pages with restricted sidebar */}
            <Route path="/employee" element={user?.role === 'employee' ? <EmployeeDashboard /> : <Navigate to="/auth" />} />
            <Route path="/employee/shops" element={user?.role === 'employee' ? <AdminShops /> : <Navigate to="/auth" />} />
            <Route path="/employee/map" element={user?.role === 'employee' ? <AdminMap /> : <Navigate to="/auth" />} />
            <Route path="/employee/products" element={user?.role === 'employee' ? <AdminProducts /> : <Navigate to="/auth" />} />
            <Route path="/employee/orders" element={user?.role === 'employee' ? <AdminOrders /> : <Navigate to="/auth" />} />
            <Route path="/employee/cancel-requests" element={user?.role === 'employee' ? <AdminCancelRequests /> : <Navigate to="/auth" />} />
            <Route path="/employee/verification-requests" element={user?.role === 'employee' ? <AdminVerificationRequests /> : <Navigate to="/auth" />} />
            <Route path="/employee/shop-sales" element={user?.role === 'employee' ? <AdminShopSales /> : <Navigate to="/auth" />} />
            <Route path="/employee/categories" element={user?.role === 'employee' ? <AdminCategories /> : <Navigate to="/auth" />} />
            <Route path="/employee/users" element={user?.role === 'employee' ? <AdminUsers /> : <Navigate to="/auth" />} />
            <Route path="/employee/contact-messages" element={user?.role === 'employee' ? <AdminContactMessages /> : <Navigate to="/auth" />} />
            <Route path="/employee/promotions" element={user?.role === 'employee' ? <AdminPromotions /> : <Navigate to="/auth" />} />
            <Route path="/employee/gallery" element={user?.role === 'employee' ? <AdminGallery /> : <Navigate to="/auth" />} />

            {/* Agent Routes (referral agents — NEW system) */}
            <Route path="/agent" element={user?.role === 'agent' ? <AgentDashboard /> : <Navigate to="/auth" />} />
            <Route path="/agent/wallet" element={user?.role === 'agent' ? <AgentWallet /> : <Navigate to="/auth" />} />
            <Route path="/agent/referred-shops" element={user?.role === 'agent' ? <AgentReferredShops /> : <Navigate to="/auth" />} />
            <Route path="/agent/commissions" element={user?.role === 'agent' ? <AgentCommissions /> : <Navigate to="/auth" />} />
            <Route path="/agent/refer-shop" element={user?.role === 'agent' ? <AgentReferShop /> : <Navigate to="/auth" />} />
            <Route path="/agent/messages" element={user?.role === 'agent' ? <AgentMessages /> : <Navigate to="/auth" />} />
            <Route path="/agent/cashout" element={user?.role === 'agent' ? <AgentCashout /> : <Navigate to="/auth" />} />

            {/* Shop Routes */}
            <Route path="/shop/dashboard" element={user?.role === 'shop' ? <ShopDashboard /> : <Navigate to="/auth" />} />
            <Route path="/shop/create-order" element={user?.role === 'shop' ? <ShopCreateOrder /> : <Navigate to="/auth" />} />
            <Route path="/shop/products" element={user?.role === 'shop' ? <ShopProducts /> : <Navigate to="/auth" />} />
            <Route path="/shop/orders" element={user?.role === 'shop' ? <ShopOrders /> : <Navigate to="/auth" />} />
            <Route path="/shop/my-orders" element={user?.role === 'shop' ? <ShopMyOrders /> : <Navigate to="/auth" />} />
            <Route path="/shop/messages" element={user?.role === 'shop' ? <ShopMessages /> : <Navigate to="/auth" />} />
            <Route path="/shop/analytics" element={user?.role === 'shop' ? <ShopAnalytics /> : <Navigate to="/auth" />} />
            <Route path="/shop/settings" element={user?.role === 'shop' ? <ShopSettings /> : <Navigate to="/auth" />} />
            <Route path="/shop/boost" element={user?.role === 'shop' ? <ShopBoostProducts /> : <Navigate to="/auth" />} />
            <Route path="/shop/advertising" element={user?.role === 'shop' ? <ShopAdvertising /> : <Navigate to="/auth" />} />
            <Route path="/shop/gifts" element={user?.role === 'shop' ? <ShopGifts /> : <Navigate to="/auth" />} />
            <Route path="/shop/spin" element={user?.role === 'shop' ? <ShopSpin /> : <Navigate to="/auth" />} />
            <Route path="/shop/wallet" element={user?.role === 'shop' ? <ShopWallet /> : <Navigate to="/auth" />} />
            <Route path="/shop/theme" element={user?.role === 'shop' ? <ShopTheme /> : <Navigate to="/auth" />} />
            <Route path="/shop/location" element={user?.role === 'shop' ? <ShopLocation /> : <Navigate to="/auth" />} />
            <Route path="/shop/verification" element={user?.role === 'shop' ? <ShopVerification /> : <Navigate to="/auth" />} />
            <Route path="/shop/sales" element={user?.role === 'shop' ? <ShopSales /> : <Navigate to="/auth" />} />
            <Route path="/shop/gallery" element={user?.role === 'shop' ? <ShopGallery /> : <Navigate to="/auth" />} />
            <Route path="/shop/subscription-success" element={user ? <SubscriptionSuccessPage /> : <Navigate to="/auth" />} />

            {/* Delivery Routes */}
            <Route path="/delivery/dashboard" element={user?.role === 'delivery' ? <DeliveryDashboard /> : <Navigate to="/auth" />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
          </div>
          {showNavbar && <Footer />}
          {showNavbar && <AIChatbot />}
          <SubscriptionSalePopup />
          <LoyaltyBonusPopup />
          <EventPopup />
          <Toaster richColors position="top-center" />
        </div>
      </ShopRedirect>
    </AuthContext.Provider>
  );
}

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
