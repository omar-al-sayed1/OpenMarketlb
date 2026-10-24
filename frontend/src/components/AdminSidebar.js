import React, { useState, useContext, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingBag, FolderTree, Users, MessageSquare, MessagesSquare, Settings, X, Store, Wallet, BarChart3, Inbox, ChevronLeft, ChevronRight, ChevronDown, Gift, XCircle, CalendarDays, Megaphone, Crown, CreditCard, FileText, Sparkles, Banknote, Palette, Shield, Map, Tag, Image as ImageIcon, UserCog, Rocket, Briefcase, Database } from 'lucide-react';
import { AuthContext } from '../App';
import { api } from '../lib/api';

const SEEN_KEY = 'admin_badge_seen';
const getSeenCounts = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; } };
const setSeenCount = (key, value) => { const seen = getSeenCounts(); seen[key] = value; localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); };

const AdminSidebar = ({ onLogout, onCollapseChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('admin_sidebar_collapsed') === 'true');
  const [unreadCount, setUnreadCount] = useState(0);
  const [badgeCounts, setBadgeCounts] = useState({});
  const [seenCounts, setSeenCounts] = useState(getSeenCounts());
  const [requestsOpen, setRequestsOpen] = useState(() => {
    const requestPaths = ['/admin/cancel-requests', '/admin/credit-requests', '/admin/cashout-requests', '/admin/agent-cashouts', '/admin/verification-requests'];
    return requestPaths.some(p => window.location.pathname === p);
  });

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    return () => { document.body.style.overflow = ''; document.body.style.position = ''; document.body.style.width = ''; document.body.style.top = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    fetchUnreadCount(); fetchBadgeCounts();
    const interval = setInterval(() => { fetchUnreadCount(); fetchBadgeCounts(); }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('admin_sidebar_collapsed', collapsed);
    window.dispatchEvent(new CustomEvent('admin-sidebar-toggle', { detail: { collapsed } }));
    if (onCollapseChange) onCollapseChange(collapsed);
  }, [collapsed]);

  useEffect(() => {
    const path = location.pathname;
    const mapping = {
      '/admin/shops': 'shop_pending', '/admin/contact-messages': 'contact_messages',
      '/admin/cancel-requests': 'cancel_requests', '/admin/credit-requests': 'wallet_requests',
      '/admin/cashout-requests': 'cashout_requests', '/admin/agent-cashouts': 'agent_cashout_requests',
      '/admin/subscription-tiers': 'subscription_requests',
      '/admin/verification-requests': 'verification_requests',
    };
    const key = mapping[path];
    if (key && badgeCounts[key] !== undefined) {
      setSeenCount(key, badgeCounts[key]);
      setSeenCounts(getSeenCounts());
    }
  }, [location.pathname, badgeCounts]);

  const fetchUnreadCount = async () => { try { const { data } = await api.messages.getUnreadCount(); setUnreadCount(data.unread_count); } catch {} };
  const fetchBadgeCounts = async () => { try { const { data } = await api.admin.getBadgeCounts(); setBadgeCounts(data); } catch {} };

  // Toggle for external mobile menu button - use ref to always get latest state
  useEffect(() => {
    window.__adminSidebarToggle = () => setMobileOpen(prev => !prev);
    return () => { delete window.__adminSidebarToggle; };
  }, []);

  // Persist sidebar scroll across page navigations
  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem('admin_sidebar_scroll');
    if (saved !== null) {
      el.scrollTop = parseInt(saved, 10) || 0;
    }
    const handler = () => {
      sessionStorage.setItem('admin_sidebar_scroll', String(el.scrollTop));
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, []);

  const requestItems = [
    { path: '/admin/cancel-requests', icon: XCircle, label: 'Cancel Requests', badgeKey: 'cancel_requests' },
    { path: '/admin/credit-requests', icon: CreditCard, label: 'Credit Requests', badgeKey: 'wallet_requests' },
    { path: '/admin/cashout-requests', icon: Banknote, label: 'Cash Out Requests', badgeKey: 'cashout_requests' },
    { path: '/admin/agent-cashouts', icon: UserCog, label: 'Agent Cash-out Requests', badgeKey: 'agent_cashout_requests' },
    { path: '/admin/shops', icon: Crown, label: 'Shop Requests', badgeKey: 'subscription_requests' },
    { path: '/admin/verification-requests', icon: Shield, label: 'Shops Verification', badgeKey: 'verification_requests' },
    { path: '/admin/shop-sales', icon: Tag, label: 'Shop Sales' },
  ];

  const navItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/finance-center', icon: Banknote, label: 'Finance Center' },
    { path: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/admin/shops', icon: Store, label: 'Shops', badgeKey: 'shop_pending' },
    { path: '/admin/map', icon: Map, label: 'Map' },
    { path: '/admin/payouts', icon: Wallet, label: 'Shop Payouts' },
    { path: '/admin/agent-payouts', icon: Wallet, label: 'Agent Payouts' },
    { path: '/admin/products', icon: Package, label: 'Products' },
    { path: '/admin/orders', icon: ShoppingBag, label: 'Orders' },
    { type: 'dropdown', icon: FileText, label: 'Requests', badgeKey: 'total_requests', items: requestItems },
    { path: '/admin/categories', icon: FolderTree, label: 'Categories' },
    { path: '/admin/users', icon: Users, label: 'Users' },
    { path: '/admin/agents', icon: UserCog, label: 'Agents' },
    { path: '/admin/employees', icon: Briefcase, label: 'Employees' },
    { path: '/admin/gallery', icon: ImageIcon, label: 'Gallery' },
    { path: '/admin/messages', icon: MessageSquare, label: 'Messages', badgeType: 'unread' },
    { path: '/admin/all-conversations', icon: MessagesSquare, label: 'All Conversations' },
    { path: '/admin/contact-messages', icon: Inbox, label: 'Contact Forms', badgeKey: 'contact_messages' },
    { path: '/admin/loyalty', icon: Gift, label: 'Loyalty' },
    { path: '/admin/promotions', icon: Megaphone, label: 'Promotions' },
    { path: '/admin/advertising', icon: Rocket, label: 'Advertising' },
    { path: '/admin/subscription-tiers', icon: Crown, label: 'Subscription Tiers' },
    { path: '/admin/spin-wheel', icon: Sparkles, label: 'Spin Wheel' },
    { path: '/admin/themes', icon: Palette, label: 'Storefront Themes' },
    { path: '/admin/events', icon: CalendarDays, label: 'Events' },
    { path: '/admin/settings', icon: Settings, label: 'Settings' },
    { path: '/admin/database', icon: Database, label: 'Database Tables' },
  ];

  const getNewBadge = (item) => {
    if (item.badgeType === 'unread') return unreadCount;
    if (item.badgeKey) {
      const current = badgeCounts[item.badgeKey] || 0;
      if (item.badgeKey === 'total_requests') {
        const cancelNew = Math.max(0, (badgeCounts['cancel_requests'] || 0) - (seenCounts['cancel_requests'] || 0));
        const walletNew = Math.max(0, (badgeCounts['wallet_requests'] || 0) - (seenCounts['wallet_requests'] || 0));
        const cashoutNew = Math.max(0, (badgeCounts['cashout_requests'] || 0) - (seenCounts['cashout_requests'] || 0));
        const agentCashoutNew = Math.max(0, (badgeCounts['agent_cashout_requests'] || 0) - (seenCounts['agent_cashout_requests'] || 0));
        const subscriptionNew = Math.max(0, (badgeCounts['subscription_requests'] || 0) - (seenCounts['subscription_requests'] || 0));
        const verificationNew = Math.max(0, (badgeCounts['verification_requests'] || 0) - (seenCounts['verification_requests'] || 0));
        return cancelNew + walletNew + cashoutNew + agentCashoutNew + subscriptionNew + verificationNew;
      }
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

  const NavContent = ({ forceFull = false }) => {
    const showLabel = forceFull || !collapsed;
    return (
      <div className="flex flex-col h-full">
        <nav className={`${showLabel ? 'px-3' : 'px-2'} py-4 flex-1 space-y-0.5`}>
          {navItems.map((item, idx) => {
            if (item.type === 'dropdown') {
              const Icon = item.icon;
              const totalBadge = getNewBadge(item);
              const isChildActive = item.items.some(sub => location.pathname === sub.path);
              const isOpen = requestsOpen || isChildActive;

              if (!showLabel) {
                return item.items.map(sub => {
                  const SubIcon = sub.icon;
                  const subBadge = getNewBadge(sub);
                  const isActive = location.pathname === sub.path;
                  return (
                    <Link key={sub.path} to={sub.path} onClick={() => handleNavClick(sub)} title={sub.label}
                      className={`flex items-center justify-center px-2 py-2.5 rounded-xl mb-0.5 transition-all relative ${isActive ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25' : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'}`}
                      data-testid={`admin-nav-${sub.label.toLowerCase().replace(/\s/g, '-')}`}>
                      <SubIcon className="h-[18px] w-[18px] flex-shrink-0" />
                      {subBadge > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{subBadge > 9 ? '9+' : subBadge}</span>}
                    </Link>
                  );
                });
              }

              return (
                <div key={`dropdown-${idx}`} className="mb-0.5">
                  <button onClick={() => setRequestsOpen(!isOpen)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${isChildActive ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'}`}
                    data-testid="admin-nav-requests-dropdown">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${isChildActive ? 'bg-violet-100' : ''}`}>
                      <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                    </div>
                    <span className="font-medium text-sm flex-1 text-left">{item.label}</span>
                    {totalBadge > 0 && <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold min-w-[20px] text-center">{totalBadge}</span>}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="ml-6 mt-0.5 space-y-0.5 border-l-2 border-violet-100 pl-3">
                      {item.items.map(sub => {
                        const SubIcon = sub.icon;
                        const isActive = location.pathname === sub.path;
                        const subBadge = getNewBadge(sub);
                        return (
                          <Link key={sub.path} to={sub.path} onClick={() => handleNavClick(sub)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${isActive ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md' : 'text-slate-500 hover:bg-violet-50 hover:text-violet-700'}`}
                            data-testid={`admin-nav-${sub.label.toLowerCase().replace(/\s/g, '-')}`}>
                            <SubIcon className="h-4 w-4 flex-shrink-0" />
                            <span className="font-medium text-xs">{sub.label}</span>
                            {subBadge > 0 && <span className={`ml-auto text-[10px] rounded-full px-1.5 py-0.5 font-bold min-w-[18px] text-center ${isActive ? 'bg-white/25 text-white' : 'bg-red-500 text-white'}`}>{subBadge}</span>}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const badge = getNewBadge(item);

            return (
              <Link key={item.path} to={item.path} onClick={() => handleNavClick(item)} title={!showLabel ? item.label : undefined}
                className={`group flex items-center ${!showLabel ? 'justify-center' : ''} gap-3 ${!showLabel ? 'px-2' : 'px-3'} py-2.5 rounded-xl transition-all duration-200 relative ${
                  isActive 
                    ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25' 
                    : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
                }`}
                data-testid={`admin-nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                  isActive ? 'bg-white/20' : 'bg-transparent group-hover:bg-violet-100'
                }`}>
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                </div>
                {showLabel && <span className="font-medium text-sm">{item.label}</span>}
                {badge > 0 && showLabel && <span className={`ml-auto text-[10px] rounded-full px-1.5 py-0.5 font-bold min-w-[20px] text-center ${isActive ? 'bg-white/25 text-white' : 'bg-red-500 text-white'}`}>{badge}</span>}
                {badge > 0 && !showLabel && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{badge > 9 ? '9+' : badge}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={`hidden lg:flex lg:flex-col ${collapsed ? 'w-[72px]' : 'w-60'} bg-white border-r border-slate-200/80 fixed left-0 top-[44px] h-[calc(100vh-44px)] transition-all duration-300 z-20 shadow-sm`} data-testid="admin-sidebar">
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide"><NavContent /></div>
        <button onClick={() => setCollapsed(!collapsed)} className={`absolute -right-3.5 top-8 flex items-center justify-center transition-all duration-300 z-20 ${
          collapsed 
            ? 'w-7 h-7 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md hover:shadow-lg hover:scale-110' 
            : 'w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-violet-600 hover:border-violet-300 shadow-sm hover:shadow-md'
        }`} data-testid="collapse-sidebar-btn" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} data-testid="mobile-overlay" style={{ touchAction: 'none' }} />
          <div className="lg:hidden fixed left-0 top-0 bottom-0 w-[260px] bg-white z-50 shadow-2xl flex flex-col overflow-y-auto animate-in slide-in-from-left duration-200" data-testid="mobile-sidebar">
            <div className="h-14 flex items-center px-4 border-b border-slate-100 bg-gradient-to-r from-violet-600 to-indigo-600">
              <LayoutDashboard className="h-5 w-5 text-white mr-2" />
              <span className="text-white font-bold text-base">Admin Menu</span>
              <button onClick={() => setMobileOpen(false)} className="ml-auto p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30"><X className="h-4 w-4" /></button>
            </div>
            <NavContent forceFull={true} />
          </div>
        </>
      )}
    </>
  );
};

export default AdminSidebar;
