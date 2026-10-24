import React, { useState, useEffect, useRef } from 'react';
import BrandName from './BrandName';
import { Bell, Check, Package, ShoppingBag, CreditCard, User, AlertCircle, X, ChevronRight, Settings, LogOut, Moon, Sun, Wallet, Menu, Award } from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '@/components/ui/button';
import { useNavigate, Link } from 'react-router-dom';
import QuickPageSearch from './QuickPageSearch';

const TopNotificationBar = ({ userRole, userName, onLogout }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState('/logo.png');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState(null);
  const dropdownRef = useRef(null);
  const walletDropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    if (userRole === 'admin' || userRole === 'shop' || userRole === 'agent') {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [userRole]);

  useEffect(() => {
    if (userRole === 'shop') {
      const fetchWallet = () => {
        api.shopWallet.get().then(res => {
          setWalletBalance(res.data?.balance || 0);
          setWalletTransactions(res.data?.transactions?.slice(0, 5) || []);
        }).catch(() => {});
      };
      const fetchLoyalty = () => {
        api.loyalty.getStatus().then(res => {
          if (res.data?.enabled) setLoyaltyPoints(res.data.points_balance ?? 0);
        }).catch(() => {});
      };
      fetchWallet();
      fetchLoyalty();
      // Listen for wallet-updated event
      const handleWalletUpdate = () => fetchWallet();
      const handleLoyaltyUpdate = () => fetchLoyalty();
      window.addEventListener('wallet-updated', handleWalletUpdate);
      window.addEventListener('loyalty-updated', handleLoyaltyUpdate);
      // Poll every 30s
      const interval = setInterval(() => { fetchWallet(); fetchLoyalty(); }, 30000);
      return () => {
        window.removeEventListener('wallet-updated', handleWalletUpdate);
        window.removeEventListener('loyalty-updated', handleLoyaltyUpdate);
        clearInterval(interval);
      };
    }
    if (userRole === 'agent') {
      const fetchAgentWallet = () => {
        api.agent.wallet().then(res => {
          setWalletBalance(res.data?.balance || 0);
          setWalletTransactions((res.data?.transactions || []).slice(0, 5));
        }).catch(() => {});
      };
      fetchAgentWallet();
      const handleWalletUpdate = () => fetchAgentWallet();
      window.addEventListener('wallet-updated', handleWalletUpdate);
      const interval = setInterval(fetchAgentWallet, 30000);
      return () => {
        window.removeEventListener('wallet-updated', handleWalletUpdate);
        clearInterval(interval);
      };
    }
  }, [userRole]);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const { data } = await api.admin.getPlatformSettings();
        if (data?.logo_url) setLogoUrl(data.logo_url);
      } catch {}
    };
    fetchLogo();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(event.target)) setWalletDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUnreadCount = async () => {
    try { const { data } = await api.notifications.getUnreadCount(); setUnreadCount(data.count); } catch (error) {}
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try { const { data } = await api.notifications.getAll(); setNotifications(data); } catch (error) {} finally { setLoading(false); }
  };

  const handleBellClick = () => { if (!isOpen) fetchNotifications(); setIsOpen(!isOpen); };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await api.notifications.markAsRead(notificationId);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {}
  };

  const handleMarkAllRead = async () => {
    try { await api.notifications.markAllRead(); setNotifications(prev => prev.map(n => ({ ...n, is_read: true }))); setUnreadCount(0); } catch (error) {}
  };

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) handleMarkAsRead(notification.id);
    if (notification.link) { navigate(notification.link); setIsOpen(false); }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'order': return <Package className="h-3.5 w-3.5 text-blue-500" />;
      case 'product': return <ShoppingBag className="h-3.5 w-3.5 text-green-500" />;
      case 'subscription': return <CreditCard className="h-3.5 w-3.5 text-purple-500" />;
      case 'user': return <User className="h-3.5 w-3.5 text-orange-500" />;
      default: return <AlertCircle className="h-3.5 w-3.5 text-slate-500" />;
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleHamburgerClick = () => {
    if (userRole === 'admin' && window.__adminSidebarToggle) window.__adminSidebarToggle();
    else if (userRole === 'agent' && window.__agentSidebarToggle) window.__agentSidebarToggle();
    else if (userRole === 'shop' && window.__shopSidebarToggle) window.__shopSidebarToggle();
  };

  const isAdmin = userRole === 'admin';
  const isAgent = userRole === 'agent';
  const gradientClass = isAdmin 
    ? 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600' 
    : isAgent
      ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600'
      : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600';

  return (
    <div className={`${gradientClass} shadow-lg sticky top-0 z-30`}>
      <div className="px-3 sm:px-6 py-2.5 flex items-center justify-between">
        {/* Left side - Hamburger + Branding */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {/* Hamburger - Mobile only */}
          <button
            onClick={handleHamburgerClick}
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 transition-colors flex-shrink-0"
            data-testid="mobile-hamburger-btn"
          >
            <Menu className="h-4 w-4 text-white" />
          </button>

          <Link 
            to={isAdmin ? '/admin' : isAgent ? '/agent' : '/shop/dashboard'} 
            className="text-white font-heading font-bold text-base sm:text-lg hover:opacity-90 transition-opacity flex items-center gap-1 min-w-0"
          >
            <img src={logoUrl} alt="Logo" className="h-6 w-6 rounded-lg object-contain flex-shrink-0" />
            <BrandName className="truncate" showLb />
            <span className="text-white/60 font-normal text-xs ml-0.5 hidden sm:inline">{isAdmin ? 'Admin' : isAgent ? 'Agent' : 'Shop'}</span>
          </Link>
          <div className="hidden sm:block h-5 w-px bg-white/20"></div>
          <span className="hidden sm:block text-white/70 text-xs truncate">
            Welcome, <span className="font-semibold text-white">{userName || 'User'}</span>
          </span>
          {(userRole === 'shop' || userRole === 'agent') && walletBalance !== null && (
            <div className="hidden sm:block relative" ref={walletDropdownRef}>
              <button
                onClick={() => setWalletDropdownOpen(!walletDropdownOpen)}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 rounded-full px-2.5 py-1 transition-colors"
                data-testid="navbar-wallet-btn"
              >
                <Wallet className="h-3 w-3 text-emerald-300" />
                <span className="text-white text-xs font-semibold">${walletBalance.toFixed(2)}</span>
              </button>
              {walletDropdownOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border z-50 overflow-hidden">
                  <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
                    <p className="text-xs text-slate-500">{userRole === 'agent' ? 'Agent Wallet' : 'Digital Wallet'}</p>
                    <p className="text-2xl font-bold text-emerald-600">${walletBalance.toFixed(2)}</p>
                  </div>
                  {walletTransactions.length > 0 ? (
                    <div className="divide-y max-h-48 overflow-y-auto">
                      {walletTransactions.map(txn => (
                        <div key={txn.id} className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate">{txn.note || txn.type?.replace(/_/g, ' ')}</p>
                            <p className="text-[10px] text-slate-400">{new Date(txn.created_at).toLocaleDateString()}</p>
                          </div>
                          <span className={`text-xs font-bold ${txn.amount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {txn.amount > 0 ? '+' : ''}${Math.abs(txn.amount).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-5 text-center text-xs text-slate-400">No transactions yet</div>
                  )}
                  <div className="p-2 border-t bg-slate-50">
                    <button onClick={() => { setWalletDropdownOpen(false); navigate(userRole === 'agent' ? '/agent/wallet' : '/shop/wallet'); }}
                      className="w-full text-center text-xs text-emerald-600 hover:text-emerald-700 font-medium py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
                      View All Transactions
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {userRole === 'shop' && loyaltyPoints !== null && (
            <button
              onClick={() => navigate('/shop/dashboard')}
              className="hidden sm:flex items-center gap-1.5 bg-white/15 hover:bg-white/25 rounded-full px-2.5 py-1 transition-colors"
              data-testid="navbar-loyalty-btn"
              title="Shop Loyalty Points"
            >
              <Award className="h-3 w-3 text-amber-300" />
              <span className="text-white text-xs font-semibold">{loyaltyPoints.toLocaleString()} pts</span>
            </button>
          )}
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick page search (admin / shop / agent) */}
          <QuickPageSearch role={userRole} />

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title={darkMode ? 'Light Mode' : 'Dark Mode'}
            data-testid="admin-dark-mode-toggle"
          >
            {darkMode ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-white" />}
          </button>

          {/* View Store */}
          <Link to="/" className="hidden md:flex items-center gap-1 text-white/80 hover:text-white text-xs transition-colors">
            <ChevronRight className="h-3.5 w-3.5" />
            Store
          </Link>

          {/* Notification Bell */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={handleBellClick}
              className="relative p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              data-testid="top-notification-bell"
            >
              <Bell className="h-4 w-4 text-white" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse shadow-lg">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {isOpen && (
              <div className="fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto top-12 sm:top-auto sm:mt-2 w-auto sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100">
                  <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5 text-violet-600" />
                    Notifications
                    {unreadCount > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">{unreadCount} new</span>}
                  </h3>
                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                      <Button onClick={handleMarkAllRead} variant="ghost" size="sm" className="text-[10px] text-violet-600 hover:text-violet-700 h-7 px-2">
                        <Check className="h-3 w-3 mr-1" /> Mark all read
                      </Button>
                    )}
                    <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-slate-200 transition-colors">
                      <X className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                  </div>
                </div>
                <div className="max-h-[350px] overflow-y-auto">
                  {loading ? (
                    <div className="p-6 text-center text-slate-500">
                      <div className="animate-spin h-5 w-5 border-2 border-violet-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                      Loading...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">
                      <Bell className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-xs">No notifications yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {notifications.slice(0, 15).map((notification) => (
                        <div key={notification.id} onClick={() => handleNotificationClick(notification)}
                          className={`p-3 cursor-pointer transition-colors hover:bg-slate-50 ${!notification.is_read ? 'bg-violet-50/50' : ''}`}>
                          <div className="flex items-start gap-2.5">
                            <div className="p-1 rounded-full bg-slate-100 flex-shrink-0">{getNotificationIcon(notification.type)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={`text-xs font-medium truncate ${!notification.is_read ? 'text-slate-900' : 'text-slate-700'}`}>{notification.title}</p>
                                {!notification.is_read && <span className="h-1.5 w-1.5 bg-violet-500 rounded-full flex-shrink-0"></span>}
                              </div>
                              <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">{notification.message}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{formatTime(notification.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          {!isAgent && (
            <Link to={isAdmin ? '/admin/settings' : '/shop/settings'} className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              <Settings className="h-4 w-4 text-white" />
            </Link>
          )}

          {/* Logout */}
          <button onClick={onLogout} className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-red-500/80 transition-colors" title="Logout">
            <LogOut className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopNotificationBar;
