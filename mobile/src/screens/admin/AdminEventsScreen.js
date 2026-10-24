import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Animated, Easing, Switch, Modal } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { notifySuccess, tapMedium } from '../../lib/haptics';
import { img } from '../../lib/media';
import { AdminScreen, Shimmer } from '../../components/admin/AdminKit';
import { Seg } from '../../components/admin/GrowthKit';
import { colors, radius, fonts, shadow } from '../../theme/theme';

const ACCENTS = [
  { key: 'from-violet-600 via-fuchsia-600 to-rose-500', label: 'Sunset', c: [colors.p500, '#f06a92', '#f43f5e'] },
  { key: 'from-blue-600 via-indigo-600 to-violet-700', label: 'Twilight', c: ['#2563eb', colors.s500, colors.p800] },
  { key: 'from-emerald-500 via-teal-500 to-cyan-600', label: 'Mint', c: ['#10b981', '#14b8a6', '#0891b2'] },
  { key: 'from-amber-500 via-orange-500 to-rose-600', label: 'Tangerine', c: ['#f59e0b', '#f97316', '#e11d48'] },
  { key: 'from-pink-500 via-rose-500 to-red-500', label: 'Blush', c: ['#ec4899', '#f43f5e', '#ef4444'] },
  { key: 'from-slate-700 via-slate-900 to-black', label: 'Midnight', c: ['#334155', '#0f172a', '#000000'] },
  { key: 'from-sky-400 via-blue-500 to-indigo-600', label: 'Ocean', c: ['#38bdf8', '#3b82f6', colors.s500] },
  { key: 'from-fuchsia-500 via-purple-600 to-indigo-700', label: 'Galaxy', c: ['#ffc0cb', colors.p600, colors.s700] },
];
const accentColors = (key) => (ACCENTS.find((a) => a.key === key) || ACCENTS[0]).c;
const MODES = [
  { value: 'home_banner', label: 'Home Banner', icon: 'images', c: [colors.p450, '#f06a92'] },
  { value: 'center', label: 'Center Popup', icon: 'eye', c: [colors.p450, colors.p400] },
  { value: 'side_fixed', label: 'Side Widget', icon: 'albums', c: ['#3b82f6', '#06b6d4'] },
  { value: 'side_toast', label: 'Side Toast', icon: 'time', c: ['#10b981', '#14b8a6'] },
];
const modeMeta = (m) => ({ center: { l: 'Center Popup', bg: colors.primarySoft, fg: colors.primarySoftText }, side_fixed: { l: 'Side Widget', bg: '#dbeafe', fg: '#1d4ed8' }, side_toast: { l: 'Side Toast', bg: colors.sellerSoft, fg: '#047857' }, home_banner: { l: 'Home Banner', bg: '#fae8ff', fg: '#be3a5c' } }[m] || { l: m, bg: colors.bgAlt, fg: colors.textSecondary });
const EMPTY = { title: '', description: '', image_url: '', cta_text: '', cta_link: '', display_mode: 'center', popup_color: '', banner_subtitle: '', banner_accent_color: ACCENTS[0].key, start_date: '', end_date: '', is_active: true, sponsorship_enabled: false, sponsorship_price_per_day: 2 };

