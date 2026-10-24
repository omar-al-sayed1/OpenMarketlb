import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, ArrowRight, CornerDownLeft,
  LayoutDashboard, Banknote, BarChart3, Store, Map, Wallet, Package, ShoppingBag,
  XCircle, CreditCard, Shield, Tag, FolderTree, Users, UserCog, Image as ImageIcon,
  MessageSquare, Inbox, Gift, Megaphone, Crown, Sparkles, Palette, CalendarDays,
  Settings, PlusCircle, ClipboardList, MapPin, Truck,
} from 'lucide-react';

/**
 * Quick page navigator/search for the Admin & Shop top notification bar.
 *
 * - Type to see a live suggestions dropdown (filtered by label + keywords).
 * - Press Enter (or the search button) to jump to the top result.
 * - Arrow keys to move through suggestions; Esc to close.
 * - Mobile-friendly: collapses to an icon that opens a full-width search panel.
 *
 * Admin index includes Admin pages + Delivery/Agent pages.
 * Shop index includes all Shop pages. Agent index includes Agent pages.
 */

const ADMIN_PAGES = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, keywords: ['home', 'overview', 'stats', 'main'] },
  { label: 'Finance Center', path: '/admin/finance-center', icon: Banknote, keywords: ['money', 'revenue', 'profit', 'balance', 'finance', 'earnings'] },
  { label: 'Analytics', path: '/admin/analytics', icon: BarChart3, keywords: ['charts', 'reports', 'insights', 'data', 'metrics'] },
  { label: 'Shops', path: '/admin/shops', icon: Store, keywords: ['stores', 'sellers', 'vendors', 'shop requests'] },
  { label: 'Map', path: '/admin/map', icon: Map, keywords: ['location', 'geography', 'pins'] },
  { label: 'Shop Payouts', path: '/admin/payouts', icon: Wallet, keywords: ['payout', 'withdraw', 'pay sellers'] },
  { label: 'Products', path: '/admin/products', icon: Package, keywords: ['items', 'catalog', 'goods', 'inventory'] },
  { label: 'Orders', path: '/admin/orders', icon: ShoppingBag, keywords: ['purchases', 'sales', 'delivery', 'shipping', 'dispatch'] },
  { label: 'Cancel Requests', path: '/admin/cancel-requests', icon: XCircle, keywords: ['cancel', 'refund requests'] },
  { label: 'Credit Requests', path: '/admin/credit-requests', icon: CreditCard, keywords: ['wallet', 'credit', 'topup', 'top up'] },
  { label: 'Cash Out Requests', path: '/admin/cashout-requests', icon: Banknote, keywords: ['cashout', 'cash out', 'withdraw'] },
  { label: 'Shops Verification', path: '/admin/verification-requests', icon: Shield, keywords: ['verify', 'verification', 'approve', 'kyc'] },
  { label: 'Shop Sales', path: '/admin/shop-sales', icon: Tag, keywords: ['sales', 'discount', 'promo', 'deals'] },
  { label: 'Categories', path: '/admin/categories', icon: FolderTree, keywords: ['category', 'taxonomy', 'tree'] },
  { label: 'Users', path: '/admin/users', icon: Users, keywords: ['customers', 'accounts', 'members', 'people'] },
  { label: 'Agents', path: '/admin/agents', icon: UserCog, keywords: ['delivery agents', 'agent', 'staff', 'delivery', 'drivers', 'couriers'] },
  { label: 'Gallery', path: '/admin/gallery', icon: ImageIcon, keywords: ['images', 'media', 'photos'] },
  { label: 'Messages', path: '/admin/messages', icon: MessageSquare, keywords: ['chat', 'inbox', 'conversations'] },
  { label: 'All Conversations', path: '/admin/all-conversations', icon: MessageSquare, keywords: ['conversations', 'all conversations', 'messages history', 'chat history', 'monitor', 'oversight'] },
  { label: 'Contact Forms', path: '/admin/contact-messages', icon: Inbox, keywords: ['contact', 'support', 'inquiries', 'feedback'] },
  { label: 'Loyalty', path: '/admin/loyalty', icon: Gift, keywords: ['rewards', 'points', 'bonus'] },
  { label: 'Promotions', path: '/admin/promotions', icon: Megaphone, keywords: ['boost', 'sponsored'] },
  { label: 'Advertising', path: '/admin/advertising', icon: Megaphone, keywords: ['advertising', 'ads', 'campaigns', 'email campaigns', 'ppc', 'banner campaigns', 'event sponsorship'] },
  { label: 'Subscription Tiers', path: '/admin/subscription-tiers', icon: Crown, keywords: ['plans', 'tiers', 'subscription', 'pricing'] },
  { label: 'Spin Wheel', path: '/admin/spin-wheel', icon: Sparkles, keywords: ['game', 'rewards', 'spin', 'wheel', 'free spin', 'grant spin'] },
  { label: 'Storefront Themes', path: '/admin/themes', icon: Palette, keywords: ['theme', 'design', 'appearance', 'colors'] },
  { label: 'Events', path: '/admin/events', icon: CalendarDays, keywords: ['banners', 'events', 'home banner', 'popups'] },
  { label: 'Settings', path: '/admin/settings', icon: Settings, keywords: ['config', 'configuration', 'preferences', 'options', 'platform'] },
];

