import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, ScrollView, Image, Animated, Easing, Clipboard, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { notifySuccess } from '../../lib/haptics';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { Input } from '../../components/ui';
import { ShopScreenWrap, Rise, Pulse, CountUp, PressScale, Spinner, SingleSlider, toast } from '../../components/shop/ShopKit';
import ConfirmSpendSheet from '../../components/shop/ConfirmSpendSheet';

const W = Dimensions.get('window').width;
const fmt = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const STATES = ['Beirut', 'Mount Lebanon', 'North Lebanon', 'South Lebanon', 'Bekaa', 'Nabatieh', 'Akkar', 'Baalbek-Hermel', 'Keserwan-Jbeil'];
const AI_TONES = ['Professional', 'Warm & local (Lebanon-friendly)', 'Urgent promo', 'Premium / boutique', 'Friendly & fun'];
const PIE_COLORS = ['#10b981', '#f59e0b', colors.s600, '#ef4444'];
const emptyForm = { name: '', subject: '', preview: '', body: '', cta_text: 'Shop Now', target_type: 'state', target_state: 'all', link_type: 'shop', link_target_id: '' };

/* ---------- rocket lift-off overlay after a launch ---------- */
function RocketLiftoff({ trigger }) {
  const a = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (trigger) {
      setVisible(true);
      a.setValue(0);
      Animated.timing(a, { toValue: 1, duration: 1400, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setVisible(false));
    }
  }, [trigger]); // eslint-disable-line
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'flex-end', zIndex: 99 }]}>
      <Animated.View style={{
        opacity: a.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-90, -Dimensions.get('window').height] }) },
          { rotate: '-45deg' },
          { scale: a.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.8, 1.3, 1] }) },
        ],
      }}>
        <Ionicons name="rocket" size={52} color="#10b981" />
      </Animated.View>
    </View>
  );
}

/* ---------- KPI card (emerald top strip) ---------- */
const KpiCard = ({ icon, label, value, money, hint, testID, index }) => (
  <Rise delay={60 + index * 70} style={kp.wrap}>
    <View style={kp.card} testID={testID}>
      <LinearGradient colors={shop.activePill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={kp.strip} />
      <View style={kp.icon}><Ionicons name={icon} size={16} color="#047857" /></View>
      {money ? <CountUp value={value} prefix="$" decimals={2} style={kp.value} /> : <CountUp value={value} style={kp.value} />}
      <Text style={kp.label}>{label}</Text>
      {hint ? <Text style={kp.hint}>{hint}</Text> : null}
    </View>
  </Rise>
);
const kp = StyleSheet.create({
  wrap: { flexBasis: '47%', flexGrow: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', padding: 13, ...shadow.card },
  strip: { position: 'absolute', top: 0, left: 0, right: 0, height: 5 },
  icon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center', marginBottom: 9, marginTop: 3 },
  value: { fontFamily: fonts.extrabold, fontSize: 21, color: colors.ink, letterSpacing: -0.4 },
  label: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, marginTop: 1 },
  hint: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted, marginTop: 2 },
});

/* ---------- shared email/ppc composer (module scope: inputs keep focus) ---------- */
const Field = ({ label, value, onChangeText, placeholder, multiline, maxLength, hint, ring, testID }) => (
  <View style={{ marginBottom: 11 }}>
    <Input label={label} value={value} onChangeText={onChangeText} placeholder={placeholder}
      multiline={multiline} maxLength={maxLength} highlight={ring} testID={testID} />
    {hint ? <Text style={cp.hint}>{hint}</Text> : null}
  </View>
);
const EmailComposer = ({ form, setForm, applyRing }) => (
  <View>
    <Field label="Campaign name (optional)" value={form.name} onChangeText={(t) => setForm(prev => ({ ...prev, name: t }))}
      placeholder="e.g. Spring Collection Launch" testID="email-ad-name-input" />
    <Field label="Subject line *" value={form.subject} onChangeText={(t) => setForm(prev => ({ ...prev, subject: t }))}
      placeholder="Grab attention in 55 characters" maxLength={120} ring={applyRing === 'subject'}
      hint={`${form.subject.length}/120 — keep it under 55 for best results`} testID="email-ad-subject-input" />
    <Field label="Preview text" value={form.preview} onChangeText={(t) => setForm(prev => ({ ...prev, preview: t }))}
      placeholder="Short teaser shown after the subject" maxLength={150} testID="email-ad-preview-text-input" />
    <Field label="Email body *" value={form.body} onChangeText={(t) => setForm(prev => ({ ...prev, body: t }))}
      placeholder="Write your message. You can use simple HTML (<p>, <b>, <ul><li>) or plain text." multiline testID="email-ad-body-textarea" />
    <Field label="Button label" value={form.cta_text} onChangeText={(t) => setForm(prev => ({ ...prev, cta_text: t }))}
      placeholder="Shop Now" testID="email-ad-cta-label-input" />
  </View>
);
const cp = StyleSheet.create({
  label: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.text, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13, color: colors.text, backgroundColor: colors.surface },
  hint: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 3 },
});

