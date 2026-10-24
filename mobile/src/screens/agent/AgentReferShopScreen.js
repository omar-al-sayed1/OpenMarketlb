import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Image, Animated, Easing, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { pickImage } from '../../lib/imagePick';
import Reanimated, { LinearTransition, FadeIn } from 'react-native-reanimated';
import { api } from '../../lib/api';
import { img, MEDIA_BASE_URL } from '../../lib/media';
import { notifySuccess } from '../../lib/haptics';
import { colors, agent, radius, fonts, shadow } from '../../theme/theme';
import { Rise, CountUp, PressScale, Spinner, toast } from '../../components/shop/ShopKit';
import { AgentScreenWrap, AgentHero } from '../../components/agent/AgentKit';

const { width: W, height: H } = Dimensions.get('window');
const STEPS = ['Owner Info', 'Shop Details', 'Location'];

/* category chip that springs-fills violet->fuchsia when selected */
function CategoryChip({ cat, selected, onPress }) {
  const a = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: selected ? 1 : 0, friction: 5, tension: 180, useNativeDriver: true }).start();
  }, [selected, a]);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}
      testID={selected ? `refer-category-chip-selected-${cat.id}` : `refer-category-chip-unselected-${cat.id}`}>
      <View style={cc.wrap}>
        {/* the filled gradient scales in behind the label */}
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: radius.pill, opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
          <LinearGradient colors={[colors.p450, '#ffc0cb']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} />
        </Animated.View>
        <View style={[cc.chip, !selected && cc.chipIdle]}>
          <Text style={[cc.text, selected && { color: colors.white }]}>{cat.name}</Text>
          {selected ? <Ionicons name="checkmark" size={11} color={colors.white} style={{ marginLeft: 4 }} /> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}
const cc = StyleSheet.create({
  wrap: { borderRadius: radius.pill, overflow: 'hidden' },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 7, borderRadius: radius.pill },
  chipIdle: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  text: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
});

/* the whole form folds into a paper plane that flies off */
function FoldAway({ trigger, onDone }) {
  const a = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (trigger) {
      setVisible(true);
      a.setValue(0);
      Animated.timing(a, { toValue: 1, duration: 1000, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => { setVisible(false); onDone?.(); });
    }
  }, [trigger]); // eslint-disable-line
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 99 }]}>
      <Animated.View style={{
        position: 'absolute', top: H * 0.4, left: 30,
        opacity: a.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, W] }) },
          { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -140] }) },
          { rotate: '-22deg' },
          { scale: a.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.7, 1.3, 0.85] }) },
        ],
      }}>
        <Ionicons name="paper-plane" size={44} color="#f06a92" />
      </Animated.View>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, required, testID, focusColor = colors.p450 }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ flex: 1, minWidth: 150 }}>
      <Text style={fs.label}>{label}{required ? ' *' : ''}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType} multiline={multiline}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={[fs.input, multiline && { height: 76, textAlignVertical: 'top' }, focused && { borderColor: focusColor, borderWidth: 1.5 }]} testID={testID} />
    </View>
  );
}
const fs = StyleSheet.create({
  label: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.textSecondary, letterSpacing: 0.6, marginBottom: 5, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, fontFamily: fonts.body, fontSize: 13.5, color: colors.text, backgroundColor: colors.surface },
});

