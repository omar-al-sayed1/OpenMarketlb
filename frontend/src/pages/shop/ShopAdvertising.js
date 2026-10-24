import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Rocket, Mail, MousePointerClick, Megaphone, CalendarDays, BarChart3, Sparkles,
  Wallet, Target, Send, Loader2, Check, Copy, TrendingUp, Users, DollarSign,
  AlertTriangle, Store, Package, Eye, Crown, Zap, ArrowRight, Clock, Info, Lightbulb, Lock, Edit3, Gift
} from 'lucide-react';
import ShopLayout from '../../components/ShopLayout';
import ConfirmSpendDialog from '../../components/ConfirmSpendDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip as RTooltip, CartesianGrid
} from 'recharts';

const fmt = (n) => `$${(Number(n) || 0).toFixed(2)}`;

// ---------------- KPI Card ----------------
const KpiCard = ({ icon: Icon, label, value, hint, testid }) => (
  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden hover-lift" data-testid={testid}>
    <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-500" />
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  </div>
);

// ---------------- Email/PPC shared composer ----------------
const EmailComposer = ({ form, setForm, accentField, applyRing }) => {
  const ringFor = (f) => applyRing === f ? 'ring-2 ring-emerald-300' : '';
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">Campaign name (optional)</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Spring Collection Launch" className="h-10" data-testid="email-ad-name-input" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">Subject line *</Label>
        <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
          placeholder="Grab attention in 55 characters" className={`h-10 transition-all ${ringFor('subject')}`} maxLength={120}
          data-testid="email-ad-subject-input" />
        <p className="text-[11px] text-slate-400">{form.subject.length}/120 — keep it under 55 for best results</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">Preview text</Label>
        <Input value={form.preview} onChange={(e) => setForm({ ...form, preview: e.target.value })}
          placeholder="Short teaser shown after the subject" className={`h-10 transition-all ${ringFor('preview')}`} maxLength={150}
          data-testid="email-ad-preview-text-input" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">Email body *</Label>
        <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
          placeholder="Write your message. You can use simple HTML (<p>, <b>, <ul><li>) or plain text."
          className={`min-h-[200px] resize-y transition-all ${ringFor('body')}`} data-testid="email-ad-body-textarea" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">Button label</Label>
        <Input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })}
          placeholder="Shop Now" className="h-10" data-testid="email-ad-cta-label-input" />
      </div>
    </div>
  );
};

