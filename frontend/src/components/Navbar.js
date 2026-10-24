import React, { useState, useContext, useEffect } from 'react';
import BrandName from './BrandName';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, Heart, User, Menu, X, LogOut, LayoutDashboard, Store, Package, Home, Phone, ChevronRight, ShoppingBag, Globe, Star, Award, Crown, Medal, Gift, ChevronDown, Moon, Sun, MapPin, Info, MessageCircle } from 'lucide-react';
import { AuthContext } from '../App';
import { Button } from '@/components/ui/button';
import { api } from '../lib/api';
import NotificationBell from './NotificationBell';
import { useLanguage } from '../lib/i18n';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const { t, language, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [logoUrl, setLogoUrl] = useState('/logo.png');
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [showLoyaltyDropdown, setShowLoyaltyDropdown] = useState(false);
  const [saleBadge, setSaleBadge] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [platformDarkModeEnabled, setPlatformDarkModeEnabled] = useState(true);
  const [platformLanguageEnabled, setPlatformLanguageEnabled] = useState(true);

  // Dark mode toggle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
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
  }, [mobileMenuOpen]);

  useEffect(() => {
    fetchCartCount();
    if (user && (user.role === 'user' || user.role === 'shop')) fetchLoyalty();
  }, [user]);

  // Fetch logo from platform settings
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const { data } = await api.admin.getPlatformSettings();
        if (data?.logo_url) {
          setLogoUrl(data.logo_url);
          // Also update browser tab favicon
          const favicon = document.getElementById('dynamic-favicon');
          if (favicon) favicon.href = data.logo_url;
        }
        // Check for subscription sale to show badge
        if (data?.subscription_sale_active && data?.subscription_sale_percentage > 0) {
          setSaleBadge({
            percentage: data.subscription_sale_percentage,
          });
        }
        // Also check for seller CTA sale badge toggle
        if (data?.seller_cta_sale_badge_enabled) {
          setSaleBadge(prev => prev || { percentage: data?.subscription_sale_percentage || 0 });
        }
        // Check platform settings for dark mode and language toggle
        if (data?.dark_mode_enabled === false) {
          setPlatformDarkModeEnabled(false);
          // Force light mode if dark mode is disabled
          document.documentElement.classList.remove('dark');
          localStorage.setItem('theme', 'light');
        }
        if (data?.language_toggle_enabled === false) {
          setPlatformLanguageEnabled(false);
        }
      } catch {}
    };
    fetchLogo();
  }, []);

  // Listen for cart updates from other components
  useEffect(() => {
    const handleCartUpdate = () => fetchCartCount();
    const handleLoyaltyUpdate = () => { if (user && (user.role === 'user' || user.role === 'shop')) fetchLoyalty(); };
    window.addEventListener('cart-updated', handleCartUpdate);
    window.addEventListener('loyalty-updated', handleLoyaltyUpdate);
    return () => {
      window.removeEventListener('cart-updated', handleCartUpdate);
      window.removeEventListener('loyalty-updated', handleLoyaltyUpdate);
    };
  }, [user]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const fetchCartCount = async () => {
    try {
      const { data } = await api.cart.get();
      const count = data.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      setCartCount(count);
    } catch (error) {
      setCartCount(0);
    }
  };

  const fetchLoyalty = async () => {
    try {
      const { data } = await api.loyalty.getStatus();
      if (data.enabled) setLoyaltyData(data);
    } catch (error) {}
  };

  // Close loyalty dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (!e.target.closest('[data-loyalty-dropdown]')) setShowLoyaltyDropdown(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const tierIcons = { Bronze: Medal, Silver: Award, Gold: Crown };
  const tierBg = { Bronze: 'bg-amber-100 text-amber-700', Silver: 'bg-slate-200 text-slate-600', Gold: 'bg-yellow-100 text-yellow-600' };


  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileMenuOpen(false);
  };

  // Check if current path is active
  const isActive = (path) => location.pathname === path;

  // Role-aware Messages destination (logged-in users)
  const messagesPath =
    user?.role === 'admin'
      ? '/admin/messages'
      : user?.role === 'shop'
      ? '/shop/messages'
      : '/messages';
  const messagesLabel = language === 'ar' ? 'الرسائل' : 'Messages';

  // Mobile menu item with animation
  const MobileNavItem = ({ to, icon: Icon, label, delay }) => (
    <Link
      to={to}
      onClick={() => setMobileMenuOpen(false)}
      className={`flex items-center justify-between p-4 rounded-xl transition-all duration-300 mobile-nav-item ${
        isActive(to)
          ? 'bg-violet-100 text-violet-700'
          : 'bg-white hover:bg-slate-50 text-slate-700'
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isActive(to) ? 'bg-violet-200' : 'bg-slate-100'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="font-medium">{label}</span>
      </div>
      <ChevronRight className={`h-4 w-4 transition-transform ${isActive(to) ? 'text-violet-500' : 'text-slate-300'}`} />
    </Link>
  );

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-white/95 backdrop-blur-xl shadow-sm border-b border-slate-200/50' 
          : 'bg-white/80 backdrop-blur-xl'
      }`} data-testid="navbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-11 sm:h-14">
            {/* Left side: Logo */}
            <div className="flex items-center gap-2">
              {/* Logo */}
              <Link to="/" className="flex items-center gap-1 group" data-testid="nav-logo">
                <img src={logoUrl} alt="OpenMarketlb" className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg group-hover:scale-105 transition-transform object-contain" />
                <span className="font-heading font-bold text-sm sm:text-lg">
                  <BrandName showLb />
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-3 xl:gap-4 min-w-0 [&_a]:whitespace-nowrap">
              {/* Shop Link - Direct to products */}
              <Link 
                to="/products" 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${isActive('/products') ? 'bg-violet-100 text-violet-700' : 'text-slate-700 hover:bg-slate-100'}`}
                data-testid="nav-shop"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                {t('nav.shop')}
              </Link>
              
              <Link to="/shops/map" className={`transition-colors text-[13px] font-medium flex items-center gap-1 ${isActive('/shops/map') ? 'text-violet-600' : 'text-slate-700 hover:text-primary'}`} data-testid="nav-map">
                <MapPin className="h-3.5 w-3.5" />
                Map
              </Link>

              {/* All Shops link — between Map and Contact */}
              <Link to="/shops" className={`transition-colors text-[13px] font-medium flex items-center gap-1 ${isActive('/shops') ? 'text-violet-600' : 'text-slate-700 hover:text-primary'}`} data-testid="nav-all-shops">
                <Store className="h-3.5 w-3.5" />
                All Shops
              </Link>
              
              <Link to="/contact" className={`transition-colors text-[13px] font-medium ${isActive('/contact') ? 'text-violet-600' : 'text-slate-700 hover:text-primary'}`} data-testid="nav-contact">
                {t('nav.contact')}
              </Link>
              <Link to="/about" className={`transition-colors text-[13px] font-medium ${isActive('/about') ? 'text-violet-600' : 'text-slate-700 hover:text-primary'}`} data-testid="nav-about">
                {t('nav.about')}
              </Link>
              <Link to="/track-order" className={`transition-colors text-[13px] font-medium flex items-center gap-1 ${isActive('/track-order') ? 'text-violet-600' : 'text-slate-700 hover:text-primary'}`} data-testid="nav-track-order">
                <Package className="h-3.5 w-3.5" />
                {t('nav.trackOrder')}
              </Link>
              {/* Profile button for logged-in default users — desktop only, styled like the Dashboard pill (compact) */}
              {user && user.role === 'user' && (
                <Link
                  to="/profile"
                  className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-violet-500 to-indigo-500 text-white rounded-full font-medium text-[11px] hover:from-violet-600 hover:to-indigo-600 transition-all hover:scale-105 shadow-md"
                  data-testid="nav-profile-button"
                >
                  <User className="h-3.5 w-3.5" />
                  Profile
                </Link>
              )}
              {/* Show Become a Seller for non-logged-in users AND logged-in default users (compact when logged in) */}
              {(!user || user.role === 'user') && (
                <Link 
                  to="/become-seller" 
                  className={`relative flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full font-medium hover:from-emerald-600 hover:to-teal-600 transition-all hover:scale-105 shadow-md ${user ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-[13px]'}`}
                  data-testid="nav-become-seller"
                >
                  <Store className="h-3.5 w-3.5" />
                  {t('nav.becomeSeller')}
                  {saleBadge && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-lg" data-testid="sale-badge">
                      {saleBadge.percentage > 0 ? `-${saleBadge.percentage}%` : 'SALE'}
                    </span>
                  )}
                </Link>
              )}
              {/* Show Dashboard link for admin/shop/delivery */}
              {user && (user.role === 'admin' || user.role === 'shop' || user.role === 'delivery') && !location.pathname.match(/^\/shop\/shop-/) && (
                <Link 
                  to={user.role === 'admin' ? '/admin' : user.role === 'shop' ? '/shop/dashboard' : '/delivery/dashboard'} 
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-violet-500 to-indigo-500 text-white rounded-full font-medium text-[13px] hover:from-violet-600 hover:to-indigo-600 transition-all hover:scale-105 shadow-md"
                  data-testid="nav-dashboard-hamburger"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  {user.role === 'admin' ? 'Admin Dashboard' : user.role === 'shop' ? 'Shop Dashboard' : 'Delivery Dashboard'}
                </Link>
              )}
            </div>

            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center gap-1.5 xl:gap-2 flex-shrink-0">
              {/* Language Toggle */}
              {platformLanguageEnabled && (
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600"
                data-testid="language-toggle"
                title={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
              >
                <Globe className="h-3 w-3" />
                {language === 'en' ? 'AR' : 'EN'}
              </button>
              )}

              {/* Dark Mode Toggle */}
              {platformDarkModeEnabled && (
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="flex items-center gap-1 p-1.5 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors border border-slate-200"
                data-testid="dark-mode-toggle"
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {darkMode ? <Sun className="h-3.5 w-3.5 text-amber-500" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
              )}

              <Link to="/wishlist" className="relative p-1.5 text-slate-600 hover:text-primary transition-colors" data-testid="nav-wishlist">
                <Heart className="h-4 w-4" />
              </Link>
              <Link to="/cart" className="relative p-1.5 text-slate-600 hover:text-primary transition-colors" data-testid="nav-cart">
                <ShoppingCart className="h-4 w-4" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[9px] font-bold rounded-full h-3.5 min-w-3.5 px-1 flex items-center justify-center leading-none">
                    {cartCount}
                  </span>
                )}
              </Link>

              {user ? (
                <div className="flex items-center gap-2">
                  {/* Messages button — visible for all logged-in users */}
                  <Link
                    to={messagesPath}
                    className={`relative p-1.5 rounded-lg transition-colors ${isActive(messagesPath) ? 'text-violet-600 bg-violet-50' : 'text-slate-600 hover:text-primary'}`}
                    data-testid="nav-messages"
                    title={messagesLabel}
                    aria-label={messagesLabel}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Link>

                  {/* Notification Bell for admin and shop users */}
                  <NotificationBell userRole={user.role} />
                  
                  {/* Loyalty Tier Badge (for regular users AND shops) */}
                  {(user.role === 'user' || user.role === 'shop') && loyaltyData && (
                    <div className="relative" data-loyalty-dropdown>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowLoyaltyDropdown(!showLoyaltyDropdown); }}
                        className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all hover:scale-105 ${tierBg[loyaltyData.tier?.name] || 'bg-amber-100 text-amber-700'}`}
                        data-testid="loyalty-badge"
                        title={user.role === 'shop' ? 'Shop Loyalty Points' : 'Loyalty Points'}
                      >
                        {(() => { const Icon = tierIcons[loyaltyData.tier?.name] || Medal; return <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />; })()}
                        <span>{loyaltyData.points_balance}</span>
                        <ChevronDown className={`h-2.5 w-2.5 sm:h-3 sm:w-3 transition-transform ${showLoyaltyDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {/* Dropdown */}
                      {showLoyaltyDropdown && (
                        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden" data-testid="loyalty-dropdown">
                          {/* Tier Header */}
                          <div className={`p-4 ${
                            loyaltyData.tier?.name === 'Gold' ? 'bg-gradient-to-r from-yellow-100 to-amber-100' :
                            loyaltyData.tier?.name === 'Silver' ? 'bg-gradient-to-r from-slate-100 to-slate-200' :
                            'bg-gradient-to-r from-amber-50 to-orange-50'
                          }`}>
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${tierBg[loyaltyData.tier?.name] || 'bg-amber-100 text-amber-700'}`}>
                                {(() => { const Icon = tierIcons[loyaltyData.tier?.name] || Medal; return <Icon className="h-6 w-6" />; })()}
                              </div>
                              <div>
                                <p className="font-bold text-lg">{loyaltyData.tier?.name} Member</p>
                                <p className="text-xs opacity-70">{loyaltyData.tier?.multiplier}x points multiplier</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Stats */}
                          <div className="p-4 space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-600">Available Points</span>
                              <span className="font-bold text-lg">{loyaltyData.points_balance?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-600">Redeem Value</span>
                              <span className="font-semibold text-emerald-600">${loyaltyData.redeem_value?.toFixed(2)}</span>
                            </div>
                            
                            {/* Progress */}
                            {loyaltyData.next_tier && (
                              <div>
                                <div className="flex justify-between text-xs text-slate-500 mb-1">
                                  <span>{loyaltyData.tier?.name}</span>
                                  <span>{loyaltyData.next_tier.name}</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-1.5">
                                  <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-1.5 rounded-full" 
                                    style={{ width: `${loyaltyData.progress_to_next_tier}%` }} />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">{loyaltyData.next_tier.min_points - loyaltyData.points_lifetime} pts to {loyaltyData.next_tier.name}</p>
                              </div>
                            )}
                            
                            <Link
                              to={user.role === 'shop' ? '/shop/dashboard' : '/profile'}
                              onClick={() => setShowLoyaltyDropdown(false)}
                              className="block w-full text-center py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-semibold hover:from-amber-600 hover:to-orange-600 transition-all"
                            >
                              {user.role === 'shop' ? 'View in Dashboard' : 'View Rewards'}
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {user.role !== 'admin' && user.role !== 'user' && (
                  <Link to="/profile" className="p-2 text-slate-600 hover:text-primary transition-colors" data-testid="nav-profile">
                    <User className="h-5 w-5" />
                  </Link>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-600" data-testid="nav-logout">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button asChild variant="ghost" size="sm" data-testid="nav-login">
                    <Link to="/auth">{t('nav.login')}</Link>
                  </Button>
                  <Button asChild size="sm" className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700" data-testid="nav-signup">
                    <Link to="/auth?tab=signup">{t('nav.signup')}</Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden flex items-center gap-0.5">
              {/* Become a Seller - mobile compact - only for non-logged in users */}
              {!user && (
                <Link 
                  to="/become-seller" 
                  className="relative flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full font-semibold text-[10px] hover:from-emerald-600 hover:to-teal-600 transition-all shadow-sm whitespace-nowrap"
                  data-testid="nav-become-seller-mobile"
                >
                  <Store className="h-3 w-3 flex-shrink-0" />
                  <span className="hidden xs:inline">Seller</span>
                  <span className="xs:hidden">Sell</span>
                  {saleBadge && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-black px-1 py-0 rounded-full animate-pulse shadow-sm leading-tight">
                      {saleBadge.percentage > 0 ? `-${saleBadge.percentage}%` : '!'}
                    </span>
                  )}
                </Link>
              )}
              {/* Products link - mobile (before Map per requirement) */}
              <Link to="/products" className="p-1.5 text-slate-600 rounded-lg hover:bg-slate-100" data-testid="nav-products-mobile" title="Products">
                <Store className="h-[18px] w-[18px]" />
              </Link>
              {/* Map link - mobile */}
              <Link to="/shops/map" className="p-1.5 text-slate-600 rounded-lg hover:bg-slate-100" data-testid="nav-map-mobile" title="Map">
                <MapPin className="h-[18px] w-[18px]" />
              </Link>
              {/* Mobile Loyalty Points Badge with dropdown - for users AND shops */}
              {user && (user.role === 'user' || user.role === 'shop') && loyaltyData && (
                <div className="relative" data-loyalty-dropdown>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowLoyaltyDropdown(!showLoyaltyDropdown); }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${tierBg[loyaltyData.tier?.name] || 'bg-amber-100 text-amber-700'}`}
                    data-testid="loyalty-badge-mobile"
                  >
                    {(() => { const Icon = tierIcons[loyaltyData.tier?.name] || Medal; return <Icon className="h-3 w-3" />; })()}
                    <span>{loyaltyData.points_balance}</span>
                    <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showLoyaltyDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {/* Mobile Loyalty Dropdown */}
                  {showLoyaltyDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden" data-testid="loyalty-dropdown-mobile">
                      <div className={`p-3 ${
                        loyaltyData.tier?.name === 'Gold' ? 'bg-gradient-to-r from-yellow-100 to-amber-100' :
                        loyaltyData.tier?.name === 'Silver' ? 'bg-gradient-to-r from-slate-100 to-slate-200' :
                        'bg-gradient-to-r from-amber-50 to-orange-50'
                      }`}>
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${tierBg[loyaltyData.tier?.name] || 'bg-amber-100 text-amber-700'}`}>
                            {(() => { const Icon = tierIcons[loyaltyData.tier?.name] || Medal; return <Icon className="h-5 w-5" />; })()}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{loyaltyData.tier?.name} Member</p>
                            <p className="text-[10px] opacity-70">{loyaltyData.tier?.multiplier}x multiplier</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-600">Points</span>
                          <span className="font-bold">{loyaltyData.points_balance?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-600">Value</span>
                          <span className="font-semibold text-emerald-600">${loyaltyData.redeem_value?.toFixed(2)}</span>
                        </div>
                        {loyaltyData.next_tier && (
                          <div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                              <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-1.5 rounded-full" 
                                style={{ width: `${loyaltyData.progress_to_next_tier}%` }} />
                            </div>
                            <p className="text-[9px] text-slate-400 mt-0.5">{loyaltyData.next_tier.min_points - loyaltyData.points_lifetime} pts to {loyaltyData.next_tier.name}</p>
                          </div>
                        )}
                        <Link
                          to={user.role === 'shop' ? '/shop/dashboard' : '/profile'}
                          onClick={() => setShowLoyaltyDropdown(false)}
                          className="block w-full text-center py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-xs font-semibold"
                        >
                          {user.role === 'shop' ? 'View in Dashboard' : 'View Rewards'}
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <Link to="/cart" className="relative p-1.5 text-slate-600 rounded-lg hover:bg-slate-100" data-testid="nav-cart-mobile" title="Cart">
                <ShoppingCart className="h-[18px] w-[18px]" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[9px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Link>
              {/* Wishlist — only for guests on mobile (logged-in users get a Profile icon instead) */}
              {!user && (
                <Link to="/wishlist" className="p-1.5 text-slate-600 rounded-lg hover:bg-slate-100" data-testid="nav-wishlist-mobile" title="Wishlist">
                  <Heart className="h-[18px] w-[18px]" />
                </Link>
              )}
              {/* Profile icon — for logged-in users on mobile (replaces messages + wishlist) */}
              {user && (
                <Link to="/profile" className="p-1.5 text-slate-600 rounded-lg hover:bg-slate-100" data-testid="nav-profile-mobile" title={language === 'ar' ? 'الملف الشخصي' : 'Profile'}>
                  <User className="h-[18px] w-[18px]" />
                </Link>
              )}
              {user && <NotificationBell userRole={user.role} />}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 text-slate-600 hover:text-primary transition-colors relative"
                data-testid="mobile-menu-toggle"
              >
                <div className="relative w-[18px] h-[18px]">
                  <Menu className={`h-[18px] w-[18px] absolute transition-all duration-300 ${mobileMenuOpen ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}`} />
                  <X className={`h-[18px] w-[18px] absolute transition-all duration-300 ${mobileMenuOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}`} />
                </div>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile Menu Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-[85%] max-w-sm bg-slate-50 z-50 md:hidden transform transition-all duration-500 ease-out ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-600 to-indigo-600">
            <div className="flex items-center gap-2">
              <img src={logoUrl} alt="OpenMarketlb" className="h-10 w-10 rounded-lg object-contain" />
              <span className="font-heading font-bold text-lg"><BrandName showLb /></span>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-white/80 hover:text-white">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* User Info (if logged in) */}
          {user && (
            <div className="p-4 bg-white border-b">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 flex items-center justify-center text-white font-bold text-lg">
                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {/* Language Toggle Mobile */}
            {platformLanguageEnabled && (
            <button
              onClick={toggleLanguage}
              className="flex items-center justify-between w-full p-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 transition-all"
              data-testid="language-toggle-mobile"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100">
                  <Globe className="h-5 w-5" />
                </div>
                <span className="font-medium">{language === 'en' ? 'العربية' : 'English'}</span>
              </div>
              <span className="text-xs font-bold text-violet-600 bg-violet-100 px-2 py-1 rounded">{language === 'en' ? 'AR' : 'EN'}</span>
            </button>
            )}

            {/* Dark Mode Toggle Mobile */}
            {platformDarkModeEnabled && (
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center justify-between w-full p-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 transition-all"
              data-testid="dark-mode-toggle-mobile"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100">
                  {darkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5" />}
                </div>
                <span className="font-medium">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors ${darkMode ? 'bg-violet-600' : 'bg-slate-200'} flex items-center p-0.5`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${darkMode ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>
            )}

            <MobileNavItem to="/" icon={Home} label={language === 'ar' ? 'الرئيسية' : 'Home'} delay={50} />
            <MobileNavItem to="/products" icon={Store} label="Products" delay={100} />
            <MobileNavItem to="/shops/map" icon={MapPin} label="Shops Map" delay={125} />
            <MobileNavItem to="/track-order" icon={Package} label="Track Order" delay={150} />
            <MobileNavItem to="/wishlist" icon={Heart} label="Wishlist" delay={200} />
            {user && <MobileNavItem to={messagesPath} icon={MessageCircle} label={messagesLabel} delay={225} />}
            <MobileNavItem to="/contact" icon={Phone} label="Contact" delay={250} />
            <MobileNavItem to="/about" icon={Info} label={language === 'ar' ? 'من نحن' : 'About'} delay={275} />

            {/* Role-specific links */}
            {user?.role === 'admin' && (
              <MobileNavItem to="/admin" icon={LayoutDashboard} label="Admin Dashboard" delay={300} />
            )}
            {user?.role === 'shop' && (
              <MobileNavItem to="/shop/dashboard" icon={Store} label="Shop Dashboard" delay={300} />
            )}
            {user?.role === 'delivery' && (
              <MobileNavItem to="/delivery/dashboard" icon={Package} label="Delivery Dashboard" delay={300} />
            )}
          </div>

          {/* Bottom Actions */}
          <div className="p-4 bg-white border-t space-y-2">
            {user ? (
              <>
                {/* Become a Seller hidden for all logged-in users */}
                {false && user.role === 'user' && (
                  <Link
                    to="/become-seller"
                    onClick={() => setMobileMenuOpen(false)}
                    className="relative flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium"
                  >
                    <Store className="h-5 w-5" />
                    {t('nav.becomeSeller')}
                    {saleBadge && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-lg">
                        {saleBadge.percentage > 0 ? `-${saleBadge.percentage}%` : 'SALE'}
                      </span>
                    )}
                  </Link>
                )}
                {user.role !== 'admin' && (
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-slate-100 text-slate-700 font-medium"
                >
                  <User className="h-5 w-5" />
                  {t('nav.myProfile')}
                </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-red-50 text-red-600 font-medium"
                >
                  <LogOut className="h-5 w-5" />
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium"
                >
                  <User className="h-5 w-5" />
                  {t('nav.loginSignup')}
                </Link>
                <Link
                  to="/become-seller"
                  onClick={() => setMobileMenuOpen(false)}
                  className="relative flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-emerald-50 text-emerald-600 font-medium"
                >
                  <Store className="h-5 w-5" />
                  {t('nav.becomeSeller')}
                  {saleBadge && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-lg">
                      {saleBadge.percentage > 0 ? `-${saleBadge.percentage}%` : 'SALE'}
                    </span>
                  )}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Nav Animation Styles */}
      <style>{`
        .mobile-nav-item {
          opacity: 0;
          transform: translateX(20px);
          animation: slideIn 0.4s ease-out forwards;
        }
        @keyframes slideIn {
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
};

export default Navbar;
