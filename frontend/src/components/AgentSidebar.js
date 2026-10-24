import React, { useState, useContext, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wallet, Store, Receipt, PlusSquare, Banknote, ChevronLeft, ChevronRight, X, MessageSquare } from 'lucide-react';
import { AuthContext } from '../App';

const ALL_PAGES = [
  { path: '/agent', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/agent/wallet', icon: Wallet, label: 'My Wallet' },
  { path: '/agent/referred-shops', icon: Store, label: 'Referred Shops' },
  { path: '/agent/commissions', icon: Receipt, label: 'Commissions' },
  { path: '/agent/refer-shop', icon: PlusSquare, label: 'Refer a Shop' },
  { path: '/agent/messages', icon: MessageSquare, label: 'Messages' },
  { path: '/agent/cashout', icon: Banknote, label: 'Cash Out' },
];

const AgentSidebar = ({ onLogout, onCollapseChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser, user } = useContext(AuthContext);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('agent_sidebar_collapsed') === 'true');

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    localStorage.setItem('agent_sidebar_collapsed', collapsed);
    window.dispatchEvent(new CustomEvent('agent-sidebar-toggle', { detail: { collapsed } }));
    if (onCollapseChange) onCollapseChange(collapsed);
  }, [collapsed]);

  useEffect(() => {
    window.__agentSidebarToggle = () => setMobileOpen(prev => !prev);
    return () => { delete window.__agentSidebarToggle; };
  }, []);

  const scrollRef = useRef(null);

  const NavContent = ({ forceFull = false }) => {
    const showLabel = forceFull || !collapsed;
    return (
      <nav className={`${showLabel ? 'px-3' : 'px-2'} py-4 flex-1 space-y-0.5`}>
        {ALL_PAGES.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} title={!showLabel ? item.label : undefined}
              className={`group flex items-center ${!showLabel ? 'justify-center' : ''} gap-3 ${!showLabel ? 'px-2' : 'px-3'} py-2.5 rounded-xl transition-all duration-200 relative ${
                isActive
                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25'
                  : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
              }`}
              data-testid={`agent-nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                isActive ? 'bg-white/20' : 'bg-transparent group-hover:bg-violet-100'
              }`}>
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
              </div>
              {showLabel && <span className="font-medium text-sm">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    );
  };

  return (
    <>
      <div className={`hidden lg:flex lg:flex-col ${collapsed ? 'w-[72px]' : 'w-60'} bg-white border-r border-slate-200/80 fixed left-0 top-[44px] h-[calc(100vh-44px)] transition-all duration-300 z-20 shadow-sm`} data-testid="agent-sidebar">
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide"><NavContent /></div>
        <button onClick={() => setCollapsed(!collapsed)} className={`absolute -right-3.5 top-8 flex items-center justify-center transition-all duration-300 z-20 ${
          collapsed
            ? 'w-7 h-7 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md hover:shadow-lg hover:scale-110'
            : 'w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-violet-600 hover:border-violet-300 shadow-sm hover:shadow-md'
        }`} data-testid="agent-collapse-sidebar-btn">
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="lg:hidden fixed left-0 top-0 bottom-0 w-[260px] bg-white z-50 shadow-2xl flex flex-col overflow-y-auto">
            <div className="h-14 flex items-center px-4 border-b border-slate-100 bg-gradient-to-r from-violet-600 to-fuchsia-600">
              <LayoutDashboard className="h-5 w-5 text-white mr-2" />
              <span className="text-white font-bold text-base">Agent Menu</span>
              <button onClick={() => setMobileOpen(false)} className="ml-auto p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30"><X className="h-4 w-4" /></button>
            </div>
            <NavContent forceFull={true} />
          </div>
        </>
      )}
    </>
  );
};

export default AgentSidebar;
