import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions, Easing } from 'react-native';
import Reanimated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import AnimatedMoney from '../components/AnimatedMoney';
import { api } from '../lib/api';
import { img } from '../lib/media';
import { notifySuccess } from '../lib/haptics';
import { colors, gradients, radius, fonts, shadow } from '../theme/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const CONFETTI = ['#7c3aed', '#10b981', '#f59e0b', '#f43f5e', '#3b82f6', '#fbbf24', '#ec4899'];

const STATUS = {
  pending: { label: 'Pending', c: '#d97706', bg: '#fffbeb' },
  confirmed: { label: 'Confirmed', c: '#2563eb', bg: '#eff6ff' },
  paid: { label: 'Paid', c: '#7c3aed', bg: '#f5f3ff' },
  processing: { label: 'Processing', c: '#4f46e5', bg: '#eef2ff' },
  shipped: { label: 'Shipped', c: '#0891b2', bg: '#ecfeff' },
  delivered: { label: 'Delivered', c: '#059669', bg: '#ecfdf5' },
  cancelled: { label: 'Cancelled', c: '#dc2626', bg: '#fef2f2' },
};

/* Lightweight one-shot confetti burst (native-driven). */
function Confetti() {
  const t = useRef(new Animated.Value(0)).current;
  const pieces = useRef([...Array(18)].map((_, i) => ({
    x: Math.random() * SCREEN_W,
    drift: (Math.random() - 0.5) * 140,
    rot: (Math.random() - 0.5) * 720,
    size: 6 + Math.random() * 7,
    color: CONFETTI[i % CONFETTI.length],
    fall: 220 + Math.random() * 220,
  }))).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [t]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute', top: -20, left: p.x, width: p.size, height: p.size * 1.7, borderRadius: 2,
            backgroundColor: p.color,
            opacity: t.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.fall] }) },
              { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rot}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

