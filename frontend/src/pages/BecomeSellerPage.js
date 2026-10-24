import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Store, CheckCircle, Loader2, UserCheck,
  TrendingUp, BarChart3, Shield, Globe, Wallet, Gift,
  ArrowRight, Clock, Rocket, Crown, BadgeCheck, Package, Tag, Megaphone, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ImageUploader from '../components/ImageUploader';
import StateSelect from '../components/StateSelect';
import EndOfPagePromos from '../components/EndOfPagePromos';
import { AuthContext } from '../App';
import { api } from '../lib/api';
import { toast } from 'sonner';

const BecomeSellerPage = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [shopStatus, setShopStatus] = useState(null);
  const [requestSent, setRequestSent] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', phone: '', email: '', address: '', state: '', logo: '', guest_name: '', category_ids: [] });
  const [allCategories, setAllCategories] = useState([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [sellerCount, setSellerCount] = useState(0);
  const [referralCode, setReferralCode] = useState('');
  const [referralAgent, setReferralAgent] = useState(null);
  const [subscriptionPrice, setSubscriptionPrice] = useState(19);
  const [planFeatures, setPlanFeatures] = useState([]);
  const [wantsSubscription, setWantsSubscription] = useState(false);

  useEffect(() => {
    checkForPendingShop();
    fetchCategories();
    fetchSellerCount();
    api.admin.getPlatformSettings().then(({ data }) => { if (data?.subscription_price != null) setSubscriptionPrice(Number(data.subscription_price)); }).catch(() => {});
    // Admin-configured plan features (single source of truth)
    api.shop.getSubscriptionPricing().then(({ data }) => {
      if (Array.isArray(data?.features)) setPlanFeatures(data.features);
      if (data?.monthly?.price != null) setSubscriptionPrice(Number(data.monthly.price));
    }).catch(() => {});
    if (user) { fetchUserProfile(); if (user.role === 'shop') checkExistingShop(); }
    // Restore saved form data from sessionStorage (after login redirect)
    const savedData = sessionStorage.getItem('seller_form_data');
    if (savedData) {
      try { setFormData(JSON.parse(savedData)); } catch {}
      sessionStorage.removeItem('seller_form_data');
    }
    // Capture and validate referral code from ?ref=CODE
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref') || sessionStorage.getItem('referral_code') || '';
      if (ref) {
        setReferralCode(ref);
        sessionStorage.setItem('referral_code', ref);
        api.referral.validate(ref).then(({ data }) => {
          if (data?.valid) setReferralAgent(data);
          else { setReferralAgent(null); sessionStorage.removeItem('referral_code'); }
        }).catch(() => {});
      }
    } catch {}
  }, [user]);

  const fetchCategories = async () => {
    try {
      const { data } = await api.categories.getAll(true);
      setAllCategories(data || []);
    } catch {}
  };

  const fetchSellerCount = async () => {
    try {
      const { data } = await api.shops.getAll();
      setSellerCount(Array.isArray(data) ? data.length : 0);
    } catch {}
  };

  const toggleCategory = (catId) => {
    setFormData(prev => ({
      ...prev,
      category_ids: prev.category_ids.includes(catId)
        ? prev.category_ids.filter(id => id !== catId)
        : [...prev.category_ids, catId]
    }));
  };

  const fetchUserProfile = async () => { try { const { data } = await api.auth.getMe(); setUserProfile(data); } catch {} };
  const autoFillFromProfile = (field) => {
    if (!userProfile) return;
    const mapping = { email: 'email', phone: 'phone', address: 'address', state: 'state' };
    if (userProfile[mapping[field]]) { setFormData({ ...formData, [field]: userProfile[mapping[field]] }); toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} auto-filled`); }
  };

  const checkForPendingShop = async () => { if (!user) return; try { const { data } = await api.shop.getStatus(); if (data.has_shop && data.subscription_status === 'pending') { setShopStatus(data); setRequestSent(true); } } catch {} };
  const checkExistingShop = async () => { try { const { data } = await api.shop.getStatus(); if (data.has_shop) { setShopStatus(data); if (['active', 'trial'].includes(data.subscription_status)) navigate('/shop/dashboard'); if (data.subscription_status === 'pending') setRequestSent(true); } } catch {} };

  const handleSubmitApplication = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.address || !formData.state) { toast.error('Please fill in all required fields'); return; }
    if (!user && !formData.email) { toast.error('Email is required for guest applications'); return; }
    if (!user && !formData.guest_name) { toast.error('Your name is required'); return; }
    setLoading(true);
    try {
      if (!user) {
        // Guest submission - no login required
        await api.shop.registerGuest({
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          state: formData.state,
          email: formData.email,
          description: formData.description,
          logo: formData.logo,
          guest_name: formData.guest_name,
          category_ids: formData.category_ids || [],
          referral_code: referralCode || undefined,
          wants_subscription: wantsSubscription,
        });
        setRequestSent(true); toast.success('Application submitted successfully!');
      } else {
        let existingShop = null;
        try { const { data } = await api.shop.getStatus(); if (data.has_shop) existingShop = data; } catch {}
        if (existingShop) { if (existingShop.shop_status === 'pending') { setShopStatus(existingShop); return; } if (['active', 'trial'].includes(existingShop.subscription_status)) { navigate('/shop/settings'); return; } navigate('/shop/settings'); return; }
        await api.shop.register({ ...formData, payment_method: 'manual', referral_code: referralCode || undefined, wants_subscription: wantsSubscription });
        setRequestSent(true); toast.success('Application sent to admin!');
      }
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to submit application'); }
    finally { setLoading(false); }
  };

  if (shopStatus && shopStatus.shop_status === 'pending') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="max-w-md text-center p-8 bg-white rounded-3xl shadow-2xl border border-amber-100">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200" style={{ animation: 'float 3s ease-in-out infinite' }}><Clock className="h-10 w-10 text-white" /></div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2" data-testid="pending-title">Application Under Review</h1>
        <p className="text-slate-500 mb-6">Your application for <strong className="text-slate-800">{shopStatus.shop_name}</strong> is being reviewed by our team.</p>
        <Button onClick={() => navigate('/')} className="rounded-full bg-amber-500 hover:bg-amber-600" data-testid="continue-shopping-btn">Continue Shopping</Button>
      </div>
    </div>
  );

  if (requestSent) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50">
      <div className="max-w-md text-center p-8 bg-white rounded-3xl shadow-2xl border border-emerald-100">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200" style={{ animation: 'float 3s ease-in-out infinite' }}><CheckCircle className="h-10 w-10 text-white" /></div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2" data-testid="request-sent-title">Application Sent!</h1>
        <p className="text-slate-500 mb-6">You'll receive a notification once your shop is approved.</p>
        <Button onClick={() => navigate('/')} className="rounded-full bg-emerald-500 hover:bg-emerald-600" data-testid="continue-shopping-btn">Continue Shopping</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-violet-950 to-indigo-950 py-20 lg:py-28" data-testid="become-seller-hero">
        <div className="absolute inset-0">
          <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-80px] right-[-80px] w-[400px] h-[400px] bg-emerald-500/15 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1.5s' }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 text-white/80 text-xs font-medium mb-6" style={{ animation: 'fadeIn 0.8s ease-out' }}>
                <Rocket className="h-3.5 w-3.5 text-emerald-400" />
                <span>Join <span className="text-emerald-400 font-bold">{sellerCount > 0 ? `${sellerCount}+` : '...'}</span> successful sellers</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6 tracking-tight leading-[1.1]" style={{ animation: 'slideUp 0.8s ease-out 0.2s both' }} data-testid="become-seller-title">
                Start Your<br />
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">Success Story</span>
                </span>
              </h1>

              <p className="text-lg text-white/50 max-w-lg mx-auto lg:mx-0 mb-8 font-light leading-relaxed" style={{ animation: 'slideUp 0.8s ease-out 0.4s both' }}>
                Sell on Lebanon's fastest-growing marketplace. Fill in your shop details and our team will review your application.
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 sm:gap-8 mb-8" style={{ animation: 'slideUp 0.8s ease-out 0.6s both' }}>
                {[
                  { value: 'Free', label: 'To Apply' },
                  { value: 'Fast', label: 'Approval' },
                  { value: '24/7', label: 'Support' },
                ].map((stat, i) => (
                  <div key={i} className="text-center lg:text-left">
                    <p className="text-2xl sm:text-3xl font-black text-white">{stat.value}</p>
                    <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div style={{ animation: 'slideUp 0.8s ease-out 0.8s both' }}>
                <Button onClick={() => document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth' })} size="lg" className="rounded-full px-8 py-6 text-base font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-2xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all hover:-translate-y-0.5" data-testid="get-started-hero-btn">
                  Apply Now for Free <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="hidden lg:block relative" style={{ animation: 'slideUp 1s ease-out 0.5s both' }}>
              <div className="relative" style={{ animation: 'float 6s ease-in-out infinite' }}>
                <div className="bg-white/[0.07] backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-2xl">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-3 h-3 rounded-full bg-red-400/80" />
                    <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                    <span className="ml-3 text-white/30 text-xs font-medium">Shop Dashboard</span>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-2xl p-4 mb-4 border border-emerald-500/20">
                    <p className="text-emerald-400/70 text-[10px] uppercase tracking-wider font-semibold">Total Revenue</p>
                    <p className="text-white text-3xl font-black mt-1">$12,847</p>
                    <div className="flex items-center gap-1 mt-1">
                      <TrendingUp className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400 text-xs font-bold">+24% this month</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5"><p className="text-white font-black text-lg">156</p><p className="text-white/30 text-[9px] uppercase">Orders</p></div>
                    <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5"><p className="text-white font-black text-lg">89</p><p className="text-white/30 text-[9px] uppercase">Products</p></div>
                    <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5"><p className="text-white font-black text-lg">4.9</p><p className="text-white/30 text-[9px] uppercase">Rating</p></div>
                  </div>
                  <div className="flex items-end gap-1.5 h-16 px-2">
                    {[40, 65, 45, 80, 55, 90, 70, 95, 60, 85, 75, 100].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t-sm bg-gradient-to-t from-emerald-500/60 to-teal-400/40" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="absolute -top-4 -right-6 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-3 shadow-xl" style={{ animation: 'floatSlow 4s ease-in-out infinite 1s' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center"><Package className="h-4 w-4 text-emerald-400" /></div>
                    <div><p className="text-white/80 text-[10px] font-semibold">New Order!</p><p className="text-white/40 text-[9px]">+$67.00</p></div>
                  </div>
                </div>
                <div className="absolute -bottom-3 -left-6 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-3 shadow-xl" style={{ animation: 'floatSlow 5s ease-in-out infinite 2s' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-violet-500/30 flex items-center justify-center"><BadgeCheck className="h-4 w-4 text-violet-400" /></div>
                    <div><p className="text-white/80 text-[10px] font-semibold">Verified Seller</p><p className="text-white/40 text-[9px]">Higher ranking</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 sm:py-20 relative" id="features-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600 mb-2 block">Why Sell With Us</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Everything You Need to Succeed</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: BarChart3, title: 'Advanced Analytics', desc: 'Track sales, views, and customer behavior in real-time', color: 'from-blue-500 to-cyan-500' },
              { icon: Shield, title: 'Verified Badge', desc: 'Get a trusted seller badge and rank higher in search', color: 'from-emerald-500 to-teal-500' },
              { icon: Globe, title: 'Instant Visibility', desc: 'Reach thousands of customers across all Lebanon', color: 'from-purple-500 to-pink-500' },
              { icon: Wallet, title: 'Easy Payments', desc: 'Get paid directly to your wallet with low commission', color: 'from-amber-500 to-orange-500' },
              { icon: Gift, title: 'Marketing Tools', desc: 'Gift with purchase, spin wheel, product boosts & more', color: 'from-rose-500 to-red-500' },
              { icon: Crown, title: 'Pro Features', desc: 'Unlimited products, PDF reports, premium themes', color: 'from-indigo-500 to-violet-500' },
            ].map((feature, idx) => (
              <div key={idx} className="group relative p-6 bg-white rounded-2xl border border-slate-100 hover:border-transparent hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500`} />
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-1.5 group-hover:text-violet-700 transition-colors">{feature.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Registration Form */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-white to-slate-50" id="form-section">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 mb-2 block">Get Started</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">Tell Us About Your Shop</h2>
            <p className="text-slate-500">Fill in your shop details below. Our team will review and get back to you.</p>
          </div>

          {user && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 mb-8 flex items-center gap-4" data-testid="seller-user-info">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm"><UserCheck className="h-5 w-5 text-white" /></div>
              <div className="flex-1">
                <p className="font-bold text-slate-900" data-testid="seller-user-name">{user.name}</p>
                <p className="text-xs text-slate-500" data-testid="seller-user-email">{user.email}</p>
              </div>
              <BadgeCheck className="h-5 w-5 text-emerald-500" />
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden" data-testid="become-seller-form">
            {/* Form Header with Steps */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center"><Store className="h-5 w-5 text-white" /></div>
                <h2 className="text-xl font-bold text-white">Shop Application</h2>
              </div>
              <div className="flex items-center gap-2">
                {['Your Info', 'Shop Details', 'Location'].map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold text-emerald-400">{i+1}</div>
                      <span className="text-xs text-white/60 hidden sm:inline">{step}</span>
                    </div>
                    {i < 2 && <div className="w-8 h-px bg-white/10" />}
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmitApplication} className="p-6 sm:p-8 space-y-6">
              {/* Referral banner — shown when arriving via an agent's referral link */}
              {referralAgent && (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4" data-testid="referral-banner">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <Gift className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-emerald-800">
                      You were referred by {referralAgent.agent_name || referralAgent.first_name || 'an agent'}
                    </p>
                    <p className="text-xs text-emerald-600">
                      Referral code <span className="font-mono font-semibold">{referralAgent.referral_code || referralCode}</span> applied — your shop will be linked to this agent once approved.
                    </p>
                  </div>
                </div>
              )}

              {/* What the shop will get on approval (no specific product/sponsor name shown) */}
              <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-4 sm:p-5" data-testid="seller-benefits-card">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center"><Gift className="h-4.5 w-4.5 text-white" /></div>
                  <div>
                    <p className="text-sm font-bold text-violet-800">What you'll get when approved</p>
                    <p className="text-[11px] text-violet-600">{referralAgent ? 'Referred shops receive a boosted welcome bonus' : 'Your welcome bonus, applied automatically'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2.5 rounded-xl bg-white/70 border border-violet-100 px-3.5 py-2.5">
                    <Wallet className="h-4 w-4 text-violet-600 flex-shrink-0" />
                    <span className="text-sm font-semibold text-slate-700">{referralAgent ? '$3 wallet credit' : '$2 wallet credit'}</span>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl bg-white/70 border border-violet-100 px-3.5 py-2.5">
                    <Megaphone className="h-4 w-4 text-violet-600 flex-shrink-0" />
                    <span className="text-sm font-semibold text-slate-700">{referralAgent ? '2 free product sponsors' : '1 free product sponsor'}</span>
                  </div>
                </div>
              </div>

              {!user && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center"><UserCheck className="h-4 w-4 text-violet-600" /></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Your Information</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Your Full Name *</Label>
                      <Input value={formData.guest_name} onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })} placeholder="John Doe" className="mt-1.5 h-11 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20" data-testid="guest-name-input" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Your Email *</Label>
                      <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="you@example.com" className="mt-1.5 h-11 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20" data-testid="guest-email-input" />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Shield className="h-3 w-3 text-emerald-500" />
                    Already have an account? <button type="button" onClick={() => navigate('/auth?redirect=/become-seller')} className="font-semibold text-violet-600 hover:text-violet-800 underline">Login here</button> for faster application.
                  </p>
                  <div className="border-b border-dashed border-slate-200 my-2" />
                </div>
              )}

              {/* Section 2: Shop Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><Store className="h-4 w-4 text-emerald-600" /></div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Shop Details</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative group">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Shop Name *</Label>
                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Beirut Boutique" className="mt-1.5 h-11 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all" data-testid="shop-name-input" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between"><Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Phone *</Label>{user && userProfile && <button type="button" onClick={() => autoFillFromProfile('phone')} className="text-[10px] text-violet-600 font-semibold hover:text-violet-800">Auto-fill</button>}</div>
                    <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+961 ..." className="mt-1.5 h-11 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20" data-testid="shop-phone-input" />
                  </div>
                </div>
                {user && (
                  <div>
                    <div className="flex items-center justify-between"><Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</Label>{user && userProfile && <button type="button" onClick={() => autoFillFromProfile('email')} className="text-[10px] text-violet-600 font-semibold hover:text-violet-800">Auto-fill</button>}</div>
                    <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="shop@example.com" className="mt-1.5 h-11 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20" data-testid="shop-email-input" />
                  </div>
                )}
                <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</Label>
                  <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Tell us about your shop and what you sell..." rows={3} className="mt-1.5 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20" data-testid="shop-description-input" />
                </div>
                <div>
                  <ImageUploader value={formData.logo} onChange={(url) => setFormData({ ...formData, logo: url })} label="Shop Logo (optional)" showUrlInput={true} aspect={1} />
                </div>
                {/* Categories Multi-Select Chips */}
                <div data-testid="seller-categories-section">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-emerald-600" />
                      Categories
                    </Label>
                    {formData.category_ids.length > 0 && (
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 rounded-full px-2 py-0.5 border border-emerald-100" data-testid="seller-categories-count">
                        {formData.category_ids.length} selected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mb-3">Select all categories your shop will sell in. Admin can edit later.</p>
                  {allCategories.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No categories available yet.</p>
                  ) : (
                    <>
                      {/* Search box for categories */}
                      <div className="relative mb-3">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                        <input
                          type="text"
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          placeholder="Search categories..."
                          className="w-full h-9 pl-9 pr-9 text-xs rounded-lg border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-white"
                          data-testid="seller-categories-search"
                        />
                        {categorySearch && (
                          <button
                            type="button"
                            onClick={() => setCategorySearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            data-testid="seller-categories-search-clear"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        )}
                      </div>
                      {(() => {
                        const filtered = allCategories.filter(cat => {
                          if (!categorySearch.trim()) return true;
                          const q = categorySearch.toLowerCase();
                          return (cat.name || '').toLowerCase().includes(q) || (cat.name_ar || '').toLowerCase().includes(q);
                        });
                        if (filtered.length === 0) {
                          return <p className="text-xs text-slate-400 italic" data-testid="seller-categories-no-results">No categories match "{categorySearch}"</p>;
                        }
                        return (
                          <div className="flex flex-wrap gap-2 pt-1 max-h-52 overflow-y-auto scrollbar-thin" data-testid="seller-categories-chips">
                            {filtered.map(cat => {
                              const selected = formData.category_ids.includes(cat.id);
                              return (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => toggleCategory(cat.id)}
                                  className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border cursor-pointer select-none ${
                                    selected
                                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-700'
                                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-emerald-300 hover:text-emerald-700'
                                  }`}
                                  data-testid={selected ? `category-chip-selected-${cat.id}` : `category-chip-unselected-${cat.id}`}
                                >
                                  {cat.name}
                                  {selected && <span className="ml-1.5 text-white/90">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>

              <div className="border-b border-dashed border-slate-200" />

              {/* Section 3: Location */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><Globe className="h-4 w-4 text-blue-600" /></div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Location</h3>
                </div>
                <div>
                  <div className="flex items-center justify-between"><Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Address *</Label>{user && userProfile && <button type="button" onClick={() => autoFillFromProfile('address')} className="text-[10px] text-violet-600 font-semibold hover:text-violet-800">Auto-fill</button>}</div>
                  <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Street, Building, City" className="mt-1.5 h-11 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20" data-testid="shop-address-input" />
                </div>
                <div>
                  <div className="flex items-center justify-between"><Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">State/Region *</Label>{user && userProfile && <button type="button" onClick={() => autoFillFromProfile('state')} className="text-[10px] text-violet-600 font-semibold hover:text-violet-800">Auto-fill</button>}</div>
                  <StateSelect value={formData.state} onChange={(val) => setFormData({ ...formData, state: val })} />
                </div>
              </div>

              {/* Subscribe & get more every month — optional, at the end of the application */}
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 sm:p-5" data-testid="subscription-benefits-card">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center"><Crown className="h-[18px] w-[18px] text-white" /></div>
                  <div>
                    <p className="text-sm font-bold text-amber-800">Subscribe &amp; get more every month</p>
                    <p className="text-[11px] text-amber-600">Optional — subscribed shops receive these perks each month from their subscription date</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  {(planFeatures.length ? planFeatures : ['1 free spin / month', '2 product sponsors / month', 'Lower commissions']).map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5 rounded-xl bg-white/70 border border-amber-100 px-3.5 py-2.5"><Check className="h-4 w-4 text-amber-600 flex-shrink-0" /><span className="text-sm font-semibold text-slate-700">{f}</span></div>
                  ))}
                </div>
                <label className="flex items-center gap-2.5 rounded-xl bg-white border border-amber-200 px-3.5 py-3 cursor-pointer" data-testid="wants-subscription-toggle">
                  <input type="checkbox" checked={wantsSubscription} onChange={(e) => setWantsSubscription(e.target.checked)} className="h-4 w-4 accent-amber-600" />
                  <span className="text-sm font-semibold text-slate-800">Yes, I want to subscribe <span className="text-amber-700">(${subscriptionPrice.toFixed(2)}/month)</span></span>
                </label>
                <p className="text-[11px] text-amber-600 mt-1.5">Optional. You can also subscribe later from your shop dashboard.</p>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <Button type="submit" disabled={loading} className="w-full rounded-2xl h-12 text-base font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-200 transition-all" data-testid="submit-application-btn">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ArrowRight className="h-5 w-5 mr-2" />}
                  Submit Application
                </Button>
                <p className="text-center text-[11px] text-slate-400 mt-3">
                  By submitting, you agree to our terms. Our team will review within 24-48 hours.
                </p>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Sponsored add-ons + Recommended (with interleaved sponsored carousels) */}
      <div data-testid="become-seller-end-promos">
        <EndOfPagePromos />
      </div>

      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        @keyframes floatSlow { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default BecomeSellerPage;