/* confetti burst */
const CONFETTI_COLORS = [colors.p500, '#f06a92', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6'];
function Confetti({ trigger }) {
  const parts = useRef([...Array(26)].map(() => ({ a: new Animated.Value(0), x: (Math.random() - 0.5) * 260, rot: Math.random() * 360, delay: Math.random() * 120, color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)], size: 6 + Math.random() * 6 }))).current;
  useEffect(() => {
    if (!trigger) return;
    parts.forEach((p) => { p.a.setValue(0); Animated.timing(p.a, { toValue: 1, duration: 1100, delay: p.delay, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); });
  }, [trigger]); // eslint-disable-line
  if (!trigger) return null;
  return (
    <View pointerEvents="none" style={styles.confetti}>
      {parts.map((p, i) => (
        <Animated.View key={i} style={{ position: 'absolute', width: p.size, height: p.size * 1.4, borderRadius: 1, backgroundColor: p.color, opacity: p.a.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }), transform: [{ translateX: p.a.interpolate({ inputRange: [0, 1], outputRange: [0, p.x] }) }, { translateY: p.a.interpolate({ inputRange: [0, 1], outputRange: [0, 180] }) }, { rotate: p.a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rot}deg`] }) }] }} />
      ))}
    </View>
  );
}

export default function AdminEventsScreen() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => { api.adminEvents.getAll().then(({ data }) => setEvents(data || [])).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); }); }, []);
  useEffect(() => { load(); }, [load]);

  const toggleActive = async (e) => { setEvents((p) => p.map((x) => x.id === e.id ? { ...x, is_active: !x.is_active } : x)); try { await api.adminEvents.update(e.id, { is_active: !e.is_active }); } catch (_) { load(); } };
  const del = (e) => Alert.alert('Delete event', `Delete "${e.title}"?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.adminEvents.delete(e.id); load(); } catch (_) {} } }]);
  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (e) => { setEditing(e); setDialogOpen(true); };

  const filtered = useMemo(() => tab === 'all' ? events : tab === 'home_banner' ? events.filter((e) => e.display_mode === 'home_banner') : events.filter((e) => e.display_mode !== 'home_banner'), [events, tab]);

  return (
    <AdminScreen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Events & Banners</Text>
          <Text style={styles.subtitle}>Popups, widgets & swipable banners</Text>
        </View>
        <TouchableOpacity onPress={openCreate} activeOpacity={0.9}><LinearGradient colors={[colors.p500, '#f06a92', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.createBtn}><Ionicons name="add" size={16} color={colors.white} /><Text style={styles.createText}>Create</Text></LinearGradient></TouchableOpacity>
      </View>

      <Seg value={tab} onChange={setTab} items={[
        { key: 'all', label: `All (${events.length})`, grad: [colors.p500, '#f06a92'] },
        { key: 'home_banner', label: `Banners (${events.filter((e) => e.display_mode === 'home_banner').length})`, icon: 'images', grad: [colors.p500, '#f06a92'] },
        { key: 'popup', label: `Popups (${events.filter((e) => e.display_mode !== 'home_banner').length})`, icon: 'eye', grad: [colors.p500, '#f06a92'] },
      ]} />

      {loading ? [0, 1].map((i) => <Shimmer key={i} height={150} radius={radius.lg} style={{ marginBottom: 12 }} />)
        : filtered.length === 0 ? <View style={styles.empty}><Ionicons name="calendar-outline" size={38} color={colors.textMuted} /><Text style={styles.emptyText}>No items in this view</Text></View>
        : filtered.map((e) => {
          const meta = modeMeta(e.display_mode); const isBanner = e.display_mode === 'home_banner'; const accent = accentColors(e.banner_accent_color);
          return (
            <View key={e.id} style={[styles.card, !e.is_active && { opacity: 0.6 }]}>
              {isBanner ? (
                <View style={styles.bannerPreview}>
                  <LinearGradient colors={accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                  {e.image_url ? <Image source={{ uri: img(e.image_url) }} style={StyleSheet.absoluteFill} /> : null}
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={StyleSheet.absoluteFill} />
                  <View style={styles.bannerText}><Text style={styles.bannerTag}>HOME BANNER</Text><Text style={styles.bannerTitle} numberOfLines={1}>{e.title}</Text></View>
                </View>
              ) : e.image_url ? <Image source={{ uri: img(e.image_url) }} style={styles.popupImg} /> : null}
              <View style={{ padding: 14 }}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{e.title}</Text>
                  <View style={[styles.modeChip, { backgroundColor: meta.bg }]}><Text style={[styles.modeChipText, { color: meta.fg }]}>{meta.l}</Text></View>
                </View>
                {(e.banner_subtitle || e.description) ? <Text style={styles.cardDesc} numberOfLines={2}>{e.banner_subtitle || e.description}</Text> : null}
                {(e.start_date || e.end_date) ? (
                  <View style={styles.dateBadge}><Ionicons name="time-outline" size={12} color={colors.textMuted} /><Text style={styles.dateText}>{e.start_date}{e.start_date && e.end_date ? ' → ' : ''}{e.end_date}</Text></View>
                ) : null}
                <View style={styles.cardFoot}>
                  <TouchableOpacity onPress={() => toggleActive(e)} style={styles.activeToggle}><Ionicons name={e.is_active ? 'toggle' : 'toggle-outline'} size={20} color={e.is_active ? colors.seller : colors.textMuted} /><Text style={[styles.activeText, { color: e.is_active ? colors.seller : colors.textMuted }]}>{e.is_active ? 'Active' : 'Inactive'}</Text></TouchableOpacity>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <TouchableOpacity onPress={() => openEdit(e)} style={styles.iconBtn}><Ionicons name="create-outline" size={16} color={colors.textSecondary} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => del(e)} style={styles.iconBtn}><Ionicons name="trash-outline" size={16} color={colors.red} /></TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          );
        })}

      <EventDialog open={dialogOpen} editing={editing} onClose={() => setDialogOpen(false)} onDone={load} />
    </AdminScreen>
  );
}

function EventDialog({ open, editing, onClose, onDone }) {
  const insets = useSafeAreaInsets();
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [confetti, setConfetti] = useState(0);
  useEffect(() => { if (open) setF(editing ? { ...EMPTY, ...editing, banner_accent_color: editing.banner_accent_color || ACCENTS[0].key } : EMPTY); }, [open, editing]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const isBanner = f.display_mode === 'home_banner';
  const accent = accentColors(f.banner_accent_color);

  const save = async () => {
    if (!f.title.trim()) return Alert.alert('Title required', 'Enter a title.');
    setBusy(true);
    try {
      const payload = { ...f };
      if (editing) await api.adminEvents.update(editing.id, payload); else await api.adminEvents.create(payload);
      notifySuccess(); onClose(); onDone();
    } catch (_) { Alert.alert('Failed', 'Could not save event.'); } finally { setBusy(false); }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.dlgBackdrop}>
        <View style={[styles.dlg, { paddingBottom: (insets.bottom || 12) }]}>
          <LinearGradient colors={[colors.p500, '#f06a92', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.dlgHead}>
            <Ionicons name="sparkles" size={18} color={colors.white} />
            <Text style={styles.dlgTitle}>{editing ? 'Edit Event' : 'Create New'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.dlgClose}><Ionicons name="close" size={20} color={colors.white} /></TouchableOpacity>
          </LinearGradient>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.fLabel}>Display Mode</Text>
            <View style={styles.modeGrid}>
              {MODES.map((m) => {
                const sel = f.display_mode === m.value;
                return (
                  <TouchableOpacity key={m.value} onPress={() => set('display_mode', m.value)} style={[styles.modeBtn, sel && { borderColor: 'transparent' }]} activeOpacity={0.85}>
                    {sel ? <LinearGradient colors={m.c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
                    <Ionicons name={m.icon} size={18} color={sel ? colors.white : colors.textMuted} />
                    <Text style={[styles.modeBtnText, sel && { color: colors.white }]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fLabel}>Title *</Text>
            <TextInput style={styles.input} value={f.title} onChangeText={(v) => set('title', v)} placeholder="e.g. Summer Sale 2026" placeholderTextColor={colors.textMuted} />

            {isBanner ? (
              <>
                <Text style={styles.fLabel}>Subtitle</Text>
                <TextInput style={styles.input} value={f.banner_subtitle} onChangeText={(v) => set('banner_subtitle', v)} placeholder="Up to 50% off — limited time" placeholderTextColor={colors.textMuted} />
                <Text style={styles.fLabel}>Banner Image URL (optional)</Text>
                <TextInput style={styles.input} value={f.image_url} onChangeText={(v) => set('image_url', v)} placeholder="https://…" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
                <Text style={styles.fLabel}>Accent Gradient</Text>
                <View style={styles.accentGrid}>
                  {ACCENTS.map((a) => (
                    <TouchableOpacity key={a.key} onPress={() => set('banner_accent_color', a.key)} style={[styles.accent, f.banner_accent_color === a.key && styles.accentSel]} activeOpacity={0.85}>
                      <LinearGradient colors={a.c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                      <Text style={styles.accentLabel}>{a.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.fLabel}>CTA Text</Text>
                <TextInput style={styles.input} value={f.cta_text} onChangeText={(v) => set('cta_text', v)} placeholder="Shop Summer" placeholderTextColor={colors.textMuted} />
                <View style={styles.toggleCard}>
                  <View style={{ flex: 1 }}><Text style={styles.toggleTitle}>Banner Sponsorship</Text><Text style={styles.toggleDesc}>Let shops pay to be featured</Text></View>
                  <Switch value={f.sponsorship_enabled} onValueChange={(v) => set('sponsorship_enabled', v)} trackColor={{ true: colors.amber, false: colors.border }} thumbColor={colors.white} />
                </View>
                {f.sponsorship_enabled ? (<><Text style={styles.fLabel}>Price per Day ($)</Text><TextInput style={styles.input} value={String(f.sponsorship_price_per_day)} onChangeText={(v) => set('sponsorship_price_per_day', parseFloat(v) || 0)} keyboardType="numeric" placeholderTextColor={colors.textMuted} /></>) : null}
              </>
            ) : (
              <>
                <Text style={styles.fLabel}>Description</Text>
                <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} multiline value={f.description} onChangeText={(v) => set('description', v)} placeholder="Describe the event…" placeholderTextColor={colors.textMuted} />
                <Text style={styles.fLabel}>Image URL</Text>
                <TextInput style={styles.input} value={f.image_url} onChangeText={(v) => set('image_url', v)} placeholder="https://…" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}><Text style={styles.fLabel}>Button Text</Text><TextInput style={styles.input} value={f.cta_text} onChangeText={(v) => set('cta_text', v)} placeholder="Shop Now" placeholderTextColor={colors.textMuted} /></View>
                  <View style={{ flex: 1 }}><Text style={styles.fLabel}>Button Link</Text><TextInput style={styles.input} value={f.cta_link} onChangeText={(v) => set('cta_link', v)} placeholder="/products" placeholderTextColor={colors.textMuted} autoCapitalize="none" /></View>
                </View>
                <Text style={styles.fLabel}>Popup Accent Color (hex)</Text>
                <TextInput style={styles.input} value={f.popup_color} onChangeText={(v) => set('popup_color', v)} placeholder={colors.p500} placeholderTextColor={colors.textMuted} autoCapitalize="none" />
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Text style={styles.fLabel}>Start Date</Text><TextInput style={styles.input} value={f.start_date} onChangeText={(v) => set('start_date', v)} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} /></View>
              <View style={{ flex: 1 }}><Text style={styles.fLabel}>End Date</Text><TextInput style={styles.input} value={f.end_date} onChangeText={(v) => set('end_date', v)} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} /></View>
            </View>
            <View style={styles.toggleCard}><View style={{ flex: 1 }}><Text style={styles.toggleTitle}>Active</Text><Text style={styles.toggleDesc}>{isBanner ? 'Banner shown to visitors' : 'Event shown to users'}</Text></View><Switch value={f.is_active} onValueChange={(v) => set('is_active', v)} trackColor={{ true: colors.seller, false: colors.border }} thumbColor={colors.white} /></View>

            {/* live preview in phone frame + confetti */}
            {f.title ? (
              <>
                <View style={styles.previewHead}><Text style={styles.previewLabel}>LIVE PREVIEW</Text><TouchableOpacity onPress={() => { setConfetti((c) => c + 1); tapMedium(); }} style={styles.confettiBtn}><Ionicons name="sparkles" size={13} color={colors.violet} /><Text style={styles.confettiText}>Test 🎉</Text></TouchableOpacity></View>
                <View style={styles.phoneFrame}>
                  <View style={styles.phoneNotch} />
                  {isBanner ? (
                    <View style={styles.pvBanner}>
                      <LinearGradient colors={accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                      {f.image_url ? <Image source={{ uri: img(f.image_url) }} style={StyleSheet.absoluteFill} /> : null}
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={StyleSheet.absoluteFill} />
                      <View style={styles.pvBannerText}>
                        <View style={styles.pvFeatured}><Ionicons name="sparkles" size={9} color={colors.white} /><Text style={styles.pvFeaturedText}>Featured</Text></View>
                        <Text style={styles.pvBannerTitle} numberOfLines={1}>{f.title}</Text>
                        {f.banner_subtitle ? <Text style={styles.pvBannerSub} numberOfLines={2}>{f.banner_subtitle}</Text> : null}
                        {f.cta_text ? <View style={styles.pvCta}><Text style={styles.pvCtaText}>{f.cta_text}</Text></View> : null}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.pvPopup}>
                      {f.image_url ? <Image source={{ uri: img(f.image_url) }} style={styles.pvPopupImg} /> : null}
                      <View style={[styles.pvPopupBody, { borderTopColor: f.popup_color || colors.violet, borderTopWidth: 3 }]}>
                        <Text style={styles.pvPopupTitle}>{f.title}</Text>
                        {f.description ? <Text style={styles.pvPopupDesc} numberOfLines={2}>{f.description}</Text> : null}
                        {f.cta_text ? <View style={[styles.pvPopupBtn, { backgroundColor: f.popup_color || colors.violet }]}><Text style={styles.pvPopupBtnText}>{f.cta_text}</Text></View> : null}
                      </View>
                    </View>
                  )}
                  <Confetti trigger={confetti} />
                </View>
              </>
            ) : null}

            <TouchableOpacity onPress={save} disabled={busy} activeOpacity={0.9}><LinearGradient colors={[colors.p500, '#f06a92', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.dlgSave}><Ionicons name={busy ? 'sync' : 'save'} size={16} color={colors.white} /><Text style={styles.dlgSaveText}>{busy ? 'Saving…' : editing ? 'Update' : 'Create'}</Text></LinearGradient></TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  title: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.ink, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, ...shadow.card },
  createText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', marginBottom: 12, ...shadow.card },
  bannerPreview: { height: 110, justifyContent: 'flex-end' },
  bannerText: { padding: 12 },
  bannerTag: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.bold, fontSize: 8, letterSpacing: 0.5 },
  bannerTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 18, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  popupImg: { width: '100%', height: 110 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  modeChip: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  modeChipText: { fontFamily: fonts.bold, fontSize: 9 },
  cardDesc: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 6 },
  dateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  dateText: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight },
  activeToggle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  activeText: { fontFamily: fonts.semibold, fontSize: 12 },
  iconBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dlgBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  dlg: { maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  dlgHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 16 },
  dlgTitle: { flex: 1, color: colors.white, fontFamily: fonts.extrabold, fontSize: 17 },
  dlgClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  fLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 46, fontFamily: fonts.body, fontSize: 14, color: colors.ink, marginBottom: 10 },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  modeBtn: { width: '47%', flexGrow: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, overflow: 'hidden' },
  modeBtnText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted },
  accentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  accent: { width: '22%', flexGrow: 1, height: 42, borderRadius: 10, overflow: 'hidden', justifyContent: 'flex-end', padding: 4, borderWidth: 2, borderColor: 'transparent' },
  accentSel: { borderColor: colors.violet },
  accentLabel: { color: colors.white, fontFamily: fonts.bold, fontSize: 8, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2 },
  toggleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, padding: 12, marginTop: 4, marginBottom: 6 },
  toggleTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  toggleDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  previewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 8 },
  previewLabel: { fontFamily: fonts.bold, fontSize: 10, color: colors.violet, letterSpacing: 1 },
  confettiBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  confettiText: { fontFamily: fonts.bold, fontSize: 11, color: colors.violet },
  phoneFrame: { borderWidth: 6, borderColor: '#1e293b', borderRadius: 28, overflow: 'hidden', backgroundColor: colors.surfaceMuted, paddingTop: 16, minHeight: 180 },
  phoneNotch: { position: 'absolute', top: 0, alignSelf: 'center', width: 90, height: 16, backgroundColor: '#1e293b', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, zIndex: 2 },
  pvBanner: { height: 150, margin: 10, borderRadius: 14, overflow: 'hidden', justifyContent: 'center' },
  pvBannerText: { padding: 14 },
  pvFeatured: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
  pvFeaturedText: { color: colors.white, fontFamily: fonts.bold, fontSize: 8, textTransform: 'uppercase' },
  pvBannerTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 18, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  pvBannerSub: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.body, fontSize: 11, marginTop: 3 },
  pvCta: { alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8 },
  pvCtaText: { fontFamily: fonts.bold, fontSize: 10, color: colors.ink },
  pvPopup: { margin: 14, backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden', ...shadow.card },
  pvPopupImg: { width: '100%', height: 90 },
  pvPopupBody: { padding: 12 },
  pvPopupTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  pvPopupDesc: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 4 },
  pvPopupBtn: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginTop: 8 },
  pvPopupBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 11 },
  confetti: { position: 'absolute', top: 40, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  dlgSave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.md, marginTop: 16 },
  dlgSaveText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
});
