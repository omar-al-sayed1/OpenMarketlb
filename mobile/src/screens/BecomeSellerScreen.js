import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Image, Switch, StyleSheet } from 'react-native';
import { Alert } from '../components/AppDialog';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { pickImage } from '../lib/imagePick';
import { api } from '../lib/api';
import { img } from '../lib/media';
import { useAuth } from '../context/AuthContext';
import { TAB_SPACE, Input } from '../components/ui';
import BottomSheet from '../components/BottomSheet';
import { colors, fonts, radius, shadow } from '../theme/theme';

const FEATURES = [
  { icon: 'bar-chart', title: 'Advanced Analytics', desc: 'Track sales, views, and customer behavior in real-time', grad: ['#3b82f6', '#06b6d4'] },
  { icon: 'shield-checkmark', title: 'Verified Badge', desc: 'Get a trusted seller badge and rank higher in search', grad: ['#10b981', '#14b8a6'] },
  { icon: 'globe', title: 'Instant Visibility', desc: 'Reach thousands of customers across all Lebanon', grad: [colors.p400, '#ec4899'] },
  { icon: 'wallet', title: 'Easy Payments', desc: 'Get paid directly to your wallet with low commission', grad: ['#f59e0b', '#f97316'] },
  { icon: 'gift', title: 'Marketing Tools', desc: 'Gift with purchase, spin wheel, product boosts & more', grad: ['#f43f5e', '#ef4444'] },
  { icon: 'ribbon', title: 'Pro Features', desc: 'Unlimited products, PDF reports, premium themes', grad: [colors.s600, colors.p450] },
];
const HERO_STATS = [['Free', 'To Apply'], ['Fast', 'Approval'], ['24/7', 'Support']];
const PH = '#94a3b8';

