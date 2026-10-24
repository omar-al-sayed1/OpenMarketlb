import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { ShopScreenWrap, Rise, Float, PressScale, Spinner } from '../../components/shop/ShopKit';
import SpinWheelModal from '../../components/shop/SpinWheelModal';

/* outcome icon map — mirrors the admin/web mapping exactly */
const OUTCOME_ICONS = {
  free_sponsors_4: { icon: 'megaphone', tint: '#f59e0b' },
  free_sponsor_10_days: { icon: 'megaphone', tint: '#3b82f6' },
  free_theme: { icon: 'color-palette', tint: '#ffc0cb' },
  free_subscription: { icon: 'ribbon', tint: '#f59e0b' },
  subscription_extension: { icon: 'calendar', tint: '#d97706' },
  wallet_credit_small: { icon: 'wallet', tint: '#10b981' },
  wallet_credit_large: { icon: 'logo-usd', tint: '#059669' },
  commission_reduction: { icon: 'pricetag', tint: '#3b82f6' },
  another_spin: { icon: 'flash', tint: colors.p450 },
  try_again: { icon: 'refresh', tint: '#94a3b8' },
};
const outcomeIcon = (key) => OUTCOME_ICONS[key] || { icon: 'gift', tint: '#ec4899' };

export default function ShopSpinScreen({ navigation }) {
  const [spinInfo, setSpinInfo] = useState(null);
  const [tierInfo, setTierInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [spinWheelOpen, setSpinWheelOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [spinRes, tierRes] = await Promise.allSettled([api.shopSpin.getInfo(), api.shopTier.getInfo()]);
      if (spinRes.status === 'fulfilled') setSpinInfo(spinRes.value.data);
      if (tierRes.status === 'fulfilled') setTierInfo(tierRes.value.data);
    } catch (e) {} finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }, [fetchData]);

  if (loading) {
    return <View style={st.center}><Spinner size={34} color={colors.p450} /></View>;
  }

  const freeSpins = spinInfo?.free_spins || 0;

  return (
    <>
    <ShopScreenWrap wash={shop.washSpin} refreshing={refreshing} onRefresh={onRefresh}>
      {/* Header */}
      <Rise duration={500} distance={0}>
        <View style={st.headerCard}>
          <Float style={{ position: 'absolute', top: '30%', right: '25%' }} dur={4000}><View style={st.particle} /></Float>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <LinearGradient colors={[colors.p450, colors.s600]} style={st.headerIcon}><Ionicons name="sparkles" size={22} color={colors.white} /></LinearGradient>
            <View>
              <Text style={st.headerTitle}>Lucky Spin Wheel</Text>
              <Text style={st.headerSub}>Spin to win rewards for your shop!</Text>
            </View>
          </View>
        </View>
      </Rise>

      {/* Spin card — violet-600 -> purple-600 -> indigo-600 */}
      <Rise delay={80}>
        <LinearGradient colors={shop.spinFab} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.spinCard}>
          <Float style={[st.blob, { top: -32, right: -32 }]} dur={5000}><View /></Float>
          <Ionicons name="sparkles" size={30} color={colors.white} style={{ marginBottom: 9 }} />
          <Text style={st.spinTitle}>Spin Now!</Text>
          <Text style={st.spinSub}>
            {freeSpins > 0 ? `You have ${freeSpins} free spin${freeSpins > 1 ? 's' : ''}!` : `$${spinInfo?.spin_cost || 7} per spin from wallet`}
          </Text>

          {/* spins-remaining meter */}
          {freeSpins > 0 && (
            <View style={st.meter}>
              {Array.from({ length: Math.min(freeSpins, 6) }, (_, i) => (
                <View key={i} style={st.meterDot} />
              ))}
              <Text style={st.meterText}>{freeSpins} free spin{freeSpins > 1 ? 's' : ''} remaining</Text>
            </View>
          )}

          <View style={st.statsBox}>
            <View style={st.statRow}><Text style={st.statKey}>Free Spins</Text><Text style={st.statVal}>{freeSpins}</Text></View>
            <View style={st.statRow}><Text style={st.statKey}>Spin Cost</Text><Text style={st.statVal}>${spinInfo?.spin_cost || 7}</Text></View>
            <View style={st.statRow}><Text style={st.statKey}>Wallet Balance</Text><Text style={st.statVal}>${(tierInfo?.wallet_balance || 0).toFixed(2)}</Text></View>
          </View>
          <PressScale onPress={() => setSpinWheelOpen(true)}>
            <View style={st.openBtn} testID="open-spin-btn">
              <Ionicons name="sparkles" size={18} color={colors.p800} />
              <Text style={st.openBtnText}>Open Spin Wheel</Text>
            </View>
          </PressScale>
        </LinearGradient>
      </Rise>

      {/* Subscribe note — only for shops without an active subscription */}
      {!spinInfo?.is_subscribed && (
        <Rise delay={140}>
          <View style={st.subscribeNote}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <Ionicons name="ribbon" size={17} color="#f59e0b" />
              <Text style={st.subscribeTitle}>Get a free spin every month</Text>
            </View>
            <Text style={st.subscribeDesc}><Text style={{ fontFamily: fonts.bold }}>Subscribe to get a free spin per month</Text> — plus more perks for your shop.</Text>
            <PressScale onPress={() => navigation.navigate('ShopHome')} style={{ marginTop: 9, alignSelf: 'flex-start' }}>
              <LinearGradient colors={['#f59e0b', '#f97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.subscribeBtn}>
                <Ionicons name="ribbon" size={12} color={colors.white} />
                <Text style={st.subscribeBtnText}>Subscribe</Text>
              </LinearGradient>
            </PressScale>
          </View>
        </Rise>
      )}

      {/* Possible rewards */}
      <Rise delay={200}>
        <View style={st.card}>
          <Text style={st.cardTitle}>Possible Rewards</Text>
          <View style={{ gap: 9, marginTop: 10 }}>
            {spinInfo?.outcomes?.map((o, i) => {
              const ic = outcomeIcon(o.key);
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                  <Ionicons name={ic.icon} size={15} color={ic.tint} />
                  <Text style={st.rewardText}>{o.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </Rise>

      {/* Spin history */}
      <Rise delay={260}>
        <View style={[st.card, { padding: 0, overflow: 'hidden' }]}>
          <View style={st.historyHead}>
            <Ionicons name="time" size={16} color={colors.textMuted} />
            <Text style={st.cardTitle}>Spin History</Text>
          </View>
          {spinInfo?.history?.length > 0 ? (
            spinInfo.history.map((h, i) => {
              const ic = outcomeIcon(h.outcome_key);
              const effect =
                h.applied_effects?.type === 'wallet_credit' ? `+$${h.applied_effects.amount}` :
                h.applied_effects?.type === 'subscription_extension' ? `+${h.applied_effects.days_added} days` :
                h.applied_effects?.type === 'another_spin' ? 'Free spin' : '';
              return (
                <View key={h.id || i} style={[st.historyRow, i < spinInfo.history.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                  <Ionicons name={ic.icon} size={17} color={ic.tint} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.historyResult} numberOfLines={1}>{h.outcome_label}</Text>
                    <Text style={st.historyDate}>{new Date(h.created_at).toLocaleString()}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <View style={[st.typePill, { backgroundColor: h.spin_type === 'monthly_free' ? '#d1fae5' : '#dbeafe' }]}>
                      <Text style={[st.typePillText, { color: h.spin_type === 'monthly_free' ? '#047857' : '#1d4ed8' }]}>{(h.spin_type || '').replace('_', ' ')}</Text>
                    </View>
                    <Text style={st.historyCost}>{h.cost > 0 ? `$${h.cost.toFixed(2)}` : 'Free'}{effect ? ` · ${effect}` : ''}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="time" size={42} color={colors.borderLight} />
              <Text style={st.emptyTitle}>No spins yet</Text>
              <Text style={st.emptyDesc}>Spin the wheel to see your history here</Text>
            </View>
          )}
        </View>
      </Rise>
    </ShopScreenWrap>

    {/* The physics wheel — deceleration + confetti + haptics */}
    <SpinWheelModal open={spinWheelOpen} onOpenChange={setSpinWheelOpen} spinInfo={spinInfo} navigation={navigation}
      onSpinComplete={() => fetchData()} />
    </>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: shop.bg },
  headerCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, padding: 17, overflow: 'hidden', ...shadow.card },
  headerIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', ...shadow.violetGlow },
  headerTitle: { fontFamily: fonts.heading, fontSize: 21, color: colors.ink, letterSpacing: -0.4 },
  headerSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  particle: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(196,181,253,0.6)' },
  spinCard: { borderRadius: radius.xl, padding: 20, marginTop: 14, overflow: 'hidden', ...shadow.emphasis },
  blob: { position: 'absolute', width: 112, height: 112, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.1)' },
  spinTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 21, letterSpacing: -0.3 },
  spinSub: { color: colors.p200, fontFamily: fonts.body, fontSize: 12.5, marginTop: 3 },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  meterDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#34d399', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  meterText: { color: '#a7f3d0', fontFamily: fonts.semibold, fontSize: 10.5, marginLeft: 4 },
  statsBox: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.md, padding: 14, marginTop: 14, gap: 8 },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statKey: { color: colors.p200, fontFamily: fonts.body, fontSize: 12.5 },
  statVal: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 13.5 },
  openBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.white, borderRadius: radius.md, height: 50, marginTop: 14, ...shadow.emphasis },
  openBtnText: { fontFamily: fonts.extrabold, fontSize: 15.5, color: colors.p800 },
  subscribeNote: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.md, padding: 14, marginTop: 12 },
  subscribeTitle: { fontFamily: fonts.bold, fontSize: 13, color: '#92400e' },
  subscribeDesc: { fontFamily: fonts.body, fontSize: 11.5, color: '#b45309', lineHeight: 16 },
  subscribeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  subscribeBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 11 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 15, marginTop: 12, ...shadow.card },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink },
  rewardText: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  historyHead: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  historyResult: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  historyDate: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  typePill: { borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2.5 },
  typePillText: { fontFamily: fonts.bold, fontSize: 9, textTransform: 'capitalize' },
  historyCost: { fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.textSecondary, marginTop: 10 },
  emptyDesc: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
});