// ---------------- Targeting + cost ----------------
const TargetingCard = ({ form, setForm, preview, previewLoading, products, walletBalance, recipientLimit, setRecipientLimit, pricePerEmail, showCost = true }) => {
  const available = preview?.recipient_count ?? 0;
  const chosen = Math.min(recipientLimit || 0, available);
  const cost = +(chosen * (pricePerEmail || 0)).toFixed(2);
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 shadow-sm p-4 space-y-4" data-testid="email-ad-targeting-card">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-emerald-700" />
        <h3 className="text-sm font-semibold text-slate-800">Audience & Targeting</h3>
      </div>

      <RadioGroup value={form.target_type} onValueChange={(v) => setForm({ ...form, target_type: v })}
        className="space-y-2" data-testid="email-ad-target-mode-radio">
        <label className="flex items-start gap-2.5 rounded-xl bg-white/70 border border-emerald-100 px-3 py-2.5 cursor-pointer">
          <RadioGroupItem value="state" id="t-state" className="mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-800">All platform customers</p>
            <p className="text-[11px] text-slate-500">Reach the whole OpenMarket audience, optionally by state</p>
          </div>
        </label>
        <label className="flex items-start gap-2.5 rounded-xl bg-white/70 border border-emerald-100 px-3 py-2.5 cursor-pointer">
          <RadioGroupItem value="own_customers" id="t-own" className="mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-800">My past customers</p>
            <p className="text-[11px] text-slate-500">People who already ordered from your shop</p>
          </div>
        </label>
      </RadioGroup>

      {form.target_type === 'state' && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">Target state</Label>
          <Select value={form.target_state} onValueChange={(v) => setForm({ ...form, target_state: v })}>
            <SelectTrigger className="h-10 bg-white" data-testid="email-ad-state-select"><SelectValue placeholder="All states" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {['Beirut', 'Mount Lebanon', 'North Lebanon', 'South Lebanon', 'Bekaa', 'Nabatieh', 'Akkar', 'Baalbek-Hermel', 'Keserwan-Jbeil'].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">When they click, send them to</Label>
        <Select value={form.link_type} onValueChange={(v) => setForm({ ...form, link_type: v })}>
          <SelectTrigger className="h-10 bg-white" data-testid="email-ad-link-type-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="shop">My shop page</SelectItem>
            <SelectItem value="product">A specific product</SelectItem>
          </SelectContent>
        </Select>
        {form.link_type === 'product' && (
          <Select value={form.link_target_id} onValueChange={(v) => setForm({ ...form, link_target_id: v })}>
            <SelectTrigger className="h-10 bg-white mt-2" data-testid="email-ad-product-select"><SelectValue placeholder="Choose a product" /></SelectTrigger>
            <SelectContent>
              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="rounded-xl bg-white border border-emerald-100 px-3 py-2.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Available audience</span>
          <span className="text-sm font-bold text-slate-900" data-testid="email-ad-recipient-count">
            {previewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : available}
          </span>
        </div>

        {/* Recipient range selector */}
        <div className="space-y-1.5 pt-1" data-testid="recipient-range-selector">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">How many to send to</span>
            <span className="text-sm font-bold text-emerald-700" data-testid="recipient-range-value">{chosen}</span>
          </div>
          <Slider
            value={[chosen]}
            onValueChange={(v) => setRecipientLimit(v[0])}
            min={available > 0 ? 1 : 0}
            max={Math.max(available, 1)}
            step={1}
            disabled={available === 0 || previewLoading}
            data-testid="recipient-range-slider"
          />
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>1</span>
            <span>{available} max</span>
          </div>
        </div>

        {showCost && (
          <div className="flex items-center justify-between border-t border-emerald-50 pt-2">
            <span className="text-xs text-slate-500">Cost ({fmt(pricePerEmail || 0.05)} / email)</span>
            <span className="text-sm font-bold text-emerald-700" data-testid="email-ad-cost-preview">
              {previewLoading ? '—' : fmt(cost)}
            </span>
          </div>
        )}
        {!showCost && (
          <div className="flex items-center justify-between border-t border-emerald-50 pt-2">
            <span className="text-xs text-slate-500">Emails to send</span>
            <span className="text-sm font-semibold text-slate-700">{chosen}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Wallet balance</span>
          <span className="text-sm font-semibold text-slate-700">{fmt(walletBalance)}</span>
        </div>
      </div>

      {showCost && !previewLoading && available > 0 && cost > walletBalance && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5" data-testid="email-ad-wallet-warning">
          <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-rose-700">Insufficient wallet balance for this send. Add funds or reduce the number of recipients.</p>
        </div>
      )}
    </div>
  );
};

const ShopAdvertising = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [products, setProducts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [events, setEvents] = useState([]);
  const [myActiveSponsorship, setMyActiveSponsorship] = useState(null);
  const [promotions, setPromotions] = useState([]);
  const [tab, setTab] = useState('email');

  // shared email form
  const emptyForm = { name: '', subject: '', preview: '', body: '', cta_text: 'Shop Now', target_type: 'state', target_state: 'all', link_type: 'shop', link_target_id: '' };
  const [emailForm, setEmailForm] = useState({ ...emptyForm });
  const [ppcForm, setPpcForm] = useState({ ...emptyForm });
  const [ppcBudget, setPpcBudget] = useState(10);

  const [emailPreview, setEmailPreview] = useState(null);
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);
  const [ppcPreview, setPpcPreview] = useState(null);
  const [ppcPreviewLoading, setPpcPreviewLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  // Persistent banner state showing last campaign launch (polls for status)
  const [recentlyLaunched, setRecentlyLaunched] = useState(null);
  const [recentLiveStatus, setRecentLiveStatus] = useState(null);

  // Poll launched campaign status to give live "sent X/Y" feedback
  useEffect(() => {
    if (!recentlyLaunched?.id) return;
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      if (cancelled) return;
      attempts++;
      try {
        const { data } = await api.ads.campaigns();
        const list = Array.isArray(data?.campaigns) ? data.campaigns : (Array.isArray(data) ? data : []);
        const c = list.find(x => x?.id === recentlyLaunched.id);
        if (c) {
          setRecentLiveStatus({
            status: c.status,
            emails_sent: c.emails_sent || 0,
            recipients_count: c.recipients_count || recentlyLaunched.recipientCount,
          });
          if (c.status === 'sent' || c.status === 'active' || (c.emails_sent >= c.recipients_count)) {
            return; // stop polling
          }
        }
      } catch (e) { /* ignore */ }
      if (attempts < 60) setTimeout(poll, 2000); // poll up to 2 min
    };
    poll();
    return () => { cancelled = true; };
  }, [recentlyLaunched]);
  const [applyRing, setApplyRing] = useState(null);

  // How many recipients the shop chooses to send to (range selector)
  const [emailRecipientLimit, setEmailRecipientLimit] = useState(0);
  const [ppcRecipientLimit, setPpcRecipientLimit] = useState(0);

  // AI
  const [aiOpen, setAiOpen] = useState(false);
  const [aiGoal, setAiGoal] = useState('');
  const [aiTone, setAiTone] = useState('Warm & local (Lebanon-friendly)');
  const [aiOccasion, setAiOccasion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiVariants, setAiVariants] = useState([]);
  const [aiTarget, setAiTarget] = useState('email'); // which form to apply to

  // Boost
  const [boostProduct, setBoostProduct] = useState('');
  const [boostDuration, setBoostDuration] = useState(7);
  const [boosting, setBoosting] = useState(false);
  const [boostDailyPrice, setBoostDailyPrice] = useState(2);
  const [shopProfile, setShopProfile] = useState(null);
  const [useFreeBoostCredit, setUseFreeBoostCredit] = useState(true);

  // Confirmation dialogs
  const [confirmType, setConfirmType] = useState(null); // 'blast' | 'ppc' | 'boost' | 'sponsor'
  const [confirmData, setConfirmData] = useState(null); // ev for sponsor, etc.

  // Sponsorship duration (days) per event
  const [sponsorDays, setSponsorDays] = useState({}); // {eventId: days}
  const getSponsorDays = (id) => Math.max(1, parseInt(sponsorDays[id] || 1));
  // Custom banner content (title/subtitle) the shop wants on the home banner
  const [sponsorContent, setSponsorContent] = useState({}); // {eventId: {title, subtitle}}
  const [editingContentId, setEditingContentId] = useState(null);
  const setContentField = (id, field, value) => setSponsorContent((s) => ({ ...s, [id]: { ...(s[id] || {}), [field]: value } }));

  const emailDebounceRef = useRef(null);
  const ppcDebounceRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const [ovRes, prodRes, campRes, evRes, promoRes, settingsRes, profileRes] = await Promise.allSettled([
        api.ads.overview(), api.shop.getProducts(), api.ads.campaigns(),
        api.ads.getEvents(), api.shopPromotions.getAll(), api.admin.getPlatformSettings(),
        api.shop.getProfile(),
      ]);
      if (ovRes.status === 'fulfilled') setOverview(ovRes.value.data);
      if (prodRes.status === 'fulfilled') setProducts(prodRes.value.data || []);
      if (campRes.status === 'fulfilled') setCampaigns(campRes.value.data?.campaigns || []);
      if (evRes.status === 'fulfilled') {
        setEvents(evRes.value.data?.events || []);
        setMyActiveSponsorship(evRes.value.data?.my_active_sponsorship || null);
      }
      if (promoRes.status === 'fulfilled') setPromotions(promoRes.value.data?.promotions || []);
      if (settingsRes.status === 'fulfilled') setBoostDailyPrice(settingsRes.value.data?.promotion_daily_price || 2);
      if (profileRes.status === 'fulfilled') setShopProfile(profileRes.value.data || null);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Debounced recipient preview for email + ppc (separate timers so they don't cancel each other)
  const runPreview = useCallback((form, setPrev, setLoad, ref) => {
    setLoad(true);
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(async () => {
      try {
        const { data } = await api.ads.previewRecipients({ target_type: form.target_type, target_state: form.target_state });
        setPrev(data);
      } catch { setPrev(null); } finally { setLoad(false); }
    }, 350);
  }, []);

  useEffect(() => { runPreview(emailForm, setEmailPreview, setEmailPreviewLoading, emailDebounceRef); }, [emailForm.target_type, emailForm.target_state, runPreview]); // eslint-disable-line
  useEffect(() => { runPreview(ppcForm, setPpcPreview, setPpcPreviewLoading, ppcDebounceRef); }, [ppcForm.target_type, ppcForm.target_state, runPreview]); // eslint-disable-line

  // When a fresh recipient count arrives, default the chosen amount to the full audience
  useEffect(() => {
    if (emailPreview?.recipient_count != null) setEmailRecipientLimit(emailPreview.recipient_count);
  }, [emailPreview?.recipient_count]);
  useEffect(() => {
    if (ppcPreview?.recipient_count != null) setPpcRecipientLimit(ppcPreview.recipient_count);
  }, [ppcPreview?.recipient_count]);

  const settings = overview?.settings || {};
  const walletBalance = overview?.wallet_balance ?? 0;
  const stats = overview?.stats || {};

  // Cost based on the shop's chosen number of recipients (range selector)
  const emailPricePerEmail = emailPreview?.price_per_email ?? settings.email_price_per_email ?? 0.05;
  const ppcPricePerEmail = ppcPreview?.price_per_email ?? settings.email_price_per_email ?? 0.05;
  const emailChosenCount = Math.min(emailRecipientLimit || 0, emailPreview?.recipient_count ?? 0);
  const ppcChosenCount = Math.min(ppcRecipientLimit || 0, ppcPreview?.recipient_count ?? 0);
  const emailChosenCost = +(emailChosenCount * emailPricePerEmail).toFixed(2);
  const emailSufficient = emailChosenCount > 0 && walletBalance >= emailChosenCost;

  const normalizeBody = (body) => {
    const t = body.trim();
    if (/<[a-z][\s\S]*>/i.test(t)) return t; // already HTML
    return t.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
  };

  // ---- Launch blast ----
  const handleLaunchBlast = async () => {
    if (!emailForm.subject.trim() || !emailForm.body.trim()) { toast.error('Subject and body are required'); return; }
    if (emailForm.link_type === 'product' && !emailForm.link_target_id) { toast.error('Please choose a product to link to'); return; }
    setLaunching(true);
    try {
      const { data } = await api.ads.sendBlast({
        ...emailForm, body_html: normalizeBody(emailForm.body), max_recipients: emailRecipientLimit || undefined,
      });
      const recipientCount = data?.campaign?.recipients_count || emailChosenCount || 0;
      // Persistent success banner for 30s (don't auto-dismiss too quickly)
      toast.success(
        `Campaign launched! Sending to ${recipientCount} recipient${recipientCount === 1 ? '' : 's'}. Emails take ~${Math.ceil(recipientCount * 0.6)}s to fully deliver.`,
        { duration: 12000 }
      );
      // Track campaign for live polling
      setRecentlyLaunched({ id: data?.campaign?.id, recipientCount, subject: data?.campaign?.subject || emailForm.subject, launchedAt: Date.now() });
      setEmailForm({ ...emptyForm });
      fetchAll();
      window.dispatchEvent(new Event('wallet-updated'));
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to launch'); } finally { setLaunching(false); setConfirmType(null); }
  };

  // ---- Launch PPC ----
  const handleLaunchPpc = async () => {
    if (!ppcForm.subject.trim() || !ppcForm.body.trim()) { toast.error('Subject and body are required'); return; }
    if (ppcForm.link_type === 'product' && !ppcForm.link_target_id) { toast.error('Please choose a product to link to'); return; }
    setLaunching(true);
    try {
      const { data } = await api.ads.startPpc({
        ...ppcForm, body_html: normalizeBody(ppcForm.body), click_budget: ppcBudget, max_recipients: ppcRecipientLimit || undefined,
      });
      const recipientCount = data?.campaign?.recipients_count || ppcChosenCount || 0;
      toast.success(
        `PPC campaign launched! Sending to ${recipientCount} recipient${recipientCount === 1 ? '' : 's'}. Emails take ~${Math.ceil(recipientCount * 0.6)}s to deliver.`,
        { duration: 12000 }
      );
      setRecentlyLaunched({ id: data?.campaign?.id, recipientCount, subject: data?.campaign?.subject || ppcForm.subject, launchedAt: Date.now() });
      setPpcForm({ ...emptyForm });
      fetchAll();
      window.dispatchEvent(new Event('wallet-updated'));
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to launch'); } finally { setLaunching(false); setConfirmType(null); }
  };

  // ---- Send TEST email (free, doesn't deduct wallet, to verify deliverability) ----
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const handleSendTestEmail = async (formData) => {
    if (!formData.subject.trim() || !formData.body.trim()) { toast.error('Subject and body are required first'); return; }
    const targetEmail = (testEmail || '').trim() || undefined;
    if (testEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(testEmail)) {
      toast.error('Enter a valid email address (or leave empty to use your account email)');
      return;
    }
    setSendingTest(true);
    try {
      const { data } = await api.ads.sendTestEmail({
        test_email: targetEmail,
        subject: formData.subject,
        body_html: normalizeBody(formData.body),
        cta_text: formData.cta_text || 'Visit Shop',
        preview: formData.preview || '',
        link_type: formData.link_type || 'shop',
        link_target_id: formData.link_target_id || null,
      });
      toast.success(data.message || 'Test email sent! Check your inbox + Spam folder.', { duration: 6000 });
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  // ---- AI generate ----
  const handleGenerateAi = async () => {
    setAiLoading(true);
    try {
      const { data } = await api.ads.aiSuggest({ goal: aiGoal, tone: aiTone, occasion: aiOccasion });
      setAiVariants(data.variants || []);
      if (!data.variants?.length) toast.error('No suggestions generated, try again');
    } catch (e) { toast.error(e.response?.data?.detail || 'AI generation failed'); } finally { setAiLoading(false); }
  };

  const applyVariant = (v) => {
    const setter = aiTarget === 'ppc' ? setPpcForm : setEmailForm;
    const cur = aiTarget === 'ppc' ? ppcForm : emailForm;
    setter({ ...cur, subject: v.subject || cur.subject, preview: v.preview || cur.preview, body: v.body_html || cur.body, cta_text: v.cta_text || cur.cta_text });
    setApplyRing('subject');
    setTimeout(() => setApplyRing(null), 700);
    toast.success('Suggestion applied to your campaign');
    setAiOpen(false);
  };

  // ---- Boost ----
  const freeShortCredits = shopProfile?.free_sponsor_credits || 0;
  const freeLongCredits = shopProfile?.free_sponsor_10day_credits || 0;
  const totalSponsorCredits = freeShortCredits + freeLongCredits;
  const canUseFreeBoost = useFreeBoostCredit && ((freeShortCredits > 0 && boostDuration === 3) || (freeLongCredits > 0 && boostDuration === 10));

  const handleBoost = async () => {
    if (!boostProduct) { toast.error('Select a product to boost'); return; }
    const cost = boostDailyPrice * boostDuration;
    if (!canUseFreeBoost && cost > walletBalance) { toast.error(`Need ${fmt(cost)}, wallet has ${fmt(walletBalance)}`); return; }
    setBoosting(true);
    try {
      await api.shopPromotions.create({ product_id: boostProduct, duration_days: boostDuration, use_free_credit: canUseFreeBoost });
      toast.success(canUseFreeBoost ? 'Free sponsor credit used — product boosted!' : 'Product boosted successfully!');
      setBoostProduct('');
      fetchAll();
      window.dispatchEvent(new Event('wallet-updated'));
    } catch (e) { toast.error(e.response?.data?.detail || 'Boost failed'); } finally { setBoosting(false); setConfirmType(null); }
  };

  // ---- Join event ----
  const handleJoinEvent = async (ev, days) => {
    const usedDays = Math.max(1, parseInt(days || getSponsorDays(ev.id)));
    const total = (ev.sponsorship_price_per_day || ev.sponsorship_price || 0) * usedDays;
    if (total > walletBalance) { toast.error(`Need ${fmt(total)}, wallet has ${fmt(walletBalance)}`); return; }
    const content = sponsorContent[ev.id] || {};
    try {
      const { data } = await api.ads.joinEvent(ev.id, { days: usedDays, title: content.title || '', subtitle: content.subtitle || '' });
      toast.success(data.message || 'Joined event!');
      fetchAll();
      window.dispatchEvent(new Event('wallet-updated'));
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to join'); }
    finally { setConfirmType(null); setConfirmData(null); }
  };

  // ---- Edit sponsor banner content (title/subtitle) after purchase ----
  const handleSaveSponsorContent = async (ev) => {
    const content = sponsorContent[ev.id] || {};
    try {
      await api.ads.updateSponsorContent(ev.id, { title: content.title || '', subtitle: content.subtitle || '' });
      toast.success('Banner text updated — it now shows on the home page!');
      setEditingContentId(null);
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update'); }
  };

  // ---- Performance chart data ----
  const spendByType = [
    { name: 'Email', value: campaigns.filter(c => c.type === 'blast').reduce((s, c) => s + (c.cost_charged || 0), 0) },
    { name: 'PPC', value: campaigns.filter(c => c.type === 'ppc').reduce((s, c) => s + (c.spend || 0), 0) },
  ].filter(d => d.value > 0);
  const clicksByCampaign = campaigns.slice(0, 8).map(c => ({ name: (c.name || c.subject || '').slice(0, 12), clicks: c.clicks || 0 }));
  const PIE_COLORS = ['#10b981', '#f59e0b', '#b4f56a', '#ef4444'];

  if (loading) return <ShopLayout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-emerald-500" /></div></ShopLayout>;

  const activeBudgetPpc = (form, budget, preview) => {
    const enough = walletBalance >= (settings.ppc_min_wallet_to_start || 5);
    return enough;
  };

  return (
    <ShopLayout>
      <div className="p-3 sm:p-5 lg:p-8 space-y-5 sm:space-y-6 bg-slate-50/60 min-h-screen" data-testid="shop-advertising-page">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200 flex-shrink-0">
              <Rocket className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Advertising</h1>
              <p className="text-sm text-slate-600 max-w-2xl">Grow your shop with email campaigns, pay-per-click ads, product boosts and event sponsorships — all paid from your wallet.</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/60 px-4 py-2 text-sm text-emerald-900 self-start" data-testid="shop-advertising-wallet-balance">
            <Wallet className="h-4 w-4" /> <span className="font-bold">{fmt(walletBalance)}</span> wallet
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard icon={Wallet} label="Wallet Balance" value={fmt(walletBalance)} testid="shop-advertising-kpi-wallet" />
          <KpiCard icon={Zap} label="Active Campaigns" value={stats.active_campaigns ?? 0} hint={`${stats.total_campaigns ?? 0} total`} testid="shop-advertising-kpi-active" />
          <KpiCard icon={DollarSign} label="Total Ad Spend" value={fmt(stats.total_spend)} testid="shop-advertising-kpi-spend" />
          <KpiCard icon={MousePointerClick} label="Total Clicks" value={stats.total_clicks ?? 0} hint={`${stats.total_emails_sent ?? 0} emails sent`} testid="shop-advertising-kpi-clicks" />
        </div>

        {/* Info: Email vs PPC explainer */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden" data-testid="ads-info-section">
          <div className="flex items-center gap-2 px-4 sm:px-5 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
            <Info className="h-4.5 w-4.5 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-800">How advertising works — Email vs Pay-Per-Click</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 sm:p-5">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4" data-testid="ads-info-email">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700"><Mail className="h-4 w-4" /></div>
                <h4 className="text-sm font-bold text-slate-900">Email Advertising (Blast)</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Send a one-time promotional email to a chosen audience (all platform customers or your own past customers).
                You are <span className="font-semibold text-slate-800">charged once, per email delivered</span> ({fmt(settings.email_price_per_email || 0.05)} each).
                Best for announcements, sales, and new arrivals where you want maximum reach for a fixed, predictable cost.
              </p>
              <ul className="mt-2 space-y-1 text-[11px] text-slate-500">
                <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-600" /> Pay upfront for the whole send</li>
                <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-600" /> Great for broad awareness</li>
              </ul>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4" data-testid="ads-info-ppc">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700"><MousePointerClick className="h-4 w-4" /></div>
                <h4 className="text-sm font-bold text-slate-900">Pay-Per-Click (PPC)</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Send the email for free and only <span className="font-semibold text-slate-800">pay when a customer actually clicks</span> your link
                ({fmt(settings.ppc_price_per_click || 0.05)} per click). You set a click budget — spending stops automatically once it runs out.
                Best when you care about real traffic and a measurable return on every dollar.
              </p>
              <ul className="mt-2 space-y-1 text-[11px] text-slate-500">
                <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-indigo-600" /> Pay only for engaged clicks</li>
                <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-indigo-600" /> Requires a minimum wallet of {fmt(settings.ppc_min_wallet_to_start || 5)} to start</li>
              </ul>
            </div>
          </div>
          <div className="px-4 sm:px-5 pb-4 -mt-1">
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5" data-testid="ads-info-tip">
              <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-amber-800">
                <span className="font-semibold">Tip:</span> Email and PPC are launched as separate campaigns. Use an Email Blast for a big announcement,
                then run a PPC campaign to keep driving traffic while only paying for results.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} data-testid="shop-advertising-tabs">
          <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide rounded-2xl border border-slate-200 bg-white p-1 h-auto flex-nowrap">
            <TabsTrigger value="email" disabled={settings.email_campaigns_enabled === false} className="rounded-xl px-3 py-2 text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white whitespace-nowrap disabled:opacity-50" data-testid="shop-advertising-tab-email"><Mail className="h-4 w-4 mr-1.5" />Email Ads{settings.email_campaigns_enabled === false ? ' (off)' : ''}</TabsTrigger>
            <TabsTrigger value="ppc" disabled={settings.ppc_campaigns_enabled === false} className="rounded-xl px-3 py-2 text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white whitespace-nowrap disabled:opacity-50" data-testid="shop-advertising-tab-ppc"><MousePointerClick className="h-4 w-4 mr-1.5" />Pay-Per-Click{settings.ppc_campaigns_enabled === false ? ' (off)' : ''}</TabsTrigger>
            <TabsTrigger value="boost" className="rounded-xl px-3 py-2 text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white whitespace-nowrap" data-testid="shop-advertising-tab-boost"><Megaphone className="h-4 w-4 mr-1.5" />Boost Product</TabsTrigger>
            <TabsTrigger value="sponsor" disabled={settings.banner_campaigns_enabled === false} className="rounded-xl px-3 py-2 text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white whitespace-nowrap disabled:opacity-50" data-testid="shop-advertising-tab-sponsor"><CalendarDays className="h-4 w-4 mr-1.5" />Event Sponsorship{settings.banner_campaigns_enabled === false ? ' (off)' : ''}</TabsTrigger>
            <TabsTrigger value="performance" className="rounded-xl px-3 py-2 text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white whitespace-nowrap" data-testid="shop-advertising-tab-performance"><BarChart3 className="h-4 w-4 mr-1.5" />Performance</TabsTrigger>
          </TabsList>

          {/* ============ EMAIL ============ */}
          <TabsContent value="email" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2"><Mail className="h-5 w-5 text-emerald-600" /> Email Campaign</h2>
                    <p className="text-xs text-slate-500">Send a one-time email blast to your audience. Charged per email delivered.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setAiTarget('email'); setAiOpen(true); }} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" data-testid="email-ad-ai-generate-button">
                    <Sparkles className="h-4 w-4 mr-1.5" /> AI Suggestions
                  </Button>
                </div>
                <EmailComposer form={emailForm} setForm={setEmailForm} applyRing={applyRing} />
              </div>
              <div className="lg:col-span-4 space-y-4">
                <TargetingCard form={emailForm} setForm={setEmailForm} preview={emailPreview} previewLoading={emailPreviewLoading} products={products} walletBalance={walletBalance}
                  recipientLimit={emailRecipientLimit} setRecipientLimit={setEmailRecipientLimit} pricePerEmail={emailPricePerEmail} showCost={true} />
                <Button onClick={() => {
                    if (!emailForm.subject.trim() || !emailForm.body.trim()) { toast.error('Subject and body are required'); return; }
                    if (emailForm.link_type === 'product' && !emailForm.link_target_id) { toast.error('Please choose a product to link to'); return; }
                    setConfirmType('blast');
                  }} disabled={launching || emailChosenCount < 1 || !emailSufficient}
                  className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold" data-testid="email-ad-launch-button">
                  {launching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Launch Campaign {emailChosenCount > 0 ? `(${fmt(emailChosenCost)})` : ''}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ============ PPC ============ */}
          <TabsContent value="ppc" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2"><MousePointerClick className="h-5 w-5 text-emerald-600" /> Pay-Per-Click Campaign</h2>
                    <p className="text-xs text-slate-500">Only pay when a customer clicks. {fmt(settings.ppc_price_per_click || 0.05)} per click.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setAiTarget('ppc'); setAiOpen(true); }} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                    <Sparkles className="h-4 w-4 mr-1.5" /> AI Suggestions
                  </Button>
                </div>
                <EmailComposer form={ppcForm} setForm={setPpcForm} applyRing={applyRing} />
                {/* Budget */}
                <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4" data-testid="ppc-budget-strip">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-semibold text-slate-700">Click budget</Label>
                    <span className="text-sm font-bold text-emerald-700">{fmt(ppcBudget)}</span>
                  </div>
                  <Slider value={[ppcBudget]} onValueChange={(v) => setPpcBudget(v[0])} min={1} max={Math.max(50, Math.floor(walletBalance))} step={1} data-testid="ppc-budget-slider" />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                    <span>$1</span>
                    <span>~{Math.floor(ppcBudget / (settings.ppc_price_per_click || 0.05))} clicks @ {fmt(settings.ppc_price_per_click || 0.05)}</span>
                    <span>{fmt(Math.max(50, Math.floor(walletBalance)))}</span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 space-y-4">
                <TargetingCard form={ppcForm} setForm={setPpcForm} preview={ppcPreview} previewLoading={ppcPreviewLoading} products={products} walletBalance={walletBalance}
                  recipientLimit={ppcRecipientLimit} setRecipientLimit={setPpcRecipientLimit} pricePerEmail={ppcPricePerEmail} showCost={false} />
                {walletBalance < (settings.ppc_min_wallet_to_start || 5) && (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5" data-testid="ppc-wallet-gate">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800">You need at least {fmt(settings.ppc_min_wallet_to_start || 5)} in your wallet to start a PPC campaign.</p>
                  </div>
                )}
                <Button onClick={() => {
                    if (!ppcForm.subject.trim() || !ppcForm.body.trim()) { toast.error('Subject and body are required'); return; }
                    if (ppcForm.link_type === 'product' && !ppcForm.link_target_id) { toast.error('Please choose a product to link to'); return; }
                    setConfirmType('ppc');
                  }} disabled={launching || ppcChosenCount < 1 || walletBalance < (settings.ppc_min_wallet_to_start || 5)}
                  className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold" data-testid="ppc-start-campaign-button">
                  {launching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                  Launch PPC ({fmt(ppcBudget)} budget)
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ============ BOOST ============ */}
          <TabsContent value="boost" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2"><Megaphone className="h-5 w-5 text-amber-500" /> Boost a Product</h2>
                  {totalSponsorCredits > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm animate-pulse" data-testid="boost-free-sponsor-badge">
                      <Gift className="h-3.5 w-3.5" /> {totalSponsorCredits} Free Sponsor{totalSponsorCredits > 1 ? 's' : ''} available
                    </span>
                  )}
                </div>
                {totalSponsorCredits > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-4 text-xs text-amber-800" data-testid="boost-free-sponsor-note">
                    <div className="flex items-center gap-2 mb-1.5 font-bold"><Gift className="h-3.5 w-3.5" /> You have free product sponsors!</div>
                    {freeShortCredits > 0 && <p>• {freeShortCredits} × 3-day sponsor credit{freeShortCredits > 1 ? 's' : ''}</p>}
                    {freeLongCredits > 0 && <p>• {freeLongCredits} × 10-day sponsor credit{freeLongCredits > 1 ? 's' : ''}</p>}
                    <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                      <input type="checkbox" checked={useFreeBoostCredit} onChange={(e) => {
                        setUseFreeBoostCredit(e.target.checked);
                        // Free sponsor = 3 days (regular); lock the range while checked.
                        if (e.target.checked) {
                          if (freeShortCredits > 0) setBoostDuration(3);
                          else if (freeLongCredits > 0) setBoostDuration(10);
                        }
                      }} className="rounded border-amber-300 text-amber-600 focus:ring-amber-500" data-testid="boost-use-free-credit-toggle" />
                      <span className="font-semibold">Use a free credit (sets duration to 3 or 10 days)</span>
                    </label>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Choose product</Label>
                    <Select value={boostProduct} onValueChange={setBoostProduct}>
                      <SelectTrigger className="h-10" data-testid="boost-product-select"><SelectValue placeholder="Select a product to boost" /></SelectTrigger>
                      <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-700">Duration</Label>
                      <span className="text-sm font-bold text-emerald-700" data-testid="boost-duration-value">{boostDuration} {boostDuration === 1 ? 'day' : 'days'}</span>
                    </div>
                    <div className={`rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 ${useFreeBoostCredit ? 'opacity-60' : ''}`} data-testid="boost-duration-range">
                      <Slider
                        value={[boostDuration]}
                        onValueChange={(v) => setBoostDuration(v[0])}
                        min={1}
                        max={30}
                        step={1}
                        disabled={useFreeBoostCredit}
                        data-testid="boost-duration-slider"
                      />
                      <div className="flex justify-between text-[11px] text-slate-400 mt-2">
                        <span>1 day</span>
                        <span>{fmt(boostDailyPrice)}/day</span>
                        <span>30 days</span>
                      </div>
                      {useFreeBoostCredit && <p className="text-[11px] text-emerald-700 mt-2">Locked to your free sponsor duration. Uncheck to change.</p>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800">Boost summary</h3>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Daily rate</span><span className="font-semibold">{fmt(boostDailyPrice)}/day</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Duration</span><span className="font-semibold">{boostDuration} days</span></div>
                  <div className="border-t border-emerald-100 my-1" />
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total</span>
                    {canUseFreeBoost ? (
                      <span className="flex items-center gap-2">
                        <span className="text-sm text-slate-400 line-through">{fmt(boostDailyPrice * boostDuration)}</span>
                        <span className="text-xl font-bold text-amber-600 flex items-center gap-1" data-testid="boost-cost-preview"><Gift className="h-4 w-4" /> FREE</span>
                      </span>
                    ) : (
                      <span className="text-xl font-bold text-emerald-700" data-testid="boost-cost-preview">{fmt(boostDailyPrice * boostDuration)}</span>
                    )}
                  </div>
                  {canUseFreeBoost && <p className="text-[11px] text-amber-600 text-right font-medium">A free sponsor credit will be used</p>}
                  <div className="flex justify-between text-xs"><span className="text-slate-500">Wallet balance</span><span className={canUseFreeBoost || walletBalance >= boostDailyPrice * boostDuration ? 'text-emerald-600 font-semibold' : 'text-rose-500 font-semibold'}>{fmt(walletBalance)}</span></div>
                  <Button onClick={() => {
                      if (!boostProduct) { toast.error('Select a product to boost'); return; }
                      setConfirmType('boost');
                    }} disabled={boosting || !boostProduct || (!canUseFreeBoost && walletBalance < boostDailyPrice * boostDuration)}
                    className={`w-full h-11 text-white font-semibold mt-2 ${canUseFreeBoost ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600' : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'}`} data-testid="boost-confirm-button">
                    {boosting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (canUseFreeBoost ? <Gift className="h-4 w-4 mr-2" /> : <Megaphone className="h-4 w-4 mr-2" />)}
                    {canUseFreeBoost ? 'Boost for FREE' : `Boost for ${fmt(boostDailyPrice * boostDuration)}`}
                  </Button>
                  <p className="text-[11px] text-slate-500 text-center">Boosted products appear in sponsored rows across the platform.</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ============ SPONSORSHIP ============ */}
          <TabsContent value="sponsor" className="mt-4">
            {/* Banner showing the shop's active sponsorship + one-event constraint */}
            {myActiveSponsorship && (
              <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 via-emerald-50 to-teal-50 p-4 mb-4 flex items-center gap-3" data-testid="shop-active-sponsorship-banner">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm shrink-0">
                  <Crown className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Active Sponsorship</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">You're sponsoring <span className="text-emerald-700">{myActiveSponsorship.event_title}</span> until {new Date(myActiveSponsorship.end_at).toLocaleDateString()}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">A shop can sponsor only ONE event at a time. Wait until your campaign ends to sponsor another banner.</p>
                </div>
              </div>
            )}
            {events.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-10 text-center">
                <Megaphone className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">No active campaign events right now</p>
                <p className="text-sm text-slate-400">Seasonal events (Black Friday, Ramadan...) will appear here when the admin opens them for sponsorship.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {events.map(ev => {
                  const dailyPrice = ev.sponsorship_price_per_day || ev.sponsorship_price || 2;
                  const days = getSponsorDays(ev.id);
                  const total = +(dailyPrice * days).toFixed(2);
                  const reservedUntilFmt = ev.reserved_until ? new Date(ev.reserved_until).toLocaleDateString() : '';
                  const blocked = ev.is_reserved && !ev.joined;
                  const blockedByOther = !!ev.blocked_by_other_sponsorship;
                  return (
                    <div key={ev.id} className={`rounded-2xl border ${blocked || blockedByOther ? 'border-slate-200 opacity-90' : 'border-slate-200'} bg-white shadow-sm overflow-hidden flex flex-col`} data-testid="event-sponsorship-card">
                      <div className="h-32 relative" style={{ background: ev.banner_accent_color ? undefined : 'linear-gradient(135deg,#3bf4fb,#caff8a)' }}>
                        {ev.banner_accent_color && (
                          <div className={`absolute inset-0 bg-gradient-to-br ${ev.banner_accent_color}`} />
                        )}
                        {ev.image_url && <img src={ev.image_url} alt={ev.title} className="absolute inset-0 w-full h-full object-cover opacity-70" />}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute inset-0 flex flex-col justify-end p-3">
                          <span className="inline-flex items-center self-start rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 mb-1"><Crown className="h-3 w-3 mr-1" /> Home Banner Feature</span>
                          <h3 className="text-white font-bold text-lg drop-shadow line-clamp-1">{ev.title}</h3>
                          {ev.banner_subtitle && <p className="text-white/85 text-xs line-clamp-2">{ev.banner_subtitle}</p>}
                        </div>
                      </div>
                      <div className="p-4 space-y-3 flex-1 flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500 flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {ev.sponsors_count} total sponsor{ev.sponsors_count !== 1 ? 's' : ''}</span>
                          <span className="text-sm font-bold text-emerald-700">{fmt(dailyPrice)}/day</span>
                        </div>
                        {ev.joined ? (
                          <div className="space-y-2">
                            <div className="w-full rounded-xl bg-emerald-50 border border-emerald-200 py-2.5 text-center text-sm font-semibold text-emerald-700 flex items-center justify-center gap-1.5">
                              <Check className="h-4 w-4" /> You&apos;re sponsoring this{reservedUntilFmt ? ` until ${reservedUntilFmt}` : ''}
                            </div>
                            {editingContentId === ev.id ? (
                              <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 space-y-2" data-testid={`sponsor-edit-content-${ev.id}`}>
                                <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wider">Your banner text (shown on home page)</p>
                                <Input
                                  value={sponsorContent[ev.id]?.title ?? (ev.my_sponsor_title || ev.title || '')}
                                  onChange={(e) => setContentField(ev.id, 'title', e.target.value)}
                                  placeholder="Banner title"
                                  className="h-9 text-sm" data-testid={`sponsor-title-input-${ev.id}`}
                                />
                                <Input
                                  value={sponsorContent[ev.id]?.subtitle ?? (ev.my_sponsor_subtitle || ev.banner_subtitle || '')}
                                  onChange={(e) => setContentField(ev.id, 'subtitle', e.target.value)}
                                  placeholder="Banner subtitle"
                                  className="h-9 text-sm" data-testid={`sponsor-subtitle-input-${ev.id}`}
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => setEditingContentId(null)} className="flex-1">Cancel</Button>
                                  <Button size="sm" onClick={() => handleSaveSponsorContent(ev)} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white" data-testid={`sponsor-save-content-${ev.id}`}>Save</Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                size="sm" variant="outline"
                                onClick={() => {
                                  setSponsorContent((s) => ({ ...s, [ev.id]: { title: ev.my_sponsor_title || ev.title || '', subtitle: ev.my_sponsor_subtitle || ev.banner_subtitle || '' } }));
                                  setEditingContentId(ev.id);
                                }}
                                className="w-full border-violet-200 text-violet-700 hover:bg-violet-50"
                                data-testid={`sponsor-edit-text-btn-${ev.id}`}
                              >
                                <Edit3 className="h-3.5 w-3.5 mr-1.5" /> Edit banner title &amp; subtitle
                              </Button>
                            )}
                          </div>
                        ) : blocked ? (
                          <div className="w-full rounded-xl bg-slate-50 border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-600 flex items-center justify-center gap-1.5" data-testid="event-banner-reserved">
                            <Lock className="h-4 w-4" /> Reserved until {reservedUntilFmt}
                          </div>
                        ) : blockedByOther ? (
                          <div className="w-full rounded-xl bg-amber-50 border border-amber-200 py-2.5 px-3 text-center text-xs font-semibold text-amber-700 flex items-center justify-center gap-1.5" data-testid={`event-blocked-by-other-${ev.id}`}>
                            <Lock className="h-4 w-4" /> You already sponsor {myActiveSponsorship?.event_title || 'another banner'}
                          </div>
                        ) : (
                          <>
                            <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 space-y-2" data-testid={`sponsor-content-inputs-${ev.id}`}>
                              <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wider flex items-center gap-1"><Edit3 className="h-3 w-3" /> Customize your banner (optional)</p>
                              <Input
                                value={sponsorContent[ev.id]?.title ?? ''}
                                onChange={(e) => setContentField(ev.id, 'title', e.target.value)}
                                placeholder={`Title (default: ${ev.title})`}
                                className="h-9 text-sm" data-testid={`join-title-input-${ev.id}`}
                              />
                              <Input
                                value={sponsorContent[ev.id]?.subtitle ?? ''}
                                onChange={(e) => setContentField(ev.id, 'subtitle', e.target.value)}
                                placeholder="Subtitle (optional)"
                                className="h-9 text-sm" data-testid={`join-subtitle-input-${ev.id}`}
                              />
                            </div>
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <Label className="text-xs font-semibold text-slate-700">Duration</Label>
                                <span className="text-sm font-bold text-emerald-700">{days} day{days !== 1 ? 's' : ''}</span>
                              </div>
                              <Slider
                                value={[days]}
                                onValueChange={(v) => setSponsorDays((s) => ({ ...s, [ev.id]: v[0] }))}
                                min={1}
                                max={30}
                                step={1}
                                data-testid={`event-sponsor-days-slider-${ev.id}`}
                              />
                              <div className="flex justify-between text-[11px] text-slate-400">
                                <span>1 day</span>
                                <span>30 days</span>
                              </div>
                              <div className="flex items-center justify-between border-t border-emerald-100 pt-2">
                                <span className="text-xs text-slate-500">Total</span>
                                <span className="text-sm font-bold text-emerald-700" data-testid={`event-sponsor-total-${ev.id}`}>{fmt(total)}</span>
                              </div>
                            </div>
                            <Button onClick={() => { setConfirmData({ ...ev, days, total }); setConfirmType('sponsor'); }} disabled={!ev.sponsorship_enabled || total > walletBalance}
                              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white mt-auto" data-testid="event-sponsorship-join-button">
                              {total > walletBalance ? 'Insufficient wallet' : <>Sponsor for {fmt(total)} <ArrowRight className="h-4 w-4 ml-1" /></>}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ============ PERFORMANCE ============ */}
          <TabsContent value="performance" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2"><MousePointerClick className="h-4 w-4 text-emerald-600" /> Clicks by campaign</h3>
                <div style={{ height: 240 }} data-testid="shop-performance-chart-clicks">
                  {clicksByCampaign.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={clicksByCampaign}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                        <RTooltip />
                        <Bar dataKey="clicks" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-sm text-slate-400">No click data yet</div>}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-600" /> Spend allocation</h3>
                <div style={{ height: 240 }} data-testid="shop-performance-chart-spend">
                  {spendByType.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={spendByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}: ${fmt(e.value)}`}>
                          {spendByType.map((e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <RTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-sm text-slate-400">No spend data yet</div>}
                </div>
              </div>
            </div>

            {/* Campaigns table */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden" data-testid="shop-performance-campaigns-table">
              <div className="px-4 py-3 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-800">My Campaigns ({campaigns.length})</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50">
                    <th className="text-left px-4 py-2.5">Campaign</th><th className="text-left px-4 py-2.5">Type</th>
                    <th className="text-left px-4 py-2.5">Target</th><th className="text-right px-4 py-2.5">Sent</th>
                    <th className="text-right px-4 py-2.5">Clicks</th><th className="text-right px-4 py-2.5">Spend</th>
                    <th className="text-left px-4 py-2.5">Status</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {campaigns.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No campaigns yet — launch your first above!</td></tr>
                    ) : campaigns.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800 max-w-[180px] truncate">{c.name || c.subject}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className={c.type === 'ppc' ? 'border-indigo-200 text-indigo-700 bg-indigo-50' : 'border-emerald-200 text-emerald-700 bg-emerald-50'}>{c.type === 'ppc' ? 'PPC' : 'Email'}</Badge></td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{c.target_type === 'own_customers' ? 'My customers' : (c.target_state === 'all' ? 'All states' : c.target_state)}</td>
                        <td className="px-4 py-3 text-right">{c.emails_sent || 0}</td>
                        <td className="px-4 py-3 text-right font-medium">{c.clicks || 0}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt((c.cost_charged || 0) + (c.spend || 0))}</td>
                        <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-sky-100 text-sky-700' : c.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : c.status === 'sending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{c.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Confirm Payment Dialog */}
        <ConfirmSpendDialog
          open={confirmType === 'blast'}
          onClose={() => setConfirmType(null)}
          onConfirm={handleLaunchBlast}
          title="Launch Email Campaign?"
          description={`Send your email to ${emailChosenCount} recipient${emailChosenCount !== 1 ? 's' : ''}.`}
          icon={Mail}
          iconGradient="from-emerald-500 to-teal-500"
          confirmGradient="from-emerald-500 to-teal-500"
          walletBalance={walletBalance}
          spendAmount={emailChosenCost}
          itemName={emailForm.name || emailForm.subject || 'Email Blast'}
          confirmLabel="Confirm & Send"
          loading={launching}
        />
        <ConfirmSpendDialog
          open={confirmType === 'ppc'}
          onClose={() => setConfirmType(null)}
          onConfirm={handleLaunchPpc}
          title="Launch PPC Campaign?"
          description={`You'll only pay ${fmt(settings.ppc_price_per_click || 0.05)} per click, up to ${fmt(ppcBudget)}.`}
          icon={MousePointerClick}
          iconGradient="from-indigo-500 to-violet-500"
          confirmGradient="from-indigo-500 to-violet-500"
          walletBalance={walletBalance}
          spendAmount={ppcBudget}
          itemName={ppcForm.name || ppcForm.subject || 'PPC Campaign'}
          confirmLabel="Confirm & Start"
          loading={launching}
        />
        <ConfirmSpendDialog
          open={confirmType === 'boost'}
          onClose={() => setConfirmType(null)}
          onConfirm={handleBoost}
          title="Boost This Product?"
          description={canUseFreeBoost ? `Your product will be sponsored for ${boostDuration} days using a FREE sponsor credit — no wallet charge.` : `Your product will be sponsored for ${boostDuration} day${boostDuration !== 1 ? 's' : ''}.`}
          icon={canUseFreeBoost ? Gift : Megaphone}
          iconGradient="from-amber-500 to-orange-500"
          confirmGradient="from-amber-500 to-orange-500"
          walletBalance={walletBalance}
          spendAmount={canUseFreeBoost ? 0 : boostDailyPrice * boostDuration}
          itemName={products.find((p) => p.id === boostProduct)?.name || 'Product'}
          confirmLabel={canUseFreeBoost ? 'Use Free Credit & Boost' : 'Confirm & Boost'}
          loading={boosting}
        />
        <ConfirmSpendDialog
          open={confirmType === 'sponsor'}
          onClose={() => { setConfirmType(null); setConfirmData(null); }}
          onConfirm={() => confirmData && handleJoinEvent(confirmData, confirmData.days)}
          title="Sponsor This Event?"
          description={`Your shop will be featured on the home banner for ${confirmData?.days || 1} day${(confirmData?.days || 1) !== 1 ? 's' : ''}.`}
          icon={Crown}
          iconGradient="from-fuchsia-500 to-rose-500"
          confirmGradient="from-fuchsia-500 to-rose-500"
          walletBalance={walletBalance}
          spendAmount={confirmData?.total || 0}
          itemName={confirmData?.title || 'Event Banner'}
          confirmLabel="Confirm & Sponsor"
          loading={false}
        />

        {/* AI Suggestions Dialog */}
        <Dialog open={aiOpen} onOpenChange={setAiOpen}>
          <DialogContent className="sm:max-w-[640px] max-h-[88vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-emerald-600" /> AI Email Copy Suggestions</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">What's the goal of this email?</Label>
                  <Input value={aiGoal} onChange={(e) => setAiGoal(e.target.value)} placeholder="e.g. Promote our new winter collection" className="h-10" data-testid="ai-goal-input" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Tone</Label>
                  <Select value={aiTone} onValueChange={setAiTone}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Professional', 'Warm & local (Lebanon-friendly)', 'Urgent promo', 'Premium / boutique', 'Friendly & fun'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Occasion (optional)</Label>
                  <Input value={aiOccasion} onChange={(e) => setAiOccasion(e.target.value)} placeholder="e.g. Black Friday" className="h-10" />
                </div>
              </div>
              <Button onClick={handleGenerateAi} disabled={aiLoading} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white">
                {aiLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate 3 variants</>}
              </Button>

              <div className="space-y-3">
                {aiVariants.map((v, i) => (
                  <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3" data-testid="email-ad-ai-variant-card">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Variant {String.fromCharCode(65 + i)}</span>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="ghost" className="h-7 text-xs hover:bg-white" onClick={() => { navigator.clipboard?.writeText(`${v.subject}\n\n${(v.body_html || '').replace(/<[^>]+>/g, '')}`); toast.success('Copied'); }} data-testid="email-ad-ai-variant-copy-button"><Copy className="h-3 w-3 mr-1" /> Copy</Button>
                        <Button size="sm" className="h-7 text-xs bg-gradient-to-r from-emerald-500 to-teal-500 text-white" onClick={() => applyVariant(v)} data-testid="email-ad-ai-variant-apply-button"><Check className="h-3 w-3 mr-1" /> Apply</Button>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{v.subject}</p>
                    {v.preview && <p className="text-xs text-slate-500 italic">{v.preview}</p>}
                    <div className="text-xs text-slate-600 mt-1.5 line-clamp-3" dangerouslySetInnerHTML={{ __html: v.body_html || '' }} />
                    {v.cta_text && <span className="inline-block mt-2 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">CTA: {v.cta_text}</span>}
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ShopLayout>
  );
};

export default ShopAdvertising;