// Delivery / Agent oriented entries surfaced for ADMIN (point to admin-accessible routes).
const ADMIN_DELIVERY_PAGES = [
  { label: 'Delivery Agents', path: '/admin/agents', icon: Truck, keywords: ['delivery', 'agents', 'drivers', 'couriers', 'riders'], group: 'Delivery' },
  { label: 'Order Delivery', path: '/admin/orders', icon: Truck, keywords: ['delivery', 'shipping', 'dispatch', 'fulfilment', 'fulfillment'], group: 'Delivery' },
  { label: 'Delivery Map', path: '/admin/map', icon: MapPin, keywords: ['delivery', 'tracking', 'location', 'route'], group: 'Delivery' },
];

const AGENT_PAGES = [
  { label: 'Dashboard', path: '/agent', icon: LayoutDashboard, keywords: ['home', 'overview', 'main'] },
  { label: 'Shops', path: '/agent/shops', icon: Store, keywords: ['stores', 'sellers', 'vendors'] },
  { label: 'Map', path: '/agent/map', icon: Map, keywords: ['location', 'delivery', 'tracking'] },
  { label: 'Products', path: '/agent/products', icon: Package, keywords: ['items', 'catalog', 'goods'] },
  { label: 'Orders', path: '/agent/orders', icon: ShoppingBag, keywords: ['purchases', 'delivery', 'shipping'] },
  { label: 'Cancel Requests', path: '/agent/cancel-requests', icon: XCircle, keywords: ['cancel', 'refund'] },
  { label: 'Shops Verification', path: '/agent/verification-requests', icon: Shield, keywords: ['verify', 'verification', 'approve'] },
  { label: 'Shop Sales', path: '/agent/shop-sales', icon: Tag, keywords: ['sales', 'discount', 'promo'] },
  { label: 'Categories', path: '/agent/categories', icon: FolderTree, keywords: ['category', 'taxonomy'] },
  { label: 'Users', path: '/agent/users', icon: Users, keywords: ['customers', 'accounts', 'members'] },
  { label: 'Contact Forms', path: '/agent/contact-messages', icon: Inbox, keywords: ['contact', 'support', 'inquiries'] },
  { label: 'Promotions', path: '/agent/promotions', icon: Megaphone, keywords: ['boost', 'ads', 'sponsored'] },
  { label: 'Gallery', path: '/agent/gallery', icon: ImageIcon, keywords: ['images', 'media', 'photos'] },
];

const SHOP_PAGES = [
  { label: 'Dashboard', path: '/shop/dashboard', icon: LayoutDashboard, keywords: ['home', 'overview', 'stats', 'main'] },
  { label: 'Products', path: '/shop/products', icon: Package, keywords: ['items', 'catalog', 'inventory', 'goods'] },
  { label: 'Orders', path: '/shop/orders', icon: ShoppingBag, keywords: ['purchases', 'sales', 'delivery'] },
  { label: 'My Wallet', path: '/shop/wallet', icon: Wallet, keywords: ['money', 'balance', 'earnings', 'wallet'] },
  { label: 'Analytics', path: '/shop/analytics', icon: BarChart3, keywords: ['charts', 'reports', 'insights', 'data'] },
  { label: 'Create Order', path: '/shop/create-order', icon: PlusCircle, keywords: ['new order', 'manual order', 'add order'] },
  { label: 'Add Gift', path: '/shop/gifts', icon: Gift, keywords: ['gift', 'free gift', 'present'] },
  { label: 'Gallery', path: '/shop/gallery', icon: ImageIcon, keywords: ['images', 'media', 'photos'] },
  { label: 'Messages', path: '/shop/messages', icon: MessageSquare, keywords: ['chat', 'inbox', 'support'] },
  { label: 'Boost a Product', path: '/shop/boost', icon: Megaphone, keywords: ['boost', 'promote', 'sponsored'] },
  { label: 'Advertising', path: '/shop/advertising', icon: Megaphone, keywords: ['advertising', 'ads', 'shop', 'campaigns', 'email campaign', 'ppc', 'event sponsorship', 'banner sponsor'] },
  { label: 'Shop Sales', path: '/shop/sales', icon: Tag, keywords: ['sales', 'discount', 'promo', 'deals'] },
  { label: 'Storefront Theme', path: '/shop/theme', icon: Palette, keywords: ['theme', 'design', 'appearance', 'colors'] },
  { label: 'Shop Location', path: '/shop/location', icon: MapPin, keywords: ['location', 'address', 'map'] },
  { label: 'Verification', path: '/shop/verification', icon: Shield, keywords: ['verify', 'verification', 'kyc'] },
  { label: 'Spin the Wheel', path: '/shop/spin', icon: Sparkles, keywords: ['game', 'rewards', 'spin', 'wheel'] },
  { label: 'My Orders', path: '/shop/my-orders', icon: ClipboardList, keywords: ['my purchases', 'bought', 'my orders'] },
  { label: 'Settings', path: '/shop/settings', icon: Settings, keywords: ['config', 'preferences', 'options', 'account'] },
];

