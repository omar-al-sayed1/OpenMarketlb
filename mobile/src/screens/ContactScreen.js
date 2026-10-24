import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { pickImage } from '../lib/imagePick';
import { api } from '../lib/api';
import { colors, gradients, fonts, radius, shadow } from '../theme/theme';
import { Input } from '../components/ui';
import EndOfPagePromos from '../components/EndOfPagePromos';

const PH = '#94a3b8';

// Message types — mirrors the web ContactPage MESSAGE_TYPES.
const MSG_TYPES = [
  { value: 'general', label: 'General Inquiry', icon: 'help-circle', tint: colors.p600, active: colors.p600 },
  { value: 'bug', label: 'Report a Bug', icon: 'bug', tint: '#dc2626', active: '#dc2626' },
  { value: 'suggestion', label: 'Suggestion', icon: 'bulb', tint: '#d97706', active: '#d97706' },
  { value: 'complaint', label: 'Complaint', icon: 'warning', tint: '#ea580c', active: '#ea580c' },
  { value: 'partnership', label: 'Partnership', icon: 'people', tint: '#059669', active: '#059669' },
];

const INFO_CARDS = [
  { key: 'email', label: 'Email', icon: 'mail', grad: [colors.p400, colors.s500] },
  { key: 'phone', label: 'Phone', icon: 'call', grad: ['#34d399', '#14b8a6'] },
  { key: 'location', label: 'Location', icon: 'location', grad: ['#60a5fa', '#22d3ee'] },
];

const FEATURES = [
  { icon: 'time', title: 'Fast Response', desc: 'We reply within 24 hours', grad: ['#3b82f6', '#06b6d4'] },
  { icon: 'heart', title: 'Customer First', desc: 'Your satisfaction matters', grad: ['#ec4899', '#f43f5e'] },
  { icon: 'shield-checkmark', title: 'Secure & Private', desc: 'Your data is safe with us', grad: ['#10b981', '#14b8a6'] },
  { icon: 'globe', title: 'Lebanon-wide', desc: 'Supporting all regions', grad: [colors.p500, colors.s600] },
];