export default function ShopAdvertisingScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState(null);
  const [products, setProducts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [events, setEvents] = useState([]);
  const [myActiveSponsorship, setMyActiveSponsorship] = useState(null);
  const [shopProfile, setShopProfile] = useState(null);
  const [tab, setTab] = useState('email');

  const [emailForm, setEmailForm] = useState({ ...emptyForm });
  const [ppcForm, setPpcForm] = useState({ ...emptyForm });
  const [ppcBudget, setPpcBudget] = useState(10);
  const [emailPreview, setEmailPreview] = useState(null);
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);
  const [ppcPreview, setPpcPreview] = useState(null);
  const [ppcPreviewLoading, setPpcPreviewLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [applyRing, setApplyRing] = useState(null);
  const [emailRecipientLimit, setEmailRecipientLimit] = useState(0);
  const [ppcRecipientLimit, setPpcRecipientLimit] = useState(0);
  const [recentlyLaunched, setRecentlyLaunched] = useState(null);
  const [recentLiveStatus, setRecentLiveStatus] = useState(null);
  const [liftoff, setLiftoff] = useState(0);

  // AI
  const [aiOpen, setAiOpen] = useState(false);
  const [aiGoal, setAiGoal] = useState('');
  const [aiTone, setAiTone] = useState('Warm & local (Lebanon-friendly)');
  const [aiOccasion, setAiOccasion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiVariants, setAiVariants] = useState([]);
  const [aiTarget, setAiTarget] = useState('email');

  // Test email
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Boost tab
  const [boostProduct, setBoostProduct] = useState('');
  const [boostDuration, setBoostDuration] = useState(7);
  const [boosting, setBoosting] = useState(false);
  const [boostDailyPrice, setBoostDailyPrice] = useState(2);
  const [useFreeBoostCredit, setUseFreeBoostCredit] = useState(true);
  const [productPickerOpen, setProductPickerOpen] = useState(null); // 'boost' | 'email' | 'ppc'

  // Sponsorship
  const [sponsorDays, setSponsorDays] = useState({});
  const [sponsorContent, setSponsorContent] = useState({});
  const [editingContentId, setEditingContentId] = useState(null);
  const getSponsorDays = (id) => Math.max(1, parseInt(sponsorDays[id] || 1, 10));
  const setContentField = (id, field, value) => setSponsorContent((s) => ({ ...s, [id]: { ...(s[id] || {}), [field]: value } }));

  const [confirmType, setConfirmType] = useState(null); // 'blast' | 'ppc' | 'boost' | 'sponsor'
  const [confirmData, setConfirmData] = useState(null);

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
      if (settingsRes.status === 'fulfilled') setBoostDailyPrice(settingsRes.value.data?.promotion_daily_price || 2);
      if (profileRes.status === 'fulfilled') setShopProfile(profileRes.value.data || null);
    } catch (e) {} finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchAll(); setRefreshing(false); }, [fetchAll]);

  /* debounced recipient preview (separate timers so they don't cancel each other) */
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
  useEffect(() => { if (emailPreview?.recipient_count != null) setEmailRecipientLimit(emailPreview.recipient_count); }, [emailPreview?.recipient_count]);
  useEffect(() => { if (ppcPreview?.recipient_count != null) setPpcRecipientLimit(ppcPreview.recipient_count); }, [ppcPreview?.recipient_count]);

  /* poll launched campaign status — live "sent X/Y" feedback */
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
          setRecentLiveStatus({ status: c.status, emails_sent: c.emails_sent || 0, recipients_count: c.recipients_count || recentlyLaunched.recipientCount });
          if (c.status === 'sent' || c.status === 'active' || (c.emails_sent >= c.recipients_count)) return;
        }
      } catch (e) {}
      if (attempts < 60) setTimeout(poll, 2000);
    };
    poll();
    return () => { cancelled = true; };
  }, [recentlyLaunched]);

  const settings = overview?.settings || {};
  const walletBalance = overview?.wallet_balance ?? 0;
  const stats = overview?.stats || {};

  const emailPricePerEmail = emailPreview?.price_per_email ?? settings.email_price_per_email ?? 0.05;
  const ppcPricePerEmail = ppcPreview?.price_per_email ?? settings.email_price_per_email ?? 0.05;
  const emailChosenCount = Math.min(emailRecipientLimit || 0, emailPreview?.recipient_count ?? 0);
  const ppcChosenCount = Math.min(ppcRecipientLimit || 0, ppcPreview?.recipient_count ?? 0);
  const emailChosenCost = +(emailChosenCount * emailPricePerEmail).toFixed(2);
  const emailSufficient = emailChosenCount > 0 && walletBalance >= emailChosenCost;

  const normalizeBody = (body) => {
    const t = body.trim();
    if (/<[a-z][\s\S]*>/i.test(t)) return t;
    return t.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
  };

  /* ---- launches ---- */
  const handleLaunchBlast = async () => {
    if (!emailForm.subject.trim() || !emailForm.body.trim()) { toast.error('Subject and body are required'); return; }
    if (emailForm.link_type === 'product' && !emailForm.link_target_id) { toast.error('Please choose a product to link to'); return; }
    setLaunching(true);
    try {
      const { data } = await api.ads.sendBlast({ ...emailForm, body_html: normalizeBody(emailForm.body), max_recipients: emailRecipientLimit || undefined });
      const recipientCount = data?.campaign?.recipients_count || emailChosenCount || 0;
      toast.success(`Campaign launched! Sending to ${recipientCount} recipient${recipientCount === 1 ? '' : 's'}. Emails take ~${Math.ceil(recipientCount * 0.6)}s to fully deliver.`);
      setRecentlyLaunched({ id: data?.campaign?.id, recipientCount, subject: data?.campaign?.subject || emailForm.subject });
      setLiftoff(k => k + 1); notifySuccess();
      setEmailForm({ ...emptyForm });
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to launch'); }
    finally { setLaunching(false); setConfirmType(null); }
  };

  const handleLaunchPpc = async () => {
    if (!ppcForm.subject.trim() || !ppcForm.body.trim()) { toast.error('Subject and body are required'); return; }
    if (ppcForm.link_type === 'product' && !ppcForm.link_target_id) { toast.error('Please choose a product to link to'); return; }
    setLaunching(true);
    try {
      const { data } = await api.ads.startPpc({ ...ppcForm, body_html: normalizeBody(ppcForm.body), click_budget: ppcBudget, max_recipients: ppcRecipientLimit || undefined });
      const recipientCount = data?.campaign?.recipients_count || ppcChosenCount || 0;
      toast.success(`PPC campaign launched! Sending to ${recipientCount} recipient${recipientCount === 1 ? '' : 's'}.`);
      setRecentlyLaunched({ id: data?.campaign?.id, recipientCount, subject: data?.campaign?.subject || ppcForm.subject });
      setLiftoff(k => k + 1); notifySuccess();
      setPpcForm({ ...emptyForm });
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to launch'); }
    finally { setLaunching(false); setConfirmType(null); }
  };

  /* ---- test email (free) ---- */
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
        test_email: targetEmail, subject: formData.subject, body_html: normalizeBody(formData.body),
        cta_text: formData.cta_text || 'Visit Shop', preview: formData.preview || '',
        link_type: formData.link_type || 'shop', link_target_id: formData.link_target_id || null,
      });
      toast.success(data.message || 'Test email sent! Check your inbox + Spam folder.');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to send test email'); }
    finally { setSendingTest(false); }
  };

  /* ---- AI ---- */
  const handleGenerateAi = async () => {
    setAiLoading(true);
    try {
      const { data } = await api.ads.aiSuggest({ goal: aiGoal, tone: aiTone, occasion: aiOccasion });
      setAiVariants(data.variants || []);
      if (!data.variants?.length) toast.error('No suggestions generated, try again');
    } catch (e) { toast.error(e.response?.data?.detail || 'AI generation failed'); }
    finally { setAiLoading(false); }
  };
  const applyVariant = (v) => {
    const setter = aiTarget === 'ppc' ? setPpcForm : setEmailForm;
    setter(cur => ({ ...cur, subject: v.subject || cur.subject, preview: v.preview || cur.preview, body: v.body_html || cur.body, cta_text: v.cta_text || cur.cta_text }));
    setApplyRing('subject');
    setTimeout(() => setApplyRing(null), 700);
    toast.success('Suggestion applied to your campaign');
    setAiOpen(false);
  };

  /* ---- boost ---- */
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
      setLiftoff(k => k + 1);
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Boost failed'); }
    finally { setBoosting(false); setConfirmType(null); }
  };

  /* ---- sponsorship ---- */
  const handleJoinEvent = async (ev, days) => {
    const usedDays = Math.max(1, parseInt(days || getSponsorDays(ev.id), 10));
    const total = (ev.sponsorship_price_per_day || ev.sponsorship_price || 0) * usedDays;
    if (total > walletBalance) { toast.error(`Need ${fmt(total)}, wallet has ${fmt(walletBalance)}`); return; }
    const content = sponsorContent[ev.id] || {};
    try {
      const { data } = await api.ads.joinEvent(ev.id, { days: usedDays, title: content.title || '', subtitle: content.subtitle || '' });
      toast.success(data.message || 'Joined event!');
      setLiftoff(k => k + 1);
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to join'); }
    finally { setConfirmType(null); setConfirmData(null); }
  };
  const handleSaveSponsorContent = async (ev) => {
    const content = sponsorContent[ev.id] || {};
    try {
      await api.ads.updateSponsorContent(ev.id, { title: content.title || '', subtitle: content.subtitle || '' });
      toast.success('Banner text updated — it now shows on the home page!');
      setEditingContentId(null);
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update'); }
  };

  /* ---- performance data ---- */
  const spendByType = [
    { name: 'Email', value: campaigns.filter(c => c.type === 'blast').reduce((s, c) => s + (c.cost_charged || 0), 0) },
    { name: 'PPC', value: campaigns.filter(c => c.type === 'ppc').reduce((s, c) => s + (c.spend || 0), 0) },
  ].filter(d => d.value > 0);
  const clicksByCampaign = campaigns.slice(0, 8).map(c => ({ value: c.clicks || 0, label: (c.name || c.subject || '').slice(0, 8), frontColor: '#10b981' }));

  if (loading) {
    return <View style={st.center}><Spinner size={38} color="#10b981" /></View>;
  }

  const TABS = [
    { v: 'email', l: 'Email Ads', icon: 'mail', off: settings.email_campaigns_enabled === false },
    { v: 'ppc', l: 'Pay-Per-Click', icon: 'radio-button-on', off: settings.ppc_campaigns_enabled === false },
    { v: 'boost', l: 'Boost Product', icon: 'megaphone' },
    { v: 'sponsor', l: 'Event Sponsorship', icon: 'calendar', off: settings.banner_campaigns_enabled === false },
    { v: 'performance', l: 'Performance', icon: 'bar-chart' },
  ];

  const pickedProductName = (id) => products.find(p => p.id === id)?.name || '';

  /* targeting card (shared email/ppc) */
  const TargetingCard = ({ form, setForm, preview, previewLoading, recipientLimit, setRecipientLimit, pricePerEmail, showCost, pickerKey }) => {
    const available = preview?.recipient_count ?? 0;
    const chosen = Math.min(recipientLimit || 0, available);
    const cost = +(chosen * (pricePerEmail || 0)).toFixed(2);
    return (
      <View style={st.targetCard} testID="email-ad-targeting-card">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Ionicons name="locate" size={14} color="#047857" />
          <Text style={st.targetTitle}>Audience & Targeting</Text>
        </View>

        {/* target mode radio */}
        <View style={{ gap: 7 }} testID="email-ad-target-mode-radio">
          {[
            { v: 'state', t: 'All platform customers', d: 'Reach the whole OpenMarket audience, optionally by state' },
            { v: 'own_customers', t: 'My past customers', d: 'People who already ordered from your shop' },
          ].map(o => (
            <TouchableOpacity key={o.v} activeOpacity={0.8} onPress={() => setForm(prev => ({ ...prev, target_type: o.v }))}
              style={[st.radioRow, form.target_type === o.v && { borderColor: '#6ee7b7' }]}>
              <View style={[st.radio, form.target_type === o.v && st.radioOn]}>{form.target_type === o.v && <View style={st.radioDot} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={st.radioTitle}>{o.t}</Text>
                <Text style={st.radioDesc}>{o.d}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* state select */}
        {form.target_type === 'state' && (
          <>
            <Text style={cp.label}>Target state</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }} testID="email-ad-state-select">
              {['all', ...STATES].map(s => (
                <TouchableOpacity key={s} onPress={() => setForm(prev => ({ ...prev, target_state: s }))}
                  style={[st.chip, form.target_state === s && st.chipOn]}>
                  <Text style={[st.chipText, form.target_state === s && { color: colors.white }]}>{s === 'all' ? 'All states' : s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* link type */}
        <Text style={cp.label}>When they click, send them to</Text>
        <View style={{ flexDirection: 'row', gap: 7, marginBottom: 8 }} testID="email-ad-link-type-select">
          {[{ v: 'shop', l: 'My shop page' }, { v: 'product', l: 'A specific product' }].map(o => (
            <TouchableOpacity key={o.v} onPress={() => setForm(prev => ({ ...prev, link_type: o.v }))}
              style={[st.chip, { flex: 1, alignItems: 'center' }, form.link_type === o.v && st.chipOn]}>
              <Text style={[st.chipText, form.link_type === o.v && { color: colors.white }]}>{o.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {form.link_type === 'product' && (
          <TouchableOpacity onPress={() => setProductPickerOpen(pickerKey)} style={st.productSelect} testID="email-ad-product-select">
            <Text style={[st.chipText, !form.link_target_id && { color: colors.textMuted }]} numberOfLines={1}>
              {form.link_target_id ? pickedProductName(form.link_target_id) : 'Choose a product'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* audience + range + cost */}
        <View style={st.audienceBox}>
          <View style={st.audRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="people" size={13} color={colors.textMuted} /><Text style={st.audKey}>Available audience</Text>
            </View>
            {previewLoading ? <Spinner size={13} color={colors.textMuted} /> : <Text style={st.audVal} testID="email-ad-recipient-count">{available}</Text>}
          </View>
          <View testID="recipient-range-selector">
            <View style={st.audRow}>
              <Text style={[st.audKey, { fontFamily: fonts.bold, color: colors.text }]}>How many to send to</Text>
              <Text style={[st.audVal, { color: '#047857' }]} testID="recipient-range-value">{chosen}</Text>
            </View>
            <SingleSlider min={available > 0 ? 1 : 0} max={Math.max(available, 1)} step={1} value={chosen}
              onChange={setRecipientLimit} disabled={available === 0 || previewLoading} testID="recipient-range-slider" />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={st.rangeText}>1</Text><Text style={st.rangeText}>{available} max</Text>
            </View>
          </View>
          <View style={[st.audRow, { borderTopWidth: 1, borderTopColor: '#d1fae5', paddingTop: 8 }]}>
            <Text style={st.audKey}>{showCost ? `Cost (${fmt(pricePerEmail || 0.05)} / email)` : 'Emails to send'}</Text>
            {showCost ? (
              <Text style={[st.audVal, { color: '#047857' }]} testID="email-ad-cost-preview">{previewLoading ? '—' : fmt(cost)}</Text>
            ) : <Text style={st.audVal}>{chosen}</Text>}
          </View>
          <View style={st.audRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="wallet" size={13} color={colors.textMuted} /><Text style={st.audKey}>Wallet balance</Text>
            </View>
            <Text style={st.audVal}>{fmt(walletBalance)}</Text>
          </View>
        </View>

        {showCost && !previewLoading && available > 0 && cost > walletBalance && (
          <View style={st.warnBox} testID="email-ad-wallet-warning">
            <Ionicons name="warning" size={14} color="#f43f5e" />
            <Text style={st.warnText}>Insufficient wallet balance for this send. Add funds or reduce the number of recipients.</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
    <ShopScreenWrap refreshing={refreshing} onRefresh={onRefresh} testID="shop-advertising-page">
      {/* Header */}
      <Rise duration={500} distance={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <LinearGradient colors={shop.activePill} style={st.headerIcon}><Ionicons name="rocket" size={22} color={colors.white} /></LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>Advertising</Text>
            <Text style={st.headerSub}>Grow your shop with email campaigns, pay-per-click ads, product boosts and event sponsorships — all paid from your wallet.</Text>
          </View>
        </View>
        <View style={st.walletPill} testID="shop-advertising-wallet-balance">
          <Ionicons name="wallet" size={13} color="#065f46" />
          <Text style={st.walletPillText}>{fmt(walletBalance)} wallet</Text>
        </View>
      </Rise>

      {/* Live launch status banner */}
      {recentlyLaunched && recentLiveStatus && (
        <Rise>
          <LinearGradient colors={['#ecfdf5', '#f0fdfa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.liveBanner}>
            <Pulse><View style={st.liveDot} /></Pulse>
            <View style={{ flex: 1 }}>
              <Text style={st.liveTitle} numberOfLines={1}>“{recentlyLaunched.subject}”</Text>
              <Text style={st.liveDesc}>
                {recentLiveStatus.status === 'sent' || recentLiveStatus.status === 'active'
                  ? `Delivered to ${recentLiveStatus.emails_sent}/${recentLiveStatus.recipients_count} recipients ✓`
                  : `Sending… ${recentLiveStatus.emails_sent}/${recentLiveStatus.recipients_count} emails`}
              </Text>
            </View>
          </LinearGradient>
        </Rise>
      )}

      {/* KPI row */}
      <View style={st.kpiGrid}>
        <KpiCard index={0} icon="wallet" label="Wallet Balance" value={walletBalance} money testID="shop-advertising-kpi-wallet" />
        <KpiCard index={1} icon="flash" label="Active Campaigns" value={stats.active_campaigns ?? 0} hint={`${stats.total_campaigns ?? 0} total`} testID="shop-advertising-kpi-active" />
        <KpiCard index={2} icon="logo-usd" label="Total Ad Spend" value={Number(stats.total_spend || 0)} money testID="shop-advertising-kpi-spend" />
        <KpiCard index={3} icon="radio-button-on" label="Total Clicks" value={stats.total_clicks ?? 0} hint={`${stats.total_emails_sent ?? 0} emails sent`} testID="shop-advertising-kpi-clicks" />
      </View>

      {/* Info: email vs ppc explainer + tip */}
      <Rise delay={200}>
        <View style={st.infoCard} testID="ads-info-section">
          <LinearGradient colors={['#ecfdf5', '#f0fdfa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.infoHead}>
            <Ionicons name="information-circle" size={15} color="#059669" />
            <Text style={st.infoHeadText}>How advertising works — Email vs Pay-Per-Click</Text>
          </LinearGradient>
          <View style={{ padding: 13, gap: 10 }}>
            <View style={[st.infoBox, { borderColor: '#d1fae5', backgroundColor: 'rgba(236,253,245,0.4)' }]} testID="ads-info-email">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <View style={[st.infoIcon, { backgroundColor: '#d1fae5' }]}><Ionicons name="mail" size={14} color="#047857" /></View>
                <Text style={st.infoTitle}>Email Advertising (Blast)</Text>
              </View>
              <Text style={st.infoBody}>Send a one-time promotional email to a chosen audience (all platform customers or your own past customers). You are <Text style={{ fontFamily: fonts.bold }}>charged once, per email delivered</Text> ({fmt(settings.email_price_per_email || 0.05)} each). Best for announcements, sales, and new arrivals where you want maximum reach for a fixed, predictable cost.</Text>
              <View style={{ marginTop: 6, gap: 3 }}>
                <View style={st.checkRow}><Ionicons name="checkmark" size={11} color="#059669" /><Text style={st.checkText}>Pay upfront for the whole send</Text></View>
                <View style={st.checkRow}><Ionicons name="checkmark" size={11} color="#059669" /><Text style={st.checkText}>Great for broad awareness</Text></View>
              </View>
            </View>
            <View style={[st.infoBox, { borderColor: colors.s100, backgroundColor: 'rgba(238,242,255,0.4)' }]} testID="ads-info-ppc">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <View style={[st.infoIcon, { backgroundColor: colors.s100 }]}><Ionicons name="radio-button-on" size={14} color={colors.s700} /></View>
                <Text style={st.infoTitle}>Pay-Per-Click (PPC)</Text>
              </View>
              <Text style={st.infoBody}>Send the email for free and only <Text style={{ fontFamily: fonts.bold }}>pay when a customer actually clicks</Text> your link ({fmt(settings.ppc_price_per_click || 0.05)} per click). You set a click budget — spending stops automatically once it runs out. Best when you care about real traffic and a measurable return on every dollar.</Text>
              <View style={{ marginTop: 6, gap: 3 }}>
                <View style={st.checkRow}><Ionicons name="checkmark" size={11} color={colors.s700} /><Text style={st.checkText}>Pay only for engaged clicks</Text></View>
                <View style={st.checkRow}><Ionicons name="checkmark" size={11} color={colors.s700} /><Text style={st.checkText}>Requires a minimum wallet of {fmt(settings.ppc_min_wallet_to_start || 5)} to start</Text></View>
              </View>
            </View>
            <View style={st.tipBox} testID="ads-info-tip">
              <Ionicons name="bulb" size={14} color="#f59e0b" style={{ marginTop: 1 }} />
              <Text style={st.tipText}><Text style={{ fontFamily: fonts.bold }}>Tip:</Text> Email and PPC are launched as separate campaigns. Use an Email Blast for a big announcement, then run a PPC campaign to keep driving traffic while only paying for results.</Text>
            </View>
          </View>
        </View>
      </Rise>

      {/* Tabs */}
      <Rise delay={260}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={st.tabBar} testID="shop-advertising-tabs">
          {TABS.map(t => (
            <TouchableOpacity key={t.v} disabled={t.off} onPress={() => setTab(t.v)} activeOpacity={0.85} testID={`shop-advertising-tab-${t.v}`}>
              {tab === t.v ? (
                <LinearGradient colors={shop.activePill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.tabOn}>
                  <Ionicons name={t.icon} size={13} color={colors.white} />
                  <Text style={st.tabOnText}>{t.l}</Text>
                </LinearGradient>
              ) : (
                <View style={[st.tabOff, t.off && { opacity: 0.45 }]}>
                  <Ionicons name={t.icon} size={13} color={colors.textSecondary} />
                  <Text style={st.tabOffText}>{t.l}{t.off ? ' (off)' : ''}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Rise>

      {/* ============ EMAIL ============ */}
      {tab === 'email' && (
        <Rise>
          <View style={st.panel}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="mail" size={17} color="#059669" /><Text style={st.panelTitle}>Email Campaign</Text>
                </View>
                <Text style={st.panelSub}>Send a one-time email blast to your audience. Charged per email delivered.</Text>
              </View>
              <TouchableOpacity onPress={() => { setAiTarget('email'); setAiOpen(true); }} style={st.aiBtn} testID="email-ad-ai-generate-button">
                <Ionicons name="sparkles" size={13} color="#047857" />
                <Text style={st.aiBtnText}>AI Suggestions</Text>
              </TouchableOpacity>
            </View>
            <EmailComposer form={emailForm} setForm={setEmailForm} applyRing={applyRing} />
          </View>
          <TargetingCard form={emailForm} setForm={setEmailForm} preview={emailPreview} previewLoading={emailPreviewLoading}
            recipientLimit={emailRecipientLimit} setRecipientLimit={setEmailRecipientLimit} pricePerEmail={emailPricePerEmail} showCost pickerKey="email" />

          {/* Test email (free) */}
          <View style={st.testRow}>
            <TextInput value={testEmail} onChangeText={setTestEmail} placeholder="Test email (empty = your account)" keyboardType="email-address"
              placeholderTextColor={colors.textMuted} style={[cp.input, { flex: 1, marginBottom: 0 }]} testID="email-ad-test-email-input" />
            <PressScale onPress={() => handleSendTestEmail(emailForm)} disabled={sendingTest}>
              <View style={st.testBtn} testID="email-ad-send-test-button">
                {sendingTest ? <Spinner size={13} color="#047857" /> : <Ionicons name="paper-plane" size={13} color="#047857" />}
                <Text style={st.testBtnText}>Send test</Text>
              </View>
            </PressScale>
          </View>

          <PressScale onPress={() => {
              if (!emailForm.subject.trim() || !emailForm.body.trim()) { toast.error('Subject and body are required'); return; }
              if (emailForm.link_type === 'product' && !emailForm.link_target_id) { toast.error('Please choose a product to link to'); return; }
              setConfirmType('blast');
            }} disabled={launching || emailChosenCount < 1 || !emailSufficient} style={{ marginTop: 12 }}>
            <LinearGradient colors={shop.activePill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[st.launchBtn, (launching || emailChosenCount < 1 || !emailSufficient) && { opacity: 0.55 }]} testID="email-ad-launch-button">
              {launching ? <Spinner size={15} /> : <Ionicons name="send" size={15} color={colors.white} />}
              <Text style={st.launchText}>Launch Campaign {emailChosenCount > 0 ? `(${fmt(emailChosenCost)})` : ''}</Text>
            </LinearGradient>
          </PressScale>
        </Rise>
      )}

      {/* ============ PPC ============ */}
      {tab === 'ppc' && (
        <Rise>
          <View style={st.panel}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="radio-button-on" size={17} color="#059669" /><Text style={st.panelTitle}>Pay-Per-Click Campaign</Text>
                </View>
                <Text style={st.panelSub}>Only pay when a customer clicks. {fmt(settings.ppc_price_per_click || 0.05)} per click.</Text>
              </View>
              <TouchableOpacity onPress={() => { setAiTarget('ppc'); setAiOpen(true); }} style={st.aiBtn}>
                <Ionicons name="sparkles" size={13} color="#047857" />
                <Text style={st.aiBtnText}>AI Suggestions</Text>
              </TouchableOpacity>
            </View>
            <EmailComposer form={ppcForm} setForm={setPpcForm} applyRing={applyRing} />
            {/* Budget */}
            <View style={st.budgetBox} testID="ppc-budget-strip">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={cp.label}>Click budget</Text>
                <Text style={[st.audVal, { color: '#047857' }]}>{fmt(ppcBudget)}</Text>
              </View>
              <SingleSlider min={1} max={Math.max(50, Math.floor(walletBalance))} step={1} value={ppcBudget} onChange={setPpcBudget} testID="ppc-budget-slider" />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={st.rangeText}>$1</Text>
                <Text style={st.rangeText}>~{Math.floor(ppcBudget / (settings.ppc_price_per_click || 0.05))} clicks @ {fmt(settings.ppc_price_per_click || 0.05)}</Text>
                <Text style={st.rangeText}>{fmt(Math.max(50, Math.floor(walletBalance)))}</Text>
              </View>
            </View>
          </View>
          <TargetingCard form={ppcForm} setForm={setPpcForm} preview={ppcPreview} previewLoading={ppcPreviewLoading}
            recipientLimit={ppcRecipientLimit} setRecipientLimit={setPpcRecipientLimit} pricePerEmail={ppcPricePerEmail} showCost={false} pickerKey="ppc" />
          {walletBalance < (settings.ppc_min_wallet_to_start || 5) && (
            <View style={[st.tipBox, { marginTop: 10 }]} testID="ppc-wallet-gate">
              <Ionicons name="warning" size={14} color="#f59e0b" />
              <Text style={st.tipText}>You need at least {fmt(settings.ppc_min_wallet_to_start || 5)} in your wallet to start a PPC campaign.</Text>
            </View>
          )}
          <PressScale onPress={() => {
              if (!ppcForm.subject.trim() || !ppcForm.body.trim()) { toast.error('Subject and body are required'); return; }
              if (ppcForm.link_type === 'product' && !ppcForm.link_target_id) { toast.error('Please choose a product to link to'); return; }
              setConfirmType('ppc');
            }} disabled={launching || ppcChosenCount < 1 || walletBalance < (settings.ppc_min_wallet_to_start || 5)} style={{ marginTop: 12 }}>
            <LinearGradient colors={shop.activePill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[st.launchBtn, (launching || ppcChosenCount < 1 || walletBalance < (settings.ppc_min_wallet_to_start || 5)) && { opacity: 0.55 }]} testID="ppc-start-campaign-button">
              {launching ? <Spinner size={15} /> : <Ionicons name="flash" size={15} color={colors.white} />}
              <Text style={st.launchText}>Launch PPC ({fmt(ppcBudget)} budget)</Text>
            </LinearGradient>
          </PressScale>
        </Rise>
      )}

      {/* ============ BOOST ============ */}
      {tab === 'boost' && (
        <Rise>
          <View style={st.panel}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="megaphone" size={17} color="#f59e0b" /><Text style={st.panelTitle}>Boost a Product</Text>
              </View>
              {totalSponsorCredits > 0 && (
                <Pulse>
                  <LinearGradient colors={['#fbbf24', '#f97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.freeBadge} testID="boost-free-sponsor-badge">
                    <Ionicons name="gift" size={12} color={colors.white} />
                    <Text style={st.freeBadgeText}>{totalSponsorCredits} Free Sponsor{totalSponsorCredits > 1 ? 's' : ''} available</Text>
                  </LinearGradient>
                </Pulse>
              )}
            </View>
            {totalSponsorCredits > 0 && (
              <View style={st.freeNote} testID="boost-free-sponsor-note">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                  <Ionicons name="gift" size={13} color="#b45309" /><Text style={[st.infoTitle, { color: '#92400e' }]}>You have free product sponsors!</Text>
                </View>
                {freeShortCredits > 0 && <Text style={st.freeNoteLine}>• {freeShortCredits} × 3-day sponsor credit{freeShortCredits > 1 ? 's' : ''}</Text>}
                {freeLongCredits > 0 && <Text style={st.freeNoteLine}>• {freeLongCredits} × 10-day sponsor credit{freeLongCredits > 1 ? 's' : ''}</Text>}
                <TouchableOpacity activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }} testID="boost-use-free-credit-toggle"
                  onPress={() => {
                    const next = !useFreeBoostCredit;
                    setUseFreeBoostCredit(next);
                    if (next) {
                      if (freeShortCredits > 0) setBoostDuration(3);
                      else if (freeLongCredits > 0) setBoostDuration(10);
                    }
                  }}>
                  <View style={[st.checkbox, useFreeBoostCredit && { backgroundColor: '#d97706', borderColor: '#d97706' }]}>
                    {useFreeBoostCredit && <Ionicons name="checkmark" size={12} color={colors.white} />}
                  </View>
                  <Text style={[st.freeNoteLine, { fontFamily: fonts.bold, flex: 1 }]}>Use a free credit (sets duration to 3 or 10 days)</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={cp.label}>Choose product</Text>
            <TouchableOpacity onPress={() => setProductPickerOpen('boost')} style={st.productSelect} testID="boost-product-select">
              <Text style={[st.chipText, !boostProduct && { color: colors.textMuted }]} numberOfLines={1}>
                {boostProduct ? `${pickedProductName(boostProduct)} — ${fmt(products.find(p => p.id === boostProduct)?.price)}` : 'Select a product to boost'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 4 }}>
              <Text style={cp.label}>Duration</Text>
              <Text style={[st.audVal, { color: '#047857' }]} testID="boost-duration-value">{boostDuration} {boostDuration === 1 ? 'day' : 'days'}</Text>
            </View>
            <View style={[st.budgetBox, useFreeBoostCredit && { opacity: 0.6 }]} testID="boost-duration-range">
              <SingleSlider min={1} max={30} step={1} value={boostDuration} onChange={setBoostDuration} disabled={useFreeBoostCredit} testID="boost-duration-slider" />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={st.rangeText}>1 day</Text><Text style={st.rangeText}>{fmt(boostDailyPrice)}/day</Text><Text style={st.rangeText}>30 days</Text>
              </View>
              {useFreeBoostCredit && <Text style={[st.rangeText, { color: '#047857', marginTop: 4 }]}>Locked to your free sponsor duration. Uncheck to change.</Text>}
            </View>
          </View>

          {/* boost summary */}
          <View style={st.targetCard}>
            <Text style={st.targetTitle}>Boost summary</Text>
            <View style={[st.audRow, { marginTop: 8 }]}><Text style={st.audKey}>Daily rate</Text><Text style={st.audVal}>{fmt(boostDailyPrice)}/day</Text></View>
            <View style={st.audRow}><Text style={st.audKey}>Duration</Text><Text style={st.audVal}>{boostDuration} days</Text></View>
            <View style={[st.audRow, { borderTopWidth: 1, borderTopColor: '#d1fae5', paddingTop: 9 }]}>
              <Text style={[st.audKey, { fontFamily: fonts.bold, color: colors.ink }]}>Total</Text>
              {canUseFreeBoost ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Text style={[st.audKey, { textDecorationLine: 'line-through' }]}>{fmt(boostDailyPrice * boostDuration)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="gift" size={14} color="#d97706" />
                    <Text style={{ fontFamily: fonts.extrabold, fontSize: 17, color: '#d97706' }} testID="boost-cost-preview">FREE</Text>
                  </View>
                </View>
              ) : (
                <Text style={{ fontFamily: fonts.extrabold, fontSize: 17, color: '#047857' }} testID="boost-cost-preview">{fmt(boostDailyPrice * boostDuration)}</Text>
              )}
            </View>
            {canUseFreeBoost && <Text style={[st.rangeText, { color: '#d97706', textAlign: 'right' }]}>A free sponsor credit will be used</Text>}
            <View style={st.audRow}>
              <Text style={st.audKey}>Wallet balance</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: canUseFreeBoost || walletBalance >= boostDailyPrice * boostDuration ? '#059669' : '#f43f5e' }}>{fmt(walletBalance)}</Text>
            </View>
            <PressScale onPress={() => {
                if (!boostProduct) { toast.error('Select a product to boost'); return; }
                setConfirmType('boost');
              }} disabled={boosting || !boostProduct || (!canUseFreeBoost && walletBalance < boostDailyPrice * boostDuration)} style={{ marginTop: 10 }}>
              <LinearGradient colors={canUseFreeBoost ? ['#f59e0b', '#f97316'] : shop.activePill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[st.launchBtn, (boosting || !boostProduct || (!canUseFreeBoost && walletBalance < boostDailyPrice * boostDuration)) && { opacity: 0.55 }]} testID="boost-confirm-button">
                {boosting ? <Spinner size={15} /> : <Ionicons name={canUseFreeBoost ? 'gift' : 'megaphone'} size={15} color={colors.white} />}
                <Text style={st.launchText}>{canUseFreeBoost ? 'Boost for FREE' : `Boost for ${fmt(boostDailyPrice * boostDuration)}`}</Text>
              </LinearGradient>
            </PressScale>
            <Text style={[st.rangeText, { textAlign: 'center', marginTop: 8 }]}>Boosted products appear in sponsored rows across the platform.</Text>
          </View>
        </Rise>
      )}

      {/* ============ SPONSOR ============ */}
      {tab === 'sponsor' && (
        <Rise>
          {myActiveSponsorship && (
            <LinearGradient colors={['#ecfdf5', '#f0fdfa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.activeSponsor} testID="shop-active-sponsorship-banner">
              <LinearGradient colors={shop.activePill} style={st.crownTile}><Ionicons name="ribbon" size={18} color={colors.white} /></LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={st.activeSponsorKicker}>ACTIVE SPONSORSHIP</Text>
                <Text style={st.activeSponsorTitle} numberOfLines={1}>You're sponsoring <Text style={{ color: '#047857' }}>{myActiveSponsorship.event_title}</Text> until {new Date(myActiveSponsorship.end_at).toLocaleDateString()}</Text>
                <Text style={st.activeSponsorDesc}>A shop can sponsor only ONE event at a time. Wait until your campaign ends to sponsor another banner.</Text>
              </View>
            </LinearGradient>
          )}
          {events.length === 0 ? (
            <View style={[st.panel, { alignItems: 'center', paddingVertical: 34 }]}>
              <Ionicons name="megaphone" size={38} color={colors.border} />
              <Text style={[st.panelTitle, { marginTop: 10 }]}>No active campaign events right now</Text>
              <Text style={[st.panelSub, { textAlign: 'center' }]}>Seasonal events (Black Friday, Ramadan...) will appear here when the admin opens them for sponsorship.</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {events.map(ev => {
                const dailyPrice = ev.sponsorship_price_per_day || ev.sponsorship_price || 2;
                const days = getSponsorDays(ev.id);
                const total = +(dailyPrice * days).toFixed(2);
                const reservedUntilFmt = ev.reserved_until ? new Date(ev.reserved_until).toLocaleDateString() : '';
                const blocked = ev.is_reserved && !ev.joined;
                const blockedByOther = !!ev.blocked_by_other_sponsorship;
                return (
                  <View key={ev.id} style={st.eventCard} testID="event-sponsorship-card">
                    {/* banner header */}
                    <View style={st.eventBanner}>
                      <LinearGradient colors={[colors.p500, colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                      {ev.image_url ? <Image source={{ uri: img(ev.image_url) }} style={[StyleSheet.absoluteFill, { opacity: 0.7 }]} resizeMode="cover" /> : null}
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
                      <View style={{ flex: 1, justifyContent: 'flex-end', padding: 12 }}>
                        <View style={st.homeBannerTag}><Ionicons name="ribbon" size={9} color="#78350f" /><Text style={st.homeBannerTagText}>Home Banner Feature</Text></View>
                        <Text style={st.eventTitle} numberOfLines={1}>{ev.title}</Text>
                        {ev.banner_subtitle ? <Text style={st.eventSubtitle} numberOfLines={2}>{ev.banner_subtitle}</Text> : null}
                      </View>
                    </View>
                    <View style={{ padding: 13, gap: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="people" size={12} color={colors.textMuted} />
                          <Text style={st.audKey}>{ev.sponsors_count} total sponsor{ev.sponsors_count !== 1 ? 's' : ''}</Text>
                        </View>
                        <Text style={[st.audVal, { color: '#047857' }]}>{fmt(dailyPrice)}/day</Text>
                      </View>

                      {ev.joined ? (
                        <>
                          <View style={st.joinedBox}>
                            <Ionicons name="checkmark" size={14} color="#047857" />
                            <Text style={st.joinedText}>You're sponsoring this{reservedUntilFmt ? ` until ${reservedUntilFmt}` : ''}</Text>
                          </View>
                          {editingContentId === ev.id ? (
                            <View style={st.editBox} testID={`sponsor-edit-content-${ev.id}`}>
                              <Text style={st.editKicker}>YOUR BANNER TEXT (SHOWN ON HOME PAGE)</Text>
                              <TextInput value={sponsorContent[ev.id]?.title ?? (ev.my_sponsor_title || ev.title || '')}
                                onChangeText={(t) => setContentField(ev.id, 'title', t)} placeholder="Banner title"
                                placeholderTextColor={colors.textMuted} style={cp.input} testID={`sponsor-title-input-${ev.id}`} />
                              <TextInput value={sponsorContent[ev.id]?.subtitle ?? (ev.my_sponsor_subtitle || ev.banner_subtitle || '')}
                                onChangeText={(t) => setContentField(ev.id, 'subtitle', t)} placeholder="Banner subtitle"
                                placeholderTextColor={colors.textMuted} style={[cp.input, { marginTop: 7 }]} testID={`sponsor-subtitle-input-${ev.id}`} />
                              <View style={{ flexDirection: 'row', gap: 7, marginTop: 9 }}>
                                <PressScale style={{ flex: 1 }} onPress={() => setEditingContentId(null)}>
                                  <View style={st.outlineBtn}><Text style={st.outlineText}>Cancel</Text></View>
                                </PressScale>
                                <PressScale style={{ flex: 1 }} onPress={() => handleSaveSponsorContent(ev)}>
                                  <View style={st.violetBtn} testID={`sponsor-save-content-${ev.id}`}><Text style={st.violetText}>Save</Text></View>
                                </PressScale>
                              </View>
                            </View>
                          ) : (
                            <PressScale onPress={() => {
                                setSponsorContent((s) => ({ ...s, [ev.id]: { title: ev.my_sponsor_title || ev.title || '', subtitle: ev.my_sponsor_subtitle || ev.banner_subtitle || '' } }));
                                setEditingContentId(ev.id);
                              }}>
                              <View style={[st.outlineBtn, { borderColor: colors.p200, flexDirection: 'row', gap: 6 }]} testID={`sponsor-edit-text-btn-${ev.id}`}>
                                <Ionicons name="create-outline" size={13} color={colors.p800} />
                                <Text style={[st.outlineText, { color: colors.p800 }]}>Edit banner title & subtitle</Text>
                              </View>
                            </PressScale>
                          )}
                        </>
                      ) : blocked ? (
                        <View style={[st.joinedBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]} testID="event-banner-reserved">
                          <Ionicons name="lock-closed" size={13} color={colors.textSecondary} />
                          <Text style={[st.joinedText, { color: colors.textSecondary }]}>Reserved until {reservedUntilFmt}</Text>
                        </View>
                      ) : blockedByOther ? (
                        <View style={[st.joinedBox, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]} testID={`event-blocked-by-other-${ev.id}`}>
                          <Ionicons name="lock-closed" size={13} color="#b45309" />
                          <Text style={[st.joinedText, { color: '#b45309' }]}>You already sponsor {myActiveSponsorship?.event_title || 'another banner'}</Text>
                        </View>
                      ) : (
                        <>
                          <View style={st.editBox} testID={`sponsor-content-inputs-${ev.id}`}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="create-outline" size={11} color={colors.p800} />
                              <Text style={st.editKicker}>CUSTOMIZE YOUR BANNER (OPTIONAL)</Text>
                            </View>
                            <TextInput value={sponsorContent[ev.id]?.title ?? ''} onChangeText={(t) => setContentField(ev.id, 'title', t)}
                              placeholder={`Title (default: ${ev.title})`} placeholderTextColor={colors.textMuted} style={[cp.input, { marginTop: 7 }]} testID={`join-title-input-${ev.id}`} />
                            <TextInput value={sponsorContent[ev.id]?.subtitle ?? ''} onChangeText={(t) => setContentField(ev.id, 'subtitle', t)}
                              placeholder="Subtitle (optional)" placeholderTextColor={colors.textMuted} style={[cp.input, { marginTop: 7 }]} testID={`join-subtitle-input-${ev.id}`} />
                          </View>
                          <View style={st.budgetBox}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text style={cp.label}>Duration</Text>
                              <Text style={[st.audVal, { color: '#047857' }]}>{days} day{days !== 1 ? 's' : ''}</Text>
                            </View>
                            <SingleSlider min={1} max={30} step={1} value={days} onChange={(v) => setSponsorDays((s) => ({ ...s, [ev.id]: v }))} testID={`event-sponsor-days-slider-${ev.id}`} />
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={st.rangeText}>1 day</Text><Text style={st.rangeText}>30 days</Text>
                            </View>
                            <View style={[st.audRow, { borderTopWidth: 1, borderTopColor: '#d1fae5', paddingTop: 8, marginTop: 6 }]}>
                              <Text style={st.audKey}>Total</Text>
                              <Text style={[st.audVal, { color: '#047857' }]} testID={`event-sponsor-total-${ev.id}`}>{fmt(total)}</Text>
                            </View>
                          </View>
                          <PressScale onPress={() => { setConfirmData({ ...ev, days, total }); setConfirmType('sponsor'); }}
                            disabled={!ev.sponsorship_enabled || total > walletBalance}>
                            <LinearGradient colors={shop.activePill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                              style={[st.launchBtn, (!ev.sponsorship_enabled || total > walletBalance) && { opacity: 0.55 }]} testID="event-sponsorship-join-button">
                              <Text style={st.launchText}>{total > walletBalance ? 'Insufficient wallet' : `Sponsor for ${fmt(total)}`}</Text>
                              {total <= walletBalance && <Ionicons name="arrow-forward" size={14} color={colors.white} />}
                            </LinearGradient>
                          </PressScale>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Rise>
      )}

      {/* ============ PERFORMANCE ============ */}
      {tab === 'performance' && (
        <Rise>
          <View style={st.panel}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Ionicons name="radio-button-on" size={14} color="#059669" /><Text style={st.panelTitle}>Clicks by campaign</Text>
            </View>
            <View testID="shop-performance-chart-clicks">
              {clicksByCampaign.length ? (
                <BarChart data={clicksByCampaign} width={W - 120} height={190} barWidth={20} spacing={16}
                  barBorderTopLeftRadius={5} barBorderTopRightRadius={5}
                  yAxisTextStyle={{ color: colors.textMuted, fontSize: 9 }} xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 8 }}
                  yAxisColor="transparent" xAxisColor={colors.border} rulesColor={colors.borderLight} rulesType="dashed"
                  noOfSections={4} isAnimated animationDuration={800} />
              ) : <View style={st.chartEmpty}><Text style={st.panelSub}>No click data yet</Text></View>}
            </View>
          </View>
          <View style={st.panel}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Ionicons name="logo-usd" size={14} color="#059669" /><Text style={st.panelTitle}>Spend allocation</Text>
            </View>
            <View testID="shop-performance-chart-spend" style={{ alignItems: 'center' }}>
              {spendByType.length ? (
                <>
                  <PieChart data={spendByType.map((e, i) => ({ value: e.value, color: PIE_COLORS[i % PIE_COLORS.length] }))} radius={80} isAnimated />
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
                    {spendByType.map((e, i) => (
                      <View key={e.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <Text style={st.audKey}>{e.name}: {fmt(e.value)}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : <View style={st.chartEmpty}><Text style={st.panelSub}>No spend data yet</Text></View>}
            </View>
          </View>

          {/* campaigns list */}
          <View style={[st.panel, { padding: 0, overflow: 'hidden' }]} testID="shop-performance-campaigns-table">
            <View style={{ padding: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
              <Text style={st.panelTitle}>My Campaigns ({campaigns.length})</Text>
            </View>
            {campaigns.length === 0 ? (
              <Text style={[st.panelSub, { textAlign: 'center', paddingVertical: 26 }]}>No campaigns yet — launch your first above!</Text>
            ) : campaigns.map((c, i) => (
              <View key={c.id} style={[st.campRow, i < campaigns.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={{ flex: 1 }}>
                  <Text style={st.campName} numberOfLines={1}>{c.name || c.subject}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <View style={[st.campBadge, { backgroundColor: c.type === 'ppc' ? colors.s50 : '#ecfdf5' }]}>
                      <Text style={[st.campBadgeText, { color: c.type === 'ppc' ? colors.s700 : '#047857' }]}>{c.type === 'ppc' ? 'PPC' : 'Email'}</Text>
                    </View>
                    <Text style={st.campMeta}>{c.target_type === 'own_customers' ? 'My customers' : (c.target_state === 'all' ? 'All states' : c.target_state)}</Text>
                    <Text style={st.campMeta}>· {c.emails_sent || 0} sent · {c.clicks || 0} clicks</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  <Text style={st.campSpend}>{fmt((c.cost_charged || 0) + (c.spend || 0))}</Text>
                  <View style={[st.campBadge, { backgroundColor: c.status === 'active' ? '#e0f2fe' : c.status === 'sent' ? '#d1fae5' : c.status === 'sending' ? '#fef3c7' : '#f1f5f9' }]}>
                    <Text style={[st.campBadgeText, { color: c.status === 'active' ? '#0369a1' : c.status === 'sent' ? '#047857' : c.status === 'sending' ? '#b45309' : '#475569' }]}>{c.status}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </Rise>
      )}
    </ShopScreenWrap>

    <RocketLiftoff trigger={liftoff} />

    {/* Confirm spends — every launch passes through here */}
    <ConfirmSpendSheet open={confirmType === 'blast'} onClose={() => setConfirmType(null)} onConfirm={handleLaunchBlast}
      title="Launch Email Campaign?" description={`Send your email to ${emailChosenCount} recipient${emailChosenCount !== 1 ? 's' : ''}.`}
      icon="mail" iconGradient={shop.activePill} confirmGradient={shop.activePill}
      walletBalance={walletBalance} spendAmount={emailChosenCost} itemName={emailForm.name || emailForm.subject || 'Email Blast'}
      confirmLabel="Confirm & Send" loading={launching} />
    <ConfirmSpendSheet open={confirmType === 'ppc'} onClose={() => setConfirmType(null)} onConfirm={handleLaunchPpc}
      title="Launch PPC Campaign?" description={`You'll only pay ${fmt(settings.ppc_price_per_click || 0.05)} per click, up to ${fmt(ppcBudget)}.`}
      icon="radio-button-on" iconGradient={[colors.s600, colors.p450]} confirmGradient={[colors.s600, colors.p450]}
      walletBalance={walletBalance} spendAmount={ppcBudget} itemName={ppcForm.name || ppcForm.subject || 'PPC Campaign'}
      confirmLabel="Confirm & Start" loading={launching} />
    <ConfirmSpendSheet open={confirmType === 'boost'} onClose={() => setConfirmType(null)} onConfirm={handleBoost}
      title="Boost This Product?"
      description={canUseFreeBoost ? `Your product will be sponsored for ${boostDuration} days using a FREE sponsor credit — no wallet charge.` : `Your product will be sponsored for ${boostDuration} day${boostDuration !== 1 ? 's' : ''}.`}
      icon={canUseFreeBoost ? 'gift' : 'megaphone'} iconGradient={['#f59e0b', '#f97316']} confirmGradient={['#f59e0b', '#f97316']}
      walletBalance={walletBalance} spendAmount={canUseFreeBoost ? 0 : boostDailyPrice * boostDuration}
      itemName={products.find((p) => p.id === boostProduct)?.name || 'Product'}
      confirmLabel={canUseFreeBoost ? 'Use Free Credit & Boost' : 'Confirm & Boost'} loading={boosting} />
    <ConfirmSpendSheet open={confirmType === 'sponsor'} onClose={() => { setConfirmType(null); setConfirmData(null); }}
      onConfirm={() => confirmData && handleJoinEvent(confirmData, confirmData.days)}
      title="Sponsor This Event?" description={`Your shop will be featured on the home banner for ${confirmData?.days || 1} day${(confirmData?.days || 1) !== 1 ? 's' : ''}.`}
      icon="ribbon" iconGradient={['#ffc0cb', '#f43f5e']} confirmGradient={['#ffc0cb', '#f43f5e']}
      walletBalance={walletBalance} spendAmount={confirmData?.total || 0} itemName={confirmData?.title || 'Event Banner'}
      confirmLabel="Confirm & Sponsor" loading={false} />

    {/* Product picker (boost / email link / ppc link) */}
    <Modal visible={!!productPickerOpen} transparent animationType="fade" onRequestClose={() => setProductPickerOpen(null)}>
      <BlurView intensity={22} tint="dark" style={st.pickerBackdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setProductPickerOpen(null)} />
        <View style={st.pickerSheet}>
          <Text style={st.panelTitle}>Choose a product</Text>
          <ScrollView style={{ maxHeight: 380, marginTop: 10 }}>
            {products.map(p => (
              <TouchableOpacity key={p.id} activeOpacity={0.75} style={st.pickerRow}
                onPress={() => {
                  if (productPickerOpen === 'boost') setBoostProduct(p.id);
                  else if (productPickerOpen === 'email') setEmailForm(prev => ({ ...prev, link_target_id: p.id }));
                  else if (productPickerOpen === 'ppc') setPpcForm(prev => ({ ...prev, link_target_id: p.id }));
                  setProductPickerOpen(null);
                }}>
                {p.images?.[0] ? <Image source={{ uri: img(p.images[0]) }} style={st.pickerImg} /> : <View style={[st.pickerImg, { backgroundColor: colors.borderLight }]} />}
                <Text style={st.pickerName} numberOfLines={1}>{p.name}</Text>
                <Text style={st.audKey}>{fmt(p.price)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </BlurView>
    </Modal>

    {/* AI Suggestions dialog — variants deal in like cards */}
    <Modal visible={aiOpen} transparent animationType="fade" onRequestClose={() => setAiOpen(false)}>
      <BlurView intensity={24} tint="dark" style={st.pickerBackdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setAiOpen(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[st.pickerSheet, { maxHeight: 620 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <Ionicons name="sparkles" size={17} color="#059669" />
              <Text style={st.panelTitle}>AI Email Copy Suggestions</Text>
            </View>
            <ScrollView style={{ maxHeight: 540 }} keyboardShouldPersistTaps="handled">
              <Text style={cp.label}>What's the goal of this email?</Text>
              <TextInput value={aiGoal} onChangeText={setAiGoal} placeholder="e.g. Promote our new winter collection"
                placeholderTextColor={colors.textMuted} style={cp.input} testID="ai-goal-input" />
              <Text style={[cp.label, { marginTop: 10 }]}>Tone</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {AI_TONES.map(t => (
                  <TouchableOpacity key={t} onPress={() => setAiTone(t)} style={[st.chip, aiTone === t && st.chipOn]}>
                    <Text style={[st.chipText, aiTone === t && { color: colors.white }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={[cp.label, { marginTop: 10 }]}>Occasion (optional)</Text>
              <TextInput value={aiOccasion} onChangeText={setAiOccasion} placeholder="e.g. Black Friday"
                placeholderTextColor={colors.textMuted} style={cp.input} />
              <PressScale onPress={handleGenerateAi} disabled={aiLoading} style={{ marginTop: 12 }}>
                <LinearGradient colors={shop.activePill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.launchBtn}>
                  {aiLoading ? <Spinner size={15} /> : <Ionicons name="sparkles" size={15} color={colors.white} />}
                  <Text style={st.launchText}>{aiLoading ? 'Generating...' : 'Generate 3 variants'}</Text>
                </LinearGradient>
              </PressScale>

              <View style={{ gap: 10, marginTop: 12 }}>
                {aiVariants.map((v, i) => (
                  <Rise key={i} delay={i * 130} distance={26}>
                    <View style={st.variantCard} testID="email-ad-ai-variant-card">
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={st.variantTag}>VARIANT {String.fromCharCode(65 + i)}</Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity style={st.copyBtn} testID="email-ad-ai-variant-copy-button"
                            onPress={() => { Clipboard.setString(`${v.subject}\n\n${(v.body_html || '').replace(/<[^>]+>/g, '')}`); toast.success('Copied'); }}>
                            <Ionicons name="copy-outline" size={11} color={colors.textSecondary} />
                            <Text style={st.copyText}>Copy</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => applyVariant(v)} testID="email-ad-ai-variant-apply-button">
                            <LinearGradient colors={shop.activePill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.applyBtn}>
                              <Ionicons name="checkmark" size={11} color={colors.white} />
                              <Text style={st.applyText}>Apply</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={st.variantSubject}>{v.subject}</Text>
                      {v.preview ? <Text style={st.variantPreview}>{v.preview}</Text> : null}
                      <Text style={st.variantBody} numberOfLines={3}>{(v.body_html || '').replace(/<[^>]+>/g, ' ').trim()}</Text>
                      {v.cta_text ? <View style={st.ctaPill}><Text style={st.ctaPillText}>CTA: {v.cta_text}</Text></View> : null}
                    </View>
                  </Rise>
                ))}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
    </>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: shop.bg },
  headerIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', ...shop.emeraldGlow },
  headerTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, letterSpacing: -0.5 },
  headerSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
  walletPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(236,253,245,0.6)', borderWidth: 1, borderColor: '#d1fae5', borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 7, marginTop: 10 },
  walletPillText: { fontFamily: fonts.extrabold, fontSize: 12.5, color: '#065f46' },
  liveBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.md, padding: 12, marginTop: 12 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981' },
  liveTitle: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink },
  liveDesc: { fontFamily: fonts.body, fontSize: 11, color: '#047857', marginTop: 1 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  infoCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginTop: 14, overflow: 'hidden', ...shadow.card },
  infoHead: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#d1fae5' },
  infoHeadText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text, flex: 1 },
  infoBox: { borderWidth: 1, borderRadius: radius.md, padding: 12 },
  infoIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  infoBody: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  checkText: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted },
  tipBox: { flexDirection: 'row', gap: 8, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.md, padding: 11 },
  tipText: { flex: 1, fontFamily: fonts.body, fontSize: 10.5, color: '#92400e', lineHeight: 15 },
  tabBar: { marginTop: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 5, flexGrow: 0 },
  tabOn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, ...shop.emeraldGlow },
  tabOnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
  tabOff: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9 },
  tabOffText: { color: colors.textSecondary, fontFamily: fonts.semibold, fontSize: 12 },
  panel: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 15, marginTop: 12, ...shadow.card },
  panelTitle: { fontFamily: fonts.extrabold, fontSize: 15.5, color: colors.ink },
  panelSub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  aiBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8 },
  aiBtnText: { fontFamily: fonts.semibold, fontSize: 11, color: '#047857' },
  targetCard: { backgroundColor: 'rgba(236,253,245,0.4)', borderWidth: 1, borderColor: '#d1fae5', borderRadius: radius.lg, padding: 14, marginTop: 12, ...shadow.card },
  targetTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  radioRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: '#d1fae5', borderRadius: radius.md, padding: 11 },
  radio: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioOn: { borderColor: '#059669' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669' },
  radioTitle: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  radioDesc: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: colors.surface },
  chipOn: { backgroundColor: '#059669', borderColor: '#059669' },
  chipText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textSecondary },
  productSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: colors.surface },
  audienceBox: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#d1fae5', borderRadius: radius.md, padding: 11, marginTop: 10, gap: 8 },
  audRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  audKey: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted },
  audVal: { fontFamily: fonts.extrabold, fontSize: 13.5, color: colors.ink },
  rangeText: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  warnBox: { flexDirection: 'row', gap: 8, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3', borderRadius: radius.md, padding: 11, marginTop: 10 },
  warnText: { flex: 1, fontFamily: fonts.body, fontSize: 10.5, color: '#be123c', lineHeight: 15 },
  testRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  testBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#a7f3d0', backgroundColor: '#ecfdf5', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11 },
  testBtnText: { fontFamily: fonts.bold, fontSize: 11.5, color: '#047857' },
  launchBtn: { height: 48, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, ...shop.emeraldGlow },
  launchText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13.5 },
  budgetBox: { backgroundColor: 'rgba(236,253,245,0.4)', borderWidth: 1, borderColor: '#d1fae5', borderRadius: radius.md, padding: 12, marginTop: 4 },
  freeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6, ...shadow.amberGlow },
  freeBadgeText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 11 },
  freeNote: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.md, padding: 12, marginBottom: 12 },
  freeNoteLine: { fontFamily: fonts.body, fontSize: 11, color: '#92400e', marginTop: 1 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: '#fcd34d', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  activeSponsor: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 2, borderColor: '#a7f3d0', borderRadius: radius.lg, padding: 13, marginTop: 12 },
  crownTile: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  activeSponsorKicker: { fontFamily: fonts.extrabold, fontSize: 9.5, color: '#065f46', letterSpacing: 1 },
  activeSponsorTitle: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text, marginTop: 2 },
  activeSponsorDesc: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 2 },
  eventCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },
  eventBanner: { height: 120 },
  homeBannerTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 5 },
  homeBannerTagText: { fontFamily: fonts.extrabold, fontSize: 8.5, color: '#78350f' },
  eventTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 17 },
  eventSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 11, marginTop: 1 },
  joinedBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 10 },
  joinedText: { fontFamily: fonts.bold, fontSize: 12, color: '#047857', flexShrink: 1 },
  editBox: { backgroundColor: 'rgba(245,243,255,0.5)', borderWidth: 1, borderColor: colors.p200, borderRadius: radius.md, padding: 11 },
  editKicker: { fontFamily: fonts.extrabold, fontSize: 9, color: colors.p800, letterSpacing: 0.8 },
  outlineBtn: { height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  violetBtn: { height: 42, borderRadius: radius.md, backgroundColor: colors.p500, alignItems: 'center', justifyContent: 'center' },
  violetText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12.5 },
  chartEmpty: { height: 160, alignItems: 'center', justifyContent: 'center' },
  campRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  campName: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  campBadge: { borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2.5, alignSelf: 'flex-start' },
  campBadgeText: { fontFamily: fonts.bold, fontSize: 9, textTransform: 'capitalize' },
  campMeta: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted },
  campSpend: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 18 },
  pickerSheet: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, ...shadow.dropdown },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  pickerImg: { width: 36, height: 36, borderRadius: 9 },
  pickerName: { flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  variantCard: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12 },
  variantTag: { fontFamily: fonts.extrabold, fontSize: 9.5, color: '#047857', letterSpacing: 1 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.white },
  copyText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.textSecondary },
  applyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 5 },
  applyText: { fontFamily: fonts.bold, fontSize: 10, color: colors.white },
  variantSubject: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  variantPreview: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  variantBody: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, marginTop: 5, lineHeight: 15 },
  ctaPill: { alignSelf: 'flex-start', backgroundColor: '#d1fae5', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, marginTop: 7 },
  ctaPillText: { fontFamily: fonts.bold, fontSize: 9.5, color: '#047857' },
});