const getPagesForRole = (role) => {
  if (role === 'admin') return [...ADMIN_PAGES, ...ADMIN_DELIVERY_PAGES];
  if (role === 'agent') return AGENT_PAGES;
  if (role === 'shop') return SHOP_PAGES;
  return [];
};

const placeholderForRole = (role) => {
  if (role === 'admin') return 'Search admin & delivery pages...';
  if (role === 'agent') return 'Search agent pages...';
  return 'Search shop pages...';
};

const QuickPageSearch = ({ role }) => {
  const navigate = useNavigate();
  const pages = useMemo(() => getPagesForRole(role), [role]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);       // desktop dropdown
  const [mobileOpen, setMobileOpen] = useState(false); // mobile full-width panel
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef(null);
  const desktopInputRef = useRef(null);
  const mobileInputRef = useRef(null);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored = [];
    pages.forEach((p) => {
      const label = p.label.toLowerCase();
      let score = -1;
      if (label === q) score = 100;
      else if (label.startsWith(q)) score = 80;
      else if (label.includes(q)) score = 60;
      else if ((p.keywords || []).some((k) => k.toLowerCase().startsWith(q))) score = 45;
      else if ((p.keywords || []).some((k) => k.toLowerCase().includes(q))) score = 30;
      if (score >= 0) scored.push({ ...p, score });
    });
    scored.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
    return scored.slice(0, 8);
  }, [query, pages]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  // Close desktop dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Lock background scroll when mobile panel is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => mobileInputRef.current?.focus(), 60);
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const go = useCallback((path) => {
    setQuery('');
    setOpen(false);
    setMobileOpen(false);
    navigate(path);
  }, [navigate]);

  const handleSubmit = useCallback(() => {
    if (suggestions.length > 0) {
      go(suggestions[Math.min(activeIdx, suggestions.length - 1)].path);
    }
  }, [suggestions, activeIdx, go]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setMobileOpen(false);
    }
  };

  const SuggestionList = ({ onPick }) => (
    <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto py-1.5" data-testid="quick-search-results">
      {suggestions.length === 0 ? (
        <div className="px-4 py-6 text-center text-slate-400 text-xs">
          {query.trim() ? 'No matching pages' : 'Start typing to search pages'}
        </div>
      ) : (
        suggestions.map((s, idx) => {
          const Icon = s.icon || Search;
          const isActive = idx === activeIdx;
          return (
            <button
              key={`${s.path}-${s.label}`}
              type="button"
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={() => onPick(s.path)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                isActive ? 'bg-violet-50 text-violet-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
              data-testid={`quick-search-item-${s.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <span className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${isActive ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-500'}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{s.label}</span>
                {s.group && <span className="block text-[10px] uppercase tracking-wide text-slate-400">{s.group}</span>}
              </span>
              <ArrowRight className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? 'text-violet-500' : 'text-slate-300'}`} />
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <>
      {/* ===== Desktop inline search ===== */}
      <div ref={containerRef} className="relative hidden md:block w-56 lg:w-72" data-testid="quick-search-desktop">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70 pointer-events-none" />
          <input
            ref={desktopInputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholderForRole(role)}
            className="w-full h-9 pl-9 pr-9 rounded-full bg-white/15 hover:bg-white/20 focus:bg-white text-sm text-white focus:text-slate-800 placeholder-white/70 focus:placeholder-slate-400 border border-white/25 focus:border-white outline-none transition-colors"
            data-testid="quick-search-input"
          />
          {query ? (
            <button
              type="button"
              onClick={() => { setQuery(''); desktopInputRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {open && query.trim() && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden" data-testid="quick-search-dropdown">
            <SuggestionList onPick={go} />
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> to open</span>
              <button type="button" onClick={handleSubmit} className="flex items-center gap-1 text-violet-600 font-semibold hover:text-violet-700" data-testid="quick-search-go">
                Search <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== Mobile trigger button ===== */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="Search pages"
        data-testid="quick-search-mobile-trigger"
      >
        <Search className="h-4 w-4 text-white" />
      </button>

      {/* ===== Mobile full-width search panel ===== */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[60]" data-testid="quick-search-mobile-panel">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 right-0 top-0 bg-white shadow-2xl rounded-b-2xl overflow-hidden">
            <div className="flex items-center gap-2 p-3 border-b border-slate-100">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  ref={mobileInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholderForRole(role)}
                  className="w-full h-11 pl-9 pr-3 rounded-xl bg-slate-100 focus:bg-white text-sm text-slate-800 placeholder-slate-400 border border-transparent focus:border-violet-300 outline-none transition-colors"
                  data-testid="quick-search-mobile-input"
                />
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                className="h-11 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
                data-testid="quick-search-mobile-go"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="h-11 w-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SuggestionList onPick={go} />
          </div>
        </div>
      )}
    </>
  );
};

export default QuickPageSearch;