export default function ContactScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone_number: '', message: '', message_type: 'general', photo: '' });
  const [photo, setPhoto] = useState(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nearEnd, setNearEnd] = useState(0); // reveals more recommended cards as the page nears the bottom
  const nearAt = useRef(0);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  // Throttled to ~2×/sec so scrolling near the bottom doesn't re-render on every frame.
  const onPageScroll = (e) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 700) {
      const now = Date.now();
      if (now - nearAt.current > 500) { nearAt.current = now; setNearEnd((n) => n + 1); }
    }
  };

  useEffect(() => { api.settings.get().then(({ data }) => setSettings(data)).catch(() => {}); }, []);

  const pickPhoto = async () => {
    try {
      const res = await pickImage({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      if (!res.canceled && res.assets?.length) setPhoto(res.assets[0]);
    } catch (_) {}
  };

  const submit = async () => {
    if (!form.name || !form.email || !form.phone_number || !form.message) return;
    setBusy(true);
    let photoUrl = '';
    if (photo) { try { const { data } = await api.shop.uploadFile({ uri: photo.uri, name: photo.fileName || 'screenshot.jpg', mimeType: photo.mimeType }); photoUrl = data.url; } catch (_) {} }
    try { await api.contact.send({ ...form, photo: photoUrl }); setSent(true); } catch (_) {} finally { setBusy(false); }
  };

  const infoValue = (key) => {
    if (key === 'email') return settings?.contact_email || 'contact@openmarketlb.com';
    if (key === 'phone') return settings?.contact_phone || '12-345-6789';
    return 'Lebanon';
  };

  if (sent) {
    return (
      <View style={[s.successWrap, { paddingTop: insets.top }]}>
        <View style={s.successRing}><Ionicons name="checkmark-circle" size={56} color="#10b981" /></View>
        <Text style={s.successTitle}>Message Sent!</Text>
        <Text style={s.successSub}>Thanks for reaching out. We'll get back to you within 24 hours.</Text>
        <View style={s.successBtns}>
          <TouchableOpacity style={s.successOutline} onPress={() => { setSent(false); setPhoto(null); setForm({ name: '', email: '', phone_number: '', message: '', message_type: 'general', photo: '' }); }}>
            <Text style={s.successOutlineText}>Send Another</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Root')}>
            <LinearGradient colors={[colors.p500, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.successCta}>
              <Text style={s.successCtaText}>Browse Products</Text><Ionicons name="arrow-forward" size={15} color={colors.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 + insets.bottom }} onScroll={onPageScroll} scrollEventThrottle={16}>
        {/* ===== Hero ===== */}
        <LinearGradient colors={[colors.p600, colors.p500, colors.s700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: insets.top + 8 }]}>
          <View style={[s.blob, { top: 30, left: -30, backgroundColor: 'rgba(236,72,153,0.22)' }]} />
          <View style={[s.blob, { bottom: -20, right: -40, width: 220, height: 220, backgroundColor: 'rgba(59,130,246,0.20)' }]} />

          <TouchableOpacity style={s.back} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </TouchableOpacity>

          <View style={s.badge}><Ionicons name="sparkles" size={13} color={colors.white} /><Text style={s.badgeText}>We'd love to hear from you</Text></View>
          <Text style={s.h1} testID="contact-page-title">Get in <Text style={s.h1Accent}>Touch</Text></Text>
          <Text style={s.heroPara}>Have a question, idea, or just want to say hello? We're here and ready to help you.</Text>

          <View style={s.infoCards} testID="contact-info-header">
            {INFO_CARDS.map((c) => (
              <View key={c.key} style={s.infoCard}>
                <LinearGradient colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.infoIcon}><Ionicons name={c.icon} size={20} color={colors.white} /></LinearGradient>
                <Text style={s.infoLabel}>{c.label}</Text>
                <Text style={s.infoValue} numberOfLines={1}>{infoValue(c.key)}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* ===== Form card ===== */}
        <View style={s.formWrap}>
          <View style={s.card} testID="contact-form">
            <LinearGradient colors={[colors.surfaceMuted, colors.p50]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cardHead}>
              <LinearGradient colors={[colors.p500, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cardHeadTile}><Ionicons name="chatbubble-ellipses" size={18} color={colors.white} /></LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Send us a Message</Text>
                <Text style={s.cardSub}>Fill in the form and we'll respond as soon as possible</Text>
              </View>
            </LinearGradient>

            <View style={s.cardBody}>
              <Text style={s.fieldLabel}>What's this about?</Text>
              <View style={s.typeRow}>
                {MSG_TYPES.map((t) => {
                  const on = form.message_type === t.value;
                  return (
                    <TouchableOpacity key={t.value} onPress={() => set('message_type', t.value)} activeOpacity={0.85}
                      style={[s.typePill, on ? { backgroundColor: t.active, borderColor: 'transparent' } : { backgroundColor: `${t.tint}14`, borderColor: `${t.tint}55` }]} testID={`msg-type-${t.value}`}>
                      <Ionicons name={t.icon} size={13} color={on ? colors.white : t.tint} />
                      <Text style={[s.typePillText, { color: on ? colors.white : t.tint }]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[s.twoCol, { marginBottom: 10 }]}>
                <Input label="Your Name *" containerStyle={{ flex: 1 }} icon="person-outline" placeholder="John Doe" value={form.name} onChangeText={(v) => set('name', v)} testID="contact-name-input" />
                <Input label="Your Email *" containerStyle={{ flex: 1 }} icon="mail-outline" placeholder="john@example.com" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={(v) => set('email', v)} testID="contact-email-input" />
              </View>

              <Input label="Phone Number *" containerStyle={{ marginBottom: 10 }} icon="call-outline" placeholder="+961 XX XXX XXX" keyboardType="phone-pad" value={form.phone_number} onChangeText={(v) => set('phone_number', v)} testID="contact-phone-input" />

              <Input label="Your Message *" containerStyle={{ marginBottom: 6 }} icon="chatbubble-ellipses-outline" multiline placeholder="Tell us what's on your mind..." value={form.message} onChangeText={(v) => set('message', v)} testID="contact-message-input" />

              <TouchableOpacity style={s.attach} activeOpacity={0.85} onPress={pickPhoto}>
                {photo ? <Image source={{ uri: photo.uri }} style={s.attachThumb} /> : <View style={s.attachIcon}><Ionicons name="image-outline" size={18} color={PH} /></View>}
                <Text style={s.attachText}>{photo ? 'Screenshot attached · tap to change' : 'Attach a screenshot (optional)'}</Text>
                {photo ? <TouchableOpacity onPress={() => setPhoto(null)}><Ionicons name="close-circle" size={18} color={PH} /></TouchableOpacity> : null}
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.9} onPress={submit} disabled={busy} style={{ marginTop: 8 }} testID="send-message-button">
                <LinearGradient colors={[colors.p500, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.submit}>
                  {busy ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="send" size={16} color={colors.white} /><Text style={s.submitText}>Send Message</Text></>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* ===== Feature cards ===== */}
          <View style={s.featureGrid}>
            {FEATURES.map((f) => (
              <View key={f.title} style={s.featureCard}>
                <LinearGradient colors={f.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.featureIcon}><Ionicons name={f.icon} size={20} color={colors.white} /></LinearGradient>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ===== End-of-page promos ===== */}
        <EndOfPagePromos nearEndSignal={nearEnd} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  // Hero
  hero: { paddingHorizontal: 18, paddingBottom: 30, overflow: 'hidden' },
  blob: { position: 'absolute', width: 180, height: 180, borderRadius: 120 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7, marginTop: 8 },
  badgeText: { color: 'rgba(255,255,255,0.92)', fontFamily: fonts.semibold, fontSize: 12 },
  h1: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 40, letterSpacing: -1, textAlign: 'center', marginTop: 16 },
  h1Accent: { color: colors.accentYellow },
  heroPara: { color: 'rgba(255,255,255,0.72)', fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 12, paddingHorizontal: 6 },
  infoCards: { flexDirection: 'row', gap: 10, marginTop: 24 },
  infoCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: radius.lg, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center' },
  infoIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 8, ...shadow.sm },
  infoLabel: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.body, fontSize: 10, marginBottom: 2 },
  infoValue: { color: colors.white, fontFamily: fonts.semibold, fontSize: 11.5, textAlign: 'center' },

  // Form
  formWrap: { paddingHorizontal: 16, marginTop: -14 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', ...shadow.emphasis },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  cardHeadTile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink },
  cardSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  cardBody: { padding: 16 },
  fieldLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, marginBottom: 7, marginTop: 4 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  typePillText: { fontFamily: fonts.semibold, fontSize: 12 },
  twoCol: { flexDirection: 'row', gap: 12 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 48, fontFamily: fonts.body, fontSize: 14, color: colors.text, marginBottom: 8 },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.md, padding: 12, marginTop: 4 },
  attachIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  attachThumb: { width: 34, height: 34, borderRadius: 9 },
  attachText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: radius.md },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },

  // Feature cards
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  featureCard: { width: '47.8%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 14, alignItems: 'center', ...shadow.card },
  featureIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  featureTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, marginBottom: 2 },
  featureDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, textAlign: 'center' },

  // Promo sections
  promoSection: { marginTop: 22, paddingHorizontal: 16 },
  promoHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  promoTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promoTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.p700 },
  promoSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  adBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  adBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: '#b45309' },
  forYouBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.p50, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  forYouText: { fontFamily: fonts.bold, fontSize: 10, color: colors.p800 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  cell: { width: '50%', paddingHorizontal: 5, marginBottom: 10 },

  // Success
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, paddingHorizontal: 32 },
  successRing: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.ink, marginBottom: 8 },
  successSub: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  successBtns: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  successOutline: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 12 },
  successOutlineText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  successCta: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 12 },
  successCtaText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
});
