import React, { useState, useContext, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Store, Map, Package, ShoppingBag, XCircle, Shield, Tag,
  FolderTree, Users, Inbox, Megaphone, Image as ImageIcon, ChevronLeft, ChevronRight,
  ChevronDown, X, FileText
} from 'lucide-react';
import { AuthContext } from '../App';
import { api } from '../lib/api';

const SEEN_KEY = 'employee_badge_seen';
const getSeenCounts = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; } };
const setSeenCount = (key, value) => { const seen = getSeenCounts(); seen[key] = value; localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); };

const ALL_EMPLOYEE_PAGES = [
  { key: 'dashboard', path: '/employee', icon: LayoutDashboard, label: 'Dashboard' },
  { key: 'shops', path: '/employee/shops', icon: Store, label: 'Shops', badgeKey: 'shop_pending' },
  { key: 'map', path: '/employee/map', icon: Map, label: 'Map' },
  { key: 'products', path: '/employee/products', icon: Package, label: 'Products' },
  { key: 'orders', path: '/employee/orders', icon: ShoppingBag, label: 'Orders' },
  {
    key: 'requests',
    type: 'dropdown', icon: FileText, label: 'Requests',
    items: [
      { key: 'cancel_requests', path: '/employee/cancel-requests', icon: XCircle, label: 'Cancel Requests', badgeKey: 'cancel_requests' },
      { key: 'shops_verifications', path: '/employee/verification-requests', icon: Shield, label: 'Shops Verifications', badgeKey: 'verification_requests' },
      { key: 'shop_sales', path: '/employee/shop-sales', icon: Tag, label: 'Shop Sales' },
    ],
  },
  { key: 'categories', path: '/employee/categories', icon: FolderTree, label: 'Categories' },
  { key: 'users', path: '/employee/users', icon: Users, label: 'Users' },
  { key: 'contact_form', path: '/employee/contact-messages', icon: Inbox, label: 'Contact Form', badgeKey: 'contact_messages' },
  { key: 'promotions', path: '/employee/promotions', icon: Megaphone, label: 'Promotions' },
  { key: 'gallery', path: '/employee/gallery', icon: ImageIcon, label: 'Gallery' },
];

