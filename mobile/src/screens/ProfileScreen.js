import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, DevSettings } from 'react-native';
import { Alert } from '../components/AppDialog';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { TAB_SPACE } from '../components/ui';
import { colors, gradients, radius, fonts, shadow } from '../theme/theme';

const THEME_SCHEME_KEY = 'theme_scheme_v1';
const THEME_OPTS = [
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
];

const LINKS = [
  { label: 'Wishlist', icon: 'heart', route: 'Wishlist' },
  { label: 'Messages', icon: 'chatbubbles', route: 'Messages' },
  { label: 'Saved Locations', icon: 'location', page: 'Saved Locations' },
  { label: 'Notifications', icon: 'notifications', page: 'Notifications' },
  { label: 'Settings', icon: 'settings', page: 'Settings' },
];
const STATUS_CHIP = {
  pending: { bg: '#fef3c7', fg: '#b45309', label: 'Pending' },
  processing: { bg: '#dbeafe', fg: '#1d4ed8', label: 'Processing' },
  confirmed: { bg: '#dbeafe', fg: '#1d4ed8', label: 'Confirmed' },
  shipped: { bg: colors.p100, fg: colors.p800, label: 'Shipped' },
  out_for_delivery: { bg: colors.p100, fg: colors.p800, label: 'On the way' },
  delivered: { bg: '#d1fae5', fg: '#047857', label: 'Delivered' },
  completed: { bg: '#d1fae5', fg: '#047857', label: 'Completed' },
  cancelled: { bg: '#ffe4e6', fg: '#e11d48', label: 'Cancelled' },
};
const tierIcon = (name) => (name === 'Gold' ? 'trophy' : name === 'Silver' ? 'ribbon' : 'medal');

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [loyalty, setLoyalty] = useState(null);
  const [orders, setOrders] = useState([]);
  const [themePref, setThemePref] = useState('system');

  useEffect(() => {
    api.loyalty.getStatus().then(({ data }) => setLoyalty(data)).catch(() => {});
    api.orders.getAll().then(({ data }) => setOrders((Array.isArray(data) ? data : data?.orders || []).slice(0, 4))).catch(() => {});
    AsyncStorage.getItem(THEME_SCHEME_KEY).then((v) => setThemePref(v === 'light' || v === 'dark' ? v : 'system')).catch(() => {});
  }, []);

  const chooseTheme = async (key) => {
    if (key === themePref) return;
    setThemePref(key);
    try { if (key === 'system') await AsyncStorage.removeItem(THEME_SCHEME_KEY); else await AsyncStorage.setItem(THEME_SCHEME_KEY, key); } catch (_) {}
    Alert.alert('Appearance', 'The app needs to reload to apply the new appearance.', [
      { text: 'Later', style: 'cancel' },
      { text: 'Reload now', onPress: () => { try { DevSettings.reload(); } catch (_) {} } },
    ]);
  };

  const submitDeletion = async () => {
    try {
      await api.contact.send({
        name: user?.name || 'Account deletion request',
        email: user?.email || '',
        phone_number: user?.phone || '',
        message_type: 'general',
        message:
          `ACCOUNT DELETION REQUEST\n` +
          `Account email: ${user?.email || ''}\n` +
          `The user requested deletion of their account and associated data from the app.`,
      });
      Alert.alert('Request submitted', 'Your account deletion request has been received. We will permanently delete your account and associated data within 30 days.');
    } catch (_) {
      Alert.alert('Something went wrong', 'Please try again, or email contact@openmarketlb.com to request deletion.');
    }
  };

  const requestDeletion = () => {
    Alert.alert(
      'Delete account?',
      'This requests permanent deletion of your account and all associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: submitDeletion },
      ],
    );
  };

  const points = loyalty?.points_balance ?? 0;
  const tierName = loyalty?.tier?.name || 'Bronze';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: TAB_SPACE }} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <LinearGradient colors={[colors.p800, '#7e22ce', colors.s700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(user?.name || 'U').charAt(0).toUpperCase()}</Text></View>
        <Text style={styles.name}>{user?.name || 'Welcome'}</Text>
        <Text style={styles.email}>{user?.email || ''}</Text>
      </LinearGradient>

      {/* Loyalty card */}
      <LinearGradient colors={['#f59e0b', '#f97316', '#facc15']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.loyalty}>
        <View style={styles.loyaltyTop}>
          <View style={styles.tierIconWrap}><Ionicons name={tierIcon(tierName)} size={26} color={colors.white} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tierName}>{tierName}</Text>
            <Text style={styles.tierMult}>{loyalty?.tier?.multiplier || 1}x points multiplier</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.points}>{points.toLocaleString()}</Text>
            <Text style={styles.pointsSub}>Worth ${(loyalty?.redeem_value ?? 0).toFixed(2)}</Text>
          </View>
        </View>
        {loyalty?.next_tier && (
          <View style={{ marginTop: 14 }}>
            <View style={styles.progressLabels}>
              <Text style={styles.progressText}>{tierName}</Text>
              <Text style={styles.progressText}>{loyalty.next_tier.name} · {loyalty.next_tier.min_points} pts</Text>
            </View>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, loyalty.progress_to_next_tier || 0)}%` }]} /></View>
            <Text style={styles.progressHint}>{Math.max(0, (loyalty.next_tier.min_points || 0) - (loyalty.points_lifetime || 0))} more points to {loyalty.next_tier.name}</Text>
          </View>
        )}
      </LinearGradient>

      {/* Orders */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Recent orders</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Page', { title: 'My Orders' })}><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
        </View>
        {orders.length === 0 ? (
          <View style={styles.noOrders}><Ionicons name="bag-outline" size={26} color={colors.textMuted} /><Text style={styles.noOrdersText}>No orders yet</Text></View>
        ) : orders.map((o) => {
          const st = STATUS_CHIP[(o.order_status || o.status || 'pending').toLowerCase()] || STATUS_CHIP.pending;
          return (
            <TouchableOpacity key={o.id} style={styles.order} activeOpacity={0.85} onPress={() => navigation.navigate('OrderTracking', { orderId: o.id, order: o })}>
              <View style={styles.orderIcon}><Ionicons name="receipt-outline" size={18} color={colors.violet} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderId}>#{String(o.id).slice(0, 8).toUpperCase()}</Text>
                <Text style={styles.orderMeta}>{(o.items?.length || o.item_count || 0)} item{(o.items?.length || 0) !== 1 ? 's' : ''} · ${Number(o.total_amount || o.total || 0).toFixed(2)}</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: st.bg }]}><Text style={[styles.chipText, { color: st.fg }]}>{st.label}</Text></View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Appearance */}
      <View style={styles.section}>
        <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Appearance</Text></View>
        <View style={styles.themeRow}>
          {THEME_OPTS.map((o) => {
            const on = themePref === o.key;
            return (
              <TouchableOpacity key={o.key} activeOpacity={0.85} onPress={() => chooseTheme(o.key)} style={[styles.themeOpt, on && styles.themeOptOn]}>
                <Ionicons name={o.icon} size={16} color={on ? colors.white : colors.textSecondary} />
                <Text style={[styles.themeOptText, on && { color: colors.white }]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Links */}
      <View style={styles.section}>
        {LINKS.map((l, i) => (
          <TouchableOpacity key={l.label} style={[styles.linkRow, i < LINKS.length - 1 && styles.linkBorder]} activeOpacity={0.7}
            onPress={() => l.route ? navigation.navigate(l.route) : navigation.navigate('Page', { title: l.page })}>
            <View style={styles.linkIcon}><Ionicons name={l.icon} size={18} color={colors.violet} /></View>
            <Text style={styles.linkLabel}>{l.label}</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logout} activeOpacity={0.85} onPress={logout}>
        <Ionicons name="log-out-outline" size={19} color={colors.sale} />
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.7} onPress={requestDeletion}>
        <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
        <Text style={styles.deleteText}>Delete account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingTop: 24, paddingBottom: 26 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  avatarText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 34 },
  name: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 22, marginTop: 12, letterSpacing: -0.5 },
  email: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  loyalty: { margin: 14, marginTop: -14, borderRadius: radius.lg, padding: 18, ...shadow.amberGlow },
  loyaltyTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tierIconWrap: { width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  tierName: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.4 },
  tierMult: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  points: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 24 },
  pointsSub: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.medium, fontSize: 11 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { color: 'rgba(255,255,255,0.95)', fontFamily: fonts.semibold, fontSize: 11 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.white },
  progressHint: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.body, fontSize: 11, marginTop: 6 },
  section: { backgroundColor: colors.surface, borderRadius: radius.md, marginHorizontal: 14, marginBottom: 12, padding: 6, borderWidth: 1, borderColor: colors.borderLight, ...shadow.card },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  seeAll: { fontFamily: fonts.semibold, fontSize: 12, color: colors.violet },
  noOrders: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  noOrdersText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  order: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  orderIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  orderId: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  orderMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  chipText: { fontFamily: fonts.bold, fontSize: 10 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 13 },
  linkBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  linkIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  themeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  themeOpt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  themeOptOn: { backgroundColor: colors.violet700, borderColor: colors.violet700 },
  themeOptText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, margin: 14, marginTop: 2, paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.saleSoft },
  logoutText: { fontFamily: fonts.bold, fontSize: 15, color: colors.sale },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginHorizontal: 14, marginBottom: 6, paddingVertical: 10 },
  deleteText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
});
