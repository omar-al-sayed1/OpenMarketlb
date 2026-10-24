import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, Image, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { pickImage } from '../../lib/imagePick';
import { brandRefresh } from '../../components/BrandRefresh';
import { api } from '../../lib/api';
import { notifySuccess, notifyError, tapLight } from '../../lib/haptics';
import { img } from '../../lib/media';
import { Shimmer } from '../../components/admin/AdminKit';
import { colors, radius, fonts, shadow } from '../../theme/theme';
import { applyBrandColors } from '../../theme/theme';
import { Input } from '../../components/ui';

/* ---- default-on toggle helper ---- */
const on = (v) => v !== false;
/* ---- valid #rgb / #rrggbb hex (guards LinearGradient from partial input) ---- */
const isHex = (v) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v || '').trim());

const PLATFORM_DEFAULTS = {
  subscription_price: 29, trial_days: 7, card_subscription_enabled: true, card_payment_enabled: true,
  otp_verification_enabled: true, logo_url: '', instagram_url: '', facebook_url: '',
  shop_cashback_percent: 50, promotion_enabled: true, promotion_daily_price: 3, promotion_max_slots_per_page: 4,
  email_campaigns_enabled: true, email_price_per_email: 0.05, ppc_campaigns_enabled: true, ppc_price_per_click: 0.05, ppc_min_wallet_to_start: 5,
  banner_campaigns_enabled: true, event_sponsorship_default_price: 2, shop_welcome_wallet_bonus: 2, shop_welcome_sponsor_count: 2,
  variant_color_enabled: true, variant_size_enabled: true, variant_shape_enabled: true, variant_type_enabled: true,
  available_delivery: true, sponsored_strategy: 'interleave', sponsored_density: 3, sponsored_master_enabled: true,
  sponsored_placement_products: true, sponsored_placement_product_detail: true, sponsored_placement_cart_checkout: true,
  sponsored_placement_category_band: true, sponsored_placement_shop_public: true,
  dark_mode_enabled: true, language_toggle_enabled: true, primary_color: '#3bf4fb', secondary_color: '#caff8a',
};

const NAV = [
  { id: 'profile', label: 'Admin Profile', icon: 'person', color: colors.p600, bg: colors.p50 },
  { id: 'contact', label: 'Contact Info', icon: 'mail', color: '#2563eb', bg: '#eff6ff' },
  { id: 'platform', label: 'Platform', icon: 'settings', color: colors.s700, bg: colors.s50 },
  { id: 'brand', label: 'Brand Colors', icon: 'color-palette', color: '#db2777', bg: '#fdf2f8' },
  { id: 'types', label: 'Type Images', icon: 'images', color: '#ea580c', bg: '#fff7ed' },
];

const VARIANTS = [
  { key: 'variant_color_enabled', label: 'Color', icon: '🎨', desc: 'Different colors with photos' },
  { key: 'variant_size_enabled', label: 'Size', icon: '📏', desc: 'XXS, XS, S, M, L, XL… or custom' },
  { key: 'variant_shape_enabled', label: 'Shape', icon: '🔷', desc: 'Round, square, heart, custom…' },
  { key: 'variant_type_enabled', label: 'Type', icon: '📱', desc: 'e.g. Galaxy S24, S24 Ultra…' },
];

const STRATEGIES = [
  { value: 'interleave', label: 'Interleave', desc: '1 sponsored every N products' },
  { value: 'contextual', label: 'Contextual Match', desc: 'Match user filters' },
  { value: 'quality_weighted', label: 'Quality Weighted', desc: 'Rating + views' },
  { value: 'diversity', label: 'Diversity', desc: 'Spread across shops' },
];

