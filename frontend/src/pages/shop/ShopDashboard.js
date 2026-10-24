import React, { useEffect, useState } from 'react';
import { Package, ShoppingCart, DollarSign, TrendingUp, AlertCircle, AlertTriangle, CreditCard, ShoppingBag, Loader2, Edit, Link2, FileDown, Lightbulb, Crown, Megaphone, Zap, Wallet, Gift, Sparkles, Eye, BarChart3, ArrowUpRight, Activity, Store, Clock, ChevronRight, Layers, Target, Star, Shield, Camera, Image as ImageIcon, Rocket, Mail, MousePointerClick, RefreshCw } from 'lucide-react';
import ShopLayout from '../../components/ShopLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TierBadge from '../../components/TierBadge';
import GiftDialog from '../../components/GiftDialog';
import SpinWheel from '../../components/SpinWheel';
import ComingSoonAd from '../../components/ComingSoonAd';
import ShopOnboarding from '../../components/ShopOnboarding';
import { SubscribeConfirmDialog, SubscribedWelcomeDialog, FirstLoginWelcomeDialog } from '../../components/ShopSubscriptionDialogs';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const ShopDashboard = () => {
  const navigate = useNavigate();
  const [shop, setShop] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [tierInfo, setTierInfo] = useState(null);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [proUpgradeOpen, setProUpgradeOpen] = useState(false);
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [giftProductId, setGiftProductId] = useState(null);
  const [giftProductName, setGiftProductName] = useState('');
  const [spinWheelOpen, setSpinWheelOpen] = useState(false);
  const [spinInfo, setSpinInfo] = useState(null);
  const [shopGifts, setShopGifts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [cashbackPercent, setCashbackPercent] = useState(50);
  const [subscriptionPrice, setSubscriptionPrice] = useState(19);
  const [planFeatures, setPlanFeatures] = useState([]);
  const [planName, setPlanName] = useState('Subscription');
  const [confirmSubscribeOpen, setConfirmSubscribeOpen] = useState(false);
  const [welcomeBenefitsOpen, setWelcomeBenefitsOpen] = useState(false);
  const [firstLoginData, setFirstLoginData] = useState(null);
  const [firstLoginOpen, setFirstLoginOpen] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const coverInputRef = React.useRef(null);
  const logoInputRef = React.useRef(null);
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    fetchData();
    // Fetch loyalty data for shop (shops also have loyalty points)
    api.loyalty.getStatus().then(({ data }) => { if (data?.enabled) setLoyaltyData(data); }).catch(() => {});
    // Fetch the admin-configured shop cashback percentage + subscription price
    api.admin.getPlatformSettings().then(({ data }) => {
      if (data?.shop_cashback_percent != null) setCashbackPercent(Number(data.shop_cashback_percent));
      if (data?.subscription_price != null) setSubscriptionPrice(Number(data.subscription_price));
    }).catch(() => {});
    // Subscription plan features/perks — single source of truth (admin-configured)
    api.shop.getSubscriptionPricing().then(({ data }) => {
      if (Array.isArray(data?.features)) setPlanFeatures(data.features);
      if (data?.plan_name) setPlanName(data.plan_name);
      if (data?.monthly?.price != null) setSubscriptionPrice(Number(data.monthly.price));
    }).catch(() => {});
    // First-login welcome popup (shows once)
    api.shop.getWelcomePopup().then(({ data }) => {
      if (data?.show) { setFirstLoginData(data); setFirstLoginOpen(true); }
    }).catch(() => {});
  }, []);

  const dismissFirstLogin = () => {
    setFirstLoginOpen(false);
    api.shop.dismissWelcomePopup().catch(() => {});
  };

  const handleRenew = async () => {
    setRenewing(true);
    try {
      const { data } = await api.shop.renewSubscription();
      toast.success(data.message || 'Subscription renewed!');
      fetchData();
      window.dispatchEvent(new Event('wallet-updated'));
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to renew');
    } finally { setRenewing(false); }
  };

  // Subscribed = requires a subscription AND it's active/trial (free shops are not subscribers)
  const isSubscribed = shop && shop.subscription_required !== false && ['active', 'trial'].includes(shop.subscription_status);
  const walletBalance = Number(shop?.wallet_balance || 0);

  const handleSubscribeWithWallet = async () => {
    if (walletBalance < subscriptionPrice) {
      toast.error(`Not enough wallet balance. You need $${subscriptionPrice.toFixed(2)} but have $${walletBalance.toFixed(2)}.`);
      return;
    }
    setSubscribing(true);
    try {
      const { data } = await api.shop.subscribe('wallet', 1);
      setConfirmSubscribeOpen(false);
      await fetchData();
      window.dispatchEvent(new Event('wallet-updated'));
      // Welcoming popup with the benefits a subscribed shop now has
      setWelcomeBenefitsOpen(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to subscribe');
    } finally { setSubscribing(false); }
  };

  const fetchData = async () => {
    try {
      const [shopRes, analyticsRes, subRes, tierRes, promoRes, spinRes, giftsRes] = await Promise.allSettled([
        api.shop.getProfile(),
        api.shop.getAnalytics(),
        api.shop.getSubscription(),
        api.shopTier.getInfo(),
        api.shopPromotions.getAll(),
        api.shopSpin.getInfo(),
        api.shopGifts.getAll()
      ]);
      if (shopRes.status === 'fulfilled') setShop(shopRes.value.data);
      if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value.data);
      if (subRes.status === 'fulfilled') setSubscription(subRes.value.data);
      if (tierRes.status === 'fulfilled') setTierInfo(tierRes.value.data);
      if (promoRes.status === 'fulfilled') setPromotions(promoRes.value.data?.promotions?.filter(p => p.status === 'active') || []);
      if (spinRes.status === 'fulfilled') setSpinInfo(spinRes.value.data);
      if (giftsRes.status === 'fulfilled') setShopGifts(giftsRes.value.data?.gifts || []);
      // Fetch recent orders
      try { const { data } = await api.shop.getOrders(); setRecentOrders((data.orders || data || []).slice(0, 5)); } catch {}
    } catch (error) {
      console.error('Failed to fetch data', error);
      if (error.response?.status === 403) {
        toast.error('Shop access required');
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = async () => {
    try {
      await api.shop.startTrial();
      toast.success('Trial started!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start trial');
    }
  };

  const handleSubscribeWithCard = async () => {
    setSubscribing(true);
    try {
      const { data } = await api.shop.subscribe('stripe', 1);
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error('Failed to create checkout session');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start subscription');
    } finally {
      setSubscribing(false);
    }
  };

  // ===== Quick Cover/Logo Upload =====
  const uploadImageAndUpdateShop = async (file, field) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large (max 10MB)');
      return;
    }
    if (field === 'banner') setUploadingCover(true);
    else setUploadingLogo(true);
    try {
      const resp = await api.shop.uploadFile(file);
      const url = `${BACKEND_URL}${resp.data.url}`;
      await api.shop.updateProfile({ [field]: url });
      // Update local state immediately for snappy UX
      setShop((prev) => prev ? { ...prev, [field]: url } : prev);
      toast.success(field === 'banner' ? 'Cover photo updated' : 'Logo updated');
    } catch (err) {
      console.error(err);
      toast.error('Upload failed');
    } finally {
      if (field === 'banner') setUploadingCover(false);
      else setUploadingLogo(false);
    }
  };

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) uploadImageAndUpdateShop(file, 'banner');
  };
  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) uploadImageAndUpdateShop(file, 'logo');
  };

  if (loading) {
    return (
      <ShopLayout>
        <div className="flex h-full items-center justify-center min-h-[80vh]">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-emerald-500 animate-spin" />
            <Store className="absolute inset-0 m-auto h-6 w-6 text-emerald-600" />
          </div>
        </div>
      </ShopLayout>
    );
  }

  const isSubscriptionActive = subscription?.subscription_status === 'trial' || subscription?.subscription_status === 'active' || subscription?.subscription_required === false;
  const isExpired = (subscription?.subscription_status === 'expired' || subscription?.is_expired) && subscription?.subscription_required !== false;
  const isPending = subscription?.subscription_status === 'pending';

  return (
    <>
    <ShopLayout>
      <div className="p-3 sm:p-5 lg:p-8 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 min-h-screen" data-testid="shop-dashboard-content">
        
        {/* ===== HERO COVER + LOGO (Creative, Modern) ===== */}
        <div className="relative overflow-hidden rounded-3xl mb-8 bg-white border border-slate-100 shadow-sm" style={{ animation: 'fadeIn 0.6s ease-out' }} data-testid="shop-cover-logo-hero">
          {/* COVER PHOTO */}
          <div className="relative h-40 sm:h-52 lg:h-60 w-full overflow-hidden">
            {shop?.banner ? (
              <img src={shop.banner} alt={`${shop.name} cover`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500" />
            )}
            {/* Soft gradient overlay for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent pointer-events-none" />
            {/* Decorative grain pattern */}
            <div className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
            {/* Edit cover button */}
            <button
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-white/40 text-slate-700 text-xs font-semibold shadow-lg hover:bg-white hover:scale-105 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="edit-cover-photo-btn"
              title="Change cover photo"
            >
              {uploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              {uploadingCover ? 'Uploading...' : 'Edit Cover'}
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverChange}
              data-testid="cover-file-input"
            />
            {/* PRO badge removed — tier system no longer used */}
          </div>

          {/* LOGO + INFO BAR */}
          <div className="relative px-4 sm:px-6 lg:px-8 pb-5 pt-0">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-6 -mt-12 sm:-mt-14 lg:-mt-16">
              {/* Logo with edit button */}
              <div className="relative group flex-shrink-0">
                <div className="absolute -inset-1 bg-gradient-to-tr from-emerald-400 via-teal-400 to-cyan-400 rounded-3xl opacity-50 blur-md group-hover:opacity-90 transition-opacity duration-500" />
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-3xl border-4 border-white shadow-2xl overflow-hidden bg-white">
                  {shop?.logo ? (
                    <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                      <Store className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                    </div>
                  )}
                </div>
                {/* Small edit logo button */}
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg ring-2 ring-white flex items-center justify-center transition-transform hover:scale-110 disabled:opacity-60 disabled:cursor-not-allowed"
                  data-testid="edit-logo-btn"
                  title="Change logo"
                >
                  {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                  data-testid="logo-file-input"
                />
              </div>

              {/* Shop name + date — nudged down slightly on laptop so it isn't stuck to the cover */}
              <div className="flex-1 min-w-0 pt-2 lg:pt-0 lg:pb-2 lg:translate-y-2">
                <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight truncate" data-testid="shop-dashboard-title">
                    {shop?.name || 'Your Shop'}
                  </h1>
                  {shop?.is_verified && (
                    <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full">
                      <Shield className="h-3 w-3" /> Verified
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-sm flex items-center gap-2 flex-wrap">
                  <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                  {subscription?.subscription_end && isSubscriptionActive && subscription?.subscription_required !== false && (
                    <span className="text-emerald-600 font-medium">· {Math.ceil((new Date(subscription.subscription_end) - new Date()) / (1000 * 60 * 60 * 24))} days left</span>
                  )}
                </p>
              </div>

              {/* Quick actions */}
              <div className="flex flex-wrap items-center gap-2 lg:pb-1">
                <Button size="sm" onClick={() => navigate('/')} className="rounded-full text-xs bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white shadow-sm shadow-violet-200" data-testid="continue-shopping-btn">
                  <ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Continue Shopping
                </Button>
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/shop/${shop?.id}`); toast.success('Link copied!'); }} className="rounded-full text-xs border-slate-200 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50" data-testid="copy-shop-link-btn">
                  <Link2 className="h-3.5 w-3.5 mr-1.5" /> Copy Link
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/shop/settings')} className="rounded-full text-xs border-slate-200 hover:border-slate-300">
                  <Edit className="h-3.5 w-3.5 mr-1.5" /> Settings
                </Button>
                <Button size="sm" onClick={() => { setGiftDialogOpen(true); setGiftProductId(null); setGiftProductName(''); }} className="rounded-full text-xs bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-sm shadow-pink-200" data-testid="add-gift-btn">
                  <Gift className="h-3.5 w-3.5 mr-1.5" /> Gift
                </Button>
                <Button variant="outline" size="sm" onClick={async () => {
                  try {
                    const response = await api.shop.downloadReport();
                    const blob = new Blob([response.data], { type: 'application/pdf' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url;
                    a.download = `shop_report_${new Date().toISOString().split('T')[0]}.pdf`;
                    document.body.appendChild(a); a.click();
                    window.URL.revokeObjectURL(url); document.body.removeChild(a);
                    toast.success('Report downloaded!');
                  } catch { toast.error('Failed to download report'); }
                }} className="rounded-full text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50" data-testid="download-shop-report-btn">
                  <FileDown className="h-3.5 w-3.5 mr-1.5" /> Report
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ===== ONBOARDING WIZARD ===== */}
        <div className="mb-6">
          <ShopOnboarding />
        </div>

        {/* ===== SUBSCRIBE CTA (only for shops without an active subscription) ===== */}
        {!isSubscribed && (
          <div className="relative overflow-hidden rounded-2xl mb-6 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-5 sm:p-6 shadow-xl text-white" data-testid="shop-subscribe-card">
            <div className="absolute -top-10 -right-10 w-44 h-44 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-12 left-1/4 w-32 h-32 bg-white/10 rounded-full blur-xl" />
            <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"><Crown className="h-6 w-6" /></div>
                <div>
                  <h3 className="text-lg font-extrabold tracking-tight">Subscribe &amp; unlock monthly perks</h3>
                  <p className="text-white/85 text-xs mb-2.5">Get more from your shop, every month from your subscription date.</p>
                  <div className="flex flex-wrap gap-2">
                    {(planFeatures.length ? planFeatures : ['1 free spin / month', '2 sponsors / month', 'Lower commissions']).slice(0, 4).map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-xs font-semibold bg-white/15 rounded-full px-2.5 py-1"><Sparkles className="h-3 w-3" /> {f}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-center lg:text-right flex-shrink-0">
                <div className="text-3xl font-black leading-none">${subscriptionPrice.toFixed(2)}<span className="text-sm font-medium text-white/80">/mo</span></div>
                <p className="text-[11px] text-white/85 mt-1 mb-2">Paid from wallet — ${walletBalance.toFixed(2)} available</p>
                <Button
                  onClick={() => walletBalance < subscriptionPrice ? navigate('/shop/wallet') : setConfirmSubscribeOpen(true)}
                  disabled={subscribing}
                  className="bg-white text-orange-600 hover:bg-orange-50 font-bold shadow disabled:opacity-70"
                  data-testid="shop-subscribe-btn"
                >
                  {subscribing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Crown className="h-4 w-4 mr-1.5" />}
                  {walletBalance < subscriptionPrice ? 'Add wallet funds to subscribe' : 'Subscribe now'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ===== YOUR SUBSCRIPTION PLAN (subscribed shops) — above cashback/loyalty ===== */}
        {isSubscribed && (() => {
          const end = subscription?.subscription_end ? new Date(subscription.subscription_end) : null;
          const daysLeft = end ? Math.max(0, Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24))) : null;
          const canRenew = walletBalance >= subscriptionPrice;
          return (
            <div className="relative overflow-hidden rounded-2xl mb-6 p-5 sm:p-6 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white shadow-xl shadow-violet-500/15" data-testid="shop-plan-card" style={{ animation: 'slideUp 0.4s ease-out' }}>
              <div className="absolute -top-10 -right-10 w-44 h-44 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-12 left-1/4 w-32 h-32 bg-white/10 rounded-full blur-xl" />
              <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                    <Crown className="h-6 w-6 text-yellow-300" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Your Plan Subscription</p>
                    <h3 className="text-lg font-extrabold tracking-tight">{planName}</h3>
                    <div className="text-xs text-white/85 mt-1 space-y-0.5">
                      {end && (
                        <p>Active until <strong>{end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>{daysLeft != null && <span className="text-white/70"> · {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining</span>}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-center lg:text-right flex-shrink-0">
                  <Button
                    onClick={canRenew ? handleRenew : () => navigate('/shop/wallet')}
                    disabled={renewing}
                    className="bg-white text-violet-700 hover:bg-violet-50 font-bold shadow disabled:opacity-70"
                    data-testid="shop-renew-btn"
                  >
                    {renewing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
                    {canRenew ? `Renew +30 days ($${subscriptionPrice.toFixed(2)})` : 'Add funds to renew'}
                  </Button>
                  <p className="text-[11px] text-white/70 mt-1.5">
                    {canRenew ? `Paid from wallet — $${walletBalance.toFixed(2)} available` : `Need $${subscriptionPrice.toFixed(2)} · you have $${walletBalance.toFixed(2)}`}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ===== SHOP CASHBACK & LOYALTY INFO BANNER ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6" data-testid="shop-cashback-loyalty-row">
          {/* Cashback Information Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200/60 rounded-2xl p-5 shadow-sm" data-testid="shop-cashback-info">
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-300/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-cyan-300/20 rounded-full blur-2xl" />
            <div className="relative flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200 flex-shrink-0">
                <Wallet className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-base text-slate-900">Special Shop Cashback</h3>
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wide bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                    <Sparkles className="h-2.5 w-2.5" /> {cashbackPercent}%
                  </span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  You earn <strong className="text-emerald-700">{cashbackPercent}% of the commission</strong> back as cashback when your order is <strong>paid</strong>. The rest goes to admin, and your share is credited to your shop wallet once payment is confirmed.
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/70 border border-emerald-200/80 text-emerald-700 rounded-full text-[11px] font-semibold backdrop-blur-sm">
                  <DollarSign className="h-3 w-3" />
                  Example: $10 commission → ${(10 * cashbackPercent / 100).toFixed(2)} credited after payment
                </div>
                <div className="mt-3">
                  <Button size="sm" onClick={() => navigate('/products')} className="rounded-full text-xs bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-sm" data-testid="cashback-continue-shopping">
                    <ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Continue Shopping
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Loyalty Points Card (Shop) */}
          {loyaltyData && loyaltyData.enabled !== false ? (
            <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 border border-amber-200/60 rounded-2xl p-5 shadow-sm" data-testid="shop-loyalty-card">
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-300/20 rounded-full blur-2xl" />
              <div className="relative flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-200 flex-shrink-0">
                  <Star className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-base text-slate-900">Loyalty Points</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      {loyaltyData.tier?.name || 'Member'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mb-2">Earn points & redeem on every purchase, just like regular customers.</p>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Balance</p>
                      <p className="text-xl font-black text-slate-900">{(loyaltyData.points_balance || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Worth</p>
                      <p className="text-xl font-black text-emerald-700">${(loyaltyData.redeem_value || 0).toFixed(2)}</p>
                    </div>
                    <div className="ml-auto">
                      <Button 
                        size="sm"
                        onClick={() => navigate('/cart')}
                        className="rounded-full text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm"
                        data-testid="shop-redeem-loyalty-btn"
                      >
                        Redeem Now
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-center gap-4" data-testid="shop-loyalty-card-empty">
              <div className="w-12 h-12 rounded-2xl bg-slate-200 flex items-center justify-center">
                <Star className="h-6 w-6 text-slate-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base text-slate-700 mb-0.5">Loyalty Program</h3>
                <p className="text-sm text-slate-500">Place an order to start earning loyalty points!</p>
              </div>
              <Button size="sm" onClick={() => navigate('/')} variant="outline" className="rounded-full text-xs">
                Shop Now
              </Button>
            </div>
          )}
        </div>

        {/* ===== ALERTS ===== */}
        {isPending && (
          <div className="bg-amber-50 border border-amber-200/70 rounded-2xl p-5 mb-6 flex items-start gap-4" style={{ animation: 'slideUp 0.4s ease-out' }}>
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900 text-sm">Pending Admin Activation</h3>
              <p className="text-amber-700 text-xs mt-0.5">Your subscription request is being reviewed. You'll receive an email once activated.</p>
            </div>
          </div>
        )}

        {isExpired && (
          <div className="bg-red-50 border border-red-200/70 rounded-2xl p-5 mb-6" data-testid="expired-subscription-alert" style={{ animation: 'slideUp 0.4s ease-out' }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 text-sm">Subscription Expired</h3>
                <p className="text-red-700 text-xs mt-0.5 mb-3">Your products are no longer visible. Renew to continue selling.</p>
                <div className="flex gap-2">
                  <Button onClick={handleSubscribeWithCard} disabled={subscribing} size="sm" className="bg-red-600 hover:bg-red-700 text-xs rounded-full" data-testid="renew-card-btn">
                    {subscribing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CreditCard className="h-3.5 w-3.5 mr-1" />}
                    Renew (${subscription?.price}/mo)
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Unverified Seller Warning */}
        {shop && !shop.is_verified && isSubscriptionActive && (
          <div className="bg-orange-50 border border-orange-200/70 rounded-2xl p-5 mb-6" data-testid="unverified-seller-warning" style={{ animation: 'slideUp 0.4s ease-out 0.1s both' }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 text-sm">Shop Not Verified</h3>
                <p className="text-orange-700 text-xs mt-0.5 mb-3">Verified sellers get higher ranking in search results and a trusted badge. Complete verification to boost your visibility.</p>
                <Button onClick={() => navigate('/shop/verification')} size="sm" className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-xs rounded-full text-white" data-testid="get-verified-btn">
                  <Shield className="h-3.5 w-3.5 mr-1.5" /> Get Verified Now
                </Button>
              </div>
            </div>
          </div>
        )}

        {!isPending && !isSubscriptionActive && !isExpired && subscription?.subscription_status === 'none' && (
          <div className="bg-sky-50 border border-sky-200/70 rounded-2xl p-5 mb-6" style={{ animation: 'slideUp 0.4s ease-out' }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                <Zap className="h-5 w-5 text-sky-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sky-900 text-sm">Get Started</h3>
                <p className="text-sky-700 text-xs mt-0.5 mb-3">Start your {subscription?.trial_days}-day free trial or subscribe to begin selling.</p>
                <div className="flex gap-2">
                  <Button onClick={handleStartTrial} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs rounded-full">Start Free Trial</Button>
                  <Button variant="outline" onClick={handleSubscribeWithCard} disabled={subscribing} size="sm" className="text-xs rounded-full">
                    {subscribing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CreditCard className="h-3.5 w-3.5 mr-1" />} Pay with Card
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== REVENUE + WALLET HERO CARDS ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8">
          {/* Revenue Card - 3 cols */}
          <div className="lg:col-span-3 relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-xl shadow-emerald-500/15" data-testid="revenue-banner" style={{ animation: 'slideUp 0.5s ease-out' }}>
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
            <div className="absolute top-1/2 right-1/4 w-4 h-4 bg-white/20 rounded-full" style={{ animation: 'float 4s ease-in-out infinite' }} />
            <div className="absolute bottom-1/3 right-1/3 w-2 h-2 bg-white/30 rounded-full" style={{ animation: 'float 3s ease-in-out infinite 1.5s' }} />
            
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <span className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">Net Revenue</span>
              </div>
              <p className="text-4xl sm:text-5xl font-black tracking-tight mb-1" style={{ animation: 'scaleIn 0.6s ease-out 0.2s both' }}>
                ${analytics?.total_revenue?.toFixed(2) || '0.00'}
              </p>
              <p className="text-emerald-200 text-xs">Credited to your wallet after commission</p>
              
              <div className="flex gap-3 mt-5">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10">
                  <p className="text-emerald-200 text-[10px] font-medium uppercase">Gross Sales</p>
                  <p className="text-lg font-bold">${analytics?.gross_revenue?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10">
                  <p className="text-emerald-200 text-[10px] font-medium uppercase">Total Orders</p>
                  <p className="text-lg font-bold">{analytics?.total_orders || 0}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10">
                  <p className="text-emerald-200 text-[10px] font-medium uppercase">Avg Order</p>
                  <p className="text-lg font-bold">${analytics?.total_orders > 0 ? (analytics.total_revenue / analytics.total_orders).toFixed(0) : '0'}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Wallet + Plan Card - 2 cols */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex-1 relative overflow-hidden rounded-2xl p-5 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all duration-500" style={{ animation: 'slideUp 0.6s ease-out 0.1s both' }}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-violet-50 to-transparent rounded-full" />
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm shadow-violet-200">
                  <Wallet className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Wallet Balance</p>
                  <p className="text-2xl font-black text-slate-900">${(tierInfo?.wallet_balance || 0).toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Monthly credit: <span className="text-violet-600 font-semibold">${tierInfo?.monthly_wallet_credit || 0}</span></span>
                <Button onClick={() => navigate('/shop/wallet')} size="sm" variant="ghost" className="text-[10px] text-violet-600 hover:text-violet-700 h-6 px-2">
                  View <ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 relative overflow-hidden rounded-2xl p-5 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all duration-500" style={{ animation: 'slideUp 0.7s ease-out 0.2s both' }}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-emerald-50 to-transparent rounded-full" />
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-200">
                  <Layers className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Shop Status</p>
                  <p className="text-lg font-bold text-slate-900 capitalize">Approved</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isSubscriptionActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {subscription?.subscription_status || 'None'}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* ===== STATS GRID - Glassmorphism cards ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Products', value: analytics?.products_count || 0, icon: Package, color: 'from-blue-500 to-indigo-500', bg: 'bg-blue-50', text: 'text-blue-700', shadow: 'shadow-blue-100' },
            { label: 'Low Stock', value: analytics?.low_stock_count || 0, icon: AlertCircle, color: 'from-rose-500 to-red-500', bg: 'bg-rose-50', text: 'text-rose-700', shadow: 'shadow-rose-100' },
            { label: 'Commission', value: `${analytics?.commission_percentage || 0}%`, icon: Target, color: 'from-amber-500 to-orange-500', bg: 'bg-amber-50', text: 'text-amber-700', shadow: 'shadow-amber-100' },
            { label: 'Promotions', value: promotions.length, icon: Megaphone, color: 'from-violet-500 to-purple-500', bg: 'bg-violet-50', text: 'text-violet-700', shadow: 'shadow-violet-100' },
            { label: 'Gifts', value: shopGifts.length, icon: Gift, color: 'from-pink-500 to-rose-500', bg: 'bg-pink-50', text: 'text-pink-700', shadow: 'shadow-pink-100' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`relative overflow-hidden rounded-2xl p-4 bg-white border border-slate-100 shadow-sm ${stat.shadow} hover:shadow-md hover:-translate-y-1 transition-all duration-500 group`}
              style={{ animation: `slideUp 0.4s ease-out ${0.1 + i * 0.08}s both` }}
              data-testid={`stat-${stat.label.toLowerCase().replace(' ', '-')}`}
            >
              <div className={`absolute -top-3 -right-3 w-14 h-14 rounded-full bg-gradient-to-br ${stat.color} opacity-[0.08] group-hover:opacity-[0.15] group-hover:scale-125 transition-all duration-500`} />
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className="h-4 w-4 text-white" />
              </div>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* ===== SPIN + GIFTS ROW ===== */}
        {isSubscriptionActive && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* Lucky Spin Widget */}
            <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white shadow-lg shadow-violet-500/15 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-500" data-testid="spin-wheel-widget" style={{ animation: 'slideUp 0.5s ease-out 0.3s both' }}>
              <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/10 rounded-full" style={{ animation: 'float 5s ease-in-out infinite' }} />
              <div className="absolute bottom-4 left-4 w-16 h-16 bg-white/5 rounded-full" style={{ animation: 'float 4s ease-in-out infinite 1s' }} />
              <div className="absolute top-1/2 right-1/3 w-2 h-2 bg-white/40 rounded-full" style={{ animation: 'float 3s ease-in-out infinite 0.5s' }} />
              
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">Lucky Spin</h3>
                      <p className="text-violet-200 text-[10px]">Win wallet credits & rewards</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={() => setSpinWheelOpen(true)} className="bg-white text-violet-700 hover:bg-violet-50 font-bold rounded-full shadow-lg shadow-white/20 hover:scale-105 transition-transform duration-300" size="sm" data-testid="open-spin-wheel-btn">
                    <Sparkles className="h-4 w-4 mr-1.5" /> Spin Now
                  </Button>
                  <div className="text-[10px] text-violet-200">
                    <p>{spinInfo?.free_spins || 0} free spins available</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Gifts Widget */}
            <div className="relative overflow-hidden rounded-2xl p-6 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all duration-500" data-testid="gifts-widget" style={{ animation: 'slideUp 0.5s ease-out 0.4s both' }}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-pink-50 to-transparent rounded-full" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-sm shadow-pink-200">
                      <Gift className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Product Gifts</h3>
                      <p className="text-[10px] text-slate-400">{shopGifts.length} active gift{shopGifts.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>
                {shopGifts.length > 0 ? (
                  <div className="space-y-2 max-h-24 overflow-y-auto scrollbar-hide">
                    {shopGifts.slice(0, 3).map(g => (
                      <div key={g.id} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                        {g.gift_image && <img src={g.gift_image} alt="" className="w-7 h-7 rounded-lg object-cover" />}
                        <p className="text-xs font-medium text-slate-700 truncate flex-1">{g.gift_name}</p>
                        <span className="text-[9px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-full">Active</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Add gifts to attract more customers</p>
                )}
                <Button variant="outline" size="sm" className="mt-3 text-[10px] rounded-full h-7" onClick={() => navigate('/shop/products')}>
                  Manage Gifts <ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ===== ADVERTISING HUB CTA - Creative attention-grabber ===== */}
        <div
          onClick={() => navigate('/shop/advertising')}
          className="group relative overflow-hidden rounded-2xl mb-8 cursor-pointer transition-all duration-500 hover:-translate-y-1"
          data-testid="shop-advertising-hero-cta"
          style={{ animation: 'slideUp 0.5s ease-out 0.45s both' }}
        >
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600 via-violet-600 to-indigo-700" />
          {/* Animated glows */}
          <div className="absolute -top-12 -right-12 w-56 h-56 bg-pink-400/30 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
          <div className="absolute -bottom-16 -left-12 w-52 h-52 bg-violet-300/20 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700" />
          <div className="absolute top-1/2 right-1/3 w-2.5 h-2.5 bg-white/70 rounded-full" style={{ animation: 'float 3.5s ease-in-out infinite' }} />
          <div className="absolute bottom-1/3 right-1/4 w-2 h-2 bg-white/60 rounded-full" style={{ animation: 'float 4s ease-in-out infinite 0.7s' }} />
          <div className="absolute top-1/3 left-1/3 w-1.5 h-1.5 bg-white/60 rounded-full" style={{ animation: 'float 3s ease-in-out infinite 1.4s' }} />
          {/* Diagonal shine sweep on hover */}
          <div className="absolute -inset-x-1/4 inset-y-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-[1500ms] ease-out pointer-events-none" />

          <div className="relative px-5 sm:px-8 py-6 sm:py-7 flex flex-col md:flex-row md:items-center gap-5 text-white">
            {/* Left: icon + headline */}
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-white/30 rounded-2xl blur-md group-hover:blur-lg transition-all duration-500" />
                <div className="relative w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-2xl group-hover:rotate-6 group-hover:scale-110 transition-all duration-500">
                  <Rocket className="h-7 w-7" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 border border-white/30 backdrop-blur-sm text-[10px] font-black uppercase tracking-widest mb-1.5">
                  <Sparkles className="h-2.5 w-2.5" /> Advertising Hub
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
                  Grow your shop faster <span className="hidden sm:inline">— launch campaigns, ads & sponsorships</span>
                </h2>
                <p className="text-white/85 text-xs sm:text-sm font-medium mt-1 max-w-xl">
                  Email blasts, Pay-Per-Click ads, product boosts & home-banner sponsorships — all paid from your wallet.
                </p>
              </div>
            </div>

            {/* Right: 3 pill features + CTA */}
            <div className="flex flex-col gap-2.5 md:items-end shrink-0">
              <div className="grid grid-cols-3 gap-1.5 w-full md:w-auto">
                <div className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl bg-white/15 border border-white/20 backdrop-blur-sm">
                  <Mail className="h-4 w-4 text-white/90" />
                  <span className="text-[10px] font-bold tracking-wide">Email</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl bg-white/15 border border-white/20 backdrop-blur-sm">
                  <MousePointerClick className="h-4 w-4 text-white/90" />
                  <span className="text-[10px] font-bold tracking-wide">PPC</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl bg-white/15 border border-white/20 backdrop-blur-sm">
                  <Crown className="h-4 w-4 text-white/90" />
                  <span className="text-[10px] font-bold tracking-wide">Banners</span>
                </div>
              </div>
              <Button
                onClick={(e) => { e.stopPropagation(); navigate('/shop/advertising'); }}
                className="rounded-full bg-white text-violet-700 hover:bg-violet-50 font-bold text-sm px-5 h-10 shadow-xl shadow-black/15 hover:scale-105 transition-transform duration-300 w-full md:w-auto"
                data-testid="shop-advertising-hero-cta-button"
              >
                Open Advertising Hub
                <ArrowUpRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* ===== ACTIVE PROMOTIONS ===== */}
        {promotions.length > 0 && (
          <div className="rounded-2xl p-6 bg-white border border-slate-100 shadow-sm mb-8" data-testid="active-promotions" style={{ animation: 'slideUp 0.5s ease-out 0.5s both' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm shadow-amber-200">
                <Megaphone className="h-4 w-4 text-white" />
              </div>
              <h2 className="font-bold text-sm text-slate-900">Active Promotions</h2>
            </div>
            <div className="space-y-2">
              {promotions.map((promo) => {
                const daysLeft = Math.max(0, Math.ceil((new Date(promo.end_date) - new Date()) / (1000 * 60 * 60 * 24)));
                return (
                  <div key={promo.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors duration-200">
                    <div>
                      <p className="font-semibold text-xs text-slate-800">{promo.product_name}</p>
                      <p className="text-[10px] text-slate-400">{daysLeft}d left · {promo.views || 0} views · {promo.orders || 0} orders</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-[10px] h-7 text-violet-600 hover:text-violet-700" onClick={() => navigate('/shop/boost-products')} data-testid={`view-promotion-${promo.id}`}>
                      <Eye className="h-3 w-3 mr-1" /> View
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== LOW STOCK ALERT ===== */}
        {analytics?.low_stock_products && analytics.low_stock_products.length > 0 && (
          <div className="rounded-2xl p-6 bg-white border border-red-100 shadow-sm mb-8" data-testid="low-stock-products" style={{ animation: 'slideUp 0.5s ease-out 0.6s both' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-sm shadow-red-200">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
              <h2 className="font-bold text-sm text-slate-900">Low Stock Alert</h2>
            </div>
            <div className="space-y-2">
              {analytics.low_stock_products.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-xl bg-red-50/50" data-testid={`low-stock-product-${product.id}`}>
                  <div className="flex items-center gap-3">
                    {product.images?.[0] && <img src={product.images[0]} alt={product.name} className="w-10 h-10 object-cover rounded-lg" />}
                    <div>
                      <p className="font-semibold text-xs text-slate-800">{product.name}</p>
                      <p className="text-[10px] text-red-600 font-medium">{product.stock} units left</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/shop/products')} className="text-[10px] h-7 rounded-full border-red-200 text-red-600 hover:bg-red-50">
                    Restock
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== QUICK ACTIONS GRID ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8" style={{ animation: 'slideUp 0.5s ease-out 0.7s both' }}>
          {[
            { label: 'Products', icon: Package, route: '/shop/products', gradient: 'from-blue-500 to-indigo-500', shadow: 'shadow-blue-200' },
            { label: 'Orders', icon: ShoppingCart, route: '/shop/orders', gradient: 'from-emerald-500 to-teal-500', shadow: 'shadow-emerald-200' },
            { label: 'Analytics', icon: BarChart3, route: '/shop/analytics', gradient: 'from-violet-500 to-purple-500', shadow: 'shadow-violet-200' },
            { label: 'Advertising', icon: Rocket, route: '/shop/advertising', gradient: 'from-fuchsia-500 to-violet-600', shadow: 'shadow-fuchsia-200' },
            { label: 'Gallery', icon: ImageIcon, route: '/shop/gallery', gradient: 'from-pink-500 to-rose-500', shadow: 'shadow-pink-200' },
            { label: 'Themes', icon: Sparkles, route: '/shop/theme', gradient: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-200' },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.route)}
              className={`group relative overflow-hidden rounded-2xl p-5 bg-white border border-slate-100 shadow-sm hover:shadow-md ${action.shadow} hover:-translate-y-1 transition-all duration-500 text-left`}
              data-testid={`shop-quickaction-${action.label.toLowerCase()}`}
            >
              <div className={`absolute -bottom-2 -right-2 w-16 h-16 rounded-full bg-gradient-to-br ${action.gradient} opacity-[0.06] group-hover:opacity-[0.12] group-hover:scale-150 transition-all duration-700`} />
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center mb-3 shadow-sm ${action.shadow} group-hover:scale-110 transition-transform duration-300`}>
                <action.icon className="h-5 w-5 text-white" />
              </div>
              <p className="font-semibold text-sm text-slate-800">{action.label}</p>
              <ChevronRight className="absolute top-5 right-4 h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all duration-300" />
            </button>
          ))}
        </div>

        {/* ===== RECENT ORDERS + PERFORMANCE ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8" style={{ animation: 'slideUp 0.5s ease-out 0.75s both' }}>
          {/* Recent Orders */}
          <div className="lg:col-span-2 rounded-2xl p-6 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all duration-500">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm shadow-blue-200">
                  <ShoppingCart className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Recent Orders</h3>
                  <p className="text-[10px] text-slate-400">{analytics?.total_orders || 0} total orders</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/shop/orders')} className="text-[10px] text-blue-600 hover:text-blue-700 h-7 px-2">
                View All <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>
            {recentOrders.length > 0 ? (
              <div className="space-y-2">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors duration-200">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        order.order_status === 'delivered' ? 'bg-emerald-100' :
                        order.order_status === 'shipped' ? 'bg-blue-100' :
                        order.order_status === 'cancelled' ? 'bg-red-100' : 'bg-amber-100'
                      }`}>
                        <Package className={`h-3.5 w-3.5 ${
                          order.order_status === 'delivered' ? 'text-emerald-600' :
                          order.order_status === 'shipped' ? 'text-blue-600' :
                          order.order_status === 'cancelled' ? 'text-red-600' : 'text-amber-600'
                        }`} />
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-slate-800">{order.guest_name || order.customer_name || 'Customer'}</p>
                        <p className="text-[10px] text-slate-400">{order.items?.length || 0} items · {new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-slate-900">${(order.total_amount || 0).toFixed(2)}</p>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${
                        order.order_status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                        order.order_status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                        order.order_status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>{order.order_status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ShoppingCart className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No orders yet. Share your shop link to get started!</p>
              </div>
            )}
          </div>

          {/* Performance Score */}
          <div className="rounded-2xl p-6 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all duration-500">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-sm shadow-rose-200">
                <Target className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Shop Score</h3>
                <p className="text-[10px] text-slate-400">Performance overview</p>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Products Listed', value: analytics?.products_count || 0, max: 50, color: 'bg-blue-500' },
                { label: 'Orders Completed', value: analytics?.total_orders || 0, max: 100, color: 'bg-emerald-500' },
                { label: 'Active Promotions', value: promotions.length, max: 5, color: 'bg-violet-500' },
                { label: 'Stock Health', value: Math.max(0, (analytics?.products_count || 0) - (analytics?.low_stock_count || 0)), max: analytics?.products_count || 1, color: 'bg-teal-500' },
              ].map((metric) => {
                const pct = Math.min(100, Math.round((metric.value / metric.max) * 100));
                return (
                  <div key={metric.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-slate-600 font-medium">{metric.label}</span>
                      <span className="text-[10px] font-bold text-slate-800">{metric.value}/{metric.max}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${metric.color} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Overall Score</span>
                  <span className="text-lg font-black text-emerald-600">
                    {Math.round(((analytics?.products_count || 0) / 50 * 25) + ((analytics?.total_orders || 0) / 100 * 35) + (promotions.length / 5 * 20) + (Math.max(0, ((analytics?.products_count || 1) - (analytics?.low_stock_count || 0)) / (analytics?.products_count || 1)) * 20))}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== TIPS SECTION ===== */}
        <div className="relative overflow-hidden rounded-2xl p-6 bg-white border border-slate-100 shadow-sm mb-8" data-testid="shop-suggestions" style={{ animation: 'fadeIn 0.8s ease-out 0.8s both' }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-50 to-transparent rounded-full" />
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-sm shadow-amber-200" style={{ animation: 'float 3s ease-in-out infinite' }}>
              <Lightbulb className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900">Growth Tips</h2>
              <p className="text-[10px] text-slate-400">Actionable ideas to grow your sales</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { title: 'Quality Photos', desc: 'Products with pro images get 3x more views. Multiple angles help.', color: 'border-l-blue-400' },
              { title: 'Run Discounts', desc: 'Limited-time offers create urgency and boost conversions.', color: 'border-l-emerald-400' },
              { title: 'Fast Replies', desc: 'Quick message responses build trust and repeat purchases.', color: 'border-l-amber-400' },
              { title: 'Share Your Link', desc: 'Promote on Instagram, WhatsApp & Facebook for more traffic.', color: 'border-l-rose-400' },
              { title: 'Add Variants', desc: 'Color & size options increase clicks and conversion rates.', color: 'border-l-violet-400' },
              { title: 'Keep Stock Fresh', desc: 'Low stock alerts prevent overselling. Restock regularly.', color: 'border-l-teal-400' },
            ].map((tip, i) => (
              <div key={i} className={`rounded-xl p-3.5 bg-slate-50 border-l-[3px] ${tip.color} hover:bg-white hover:shadow-sm transition-all duration-300`}>
                <p className="text-xs font-bold text-slate-800 mb-0.5">{tip.title}</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">{tip.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ShopLayout>

      {/* ===== DIALOGS ===== */}
      {/* Pro Upgrade Dialog removed — tier system no longer used */}
      <Dialog open={false} onOpenChange={setProUpgradeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tier system removed</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {giftDialogOpen && (
        <GiftDialog open={giftDialogOpen} onOpenChange={setGiftDialogOpen} productId={giftProductId} productName={giftProductName} onGiftSaved={fetchData} />
      )}

      <SpinWheel open={spinWheelOpen} onOpenChange={setSpinWheelOpen} spinInfo={spinInfo} onSpinComplete={() => fetchData()} />

      {/* Subscribe confirmation → welcome benefits */}
      <SubscribeConfirmDialog
        open={confirmSubscribeOpen}
        onOpenChange={setConfirmSubscribeOpen}
        planName={planName}
        price={subscriptionPrice}
        walletBalance={walletBalance}
        features={planFeatures}
        onConfirm={handleSubscribeWithWallet}
        loading={subscribing}
      />
      <SubscribedWelcomeDialog
        open={welcomeBenefitsOpen}
        onOpenChange={setWelcomeBenefitsOpen}
        planName={planName}
        features={planFeatures}
      />

      {/* First-login welcome popup (subscribed vs not) */}
      <FirstLoginWelcomeDialog
        open={firstLoginOpen}
        onOpenChange={(v) => { if (!v) dismissFirstLogin(); }}
        data={firstLoginData}
      />
    </>
  );
};

export default ShopDashboard;
