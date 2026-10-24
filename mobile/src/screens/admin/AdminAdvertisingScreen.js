import React, { useEffect, useState, useCallback, useRef } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Animated, Easing, Switch, Modal, Dimensions } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart } from 'react-native-gifted-charts';
import { api } from '../../lib/api';
import { notifySuccess } from '../../lib/haptics';
import { img } from '../../lib/media';
import { AdminScreen, CountUp, Shimmer } from '../../components/admin/AdminKit';
import { Seg } from '../../components/admin/GrowthKit';
import { colors, gradients, radius, fonts, shadow } from '../../theme/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const fmt = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const BAR_COLORS = ['#10b981', colors.s600, '#f59e0b', colors.p450];

/* animated occupancy/utilisation bar */
function OccupancyBar({ pct, color = colors.violet, label }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(w, { toValue: Math.max(0.02, Math.min(1, pct)), duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [pct]); // eslint-disable-line
  return (
    <View style={{ marginTop: 4 }}>
      {label ? <Text style={styles.occLabel}>{label}</Text> : null}
      <View style={styles.occTrack}><Animated.View style={{ height: 8, borderRadius: 4, backgroundColor: color, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} /></View>
    </View>
  );
}

export default function AdminAdvertisingScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState('overview');
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [prices, setPrices] = useState({ ads_enabled: true, email_campaigns_enabled: true, ppc_campaigns_enabled: true, banner_campaigns_enabled: true, email_price_per_email: 0.05, ppc_price_per_click: 0.1, ppc_min_wallet_to_start: 5, event_sponsorship_default_price: 2 });
  const [eventDialog, setEventDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const load = useCallback(async () => {
    const [ov, camp, ev] = await Promise.allSettled([api.adminAds.overview(), api.adminAds.campaigns(), api.adminAds.events()]);
    if (ov.status === 'fulfilled') {
      setOverview(ov.value.data); const s = ov.value.data.settings || {};
      setPrices({ ads_enabled: s.ads_enabled !== false, email_campaigns_enabled: s.email_campaigns_enabled !== false, ppc_campaigns_enabled: s.ppc_campaigns_enabled !== false, banner_campaigns_enabled: s.banner_campaigns_enabled !== false, email_price_per_email: s.email_price_per_email ?? 0.05, ppc_price_per_click: s.ppc_price_per_click ?? 0.1, ppc_min_wallet_to_start: s.ppc_min_wallet_to_start ?? 5, event_sponsorship_default_price: s.event_sponsorship_default_price ?? 2 });
    }
    if (camp.status === 'fulfilled') setCampaigns(camp.value.data?.campaigns || []);
    if (ev.status === 'fulfilled') setEvents(ev.value.data?.events || []);
    setLoading(false); setRefreshing(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const savePrices = async () => { setSaving(true); try { await api.adminAds.updateSettings(prices); notifySuccess(); load(); } catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Could not save.'); } finally { setSaving(false); } };
  const toggleSetting = async (key, v) => { setPrices((p) => ({ ...p, [key]: v })); try { await api.adminAds.updateSettings({ [key]: v }); load(); } catch (_) {} };
  const eventSponsor = async (ev, field, value) => { try { await api.adminAds.updateEventSponsorship(ev.id, { [field]: value }); load(); } catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Failed'); } };
  const removeSponsor = (ev) => Alert.alert('Remove sponsor', `Free the "${ev.title}" banner? (no refund)`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: async () => { try { await api.adminAds.removeEventSponsor(ev.id); load(); } catch (_) {} } }]);
  const delEvent = (ev) => Alert.alert('Delete event', `Delete "${ev.title}"?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.adminEvents.delete(ev.id); load(); } catch (_) {} } }]);

  if (loading) return <AdminScreen><Shimmer height={70} radius={radius.xxl} /><View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>{[0, 1, 2, 3].map((i) => <Shimmer key={i} height={90} radius={radius.lg} style={{ flex: 1 }} />)}</View></AdminScreen>;

  const rev = overview?.revenue || { total: 0, by_type: {} };
  const stats = overview?.stats || {};
  const chartData = [
    { label: 'Email', value: rev.by_type?.email_blast || 0, frontColor: BAR_COLORS[0] },
    { label: 'PPC', value: rev.by_type?.ppc_click || 0, frontColor: BAR_COLORS[1] },
    { label: 'Spons.', value: rev.by_type?.event_sponsorship || 0, frontColor: BAR_COLORS[2] },
    { label: 'Boosts', value: rev.by_type?.product_boost || 0, frontColor: BAR_COLORS[3] },
  ];
  const maxVal = Math.max(...chartData.map((d) => d.value), 1);
  const activePct = stats.total_campaigns ? (stats.active_campaigns || 0) / stats.total_campaigns : 0;
  const filteredCampaigns = campaigns.filter((c) => {
    const matchType = filterType === 'all' || c.type === (filterType === 'email' ? 'blast' : filterType);
    const matchSearch = !search || (c.name || c.subject || '').toLowerCase().includes(search.toLowerCase()) || (c.shop_name || '').toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <AdminScreen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      {/* hero */}
      <LinearGradient colors={[colors.p500, colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroIcon}><Ionicons name="rocket" size={22} color={colors.white} /></View>
        <View style={{ flex: 1 }}><Text style={styles.heroTitle}>Advertising</Text><Text style={styles.heroSub}>Pricing, ad revenue & campaign oversight</Text></View>
        <View style={styles.heroToggle}><View style={[styles.dot, { backgroundColor: prices.ads_enabled ? '#34d399' : '#fb7185' }]} /><Switch value={prices.ads_enabled} onValueChange={(v) => toggleSetting('ads_enabled', v)} trackColor={{ true: '#a7f3d0', false: 'rgba(255,255,255,0.3)' }} thumbColor={colors.white} /></View>
      </LinearGradient>

      {/* KPIs */}
      <View style={styles.kpiRow}>
        <Kpi icon="cash" label="Ad Revenue" value={<CountUp value={rev.total} prefix="$" decimals={2} style={styles.kpiVal} />} />
        <Kpi icon="finger-print" label="Clicks" value={<CountUp value={stats.total_clicks || 0} style={styles.kpiVal} />} />
      </View>
      <View style={styles.kpiRow}>
        <Kpi icon="mail" label="Emails Sent" value={<CountUp value={stats.total_emails_sent || 0} style={styles.kpiVal} />} />
        <Kpi icon="megaphone" label="Campaigns" value={<CountUp value={stats.total_campaigns || 0} style={styles.kpiVal} />} hint={`${stats.active_campaigns || 0} active`} />
      </View>

      <View style={{ height: 4 }} />
      <Seg value={tab} onChange={setTab} items={[
        { key: 'overview', label: 'Revenue', icon: 'bar-chart', grad: gradients.primary },
        { key: 'pricing', label: 'Pricing', icon: 'settings', grad: gradients.primary },
        { key: 'campaigns', label: 'Campaigns', icon: 'megaphone', grad: gradients.primary },
        { key: 'events', label: 'Events', icon: 'calendar', grad: gradients.primary },
      ]} />

      {tab === 'overview' && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ad revenue by type</Text>
            <View style={{ marginTop: 12, alignItems: 'center' }}>
              <BarChart data={chartData} barWidth={34} spacing={22} roundedTop noOfSections={4} maxValue={Math.ceil(maxVal * 1.2)} yAxisThickness={0} xAxisThickness={0} hideRules={false} rulesColor={colors.borderLight} yAxisTextStyle={{ color: colors.textMuted, fontSize: 10 }} xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10 }} height={180} width={SCREEN_W - 90} isAnimated />
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Revenue breakdown</Text>
            {[{ l: 'Email campaigns', ic: 'mail', v: rev.by_type?.email_blast }, { l: 'Pay-per-click', ic: 'finger-print', v: rev.by_type?.ppc_click }, { l: 'Event sponsorship', ic: 'star', v: rev.by_type?.event_sponsorship }, { l: 'Product boosts', ic: 'megaphone', v: rev.by_type?.product_boost }].map((r) => (
              <View key={r.l} style={styles.breakRow}><View style={styles.breakLeft}><Ionicons name={r.ic} size={15} color={colors.violet} /><Text style={styles.breakLabel}>{r.l}</Text></View><Text style={styles.breakVal}>{fmt(r.v)}</Text></View>
            ))}
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.totalRow}><Text style={styles.totalLabel}>Total ad revenue</Text><Text style={styles.totalVal}>{fmt(rev.total)}</Text></LinearGradient>
            <OccupancyBar pct={activePct} color={colors.violet} label={`Active campaign occupancy · ${stats.active_campaigns || 0}/${stats.total_campaigns || 0}`} />
          </View>
        </>
      )}

      {tab === 'pricing' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Advertising pricing</Text>
          <View style={styles.channelRow}>
            <Channel icon="mail" grad={gradients.seller} title="Email" on={prices.email_campaigns_enabled} onToggle={(v) => toggleSetting('email_campaigns_enabled', v)} tint={colors.seller} />
            <Channel icon="finger-print" grad={[colors.s600, colors.p450]} title="PPC" on={prices.ppc_campaigns_enabled} onToggle={(v) => toggleSetting('ppc_campaigns_enabled', v)} tint={colors.s600} />
            <Channel icon="star" grad={['#f59e0b', '#f97316']} title="Banner" on={prices.banner_campaigns_enabled} onToggle={(v) => toggleSetting('banner_campaigns_enabled', v)} tint={colors.amber} />
          </View>
          <PriceField label="Price per email ($)" value={prices.email_price_per_email} onChange={(v) => setPrices((p) => ({ ...p, email_price_per_email: v }))} />
          <PriceField label="Price per click ($)" value={prices.ppc_price_per_click} onChange={(v) => setPrices((p) => ({ ...p, ppc_price_per_click: v }))} />
          <PriceField label="Min wallet to start PPC ($)" value={prices.ppc_min_wallet_to_start} onChange={(v) => setPrices((p) => ({ ...p, ppc_min_wallet_to_start: v }))} />
          <PriceField label="Default event sponsorship price ($)" value={prices.event_sponsorship_default_price} onChange={(v) => setPrices((p) => ({ ...p, event_sponsorship_default_price: v }))} />
          <TouchableOpacity onPress={savePrices} disabled={saving} activeOpacity={0.9}><LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}><Ionicons name={saving ? 'sync' : 'save'} size={16} color={colors.white} /><Text style={styles.saveText}>Save pricing</Text></LinearGradient></TouchableOpacity>
        </View>
      )}

      {tab === 'campaigns' && (
        <View style={styles.card}>
          <View style={styles.searchWrap}><Ionicons name="search" size={15} color={colors.textMuted} /><TextInput style={styles.searchInput} placeholder="Search campaign or shop…" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} /></View>
          <View style={styles.typeRow}>
            {['all', 'email', 'ppc'].map((t) => <TouchableOpacity key={t} onPress={() => setFilterType(t)} style={[styles.typeChip, filterType === t && styles.typeChipActive]}><Text style={[styles.typeChipText, filterType === t && { color: colors.white }]}>{t === 'all' ? 'All' : t.toUpperCase()}</Text></TouchableOpacity>)}
          </View>
          {filteredCampaigns.length === 0 ? <Text style={styles.none}>No campaigns found</Text> : filteredCampaigns.map((c) => (
            <View key={c.id} style={styles.campRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.campName} numberOfLines={1}>{c.name || c.subject}</Text>
                <Text style={styles.campShop} numberOfLines={1}>{c.shop_name}</Text>
                <View style={styles.campMeta}>
                  <View style={[styles.campType, { backgroundColor: c.type === 'ppc' ? colors.s100 : colors.sellerSoft }]}><Text style={[styles.campTypeText, { color: c.type === 'ppc' ? colors.s700 : '#047857' }]}>{c.type === 'ppc' ? 'PPC' : 'Email'}</Text></View>
                  <Text style={styles.campStat}>{c.recipients_count || 0} sent · {c.clicks || 0} clicks</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={styles.revChip}><Text style={styles.revChipText}>{fmt((c.cost_charged || 0) + (c.spend || 0))}</Text></View>
                <Text style={[styles.campStatus, { color: c.status === 'active' ? '#0284c7' : c.status === 'sent' ? '#047857' : colors.textMuted }]}>{c.status}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {tab === 'events' && (
        <View style={styles.card}>
          <View style={styles.evHead}>
            <View style={{ flex: 1 }}><Text style={styles.cardTitle}>Event sponsorship</Text><Text style={styles.evSub}>Home-banner events shops can sponsor</Text></View>
            <TouchableOpacity onPress={() => { setEditingEvent(null); setEventDialog(true); }} activeOpacity={0.9}><LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addEvBtn}><Ionicons name="add" size={15} color={colors.white} /><Text style={styles.addEvText}>Add</Text></LinearGradient></TouchableOpacity>
          </View>
          {events.length === 0 ? <Text style={styles.none}>No home-banner events yet</Text> : events.map((ev) => (
            <View key={ev.id} style={styles.evCard}>
              <View style={styles.evTop}>
                {ev.image_url ? <Image source={{ uri: img(ev.image_url) }} style={styles.evImg} /> : <LinearGradient colors={[colors.p450, '#f06a92']} style={styles.evImg}><Ionicons name="star" size={20} color={colors.white} /></LinearGradient>}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.evTitleRow}><Text style={styles.evTitle} numberOfLines={1}>{ev.title}</Text>{ev.is_reserved ? <View style={styles.reservedChip}><Text style={styles.reservedText}>Reserved</Text></View> : null}</View>
                  {ev.banner_subtitle ? <Text style={styles.evSubtitle} numberOfLines={1}>{ev.banner_subtitle}</Text> : null}
                  <Text style={styles.evStat}>{ev.sponsors_count || 0} sponsors · {fmt(ev.revenue)} lifetime</Text>
                </View>
                <View style={{ gap: 4 }}>
                  <TouchableOpacity onPress={() => { setEditingEvent(ev); setEventDialog(true); }} style={styles.evIconBtn}><Ionicons name="create-outline" size={15} color={colors.textSecondary} /></TouchableOpacity>
                  <TouchableOpacity onPress={() => delEvent(ev)} style={styles.evIconBtn}><Ionicons name="trash-outline" size={15} color={colors.red} /></TouchableOpacity>
                </View>
              </View>
              <View style={styles.evControls}>
                <View style={styles.priceEdit}><Text style={styles.priceEditLabel}>$/day</Text><TextInput style={styles.priceEditInput} defaultValue={String(ev.sponsorship_price_per_day ?? ev.sponsorship_price ?? 2)} keyboardType="numeric" onEndEditing={(e) => { const v = parseFloat(e.nativeEvent.text); if (!isNaN(v)) eventSponsor(ev, 'sponsorship_price_per_day', v); }} /></View>
                <View style={styles.openToggle}><Text style={styles.openLabel}>Open</Text><Switch value={!!ev.sponsorship_enabled} onValueChange={(v) => eventSponsor(ev, 'sponsorship_enabled', v)} trackColor={{ true: colors.seller, false: colors.border }} thumbColor={colors.white} /></View>
              </View>
              {ev.current_sponsor ? (
                <LinearGradient colors={['#ecfdf5', '#f0fdfa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sponsorCard}>
                  {ev.current_sponsor.logo ? <Image source={{ uri: img(ev.current_sponsor.logo) }} style={styles.sponsorLogo} /> : <View style={styles.sponsorLogoFallback}><Text style={styles.sponsorLogoText}>{(ev.current_sponsor.shop_name || '?').charAt(0)}</Text></View>}
                  <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.sponsorTag}>CURRENTLY SPONSORED BY</Text><Text style={styles.sponsorName} numberOfLines={1}>{ev.current_sponsor.shop_name}</Text><Text style={styles.sponsorMeta}>{ev.current_sponsor.days || 1}d · {fmt(ev.current_sponsor.amount || 0)}</Text></View>
                  <TouchableOpacity onPress={() => removeSponsor(ev)} style={styles.removeSponsorBtn}><Text style={styles.removeSponsorText}>Remove</Text></TouchableOpacity>
                </LinearGradient>
              ) : null}
            </View>
          ))}
        </View>
      )}

      <AdEventDialog open={eventDialog} editing={editingEvent} defaultPrice={prices.event_sponsorship_default_price} onClose={() => setEventDialog(false)} onDone={load} />
    </AdminScreen>
  );
}

const Kpi = ({ icon, label, value, hint }) => (
  <View style={styles.kpi}>
    <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.kpiStripe} />
    <View style={styles.kpiIcon}><Ionicons name={icon} size={16} color={colors.violet} /></View>
    {value}
    <Text style={styles.kpiLabel}>{label}</Text>
    {hint ? <Text style={styles.kpiHint}>{hint}</Text> : null}
  </View>
);
const Channel = ({ icon, grad, title, on, onToggle, tint }) => (
  <View style={[styles.channel, { borderColor: on ? tint + '55' : colors.borderLight }]}>
    <LinearGradient colors={grad} style={styles.channelIcon}><Ionicons name={icon} size={15} color={colors.white} /></LinearGradient>
    <Text style={styles.channelTitle}>{title}</Text>
    <Switch value={on} onValueChange={onToggle} trackColor={{ true: tint, false: colors.border }} thumbColor={colors.white} />
  </View>
);
const PriceField = ({ label, value, onChange }) => (
  <View style={{ marginTop: 12 }}>
    <Text style={styles.priceLabel}>{label}</Text>
    <TextInput style={styles.priceInput} value={String(value)} onChangeText={(t) => onChange(parseFloat(t) || 0)} keyboardType="numeric" />
  </View>
);

function AdEventDialog({ open, editing, defaultPrice, onClose, onDone }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [f, setF] = useState({ title: '', banner_subtitle: '', image_url: '', sponsorship_price_per_day: 2, sponsorship_enabled: true, is_active: true });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF(editing ? { title: editing.title || '', banner_subtitle: editing.banner_subtitle || '', image_url: editing.image_url || '', sponsorship_price_per_day: editing.sponsorship_price_per_day ?? editing.sponsorship_price ?? 2, sponsorship_enabled: !!editing.sponsorship_enabled, is_active: editing.is_active !== false } : { title: '', banner_subtitle: '', image_url: '', sponsorship_price_per_day: defaultPrice || 2, sponsorship_enabled: true, is_active: true }); }, [open, editing]); // eslint-disable-line
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.title.trim()) return Alert.alert('Title required', 'Enter a title.');
    setBusy(true);
    try {
      const payload = { ...f, sponsorship_price: parseFloat(f.sponsorship_price_per_day) || 0, sponsorship_price_per_day: parseFloat(f.sponsorship_price_per_day) || 0, display_mode: 'home_banner' };
      if (editing) await api.adminEvents.update(editing.id, payload); else await api.adminEvents.create(payload);
      notifySuccess(); onClose(); onDone();
    } catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Could not save.'); } finally { setBusy(false); }
  };
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.dlgBackdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.dlg, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
        <View style={styles.grabber} />
        <Text style={styles.dlgTitle}><Ionicons name="calendar" size={16} color={colors.violet} /> {editing ? 'Edit Event' : 'Add New Event'}</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          <Text style={styles.fLabel}>Event Photo URL</Text>
          <TextInput style={styles.input} value={f.image_url} onChangeText={(v) => set('image_url', v)} placeholder="https://…" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
          <Text style={styles.fLabel}>Title *</Text>
          <TextInput style={styles.input} value={f.title} onChangeText={(v) => set('title', v)} placeholder="Black Friday Mega Sale" placeholderTextColor={colors.textMuted} />
          <Text style={styles.fLabel}>Subtitle</Text>
          <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} multiline value={f.banner_subtitle} onChangeText={(v) => set('banner_subtitle', v)} placeholder="Up to 70% off across all shops" placeholderTextColor={colors.textMuted} />
          <Text style={styles.fLabel}>Sponsorship Price / Day ($)</Text>
          <TextInput style={[styles.input, { maxWidth: 160 }]} value={String(f.sponsorship_price_per_day)} onChangeText={(v) => set('sponsorship_price_per_day', v)} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
          <View style={styles.dlgToggle}><View style={{ flex: 1 }}><Text style={styles.dlgToggleTitle}>Open for sponsorship</Text><Text style={styles.dlgToggleDesc}>Allow shops to buy this banner</Text></View><Switch value={f.sponsorship_enabled} onValueChange={(v) => set('sponsorship_enabled', v)} trackColor={{ true: colors.seller, false: colors.border }} thumbColor={colors.white} /></View>
          <View style={styles.dlgToggle}><View style={{ flex: 1 }}><Text style={styles.dlgToggleTitle}>Active</Text><Text style={styles.dlgToggleDesc}>Show on the home banner</Text></View><Switch value={f.is_active} onValueChange={(v) => set('is_active', v)} trackColor={{ true: colors.violet, false: colors.border }} thumbColor={colors.white} /></View>
        </ScrollView>
        <TouchableOpacity onPress={save} disabled={busy} activeOpacity={0.9}><LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}><Ionicons name={busy ? 'sync' : 'save'} size={16} color={colors.white} /><Text style={styles.saveText}>{editing ? 'Save Changes' : 'Create Event'}</Text></LinearGradient></TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.xxl, padding: 16, marginBottom: 12, ...shadow.violetGlow },
  heroIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 11, marginTop: 1 },
  heroToggle: { alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpi: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 14, paddingTop: 16, overflow: 'hidden', ...shadow.card },
  kpiStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiVal: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink, letterSpacing: -0.5 },
  kpiLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  kpiHint: { fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 14, marginBottom: 12, ...shadow.card },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
  breakRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8 },
  breakLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  breakVal: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, marginTop: 10 },
  totalLabel: { color: colors.white, fontFamily: fonts.semibold, fontSize: 13 },
  totalVal: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 17 },
  occLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 12, marginBottom: 6 },
  occTrack: { height: 8, borderRadius: 4, backgroundColor: colors.bgAlt, overflow: 'hidden' },
  channelRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  channel: { flex: 1, alignItems: 'center', gap: 6, borderWidth: 2, borderRadius: radius.md, padding: 10 },
  channelIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  channelTitle: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  priceLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  priceInput: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 44, fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.md, marginTop: 16 },
  saveText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink, paddingVertical: 0 },
  typeRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 4 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.bgAlt },
  typeChipActive: { backgroundColor: colors.violet },
  typeChipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary },
  none: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 16 },
  campRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  campName: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  campShop: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  campMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  campType: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  campTypeText: { fontFamily: fonts.bold, fontSize: 9 },
  campStat: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  revChip: { backgroundColor: colors.sellerSoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  revChipText: { fontFamily: fonts.extrabold, fontSize: 12, color: '#047857' },
  campStatus: { fontFamily: fonts.bold, fontSize: 10, textTransform: 'capitalize' },
  evHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  evSub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  addEvBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  addEvText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
  evCard: { borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.md, padding: 12, marginTop: 10 },
  evTop: { flexDirection: 'row', gap: 10 },
  evImg: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgAlt },
  evTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  evTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, flexShrink: 1 },
  reservedChip: { backgroundColor: '#fef3c7', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  reservedText: { fontFamily: fonts.bold, fontSize: 9, color: '#b45309' },
  evSubtitle: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  evStat: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary, marginTop: 3 },
  evIconBtn: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  evControls: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  priceEdit: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceEditLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  priceEditInput: { width: 70, height: 36, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 8, fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  openToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  openLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  sponsorCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, borderWidth: 1, borderColor: '#a7f3d0', padding: 10, marginTop: 12 },
  sponsorLogo: { width: 36, height: 36, borderRadius: 10 },
  sponsorLogoFallback: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.seller, alignItems: 'center', justifyContent: 'center' },
  sponsorLogoText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 15 },
  sponsorTag: { fontFamily: fonts.bold, fontSize: 8, color: '#047857', letterSpacing: 0.5 },
  sponsorName: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  sponsorMeta: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  removeSponsorBtn: { borderWidth: 1, borderColor: '#fecaca', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  removeSponsorText: { fontFamily: fonts.bold, fontSize: 11, color: colors.red },
  dlgBackdrop: { flex: 1, backgroundColor: colors.overlay },
  dlg: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 },
  dlgTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink, marginBottom: 12 },
  fLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 46, fontFamily: fonts.body, fontSize: 14, color: colors.ink, marginBottom: 6 },
  dlgToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, padding: 12, marginTop: 10 },
  dlgToggleTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  dlgToggleDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
});