const PLACEMENTS = [
  { key: 'sponsored_placement_products', label: 'Products / Search page', desc: '"Sponsored picks" row + interleaved Ad cards' },
  { key: 'sponsored_placement_product_detail', label: 'Product Detail page', desc: '"You may also like" + "Promoted from category"' },
  { key: 'sponsored_placement_cart_checkout', label: 'Cart & Checkout pages', desc: 'Compact "Sponsored add-ons" row' },
  { key: 'sponsored_placement_category_band', label: 'Category landing band', desc: '"Featured in {Category}" band' },
  { key: 'sponsored_placement_shop_public', label: 'Public Shop page', desc: '"Boosted by this shop" + others band' },
];

/* ============ small building blocks ============ */
function Section({ innerRef, onLayout, icon, grad, title, subtitle, children }) {
  return (
    <View ref={innerRef} onLayout={onLayout} style={cs.card}>
      <View style={cs.cardHead}>
        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cs.cardIcon}><Ionicons name={icon} size={18} color={colors.white} /></LinearGradient>
        <View style={{ flex: 1 }}><Text style={cs.cardTitle}>{title}</Text>{subtitle ? <Text style={cs.cardSub}>{subtitle}</Text> : null}</View>
      </View>
      <View style={cs.cardBody}>{children}</View>
    </View>
  );
}

const SubHead = ({ icon, emoji, title }) => (
  <View style={cs.subHead}>
    {emoji ? <Text style={{ fontSize: 15 }}>{emoji}</Text> : <Ionicons name={icon} size={15} color={colors.textSecondary} />}
    <Text style={cs.subHeadText}>{title}</Text>
  </View>
);

const Field = ({ label, hint, ...props }) => (
  <View style={{ marginBottom: 12 }}>
    <Input label={label} {...props} />
    {hint ? <Text style={cs.hint}>{hint}</Text> : null}
  </View>
);

function SwitchRow({ title, desc, value, onValueChange, tint = colors.p500 }) {
  return (
    <View style={cs.switchRow}>
      <View style={{ flex: 1, paddingRight: 10 }}><Text style={cs.switchTitle}>{title}</Text>{desc ? <Text style={cs.switchDesc}>{desc}</Text> : null}</View>
      <Switch value={!!value} onValueChange={(v) => { tapLight(); onValueChange(v); }} trackColor={{ true: tint, false: colors.border }} thumbColor={colors.white} />
    </View>
  );
}

function ToggleCard({ title, desc, value, onValueChange, bg, border, tint }) {
  return (
    <View style={[cs.toggleCard, { backgroundColor: value ? bg : colors.surfaceMuted, borderColor: value ? border : colors.border }]}>
      <View style={{ flex: 1, paddingRight: 10 }}><Text style={cs.toggleTitle}>{title}</Text>{desc ? <Text style={cs.toggleDesc}>{desc}</Text> : null}</View>
      <Switch value={!!value} onValueChange={(v) => { tapLight(); onValueChange(v); }} trackColor={{ true: tint, false: colors.border }} thumbColor={colors.white} />
    </View>
  );
}