export default function OrderSuccessScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const orderId = route.params?.orderId;
  const [order, setOrder] = useState(route.params?.order || null);

  // Success checkmark + ring pulse
  const pop = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    notifySuccess();
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 5, tension: 90 }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(ring, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    ).start();
  }, [pop, ring]);

  // Refresh the full order from the server (route param is instant; this fills in any gaps).
  useEffect(() => {
    if (!orderId) return;
    api.orders.getById(orderId).then(({ data }) => { if (data) setOrder((prev) => ({ ...(prev || {}), ...data })); }).catch(() => {});
  }, [orderId]);

  const goHome = () => navigation.navigate('Root', { screen: 'Tabs', params: { screen: 'Home' } });

  const o = order || {};
  const items = o.items || [];
  const deliveryFee = o.delivery_fee || 0;
  const discount = o.loyalty_discount_amount || 0;
  const total = o.total_amount || 0;
  const itemsTotal = (total - deliveryFee) + discount;
  const pointsEarned = o.points_earned || o.loyalty_points_earned || o.earned_points || 0;
  const pointsRedeemed = o.loyalty_points_redeemed || 0;
  const ship = o.shipping_address || {};
  const recipient = o.customer_name || o.guest_name || '';
  const phone = o.delivery_phone || o.phone || o.guest_phone || '';
  const payLabel = o.payment_method === 'card' ? 'Card' : o.payment_method === 'wallet' ? 'Wallet' : 'Cash on Delivery';
  const payIcon = o.payment_method === 'card' ? 'card' : o.payment_method === 'wallet' ? 'wallet' : 'cash';
  const st = STATUS[(o.order_status || o.status || 'pending').toLowerCase()] || STATUS.pending;
  const placedAt = o.created_at ? new Date(o.created_at) : new Date();

  const ringStyle = {
    opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.8] }) }],
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        {/* ===== HERO ===== */}
        <LinearGradient colors={['#0f172a', colors.p900 || '#4c1d95', colors.s700 || '#0f766e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 30 }]}>
          <Confetti />
          <View style={styles.checkWrap}>
            <Animated.View style={[styles.ring, ringStyle]} />
            <Animated.View style={{ transform: [{ scale: pop }] }}>
              <LinearGradient colors={['#34d399', '#10b981', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.check}>
                <Ionicons name="checkmark-sharp" size={54} color={colors.white} />
              </LinearGradient>
            </Animated.View>
          </View>

          <Reanimated.Text entering={FadeInDown.delay(200)} style={styles.title}>Order Placed! 🎉</Reanimated.Text>
          <Reanimated.Text entering={FadeInDown.delay(280)} style={styles.sub}>
            Thank you{recipient ? `, ${String(recipient).split(' ')[0]}` : ''}! Your order is confirmed and being prepared.
          </Reanimated.Text>

          <Reanimated.View entering={FadeInDown.delay(360)} style={styles.metaRow}>
            {orderId ? (
              <View style={styles.idChip}>
                <Text style={styles.idChipLabel}>ORDER</Text>
                <Text style={styles.idChipVal}>#{String(orderId).slice(0, 8).toUpperCase()}</Text>
              </View>
            ) : null}
            <View style={[styles.statusChip, { backgroundColor: st.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: st.c }]} />
              <Text style={[styles.statusText, { color: st.c }]}>{st.label}</Text>
            </View>
          </Reanimated.View>
        </LinearGradient>

        {/* ===== POINTS EARNED ===== */}
        {pointsEarned > 0 ? (
          <Reanimated.View entering={FadeInDown.delay(440)} style={styles.pointsCard}>
            <LinearGradient colors={['#fbbf24', '#f59e0b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pointsTile}>
              <Ionicons name="sparkles" size={18} color={colors.white} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.pointsTitle}>You earned {Number(pointsEarned).toLocaleString()} points!</Text>
              <Text style={styles.pointsSub}>Use them for discounts on your next order.</Text>
            </View>
          </Reanimated.View>
        ) : null}

        {/* ===== ITEMS ===== */}
        <Reanimated.View entering={FadeInDown.delay(500)} style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="bag-handle" size={16} color={colors.violet} />
            <Text style={styles.cardHeadText}>Your Items</Text>
            <View style={styles.countPill}><Text style={styles.countPillText}>{items.length}</Text></View>
          </View>
          {items.map((it, i) => {
            const uri = it.image || it.product_image || it.images?.[0];
            const line = it.subtotal ?? (it.price || 0) * (it.quantity || 1);
            return (
              <Reanimated.View key={it.product_id || i} entering={FadeIn.delay(560 + i * 70)} style={[styles.itemRow, i > 0 && styles.itemDivider]}>
                {uri ? <Image source={{ uri: img(uri) }} style={styles.itemImg} contentFit="cover" cachePolicy="memory-disk" />
                  : <View style={[styles.itemImg, styles.itemImgFallback]}><Ionicons name="cube" size={18} color={colors.textMuted} /></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{it.name || it.product_name || 'Item'}</Text>
                  {(it.selected_color || it.selected_size || it.selected_shape) ? (
                    <Text style={styles.itemVariant} numberOfLines={1}>
                      {[it.selected_color, it.selected_size, it.selected_shape].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                  <Text style={styles.itemQty}>Qty {it.quantity || 1} × {money(it.price)}</Text>
                </View>
                <Text style={styles.itemLine}>{money(line)}</Text>
              </Reanimated.View>
            );
          })}
        </Reanimated.View>

        {/* ===== DELIVERY ===== */}
        {(ship.address || recipient) ? (
          <Reanimated.View entering={FadeInDown.delay(600)} style={styles.card}>
            <View style={styles.cardHead}>
              <Ionicons name="location" size={16} color={colors.violet} />
              <Text style={styles.cardHeadText}>Delivery Address</Text>
            </View>
            {recipient ? <Text style={styles.addrName}>{recipient}</Text> : null}
            {ship.address ? <Text style={styles.addrLine}>{ship.address}</Text> : null}
            {(ship.city || ship.state || ship.zip) ? (
              <Text style={styles.addrLine}>{[ship.city, ship.state].filter(Boolean).join(', ')}{ship.zip ? ` ${ship.zip}` : ''}</Text>
            ) : null}
            {phone ? <View style={styles.addrPhone}><Ionicons name="call-outline" size={13} color={colors.textMuted} /><Text style={styles.addrLine}>{phone}</Text></View> : null}
          </Reanimated.View>
        ) : null}

        {/* ===== PAYMENT + BREAKDOWN ===== */}
        <Reanimated.View entering={FadeInDown.delay(680)} style={styles.card}>
          <View style={styles.payRow}>
            <View style={styles.payLeft}>
              <View style={styles.payTile}><Ionicons name={payIcon} size={16} color={colors.violet} /></View>
              <View>
                <Text style={styles.payLabel}>Payment</Text>
                <Text style={styles.payValue}>{payLabel}</Text>
              </View>
            </View>
            <Text style={styles.placedAt}>{placedAt.toLocaleDateString()} · {placedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>

          <View style={styles.divider} />

          <Row k="Items total" v={money(itemsTotal)} />
          {pointsRedeemed > 0 ? <Row k={`Points discount (${pointsRedeemed} pts)`} v={`-${money(discount)}`} tint="#d97706" /> : null}
          <Row k="Delivery fee" v={deliveryFee > 0 ? money(deliveryFee) : 'Free'} tint={deliveryFee > 0 ? undefined : '#059669'} />

          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Total Paid</Text>
            <AnimatedMoney value={total} style={styles.grandValue} />
          </View>
        </Reanimated.View>

        {/* ===== trust footer ===== */}
        <Reanimated.View entering={FadeIn.delay(760)} style={styles.trustRow}>
          <View style={styles.trust}><Ionicons name="shield-checkmark" size={14} color={colors.seller} /><Text style={styles.trustText}>Buyer protected</Text></View>
          <View style={styles.trust}><Ionicons name="notifications" size={14} color={colors.seller} /><Text style={styles.trustText}>You'll get updates</Text></View>
        </Reanimated.View>
      </ScrollView>

      {/* ===== Sticky actions ===== */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 10 }]}>
        {orderId ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.replace('OrderTracking', { orderId })} style={{ flex: 1 }}>
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
              <Ionicons name="navigate" size={17} color={colors.white} />
              <Text style={styles.primaryText}>Track Order</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.85} onPress={goHome}>
          <Ionicons name="bag-handle-outline" size={17} color={colors.violet} />
          <Text style={styles.ghostText}>Keep shopping</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ k, v, tint }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowK}>{k}</Text>
      <Text style={[styles.rowV, tint && { color: tint }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 34, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden' },
  checkWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  ring: { position: 'absolute', width: 108, height: 108, borderRadius: 54, borderWidth: 3, borderColor: '#34d399' },
  check: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', ...shadow.emphasis },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.white, letterSpacing: -0.5, textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontSize: 13.5, color: 'rgba(255,255,255,0.72)', textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 300 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  idChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  idChipLabel: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1, color: 'rgba(255,255,255,0.6)' },
  idChipVal: { fontFamily: fonts.extrabold, fontSize: 12.5, color: colors.white, letterSpacing: 0.5 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: fonts.bold, fontSize: 12 },

  pointsCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 16, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.lg, padding: 14 },
  pointsTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  pointsTitle: { fontFamily: fonts.extrabold, fontSize: 14.5, color: '#92400e' },
  pointsSub: { fontFamily: fonts.body, fontSize: 11.5, color: '#b45309', marginTop: 2 },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, marginHorizontal: 16, marginTop: 14, padding: 16, ...shadow.card },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardHeadText: { flex: 1, fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink },
  countPill: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, minWidth: 22, paddingHorizontal: 7, paddingVertical: 2, alignItems: 'center' },
  countPillText: { fontFamily: fonts.bold, fontSize: 11, color: colors.violet700 },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  itemImg: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  itemImgFallback: { alignItems: 'center', justifyContent: 'center' },
  itemName: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  itemVariant: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  itemQty: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary, marginTop: 2 },
  itemLine: { fontFamily: fonts.extrabold, fontSize: 13.5, color: colors.ink },

  addrName: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink, marginBottom: 3 },
  addrLine: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },
  addrPhone: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },

  payRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payTile: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  payLabel: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  payValue: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink, marginTop: 1 },
  placedAt: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, textAlign: 'right', flexShrink: 1 },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 14 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 },
  rowK: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  rowV: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  grandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  grandLabel: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
  grandValue: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.violet, letterSpacing: -0.5 },

  trustRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 18 },
  trust: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trustText: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textMuted },

  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight, ...shadow.emphasis },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: radius.md },
  primaryText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 16 },
  ghostText: { fontFamily: fonts.bold, fontSize: 14, color: colors.violet },
});
