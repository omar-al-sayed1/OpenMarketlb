import React, { useState, useContext, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, BarChart3, Settings, Store, Menu, X, MessageSquare, PlusCircle, ChevronLeft, ChevronRight, Megaphone, Gift, Sparkles, Wallet, Crown, Palette, MapPin, Shield, Tag, ClipboardList, Images, Rocket } from 'lucide-react';
import { AuthContext } from '../App';
import { api } from '../lib/api';

const SEEN_KEY = 'shop_badge_seen';
const getSeenCounts = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; } };
const setSeenCount = (key, value) => { const seen = getSeenCounts(); seen[key] = value; localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); };

const ShopSidebar = ({ onLogout, onCollapseChange }) => {
  const location = useLocation();
  const { setUser } = useContext(AuthContext);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('shop_sidebar_collapsed') === 'true');
  const [unreadCount, setUnreadCount] = useState(0);
  const [badgeCounts, setBadgeCounts] = useState({});
  const [seenCounts, setSeenCounts] = useState(getSeenCounts());
  const [themeBadge, setThemeBadge] = useState(null); // 'SALE', 'FREE', or null
  const [sponsorCredits, setSponsorCredits] = useState(0); // free product sponsor credits available
  const [freeSpins, setFreeSpins] = useState(0); // free spin-wheel spins available

  useEffect(() => {
    if (mobileOpen) { document.body.style.overflow = 'hidden'; document.body.style.position = 'fixed'; document.body.style.width = '100%'; document.body.style.top = `-${window.scrollY}px`; }
    else { const scrollY = document.body.style.top; document.body.style.overflow = ''; document.body.style.position = ''; document.body.style.width = ''; document.body.style.top = ''; window.scrollTo(0, parseInt(scrollY || '0') * -1); }
    return () => { document.body.style.overflow = ''; document.body.style.position = ''; document.body.style.width = ''; document.body.style.top = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    fetchUnreadCount(); fetchBadgeCounts(); fetchThemeBadge(); fetchSponsorCredits(); fetchFreeSpins();
    const interval = setInterval(() => { fetchUnreadCount(); fetchBadgeCounts(); fetchSponsorCredits(); fetchFreeSpins(); }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('shop_sidebar_collapsed', collapsed);
    window.dispatchEvent(new CustomEvent('shop-sidebar-toggle', { detail: { collapsed } }));
    if (onCollapseChange) onCollapseChange(collapsed);
  }, [collapsed]);

  useEffect(() => {
    const path = location.pathname;
    const mapping = { '/shop/orders': 'pending_orders' };
    const key = mapping[path];
    if (key && badgeCounts[key] !== undefined) {
      setSeenCount(key, badgeCounts[key]);
      setSeenCounts(getSeenCounts());
    }
  }, [location.pathname, badgeCounts]);

  const fetchUnreadCount = async () => { try { const { data } = await api.messages.getUnreadCount(); setUnreadCount(data.unread_count); } catch {} };
  const fetchBadgeCounts = async () => { try { const { data } = await api.shop.getBadgeCounts(); setBadgeCounts(data); } catch {} };
  const fetchSponsorCredits = async () => {
    try {
      const { data } = await api.shop.getProfile();
      const credits = (data?.free_sponsor_credits || 0) + (data?.free_sponsor_10day_credits || 0);
      setSponsorCredits(credits);
    } catch {}
  };
  const fetchFreeSpins = async () => {
    try {
      const { data } = await api.shopSpin.getInfo();
      setFreeSpins(data?.free_spins || 0);
    } catch {}
  };
  const fetchThemeBadge = async () => {
    try {
      const [saleRes, themeRes] = await Promise.allSettled([
        api.themeSale.get(),
        api.shop.getStorefrontThemes()
      ]);
      const salePercent = saleRes.status === 'fulfilled' ? (saleRes.value.data?.theme_sale_percent || 0) : 0;
      const freeUnlocks = themeRes.status === 'fulfilled' ? (themeRes.value.data?.free_unlocks_remaining || 0) : 0;
      if (freeUnlocks > 0) setThemeBadge('FREE');
      else if (salePercent > 0) setThemeBadge(`${salePercent}%`);
      else setThemeBadge(null);
    } catch { setThemeBadge(null); }
  };

  // Reordered as per user's request: Advertising appears directly after Analytics
  const navItems = [
    { path: '/shop/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/shop/products', icon: Package, label: 'Products' },
    { path: '/shop/orders', icon: ShoppingCart, label: 'Orders', badgeKey: 'pending_orders' },
    { path: '/shop/wallet', icon: Wallet, label: 'My Wallet' },
    { path: '/shop/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/shop/advertising', icon: Rocket, label: 'Advertising' },
    { path: '/shop/create-order', icon: PlusCircle, label: 'Create Order' },
    { path: '/shop/gifts', icon: Gift, label: 'Add Gift' },
    { path: '/shop/gallery', icon: Images, label: 'Gallery' },
    { path: '/shop/messages', icon: MessageSquare, label: 'Messages', badgeType: 'unread' },
    { path: '/shop/boost', icon: Megaphone, label: 'Boost a Product', sponsorBadge: true },
    { path: '/shop/sales', icon: Tag, label: 'Shop Sales' },
    { path: '/shop/theme', icon: Palette, label: 'Storefront Theme', hasDynamicBadge: true },
    { path: '/shop/location', icon: MapPin, label: 'Shop Location' },
    { path: '/shop/verification', icon: Shield, label: 'Verification' },
    { path: '/shop/spin', icon: Sparkles, label: 'Spin the Wheel', spinBadge: true },
    { path: '/shop/my-orders', icon: ClipboardList, label: 'My Orders' },
    { path: '/shop/settings', icon: Settings, label: 'Settings' },
  ];

  const getNewBadge = (item) => {
    if (item.badgeType === 'unread') return unreadCount;
    if (item.badgeKey) {
      const current = badgeCounts[item.badgeKey] || 0;
      const seen = seenCounts[item.badgeKey] || 0;
      return Math.max(0, current - seen);
    }
    return 0;
  };

  const handleNavClick = (item) => {
    setMobileOpen(false);
    if (item.badgeKey && item.badgeType !== 'unread') {
      const current = badgeCounts[item.badgeKey] || 0;
      setSeenCount(item.badgeKey, current);
      setSeenCounts(getSeenCounts());
    }
  };

  // Expose toggleMobile globally for the notification bar - use functional update to avoid stale closure
  useEffect(() => {
    window.__shopSidebarToggle = () => setMobileOpen(prev => !prev);
    return () => { delete window.__shopSidebarToggle; };
  }, []);

  const SidebarContent = ({ forceFull = false }) => {
    const showLabel = forceFull || !collapsed;
    return (
      <div className="flex flex-col h-full">
        <nav className={`flex-1 ${showLabel ? 'px-3 py-4' : 'px-2 py-4'} space-y-1`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const badge = getNewBadge(item);
            return (
              <Link key={item.path} to={item.path} onClick={() => handleNavClick(item)} title={!showLabel ? item.label : undefined}
                className={`group flex items-center ${!showLabel ? 'justify-center' : ''} gap-3 ${!showLabel ? 'px-2' : 'px-3'} py-2.5 rounded-xl transition-all duration-200 relative ${
                  isActive 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25' 
                    : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
                data-testid={`shop-nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                  isActive ? 'bg-white/20' : 'bg-transparent group-hover:bg-emerald-100'
                }`}>
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                </div>
                {showLabel && <span className="font-medium text-sm">{item.label}</span>}
                {item.proBadge && showLabel && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                    isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                  }`}>Pro</span>
                )}
                {item.hasDynamicBadge && themeBadge && showLabel && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide animate-pulse ${
                    themeBadge === 'FREE' 
                      ? (isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700')
                      : (isActive ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700')
                  }`}>{themeBadge === 'FREE' ? 'FREE' : `SALE`}</span>
                )}
                {item.sponsorBadge && sponsorCredits > 0 && showLabel && (
                  <span className={`ml-auto text-[8px] leading-none font-bold px-1 py-0.5 rounded-full uppercase tracking-tight animate-pulse flex items-center gap-0.5 whitespace-nowrap flex-shrink-0 ${
                    isActive ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'
                  }`} data-testid="shop-nav-sponsor-badge">
                    <Gift className="h-2 w-2 flex-shrink-0" />{sponsorCredits} FREE
                  </span>
                )}
                {item.sponsorBadge && sponsorCredits > 0 && !showLabel && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center" data-testid="shop-nav-sponsor-badge-collapsed">{sponsorCredits > 9 ? '9+' : sponsorCredits}</span>
                )}
                {item.spinBadge && freeSpins > 0 && showLabel && (
                  <span className={`ml-auto text-[8px] leading-none font-bold px-1 py-0.5 rounded-full uppercase tracking-tight animate-pulse whitespace-nowrap flex-shrink-0 ${
                    isActive ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'
                  }`} data-testid="shop-nav-spin-free-badge">FREE</span>
                )}
                {item.spinBadge && freeSpins > 0 && !showLabel && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white animate-pulse" data-testid="shop-nav-spin-free-badge-collapsed" title={`${freeSpins} free spin${freeSpins > 1 ? 's' : ''}`} />
                )}
                {badge > 0 && showLabel && (
                  <span className={`ml-auto text-[10px] rounded-full px-1.5 py-0.5 font-bold min-w-[20px] text-center ${
                    isActive ? 'bg-white/25 text-white' : 'bg-red-500 text-white'
                  }`}>{badge}</span>
                )}
                {badge > 0 && !showLabel && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{badge > 9 ? '9+' : badge}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    );
  };

  // Persist sidebar scroll position across page navigations
  const scrollRef = useRef(null);
  const mobileScrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Restore on mount
    const saved = sessionStorage.getItem('shop_sidebar_scroll');
    if (saved !== null) {
      el.scrollTop = parseInt(saved, 10) || 0;
    }
    const handler = () => {
      sessionStorage.setItem('shop_sidebar_scroll', String(el.scrollTop));
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, []);

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={`hidden lg:flex lg:flex-col ${collapsed ? 'w-[72px]' : 'w-60'} bg-white border-r border-slate-200/80 fixed left-0 top-[44px] h-[calc(100vh-44px)] transition-all duration-300 z-20 shadow-sm`} data-testid="shop-sidebar">
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide"><SidebarContent /></div>
        <button onClick={() => setCollapsed(!collapsed)} className={`absolute -right-3.5 top-8 flex items-center justify-center transition-all duration-300 z-20 ${
          collapsed 
            ? 'w-7 h-7 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md hover:shadow-lg hover:scale-110' 
            : 'w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 shadow-sm hover:shadow-md'
        }`} data-testid="collapse-shop-sidebar-btn" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>
      
      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} style={{ touchAction: 'none' }} />
          <div className="lg:hidden fixed left-0 top-0 bottom-0 w-[260px] bg-white z-50 shadow-2xl flex flex-col overflow-y-auto animate-in slide-in-from-left duration-200">
            <div className="h-14 flex items-center px-4 border-b border-slate-100 bg-gradient-to-r from-emerald-500 to-teal-500">
              <Store className="h-5 w-5 text-white mr-2" />
              <span className="text-white font-bold text-base">Shop Menu</span>
              <button onClick={() => setMobileOpen(false)} className="ml-auto p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30"><X className="h-4 w-4" /></button>
            </div>
            <SidebarContent forceFull={true} />
          </div>
        </>
      )}
    </>
  );
};

export default ShopSidebar;