export default function AdminSettingsScreen({ navigation }) {
  const [platform, setPlatform] = useState(null);
  const [contact, setContact] = useState({ contact_email: '', contact_phone: '' });
  const [profile, setProfile] = useState({ email: '', old_password: '', new_password: '', confirm_password: '' });
  const [typeImages, setTypeImages] = useState({ men: '', women: '', kids: '' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [savingTypes, setSavingTypes] = useState(false);
  const [uploading, setUploading] = useState('');

  const scrollRef = useRef(null);
  const yMap = useRef({});

  const load = useCallback(async () => {
    const [p, c, me, ti] = await Promise.allSettled([api.admin.getPlatformSettings(), api.settings.get(), api.auth.me(), api.typeImages.get()]);
    setPlatform({ ...PLATFORM_DEFAULTS, ...(p.status === 'fulfilled' ? p.value.data || {} : {}) });
    if (c.status === 'fulfilled') setContact({ contact_email: c.value.data?.contact_email || '', contact_phone: c.value.data?.contact_phone || '' });
    if (me.status === 'fulfilled') setProfile((pr) => ({ ...pr, email: me.value.data?.email || '' }));
    if (ti.status === 'fulfilled') setTypeImages({ men: ti.value.data?.men || '', women: ti.value.data?.women || '', kids: ti.value.data?.kids || '' });
    setLoading(false); setRefreshing(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const setP = (k, v) => setPlatform((s) => ({ ...s, [k]: v }));
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

  const setBrand = (k, v) => {
    const next = { ...platform, [k]: v };
    setPlatform(next);
    // Only feed valid hex to the theme; partial input keeps the last valid color.
    applyBrandColors(isHex(next.primary_color) ? next.primary_color : '#3bf4fb', isHex(next.secondary_color) ? next.secondary_color : '#caff8a');
  };

  const upload = async (slot, setter) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access to upload.');
    const res = await pickImage({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0]; setUploading(slot);
    try {
      const { data } = await api.messages.uploadAttachment({ uri: a.uri, name: a.fileName || `${slot}_${Date.now()}.jpg`, mimeType: a.mimeType || 'image/jpeg' });
      if (data?.url) setter(data.url); else throw new Error();
    } catch (_) { notifyError(); Alert.alert('Upload failed', 'Could not upload the image.'); } finally { setUploading(''); }
  };

  const saveProfile = async () => {
    if (profile.new_password && profile.new_password !== profile.confirm_password) return Alert.alert('Passwords do not match');
    if (profile.new_password && !profile.old_password) return Alert.alert('Enter your current password');
    setSavingProfile(true);
    try {
      const body = {};
      if (profile.email) body.email = profile.email;
      if (profile.new_password) { body.old_password = profile.old_password; body.new_password = profile.new_password; }
      await api.admin.updateProfile(body); notifySuccess();
      setProfile((pr) => ({ ...pr, old_password: '', new_password: '', confirm_password: '' }));
      Alert.alert('Done', 'Profile updated.');
    } catch (e) { notifyError(); Alert.alert('Failed', e?.response?.data?.detail || 'Could not update profile.'); } finally { setSavingProfile(false); }
  };
  const saveContact = async () => {
    setSavingContact(true);
    try { await api.admin.updateSettings(contact); notifySuccess(); Alert.alert('Saved', 'Settings updated.'); }
    catch (_) { notifyError(); Alert.alert('Failed', 'Could not save settings.'); } finally { setSavingContact(false); }
  };
  const savePlatform = async () => {
    setSavingPlatform(true);
    try { await api.admin.updatePlatformSettings(platform); notifySuccess(); Alert.alert('Saved', 'Platform settings updated.'); }
    catch (_) { notifyError(); Alert.alert('Failed', 'Could not save platform settings.'); } finally { setSavingPlatform(false); }
  };
  const saveTypes = async () => {
    setSavingTypes(true);
    try { await api.admin.updateTypeImages(typeImages); notifySuccess(); Alert.alert('Saved', 'Type images updated.'); }
    catch (_) { notifyError(); Alert.alert('Failed', 'Could not save type images.'); } finally { setSavingTypes(false); }
  };

  const jump = (id) => { const y = yMap.current[id]; if (y != null && scrollRef.current) scrollRef.current.scrollTo({ y: Math.max(0, y - 10), animated: true }); };
  const onSectionLayout = (id) => (e) => { yMap.current[id] = e.nativeEvent.layout.y; };

  const SaveBtn = ({ onPress, saving, label }) => (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} disabled={saving} style={{ marginTop: 6 }}>
      <LinearGradient colors={[colors.p500, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cs.saveBtn}>
        {saving ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="save" size={16} color={colors.white} /><Text style={cs.saveText}>{label}</Text></>}
      </LinearGradient>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 14 }}>
        <Shimmer height={120} radius={radius.xxl} />
        {[0, 1, 2].map((i) => <Shimmer key={i} height={150} radius={radius.lg} style={{ marginTop: 12 }} />)}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={['#f8fafc', '#ffffff', colors.s50]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 14, paddingBottom: 44 }}
        refreshControl={brandRefresh(refreshing, () => { setRefreshing(true); load(); })}
      >
        {/* ===== Hero ===== */}
        <LinearGradient colors={[colors.p600, colors.s600, '#2563eb']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cs.hero}>
          <View style={[cs.heroBlob, { top: -30, right: -20 }]} />
          <View style={cs.heroRow}>
            <View style={cs.heroIcon}><Ionicons name="settings" size={26} color={colors.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={cs.heroTitle}>Platform Settings</Text>
              <Text style={cs.heroSub}>Configure your marketplace, content & integrations</Text>
            </View>
          </View>
          <View style={cs.heroPill}><View style={cs.heroDot} /><Text style={cs.heroPillText}>All systems operational</Text></View>
        </LinearGradient>

        {/* ===== Section nav ===== */}
        <View style={cs.navGrid}>
          {NAV.map((n) => (
            <TouchableOpacity key={n.id} style={cs.navChip} activeOpacity={0.85} onPress={() => jump(n.id)}>
              <View style={[cs.navIcon, { backgroundColor: n.bg }]}><Ionicons name={n.icon} size={15} color={n.color} /></View>
              <Text style={cs.navLabel} numberOfLines={1}>{n.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ===== Admin Profile ===== */}
        <Section onLayout={onSectionLayout('profile')} icon="person" grad={[colors.p500, colors.s600]} title="Admin Profile" subtitle="Manage your administrator account">
          <Field label="Email" value={profile.email} onChangeText={(v) => setProfile((p) => ({ ...p, email: v }))} keyboardType="email-address" autoCapitalize="none" placeholder="admin@openmarket.lb" />
          <SubHead icon="lock-closed" title="Change Password" />
          <Field label="Current Password" value={profile.old_password} onChangeText={(v) => setProfile((p) => ({ ...p, old_password: v }))} secureTextEntry placeholder="Enter current password" />
          <Field label="New Password" value={profile.new_password} onChangeText={(v) => setProfile((p) => ({ ...p, new_password: v }))} secureTextEntry placeholder="Enter new password" />
          <Field label="Confirm New Password" value={profile.confirm_password} onChangeText={(v) => setProfile((p) => ({ ...p, confirm_password: v }))} secureTextEntry placeholder="Confirm new password" />
          <SaveBtn onPress={saveProfile} saving={savingProfile} label="Update Profile" />
        </Section>

        {/* ===== Contact Information ===== */}
        <Section onLayout={onSectionLayout('contact')} icon="mail" grad={['#3b82f6', '#06b6d4']} title="Contact Information" subtitle="How customers can reach your platform">
          <Field label="Contact Email *" value={contact.contact_email} onChangeText={(v) => setContact((c) => ({ ...c, contact_email: v }))} keyboardType="email-address" autoCapitalize="none" placeholder="hello@openmarket.lb" />
          <Field label="Contact Phone *" value={contact.contact_phone} onChangeText={(v) => setContact((c) => ({ ...c, contact_phone: v }))} keyboardType="phone-pad" placeholder="12-345-6789" />
          <SaveBtn onPress={saveContact} saving={savingContact} label="Save Settings" />
        </Section>

        {/* ===== Platform Settings ===== */}
        <Section onLayout={onSectionLayout('platform')} icon="settings" grad={[colors.s600, colors.p600]} title="Platform Settings" subtitle="Subscriptions, payments, OTP & feature toggles">
          {/* Site Logo */}
          <SubHead icon="image" title="Site Logo" />
          <View style={cs.logoRow}>
            <View style={cs.logoPreview}>{platform.logo_url ? <Image source={{ uri: img(platform.logo_url) }} style={cs.logoImg} resizeMode="contain" /> : <Ionicons name="image-outline" size={26} color={colors.textMuted} />}</View>
            <View style={{ flex: 1 }}>
              <TouchableOpacity onPress={() => upload('logo', (u) => setP('logo_url', u))} disabled={uploading === 'logo'} style={cs.uploadBtn}>
                {uploading === 'logo' ? <ActivityIndicator size="small" color={colors.p600} /> : <Ionicons name="cloud-upload-outline" size={16} color={colors.p600} />}
                <Text style={cs.uploadText}>{uploading === 'logo' ? 'Uploading…' : 'Upload Logo'}</Text>
              </TouchableOpacity>
              <TextInput style={[cs.input, { marginTop: 8 }]} value={platform.logo_url} onChangeText={(v) => setP('logo_url', v)} placeholder="…or paste logo URL" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
            </View>
          </View>
          <Text style={cs.hint}>Leave empty to use the default logo.</Text>

          {/* Social Media */}
          <View style={cs.divider} />
          <SubHead icon="share-social" title="Social Media Links" />
          <Text style={cs.hint}>Shown as icons in the website footer. Leave empty to hide.</Text>
          <View style={cs.socialRow}><Ionicons name="logo-instagram" size={18} color="#e1306c" /><TextInput style={[cs.input, { flex: 1, marginBottom: 0 }]} value={platform.instagram_url} onChangeText={(v) => setP('instagram_url', v)} placeholder="Instagram URL" placeholderTextColor={colors.textMuted} autoCapitalize="none" /></View>
          <View style={cs.socialRow}><Ionicons name="logo-facebook" size={18} color="#1877f2" /><TextInput style={[cs.input, { flex: 1, marginBottom: 0 }]} value={platform.facebook_url} onChangeText={(v) => setP('facebook_url', v)} placeholder="Facebook URL" placeholderTextColor={colors.textMuted} autoCapitalize="none" /></View>

          {/* Trial */}
          <View style={cs.divider} />
          <Field label="Trial Days" value={String(platform.trial_days ?? '')} onChangeText={(v) => setP('trial_days', parseInt(v) || 0)} keyboardType="number-pad" />

          {/* Card payments */}
          <View style={cs.divider} />
          <SubHead icon="card" title="Card Payment Settings" />
          <ToggleCard title="Card Subscription" desc="Allow sellers to pay subscription by card" value={on(platform.card_subscription_enabled)} onValueChange={(v) => setP('card_subscription_enabled', v)} bg="#eff6ff" border="#bfdbfe" tint="#2563eb" />
          <ToggleCard title="Card Payment" desc="Allow customers to pay orders by card" value={on(platform.card_payment_enabled)} onValueChange={(v) => setP('card_payment_enabled', v)} bg="#ecfdf5" border="#a7f3d0" tint="#059669" />

          {/* OTP */}
          <View style={cs.divider} />
          <SubHead icon="lock-closed" title="Phone Verification (OTP)" />
          <ToggleCard title="Enable OTP Verification" desc="WhatsApp OTP required for login & guest checkout" value={on(platform.otp_verification_enabled)} onValueChange={(v) => setP('otp_verification_enabled', v)} bg={colors.p50} border={colors.p200} tint={colors.p500} />

          {/* Promoted products */}
          <View style={cs.divider} />
          <SubHead emoji="📢" title="Promoted Products Settings" />
          <Field label="Shop Cashback (% of commission)" hint="% of the order's commission credited back to the shop's wallet once paid." value={String(platform.shop_cashback_percent ?? '')} onChangeText={(v) => setP('shop_cashback_percent', num(v))} keyboardType="numeric" />
          <SwitchRow title="Enable Product Promotions" desc="Allow shops to boost their products" value={on(platform.promotion_enabled)} onValueChange={(v) => setP('promotion_enabled', v)} tint={colors.amber} />
          {on(platform.promotion_enabled) && (
            <View style={cs.row2}>
              <View style={{ flex: 1 }}><Field label="Daily Price ($)" value={String(platform.promotion_daily_price ?? '')} onChangeText={(v) => setP('promotion_daily_price', num(v))} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Field label="Max Slots/Page" value={String(platform.promotion_max_slots_per_page ?? '')} onChangeText={(v) => setP('promotion_max_slots_per_page', parseInt(v) || 0)} keyboardType="number-pad" /></View>
            </View>
          )}

          {/* Advertising channels */}
          <View style={cs.divider} />
          <SubHead emoji="🚀" title="Advertising Channels & Pricing" />
          <ToggleCard title="📧 Email Campaigns" desc="Shops pay per email delivered" value={on(platform.email_campaigns_enabled)} onValueChange={(v) => setP('email_campaigns_enabled', v)} bg="#ecfdf5" border="#a7f3d0" tint="#059669" />
          <Field label="Price per email ($)" value={String(platform.email_price_per_email ?? '')} onChangeText={(v) => setP('email_price_per_email', num(v))} keyboardType="numeric" />
          <ToggleCard title="🖱️ Pay-Per-Click" desc="Charge only on actual clicks" value={on(platform.ppc_campaigns_enabled)} onValueChange={(v) => setP('ppc_campaigns_enabled', v)} bg={colors.s50} border={colors.s200} tint={colors.s600} />
          <View style={cs.row2}>
            <View style={{ flex: 1 }}><Field label="$/click" value={String(platform.ppc_price_per_click ?? '')} onChangeText={(v) => setP('ppc_price_per_click', num(v))} keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Field label="Min wallet" value={String(platform.ppc_min_wallet_to_start ?? '')} onChangeText={(v) => setP('ppc_min_wallet_to_start', num(v))} keyboardType="numeric" /></View>
          </View>
          <ToggleCard title="🎨 Banner Sponsorship" desc="Home banner / event sponsorship" value={on(platform.banner_campaigns_enabled)} onValueChange={(v) => setP('banner_campaigns_enabled', v)} bg="#fdf4ff" border="#f5d0fe" tint="#c026d3" />
          <Field label="Default $/day" value={String(platform.event_sponsorship_default_price ?? '')} onChangeText={(v) => setP('event_sponsorship_default_price', num(v))} keyboardType="numeric" />

          {/* Welcome bonus */}
          <View style={cs.divider} />
          <SubHead emoji="🎁" title="Shop Welcome Bonus" />
          <View style={cs.row2}>
            <View style={{ flex: 1 }}><Field label="Wallet credit ($)" hint="Set 0 to disable." value={String(platform.shop_welcome_wallet_bonus ?? '')} onChangeText={(v) => setP('shop_welcome_wallet_bonus', num(v))} keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Field label="Free sponsors" hint="Each = 7-day boost." value={String(platform.shop_welcome_sponsor_count ?? '')} onChangeText={(v) => setP('shop_welcome_sponsor_count', parseInt(v) || 0)} keyboardType="number-pad" /></View>
          </View>

          {/* Product variants */}
          <View style={cs.divider} />
          <SubHead emoji="🎨" title="Product Variants" />
          {VARIANTS.map((v) => (
            <ToggleCard key={v.key} title={`${v.icon}  ${v.label}`} desc={v.desc} value={on(platform[v.key])} onValueChange={(val) => setP(v.key, val)} bg={colors.p50} border={colors.p200} tint={colors.p500} />
          ))}

          {/* Delivery availability */}
          <View style={cs.divider} />
          <SubHead emoji="🚚" title="Delivery Availability" />
          <ToggleCard title="Available Delivery" desc="When OFF, delivery is hidden from checkout & shop orders." value={on(platform.available_delivery)} onValueChange={(v) => setP('available_delivery', v)} bg="#fff7ed" border="#fed7aa" tint="#ea580c" />

          {/* Sponsored strategy */}
          <View style={cs.divider} />
          <SubHead emoji="🎯" title="Sponsored Placement Strategy" />
          {STRATEGIES.map((st) => {
            const sel = (platform.sponsored_strategy || 'interleave') === st.value;
            return (
              <TouchableOpacity key={st.value} activeOpacity={0.85} onPress={() => setP('sponsored_strategy', st.value)} style={[cs.optionRow, sel && cs.optionRowOn]}>
                <Ionicons name={sel ? 'radio-button-on' : 'radio-button-off'} size={18} color={sel ? colors.p600 : colors.textMuted} />
                <View style={{ flex: 1 }}><Text style={cs.optionLabel}>{st.label}</Text><Text style={cs.optionDesc}>{st.desc}</Text></View>
              </TouchableOpacity>
            );
          })}
          <Field label="Sponsored Density (every N products)" value={String(platform.sponsored_density ?? '')} onChangeText={(v) => setP('sponsored_density', parseInt(v) || 0)} keyboardType="number-pad" />

          {/* Sponsored placements */}
          <View style={cs.divider} />
          <SubHead emoji="✨" title="Sponsored Placements" />
          <ToggleCard title="Master Switch — All Placements" desc="Turn every sponsored placement on/off" value={on(platform.sponsored_master_enabled)} onValueChange={(v) => setP('sponsored_master_enabled', v)} bg="#fffbeb" border="#fde68a" tint={colors.amber} />
          <View style={{ opacity: on(platform.sponsored_master_enabled) ? 1 : 0.5 }} pointerEvents={on(platform.sponsored_master_enabled) ? 'auto' : 'none'}>
            {PLACEMENTS.map((p) => <SwitchRow key={p.key} title={p.label} desc={p.desc} value={on(platform[p.key])} onValueChange={(v) => setP(p.key, v)} tint={colors.amber} />)}
          </View>

          {/* Feature toggles */}
          <View style={cs.divider} />
          <SubHead emoji="⚙️" title="Feature Toggles" />
          <SwitchRow title="Dark Mode" desc="Allow users to toggle dark mode" value={on(platform.dark_mode_enabled)} onValueChange={(v) => setP('dark_mode_enabled', v)} tint="#334155" />
          <SwitchRow title="Language Toggle (Arabic/English)" desc="Allow users to switch language" value={on(platform.language_toggle_enabled)} onValueChange={(v) => setP('language_toggle_enabled', v)} tint={colors.s600} />

          {/* Tiers link */}
          <View style={cs.divider} />
          <View style={cs.tierRow}>
            <View style={{ flex: 1 }}><Text style={cs.subHeadText}>👑 Subscription Tier Settings</Text><Text style={cs.hint}>Configure plans, pricing, sales & wallet credits</Text></View>
            <TouchableOpacity style={cs.tierBtn} onPress={() => navigation.navigate('AdminSubscriptionTiers')}><Text style={cs.tierBtnText}>Manage →</Text></TouchableOpacity>
          </View>

          <SaveBtn onPress={savePlatform} saving={savingPlatform} label="Save Platform Settings" />
        </Section>

        {/* ===== Brand Colors ===== */}
        <View onLayout={onSectionLayout('brand')} />
        <Section icon="color-palette" grad={['#db2777', colors.p500]} title="Brand Colors" subtitle="Themes the website & mobile app">
          {[{ f: 'primary_color', l: 'Primary', d: '#3bf4fb' }, { f: 'secondary_color', l: 'Secondary', d: '#caff8a' }].map(({ f, l, d }) => {
            const raw = platform[f] ?? '';
            const safe = isHex(raw) ? raw : d; // never hand a partial hex to native views
            return (
              <View key={f} style={{ marginBottom: 14 }}>
                <Text style={cs.label}>{l} color</Text>
                <View style={cs.colorRow}>
                  <View style={[cs.swatch, { backgroundColor: safe }]} />
                  <TextInput style={[cs.input, { flex: 1, marginBottom: 0 }]} value={raw} onChangeText={(v) => setBrand(f, v)} autoCapitalize="characters" placeholder={d} placeholderTextColor={colors.textMuted} />
                  <TouchableOpacity onPress={() => setBrand(f, d)}><Text style={cs.reset}>Reset</Text></TouchableOpacity>
                </View>
              </View>
            );
          })}
          <View style={cs.previewRow}>
            <LinearGradient colors={[isHex(platform.primary_color) ? platform.primary_color : '#3bf4fb', isHex(platform.secondary_color) ? platform.secondary_color : '#caff8a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cs.previewBtn}><Text style={cs.previewBtnText}>Primary button</Text></LinearGradient>
          </View>
          <Text style={cs.hint}>Saved with "Save Platform Settings" above. Applies across both apps.</Text>
        </Section>

        {/* ===== Type Images ===== */}
        <Section onLayout={onSectionLayout('types')} icon="images" grad={['#ec4899', '#f43f5e']} title="Type Images (Men / Women / Kids)" subtitle="Homepage gender section photos">
          {['men', 'women', 'kids'].map((slot) => (
            <View key={slot} style={cs.typeRow}>
              <View style={cs.typePreview}>{typeImages[slot] ? <Image source={{ uri: img(typeImages[slot]) }} style={cs.typeImg} resizeMode="cover" /> : <Ionicons name="image-outline" size={22} color={colors.textMuted} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={cs.typeLabel}>{slot.charAt(0).toUpperCase() + slot.slice(1)}</Text>
                <TouchableOpacity onPress={() => upload(slot, (u) => setTypeImages((t) => ({ ...t, [slot]: u })))} disabled={uploading === slot} style={cs.uploadBtnSm}>
                  {uploading === slot ? <ActivityIndicator size="small" color={colors.p600} /> : <Ionicons name="cloud-upload-outline" size={14} color={colors.p600} />}
                  <Text style={cs.uploadTextSm}>{uploading === slot ? 'Uploading…' : 'Upload'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <SaveBtn onPress={saveTypes} saving={savingTypes} label="Save Type Images" />
        </Section>

        {/* ===== Content editors (managed on web) ===== */}
        <View style={cs.noteCard}>
          <Ionicons name="desktop-outline" size={18} color={colors.textSecondary} />
          <Text style={cs.noteText}>About Us page, Team Members, Testimonials, States & Delivery, and Terms of Service are managed from the web admin dashboard.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const cs = StyleSheet.create({
  hero: { borderRadius: radius.xxl, padding: 20, overflow: 'hidden', ...shadow.emphasis },
  heroBlob: { position: 'absolute', width: 160, height: 160, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 24, letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginTop: 14 },
  heroDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6ee7b7' },
  heroPillText: { color: 'rgba(255,255,255,0.92)', fontFamily: fonts.semibold, fontSize: 11 },

  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 4 },
  navChip: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.lg, padding: 12, ...shadow.card },
  navIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  navLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 12.5, color: colors.text },

  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', marginTop: 14, ...shadow.card },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink },
  cardSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  cardBody: { padding: 16 },

  subHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 2 },
  subHeadText: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 4 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 46, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 16 },
  row2: { flexDirection: 'row', gap: 12 },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },

  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  switchTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  switchDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  toggleCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  toggleTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  toggleDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },

  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, marginBottom: 8, backgroundColor: colors.surface },
  optionRowOn: { borderColor: colors.p400, backgroundColor: colors.p50 },
  optionLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  optionDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },

  logoRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  logoPreview: { width: 72, height: 72, borderRadius: 16, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: '100%', height: '100%' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.p500, borderRadius: radius.md, paddingVertical: 10 },
  uploadText: { fontFamily: fonts.bold, fontSize: 13, color: colors.p600 },
  uploadBtnSm: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: colors.p500, borderRadius: radius.md, paddingVertical: 7, marginTop: 6 },
  uploadTextSm: { fontFamily: fonts.bold, fontSize: 12, color: colors.p600 },

  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  reset: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted, textDecorationLine: 'underline' },
  previewRow: { marginTop: 4, marginBottom: 2 },
  previewBtn: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10 },
  previewBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },

  typeRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12 },
  typePreview: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  typeImg: { width: '100%', height: '100%' },
  typeLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },

  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tierBtn: { backgroundColor: colors.p600, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 9 },
  tierBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12.5 },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.md, marginTop: 8 },
  saveText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },

  noteCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.lg, padding: 14, marginTop: 14 },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
});