export default function AgentReferShopScreen({ navigation }) {
  const [form, setForm] = useState({ shop_name: '', description: '', email: '', phone: '', address: '', state: '', guest_name: '', logo: '', category_ids: [] });
  const [saving, setSaving] = useState(false);
  const [allCategories, setAllCategories] = useState([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [states, setStates] = useState([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [fold, setFold] = useState(0);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.categories.getAll(true).then(({ data }) => setAllCategories(data || [])).catch(() => {});
    api.states.getAll().then(({ data }) => setStates(data || [])).catch(() => {});
  }, []);

  const toggleCategory = useCallback((catId) => {
    setForm(prev => ({
      ...prev,
      category_ids: prev.category_ids.includes(catId) ? prev.category_ids.filter(id => id !== catId) : [...prev.category_ids, catId],
    }));
  }, []);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return allCategories;
    const q = categorySearch.toLowerCase();
    return allCategories.filter(cat => (cat.name || '').toLowerCase().includes(q) || (cat.name_ar || '').toLowerCase().includes(q));
  }, [allCategories, categorySearch]);

  const pickLogo = async () => {
    const res = await pickImage({ mediaTypes: ['images'], quality: 0.85 });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    setUploadingLogo(true);
    try {
      const resp = await api.shop.uploadFile({ uri: asset.uri, name: asset.fileName || 'logo.jpg', mimeType: asset.mimeType });
      setForm(f => ({ ...f, logo: `${MEDIA_BASE_URL}${resp.data.url}` }));
    } catch { toast.error('Upload failed'); }
    finally { setUploadingLogo(false); }
  };

  const onSubmit = async () => {
    if (!form.shop_name.trim() || !form.phone.trim() || !form.address.trim() || !form.state.trim()) {
      return toast.error('Shop name, phone, address and region are required');
    }
    if (!form.email.trim()) return toast.error('Shop owner email is required');
    if (!form.guest_name.trim()) return toast.error("Shop owner's name is required");
    setSaving(true);
    try {
      await api.agent.fillShop({
        shop_name: form.shop_name, description: form.description, email: form.email, phone: form.phone,
        address: form.address, state: form.state, guest_name: form.guest_name,
        category_ids: form.category_ids || [], logo: form.logo || '',
      });
      notifySuccess();
      setFold(k => k + 1); // form folds into a paper plane
      toast.success('Shop application submitted — awaiting admin approval.');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to submit'); setSaving(false); }
  };

  const resetForm = () => {
    setForm({ shop_name: '', description: '', email: '', phone: '', address: '', state: '', guest_name: '', logo: '', category_ids: [] });
    setCategorySearch('');
    setSuccess(false);
    setSaving(false);
  };

  /* success card after the plane flies off */
  if (success) {
    return (
      <AgentScreenWrap>
        <Rise duration={500} distance={16}>
          <View style={st.successCard}>
            <LinearGradient colors={[colors.p450, '#ffc0cb']} style={st.successIcon}>
              <Ionicons name="checkmark-done" size={40} color={colors.white} />
            </LinearGradient>
            <Text style={st.successTitle}>Application Sent! ✈️</Text>
            <Text style={st.successSub}>The shop application is on its way to admin. You'll earn your approval bonus and commission share once it's approved (usually within 24-48 hours).</Text>
            <PressScale onPress={resetForm} style={{ marginTop: 18, alignSelf: 'stretch' }}>
              <LinearGradient colors={[colors.p500, '#f06a92']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.referAnother}>
                <Ionicons name="add-circle" size={15} color={colors.white} />
                <Text style={st.referAnotherText}>Refer Another Shop</Text>
              </LinearGradient>
            </PressScale>
            <PressScale onPress={() => navigation.navigate('AgentReferredShops')} style={{ marginTop: 9, alignSelf: 'stretch' }}>
              <View style={st.outlineBtn}><Text style={st.outlineText}>View Referred Shops</Text></View>
            </PressScale>
          </View>
        </Rise>
      </AgentScreenWrap>
    );
  }

  return (
    <>
    <AgentScreenWrap>
      <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn} testID="refer-back-btn">
        <Ionicons name="arrow-back" size={15} color={colors.textSecondary} />
        <Text style={st.backText}>Back</Text>
      </TouchableOpacity>

      {/* Hero — violet-600 -> purple-600 -> fuchsia-600 */}
      <Rise duration={500} distance={0}>
        <AgentHero grad={agent.referHero} tag="Refer a Shop" tagIcon="add-circle"
          title="Submit a Shop Application"
          sub="Fill in the shop's details on behalf of the owner. Once admin approves, you earn your approval bonus and ongoing commission share." />
      </Rise>

      {/* Benefits card — commission perks with count-ups */}
      <Rise delay={90}>
        <LinearGradient colors={['#ecfdf5', '#f0fdfa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.benefits} testID="refer-benefits-card">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 11 }}>
            <View style={st.giftTile}><Ionicons name="gift" size={17} color={colors.white} /></View>
            <View>
              <Text style={st.benefitsTitle}>What this shop gets on approval</Text>
              <Text style={st.benefitsSub}>Referred shops receive a boosted welcome bonus</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <View style={st.benefitPill}>
              <Ionicons name="wallet" size={15} color="#059669" />
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={st.benefitText}>$</Text>
                <CountUp value={3} style={st.benefitText} />
                <Text style={st.benefitText}> wallet credit</Text>
              </View>
            </View>
            <View style={st.benefitPill}>
              <Ionicons name="megaphone" size={15} color="#059669" />
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <CountUp value={2} style={st.benefitText} />
                <Text style={st.benefitText}> free sponsors</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </Rise>

      {/* Form card with dark step header */}
      <Rise delay={160}>
        <View style={st.formCard} testID="refer-shop-form">
          <LinearGradient colors={['#0f172a', '#1e293b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.formHead}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <LinearGradient colors={[colors.p400, '#e879f9']} style={st.formHeadTile}><Ionicons name="storefront" size={18} color={colors.white} /></LinearGradient>
              <Text style={st.formHeadTitle}>Shop Application</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {STEPS.map((step, i) => (
                <React.Fragment key={step}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={st.stepDot}><Text style={st.stepDotText}>{i + 1}</Text></View>
                    <Text style={st.stepLabel}>{step}</Text>
                  </View>
                  {i < STEPS.length - 1 && <View style={st.stepConnector} />}
                </React.Fragment>
              ))}
            </View>
          </LinearGradient>

          <View style={{ padding: 16, gap: 18 }}>
            {/* Section 1: Owner Info */}
            <View style={{ gap: 11 }}>
              <View style={st.sectionHead}>
                <View style={[st.sectionIcon, { backgroundColor: colors.p100 }]}><Ionicons name="person-circle" size={15} color={colors.p500} /></View>
                <Text style={st.sectionTitle}>Owner Information</Text>
              </View>
              <Field label="Owner's Full Name" required value={form.guest_name} onChangeText={(t) => setForm(f => ({ ...f, guest_name: t }))} placeholder="John Doe" testID="refer-guest-name-input" />
              <Field label="Owner's Email" required value={form.email} onChangeText={(t) => setForm(f => ({ ...f, email: t }))} placeholder="owner@example.com" keyboardType="email-address" testID="refer-email-input" />
            </View>

            <View style={st.dashDivider} />

            {/* Section 2: Shop Details */}
            <View style={{ gap: 11 }}>
              <View style={st.sectionHead}>
                <View style={[st.sectionIcon, { backgroundColor: '#d1fae5' }]}><Ionicons name="storefront" size={15} color="#059669" /></View>
                <Text style={st.sectionTitle}>Shop Details</Text>
              </View>
              <Field label="Shop Name" required value={form.shop_name} onChangeText={(t) => setForm(f => ({ ...f, shop_name: t }))} placeholder="e.g. Beirut Boutique" focusColor="#10b981" testID="refer-shop-name-input" />
              <Field label="Phone" required value={form.phone} onChangeText={(t) => setForm(f => ({ ...f, phone: t }))} placeholder="+961 ..." keyboardType="phone-pad" focusColor="#10b981" testID="refer-phone-input" />
              <Field label="Description" value={form.description} onChangeText={(t) => setForm(f => ({ ...f, description: t }))} placeholder="Tell us about the shop and what it sells..." multiline focusColor="#10b981" testID="refer-description-input" />

              {/* logo uploader */}
              <View>
                <Text style={fs.label}>Shop Logo (optional)</Text>
                <TouchableOpacity onPress={pickLogo} activeOpacity={0.8} style={st.logoBox}>
                  {uploadingLogo ? <Spinner size={18} color={colors.textMuted} /> : form.logo ? (
                    <>
                      <Image source={{ uri: img(form.logo) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      <TouchableOpacity onPress={() => setForm(f => ({ ...f, logo: '' }))} style={st.logoRemove}><Ionicons name="close" size={12} color={colors.white} /></TouchableOpacity>
                    </>
                  ) : (
                    <><Ionicons name="image-outline" size={22} color={colors.textMuted} /><Text style={st.logoText}>Tap to upload logo</Text></>
                  )}
                </TouchableOpacity>
              </View>

              {/* Categories chip picker */}
              <View testID="refer-categories-section">
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="pricetag" size={13} color="#059669" />
                    <Text style={fs.label}>Categories</Text>
                  </View>
                  {form.category_ids.length > 0 && (
                    <View style={st.countChip} testID="refer-categories-count"><Text style={st.countChipText}>{form.category_ids.length} selected</Text></View>
                  )}
                </View>
                <Text style={st.catHint}>Select all categories the shop will sell in. Admin can edit later.</Text>
                {allCategories.length === 0 ? (
                  <Text style={st.catEmpty}>No categories available yet.</Text>
                ) : (
                  <>
                    <View style={st.catSearch}>
                      <Ionicons name="search" size={13} color={colors.textMuted} />
                      <TextInput value={categorySearch} onChangeText={setCategorySearch} placeholder="Search categories..."
                        placeholderTextColor={colors.textMuted} style={st.catSearchInput} testID="refer-categories-search" />
                    </View>
                    {filteredCategories.length === 0 ? (
                      <Text style={st.catEmpty} testID="refer-categories-no-results">No categories match "{categorySearch}"</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} testID="refer-categories-chips">
                        {filteredCategories.map(cat => (
                          <Reanimated.View key={cat.id} layout={LinearTransition.springify().damping(18)} entering={FadeIn}>
                            <CategoryChip cat={cat} selected={form.category_ids.includes(cat.id)} onPress={() => toggleCategory(cat.id)} />
                          </Reanimated.View>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>
            </View>

            <View style={st.dashDivider} />

            {/* Section 3: Location */}
            <View style={{ gap: 11 }}>
              <View style={st.sectionHead}>
                <View style={[st.sectionIcon, { backgroundColor: '#dbeafe' }]}><Ionicons name="globe" size={15} color="#2563eb" /></View>
                <Text style={st.sectionTitle}>Location</Text>
              </View>
              <Field label="Address" required value={form.address} onChangeText={(t) => setForm(f => ({ ...f, address: t }))} placeholder="Street, Building, City" focusColor="#3b82f6" testID="refer-address-input" />
              <View>
                <Text style={fs.label}>State/Region *</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {states.map(s => {
                    const on = form.state === s.name;
                    return (
                      <TouchableOpacity key={s.id || s.name} onPress={() => setForm(f => ({ ...f, state: s.name }))}
                        style={[st.stateChip, on && { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }]}>
                        <Text style={[st.stateChipText, on && { color: colors.white }]}>{s.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Submit */}
            <PressScale onPress={onSubmit} disabled={saving}>
              <LinearGradient colors={[colors.p500, '#f06a92']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[st.submitBtn, saving && { opacity: 0.7 }]} testID="refer-submit-btn">
                {saving ? <Spinner size={17} /> : <Ionicons name="arrow-forward" size={17} color={colors.white} />}
                <Text style={st.submitText}>Submit Application</Text>
              </LinearGradient>
            </PressScale>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Ionicons name="shield-checkmark" size={12} color={colors.p500} />
              <Text style={st.submitNote}>Marked as referred by you · Admin reviews within 24-48 hours.</Text>
            </View>
          </View>
        </View>
      </Rise>
    </AgentScreenWrap>
    <FoldAway trigger={fold} onDone={() => setSuccess(true)} />
    </>
  );
}

const st = StyleSheet.create({
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 10 },
  backText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  benefits: { borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.lg, padding: 15, marginTop: 14 },
  giftTile: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  benefitsTitle: { fontFamily: fonts.bold, fontSize: 13, color: '#065f46' },
  benefitsSub: { fontFamily: fonts.body, fontSize: 10.5, color: '#059669', marginTop: 1 },
  benefitPill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: '#d1fae5', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11 },
  benefitText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text },
  formCard: { backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', marginTop: 14, ...shadow.emphasis },
  formHead: { padding: 16 },
  formHeadTile: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  formHeadTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 17 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(139,92,246,0.2)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.4)', alignItems: 'center', justifyContent: 'center' },
  stepDotText: { fontFamily: fonts.bold, fontSize: 10, color: colors.p300 },
  stepLabel: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.medium, fontSize: 10.5 },
  stepConnector: { width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text, letterSpacing: 0.6, textTransform: 'uppercase' },
  dashDivider: { borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: colors.border },
  logoBox: { height: 96, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 5, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  logoRemove: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(15,23,42,0.65)', borderRadius: radius.pill, padding: 5 },
  logoText: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textMuted },
  countChip: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  countChipText: { fontFamily: fonts.bold, fontSize: 9.5, color: '#047857' },
  catHint: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, marginBottom: 9 },
  catEmpty: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, fontStyle: 'italic' },
  catSearch: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 11, marginBottom: 10 },
  catSearchInput: { flex: 1, paddingVertical: 8, fontFamily: fonts.body, fontSize: 12, color: colors.text },
  stateChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: colors.surface },
  stateChipText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  submitBtn: { height: 50, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...agent.fuchsiaGlow },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  submitNote: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  successCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, padding: 24, alignItems: 'center', marginTop: 40, ...shadow.emphasis },
  successIcon: { width: 84, height: 84, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 16, ...agent.fuchsiaGlow },
  successTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, letterSpacing: -0.4 },
  successSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  referAnother: { height: 48, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, ...agent.fuchsiaGlow },
  referAnotherText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 },
  outlineBtn: { height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
});