export default function BecomeSellerScreen({ navigation }) {
  const { isLoggedIn, user } = useAuth();
  const scrollRef = useRef(null);
  const formYRef = useRef(0);

  const [cats, setCats] = useState([]);
  const [states, setStates] = useState([]);
  const [price, setPrice] = useState(29);
  const [sellerCount, setSellerCount] = useState(0);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ name: '', description: '', phone: '', email: user?.email || '', address: '', state: '', guest_name: user?.name || '', category_ids: [] });
  const [logo, setLogo] = useState(null);
  const [wantsSub, setWantsSub] = useState(false);
  const [planFeatures, setPlanFeatures] = useState([]);
  const [catSearch, setCatSearch] = useState('');
  const [stateOpen, setStateOpen] = useState(false);
  // Stable callbacks so the memoized sections below don't re-render on every keystroke.
  const set = useCallback((k, v) => setForm((f) => ({ ...f, [k]: v })), []);

  useEffect(() => {
    api.categories.getAll(true).then(({ data }) => setCats(Array.isArray(data) ? data : data?.categories || [])).catch(() => {});
    api.states.getAll().then(({ data }) => setStates((data || []).map((s) => s.name || s))).catch(() => {});
    api.shop.getSubscriptionPricing().then(({ data }) => { if (data?.monthly?.price != null) setPrice(Number(data.monthly.price)); if (Array.isArray(data?.features)) setPlanFeatures(data.features); }).catch(() => {});
    api.shops.getAll().then(({ data }) => setSellerCount((Array.isArray(data) ? data : data?.shops || []).length)).catch(() => {});
    if (isLoggedIn) api.shop.getStatus().then(({ data }) => { if (data?.status === 'pending') setPending(true); }).catch(() => {});
  }, []); // eslint-disable-line

  const catList = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    return q ? cats.filter((c) => (c.name || '').toLowerCase().includes(q)) : cats;
  }, [cats, catSearch]);

  const toggleCat = useCallback((id) => setForm((f) => ({
    ...f,
    category_ids: f.category_ids.includes(id) ? f.category_ids.filter((x) => x !== id) : [...f.category_ids, id],
  })), []);

  const pickLogo = async () => {
    try { const res = await pickImage({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1] }); if (!res.canceled && res.assets?.length) setLogo(res.assets[0]); } catch (_) {}
  };

  const scrollToForm = useCallback(() => scrollRef.current?.scrollTo({ y: Math.max(0, formYRef.current - 20), animated: true }), []);

  const submit = async () => {
    if (!form.name || !form.phone || !form.address || !form.state) return Alert.alert('Missing info', 'Please fill in all required fields.');
    if (!isLoggedIn && !form.email) return Alert.alert('Email required', 'Email is required for guest applications.');
    if (!isLoggedIn && !form.guest_name) return Alert.alert('Name required', 'Your name is required.');
    setLoading(true);
    let logoUrl = '';
    if (logo) { try { const { data } = await api.shop.uploadFile({ uri: logo.uri, name: logo.fileName || 'logo.jpg', mimeType: logo.mimeType }); logoUrl = data.url; } catch (_) {} }
    try {
      if (!isLoggedIn) {
        await api.shop.registerGuest({ name: form.name, phone: form.phone, address: form.address, state: form.state, email: form.email, description: form.description, logo: logoUrl, guest_name: form.guest_name, category_ids: form.category_ids, wants_subscription: wantsSub });
      } else {
        await api.shop.register({ ...form, logo: logoUrl, payment_method: 'manual', wants_subscription: wantsSub });
      }
      setSent(true);
    } catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Failed to submit application'); }
    finally { setLoading(false); }
  };

  /* ===== Success / pending states ===== */
  if (sent || pending) {
    const ok = sent;
    return (
      <View style={[styles.stateWrap, { backgroundColor: ok ? '#ecfdf5' : '#fffbeb' }]}>
        <LinearGradient colors={ok ? ['#34d399', '#0d9488'] : ['#fbbf24', '#f97316']} style={styles.stateIcon}><Ionicons name={ok ? 'checkmark-circle' : 'time'} size={44} color={colors.white} /></LinearGradient>
        <Text style={styles.stateTitle}>{ok ? 'Application Sent!' : 'Application Under Review'}</Text>
        <Text style={styles.stateSub}>{ok ? "Thanks for applying. Our team will review your shop and get back to you soon." : "Your shop application is being reviewed by our team. We'll notify you once it's approved."}</Text>
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('Home')}>
          <LinearGradient colors={ok ? ['#10b981', '#059669'] : ['#f59e0b', '#f97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.stateBtn}><Text style={styles.stateBtnText}>Continue Shopping</Text></LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: TAB_SPACE }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* ===== HERO ===== (memoized — no re-render while typing) */}
        <HeroSection sellerCount={sellerCount} onApply={scrollToForm} />

        {/* ===== FEATURES ===== (static, memoized — renders once) */}
        <FeaturesSection />

        {/* ===== FORM ===== */}
        <View style={styles.formSection} onLayout={(e) => { formYRef.current = e.nativeEvent.layout.y; }}>
          <Text style={[styles.eyebrow, { color: '#059669' }]}>GET STARTED</Text>
          <Text style={styles.sectionTitle}>Tell Us About Your Shop</Text>
          <Text style={styles.sectionSub}>Fill in your shop details below. Our team will review and get back to you.</Text>

          {isLoggedIn && user ? (
            <View style={styles.userCard}>
              <LinearGradient colors={['#10b981', '#0d9488']} style={styles.userAvatar}><Ionicons name="person-circle" size={22} color={colors.white} /></LinearGradient>
              <View style={{ flex: 1 }}><Text style={styles.userName}>{user.name}</Text><Text style={styles.userEmail}>{user.email}</Text></View>
            </View>
          ) : null}

          <View style={styles.card}>
            <LinearGradient colors={['#0f172a', '#1e293b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardHead}>
              <View style={styles.cardHeadTile}><Ionicons name="storefront" size={18} color={colors.white} /></View>
              <Text style={styles.cardHeadTitle}>Shop Application</Text>
            </LinearGradient>

            <View style={{ padding: 18 }}>
              {/* Benefits */}
              <View style={styles.benefitsCard}>
                <View style={styles.benefitsHead}><View style={styles.benefitsTile}><Ionicons name="gift" size={15} color={colors.white} /></View><View style={{ flex: 1 }}><Text style={styles.benefitsTitle}>Welcome Bonus</Text><Text style={styles.benefitsSub}>Your welcome bonus, applied automatically</Text></View></View>
                <View style={styles.benefitsRow}><Text style={styles.benefitsK}>Wallet credit</Text><Text style={styles.benefitsV}>$2 wallet credit</Text></View>
                <View style={styles.benefitsRow}><Text style={styles.benefitsK}>Free sponsor</Text><Text style={styles.benefitsV}>1 free product sponsor</Text></View>
              </View>

              {/* Your info (guests) */}
              {!isLoggedIn && (
                <>
                  <Text style={styles.groupTitle}>YOUR INFORMATION</Text>
                  <Input label="Your Full Name *" containerStyle={{ marginBottom: 12 }} icon="person-outline" value={form.guest_name} onChangeText={(v) => set('guest_name', v)} placeholder="John Doe" />
                  <Input label="Your Email *" containerStyle={{ marginBottom: 12 }} icon="mail-outline" value={form.email} onChangeText={(v) => set('email', v)} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
                </>
              )}

              <Text style={styles.groupTitle}>SHOP DETAILS</Text>
              <Input label="Shop Name *" containerStyle={{ marginBottom: 12 }} icon="storefront-outline" value={form.name} onChangeText={(v) => set('name', v)} placeholder="e.g. Beirut Boutique" />
              <Input label="Phone *" containerStyle={{ marginBottom: 12 }} icon="call-outline" value={form.phone} onChangeText={(v) => set('phone', v)} placeholder="+961 …" keyboardType="phone-pad" />
              <Input label="Description" containerStyle={{ marginBottom: 12 }} icon="document-text-outline" multiline value={form.description} onChangeText={(v) => set('description', v)} placeholder="Tell us about your shop and what you sell..." />

              {/* Logo */}
              <Field label="Shop Logo (optional)">
                <TouchableOpacity style={styles.logoBtn} activeOpacity={0.85} onPress={pickLogo}>
                  {logo ? <Image source={{ uri: logo.uri }} style={styles.logoThumb} /> : <View style={styles.logoIcon}><Ionicons name="image-outline" size={20} color={PH} /></View>}
                  <Text style={styles.logoText}>{logo ? 'Logo attached · tap to change' : 'Upload a shop logo'}</Text>
                  {logo ? <TouchableOpacity onPress={() => setLogo(null)}><Ionicons name="close-circle" size={18} color={PH} /></TouchableOpacity> : null}
                </TouchableOpacity>
              </Field>

              {/* Categories */}
              <View style={styles.catHeadRow}>
                <Text style={styles.groupTitle}>CATEGORIES</Text>
                {form.category_ids.length > 0 ? <View style={styles.catCount}><Text style={styles.catCountText}>{form.category_ids.length} selected</Text></View> : null}
              </View>
              <Text style={styles.catHint}>Select all categories your shop will sell in. Admin can edit later.</Text>
              <View style={styles.catSearch}><Ionicons name="search" size={15} color={PH} /><TextInput style={styles.catSearchInput} value={catSearch} onChangeText={setCatSearch} placeholder="Search categories..." placeholderTextColor={PH} />{catSearch ? <TouchableOpacity onPress={() => setCatSearch('')}><Ionicons name="close" size={15} color={PH} /></TouchableOpacity> : null}</View>
              <CategoryChips catList={catList} selected={form.category_ids} onToggle={toggleCat} catSearch={catSearch} />

              <Input label="Address *" containerStyle={{ marginTop: 4, marginBottom: 12 }} icon="location-outline" value={form.address} onChangeText={(v) => set('address', v)} placeholder="Street, Building, City" />
              <Field label="State / Region *">
                <TouchableOpacity style={styles.selectBtn} onPress={() => setStateOpen(true)}><Text style={[styles.selectText, !form.state && { color: PH }]}>{form.state || 'Select a region'}</Text><Ionicons name="chevron-down" size={16} color={colors.textMuted} /></TouchableOpacity>
              </Field>

              {/* Subscribe & get more every month — shown to all applicants (matches the website) */}
              <LinearGradient colors={['#fffbeb', '#fff7ed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.subCard}>
                  <View style={styles.subHead}>
                    <LinearGradient colors={['#f59e0b', '#f97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.subTile}><MaterialCommunityIcons name="crown" size={17} color={colors.white} /></LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subTitle}>Subscribe & get more every month</Text>
                      <Text style={styles.subSub}>Optional — subscribed shops receive these perks each month from their subscription date</Text>
                    </View>
                  </View>
                  <View style={styles.perkList}>
                    {(planFeatures.length ? planFeatures : ['1 free spin / month', '2 product sponsors / month', 'Lower commissions']).map((f, i) => (
                      <View key={i} style={styles.perkRow}><Ionicons name="checkmark-circle" size={16} color="#d97706" /><Text style={styles.perkText}>{f}</Text></View>
                    ))}
                  </View>
                  <View style={styles.subToggle}>
                    <Text style={styles.subToggleText}>Yes, I want to subscribe <Text style={{ color: '#b45309', fontFamily: fonts.bold }}>(${price.toFixed(2)}/month)</Text></Text>
                    <Switch value={wantsSub} onValueChange={setWantsSub} trackColor={{ true: '#f59e0b' }} thumbColor={colors.white} />
                  </View>
                  <Text style={styles.subNote}>Optional. You can also subscribe later from your shop dashboard.</Text>
                </LinearGradient>

              {/* Submit */}
              <TouchableOpacity activeOpacity={0.9} onPress={submit} disabled={loading} style={{ marginTop: 18 }}>
                <LinearGradient colors={['#10b981', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>
                  <Ionicons name="paper-plane" size={17} color={colors.white} />
                  <Text style={styles.submitText}>{loading ? 'Submitting…' : (isLoggedIn ? 'Submit Application' : 'Submit Application')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* State picker */}
      <BottomSheet visible={stateOpen} onClose={() => setStateOpen(false)} maxHeight="70%">
        <Text style={styles.pickTitle}>Select a region</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
          {states.map((st) => (
            <TouchableOpacity key={st} style={styles.pickRow} onPress={() => { set('state', st); setStateOpen(false); }}>
              <Text style={[styles.pickRowText, form.state === st && { color: colors.violet, fontFamily: fonts.bold }]}>{st}</Text>
              {form.state === st && <Ionicons name="checkmark" size={17} color={colors.violet} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

function Field({ label, children, flex, style }) {
  return <View style={[{ marginBottom: 12 }, flex && { flex: 1 }, style]}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;
}

/* Hero — memoized so it never re-renders while the form is being typed in. */
const HeroSection = React.memo(function HeroSection({ sellerCount, onApply }) {
  return (
    <LinearGradient renderToHardwareTextureAndroid colors={['#0f172a', colors.p950, colors.s950]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={[styles.heroGlow, { top: -60, left: -40, backgroundColor: 'rgba(124,58,237,0.30)' }]} />
      <View style={[styles.heroGlow, { bottom: -50, right: -40, backgroundColor: 'rgba(16,185,129,0.20)' }]} />
      <View style={styles.heroBadge}><Ionicons name="rocket" size={13} color="#34d399" /><Text style={styles.heroBadgeText}>Join <Text style={{ color: '#34d399', fontFamily: fonts.bold }}>{sellerCount > 0 ? `${sellerCount}+` : '…'}</Text> successful sellers</Text></View>
      <Text style={styles.heroTitle}>Start Your{'\n'}<Text style={styles.heroTitleHi}>Success Story</Text></Text>
      <Text style={styles.heroSub}>Sell on Lebanon's fastest-growing marketplace. Fill in your shop details and our team will review your application.</Text>
      <View style={styles.heroStats}>
        {HERO_STATS.map(([v, l]) => <View key={l}><Text style={styles.heroStatV}>{v}</Text><Text style={styles.heroStatL}>{l}</Text></View>)}
      </View>
      <TouchableOpacity activeOpacity={0.9} onPress={onApply}>
        <LinearGradient colors={['#10b981', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heroBtn}><Text style={styles.heroBtnText}>Apply Now for Free</Text><Ionicons name="arrow-forward" size={17} color={colors.white} /></LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  );
});

/* Features — fully static, renders once. */
const FeaturesSection = React.memo(function FeaturesSection() {
  return (
    <View style={styles.section} renderToHardwareTextureAndroid>
      <Text style={styles.eyebrow}>WHY SELL WITH US</Text>
      <Text style={styles.sectionTitle}>Everything You Need to Succeed</Text>
      <View style={styles.featGrid}>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.featCard}>
            <LinearGradient colors={f.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featIcon}><Ionicons name={f.icon} size={20} color={colors.white} /></LinearGradient>
            <Text style={styles.featTitle}>{f.title}</Text>
            <Text style={styles.featDesc}>{f.desc}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

/* Category chips — only re-renders when the (filtered) list or the selection changes,
   not on every keystroke in the other form fields. */
const CategoryChips = React.memo(function CategoryChips({ catList, selected, onToggle, catSearch }) {
  return (
    <View style={styles.catChips}>
      {catList.length === 0 ? <Text style={styles.catNone}>No categories match "{catSearch}"</Text>
        : catList.map((c) => {
          const on = selected.includes(c.id);
          return on
            ? <TouchableOpacity key={c.id} onPress={() => onToggle(c.id)} activeOpacity={0.85}><LinearGradient colors={['#10b981', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.catChipOn}><Ionicons name="checkmark" size={10} color={colors.white} /><Text style={styles.catChipTextOn}>{c.name}</Text></LinearGradient></TouchableOpacity>
            : <TouchableOpacity key={c.id} style={styles.catChip} onPress={() => onToggle(c.id)}><Text style={styles.catChipText}>{c.name}</Text></TouchableOpacity>;
        })}
    </View>
  );
});

const styles = StyleSheet.create({
  hero: { padding: 22, paddingTop: 32, paddingBottom: 30, overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 120 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16 },
  heroBadgeText: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.medium, fontSize: 11.5 },
  heroTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 38, letterSpacing: -1.2, lineHeight: 42 },
  heroTitleHi: { color: '#34d399' },
  heroSub: { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.body, fontSize: 14, lineHeight: 21, marginTop: 14 },
  heroStats: { flexDirection: 'row', gap: 28, marginTop: 22 },
  heroStatV: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 24, letterSpacing: -0.5 },
  heroStatL: { color: 'rgba(255,255,255,0.4)', fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
  heroBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: radius.pill, marginTop: 24, ...shadow.emphasis },
  heroBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },

  section: { paddingHorizontal: 16, paddingTop: 28, paddingBottom: 8 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, color: colors.violet, textTransform: 'uppercase', textAlign: 'center' },
  sectionTitle: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.ink, textAlign: 'center', letterSpacing: -0.6, marginTop: 4 },
  sectionSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
  featGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 },
  featCard: { width: '47.5%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 16, ...shadow.card },
  featIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  featTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  featDesc: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 17 },

  formSection: { paddingHorizontal: 16, paddingTop: 28 },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.lg, padding: 12, marginTop: 16 },
  userAvatar: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  userName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  userEmail: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', marginTop: 16, ...shadow.emphasis },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18 },
  cardHeadTile: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.9)', alignItems: 'center', justifyContent: 'center' },
  cardHeadTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.white },
  benefitsCard: { backgroundColor: colors.p50, borderWidth: 1, borderColor: '#e9d5ff', borderRadius: radius.lg, padding: 14, marginBottom: 18 },
  benefitsHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  benefitsTile: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.p400, alignItems: 'center', justifyContent: 'center' },
  benefitsTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.p900 },
  benefitsSub: { fontFamily: fonts.body, fontSize: 11, color: colors.p600, marginTop: 1 },
  benefitsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  benefitsK: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
  benefitsV: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  groupTitle: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.8, marginTop: 4, marginBottom: 10 },
  fieldLabel: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  two: { flexDirection: 'row', gap: 12 },
  logoBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11 },
  logoIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  logoThumb: { width: 34, height: 34, borderRadius: 9 },
  logoText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  catHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catCount: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2 },
  catCountText: { fontFamily: fonts.bold, fontSize: 10, color: '#059669' },
  catHint: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginBottom: 10 },
  catSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, height: 42, marginBottom: 10 },
  catSearchInput: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: colors.ink },
  catChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  catChip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  catChipText: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.textSecondary },
  catChipOn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  catChipTextOn: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.white },
  catNone: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13 },
  selectText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  subCard: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.lg, padding: 14, marginTop: 6 },
  subHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  subTile: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' },
  subTitle: { fontFamily: fonts.bold, fontSize: 11.5, color: '#92400e' },
  subSub: { fontFamily: fonts.body, fontSize: 9.5, color: '#d97706', marginTop: 1 },
  perkList: { gap: 8, marginBottom: 10 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: '#fef3c7', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  perkText: { flex: 1, fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  subToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  subToggleText: { flex: 1, fontFamily: fonts.semibold, fontSize: 11, color: colors.text },
  subNote: { fontFamily: fonts.body, fontSize: 9.5, color: '#d97706', marginTop: 8 },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: radius.md, ...shadow.emphasis },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15.5 },

  pickTitle: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink },
  pickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  pickRowText: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },

  stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  stateIcon: { width: 84, height: 84, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 20, ...shadow.emphasis },
  stateTitle: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.ink },
  stateSub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 320 },
  stateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: 26, paddingVertical: 14, marginTop: 24 },
  stateBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14.5 },
});