const EmployeeSidebar = ({ onLogout, onCollapseChange, allowedPages = [] }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser, user } = useContext(AuthContext);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('employee_sidebar_collapsed') === 'true');
  const [badgeCounts, setBadgeCounts] = useState({});
  const [seenCounts, setSeenCounts] = useState(getSeenCounts());
  const [requestsOpen, setRequestsOpen] = useState(() => {
    const reqPaths = ['/employee/cancel-requests', '/employee/verification-requests', '/employee/shop-sales'];
    return reqPaths.some(p => window.location.pathname === p);
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
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [mobileOpen]);

  useEffect(() => {
    fetchBadgeCounts();
    const interval = setInterval(() => fetchBadgeCounts(), 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('employee_sidebar_collapsed', collapsed);
    window.dispatchEvent(new CustomEvent('employee-sidebar-toggle', { detail: { collapsed } }));
    if (onCollapseChange) onCollapseChange(collapsed);
  }, [collapsed]);

  useEffect(() => {
    window.__employeeSidebarToggle = () => setMobileOpen(prev => !prev);
    return () => { delete window.__employeeSidebarToggle; };
  }, []);

  const fetchBadgeCounts = async () => {
    try { const { data } = await api.admin.getBadgeCounts(); setBadgeCounts(data); } catch {}
  };

  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem('employee_sidebar_scroll');
    if (saved !== null) el.scrollTop = parseInt(saved, 10) || 0;
    const handler = () => sessionStorage.setItem('employee_sidebar_scroll', String(el.scrollTop));
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, []);

  const isAllowed = (key) => allowedPages.includes(key);
  const visibleItems = ALL_EMPLOYEE_PAGES.map(item => {
    if (item.type === 'dropdown') {
      const visibleChildren = item.items.filter(c => isAllowed(c.key));
      if (visibleChildren.length === 0) return null;
      return { ...item, items: visibleChildren };
    }
    return isAllowed(item.key) ? item : null;
  }).filter(Boolean);

  const getBadge = (item) => {
    if (!item.badgeKey) return 0;
    const current = badgeCounts[item.badgeKey] || 0;
    const seen = seenCounts[item.badgeKey] || 0;
    return Math.max(0, current - seen);
  };

  const handleNavClick = (item) => {
    setMobileOpen(false);
    if (item.badgeKey) {
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
          {visibleItems.map((item, idx) => {
            if (item.type === 'dropdown') {
              const Icon = item.icon;
              const isChildActive = item.items.some(sub => location.pathname === sub.path);
              const isOpen = requestsOpen || isChildActive;

              if (!showLabel) {
                return item.items.map(sub => {
                  const SubIcon = sub.icon;
                  const isActive = location.pathname === sub.path;
                  const subBadge = getBadge(sub);
                  return (
                    <Link key={sub.path} to={sub.path} onClick={() => handleNavClick(sub)} title={sub.label}
                      className={`flex items-center justify-center px-2 py-2.5 rounded-xl mb-0.5 transition-all relative ${isActive ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`}
                      data-testid={`employee-nav-${sub.label.toLowerCase().replace(/\s/g, '-')}`}>
                      <SubIcon className="h-[18px] w-[18px] flex-shrink-0" />
                      {subBadge > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{subBadge > 9 ? '9+' : subBadge}</span>}
                    </Link>
                  );
                });
              }

              return (
                <div key={`dropdown-${idx}`} className="mb-0.5">
                  <button onClick={() => setRequestsOpen(!isOpen)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${isChildActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`}
                    data-testid="employee-nav-requests-dropdown">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${isChildActive ? 'bg-emerald-100' : ''}`}>
                      <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                    </div>
                    <span className="font-medium text-sm flex-1 text-left">{item.label}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="ml-6 mt-0.5 space-y-0.5 border-l-2 border-emerald-100 pl-3">
                      {item.items.map(sub => {
                        const SubIcon = sub.icon;
                        const isActive = location.pathname === sub.path;
                        const subBadge = getBadge(sub);
                        return (
                          <Link key={sub.path} to={sub.path} onClick={() => handleNavClick(sub)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${isActive ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'}`}
                            data-testid={`employee-nav-${sub.label.toLowerCase().replace(/\s/g, '-')}`}>
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
            const badge = getBadge(item);
            return (
              <Link key={item.path} to={item.path} onClick={() => handleNavClick(item)} title={!showLabel ? item.label : undefined}
                className={`group flex items-center ${!showLabel ? 'justify-center' : ''} gap-3 ${!showLabel ? 'px-2' : 'px-3'} py-2.5 rounded-xl transition-all duration-200 relative ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
                data-testid={`employee-nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                  isActive ? 'bg-white/20' : 'bg-transparent group-hover:bg-emerald-100'
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
      <div className={`hidden lg:flex lg:flex-col ${collapsed ? 'w-[72px]' : 'w-60'} bg-white border-r border-slate-200/80 fixed left-0 top-[44px] h-[calc(100vh-44px)] transition-all duration-300 z-20 shadow-sm`} data-testid="employee-sidebar">
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide"><NavContent /></div>
        <button onClick={() => setCollapsed(!collapsed)} className={`absolute -right-3.5 top-8 flex items-center justify-center transition-all duration-300 z-20 ${
          collapsed
            ? 'w-7 h-7 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md hover:shadow-lg hover:scale-110'
            : 'w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 shadow-sm hover:shadow-md'
        }`} data-testid="employee-collapse-sidebar-btn" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} data-testid="employee-mobile-overlay" style={{ touchAction: 'none' }} />
          <div className="lg:hidden fixed left-0 top-0 bottom-0 w-[260px] bg-white z-50 shadow-2xl flex flex-col overflow-y-auto animate-in slide-in-from-left duration-200" data-testid="employee-mobile-sidebar">
            <div className="h-14 flex items-center px-4 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-teal-600">
              <LayoutDashboard className="h-5 w-5 text-white mr-2" />
              <span className="text-white font-bold text-base">Employee Menu</span>
              <button onClick={() => setMobileOpen(false)} className="ml-auto p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30"><X className="h-4 w-4" /></button>
            </div>
            <NavContent forceFull={true} />
          </div>
        </>
      )}
    </>
  );
};

export default EmployeeSidebar;
