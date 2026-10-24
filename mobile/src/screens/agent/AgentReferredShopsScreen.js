import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { colors, agent, radius, fonts, shadow } from '../../theme/theme';
import { Rise, CountUp, PressScale, Spinner, toast } from '../../components/shop/ShopKit';
import { AgentScreenWrap, AgentHero } from '../../components/agent/AgentKit';

/* breathing pill for pending — soft opacity pulse */
function BreathingPill({ label }) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 0.55, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(a, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, [a]);
  return (
    <Animated.View style={[st.statusPill, { backgroundColor: '#fffbeb', borderColor: '#fde68a', opacity: a }]}>
      <Text style={[st.statusText, { color: '#b45309' }]}>{label}</Text>
    </Animated.View>
  );
}

/* stamped-badge pop for approved */
function StampedPill({ label }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }).start();
  }, [a]);
  return (
    <Animated.View style={[st.statusPill, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', flexDirection: 'row', alignItems: 'center', gap: 3, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }) }] }]}>
      <Ionicons name="checkmark-circle" size={11} color="#047857" />
      <Text style={[st.statusText, { color: '#047857' }]}>{label}</Text>
    </Animated.View>
  );
}

function StatusPill({ status }) {
  if (status === 'approved') return <StampedPill label={status} />;
  if (status === 'pending') return <BreathingPill label={status} />;
  const rose = status === 'suspended' || status === 'rejected';
  return (
    <View style={[st.statusPill, rose ? { backgroundColor: '#fff1f2', borderColor: '#ffe4e6' } : { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      <Text style={[st.statusText, { color: rose ? '#be123c' : colors.textSecondary }]}>{status}</Text>
    </View>
  );
}

function ShopRow({ item, index, pending }) {
  const name = pending ? item.shop_name : item.name;
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <Rise delay={Math.min(700, index * 80)} distance={12}>
      <View style={[st.shopRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight }]} testID={`referred-shop-${item.id}`}>
        {!pending && item.logo ? (
          <Image source={{ uri: img(item.logo) }} style={st.logo} />
        ) : (
          <View style={[st.logo, { backgroundColor: pending ? '#fef3c7' : '#dbeafe', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 16, color: pending ? '#d97706' : '#2563eb' }}>{initial}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={st.shopName} numberOfLines={1}>{name}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 3 }}>
            {item.email ? <View style={st.metaItem}><Ionicons name="mail" size={10} color={colors.textMuted} /><Text style={st.metaText} numberOfLines={1}>{item.email}</Text></View> : null}
            {item.phone ? <View style={st.metaItem}><Ionicons name="call" size={10} color={colors.textMuted} /><Text style={st.metaText}>{item.phone}</Text></View> : null}
            {item.state ? <View style={st.metaItem}><Ionicons name="location" size={10} color={colors.textMuted} /><Text style={st.metaText}>{item.state}</Text></View> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 3 }}>
            {!pending && item.commission_percentage != null ? <Text style={st.metaSub}>Commission: <Text style={{ fontFamily: fonts.bold, color: colors.text }}>{item.commission_percentage}%</Text></Text> : null}
            <Text style={st.metaSub}>{pending ? 'Submitted' : 'Created'}: {(item.created_at || '').slice(0, 10)}</Text>
          </View>
        </View>
        <StatusPill status={item.status} />
      </View>
    </Rise>
  );
}

export default function AgentReferredShopsScreen({ navigation }) {
  const [data, setData] = useState({ shops: [], pending_applications: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try { const r = await api.agent.referredShops(); setData(r.data); }
    catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }, [fetchData]);

  const approvedCount = data.shops?.filter(s => s.status === 'approved').length || 0;
  const pendingCount = data.pending_applications?.length || 0;

  if (loading) {
    return <View style={st.center}><Spinner size={36} color={colors.s500} /></View>;
  }

  return (
    <AgentScreenWrap refreshing={refreshing} onRefresh={onRefresh}>
      {/* Hero — blue-600 -> indigo-600 -> violet-600 */}
      <Rise duration={500} distance={0}>
        <AgentHero grad={agent.shopsHero} tag="Referred Shops" tagIcon="storefront"
          title="Your Referred Shops"
          sub="Shops you brought to OpenMarket Lebanon. You earn from every paid order.">
          <PressScale onPress={() => navigation.navigate('AgentRefer')} style={{ marginTop: 14, alignSelf: 'flex-start' }}>
            <View style={st.referBtn}>
              <Ionicons name="add-circle" size={15} color="#1d4ed8" />
              <Text style={st.referText}>Refer a Shop</Text>
            </View>
          </PressScale>
        </AgentHero>
      </Rise>

      {/* Summary strip */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Rise delay={100} style={{ flex: 1 }}>
          <View style={st.summaryCard}>
            <Text style={st.summaryLabel}>Approved Shops</Text>
            <CountUp value={approvedCount} style={[st.summaryValue, { color: '#047857' }]} />
          </View>
        </Rise>
        <Rise delay={170} style={{ flex: 1 }}>
          <View style={st.summaryCard}>
            <Text style={st.summaryLabel}>Pending Applications</Text>
            <CountUp value={pendingCount} style={[st.summaryValue, { color: '#b45309' }]} />
          </View>
        </Rise>
      </View>

      {/* Approved & active shops */}
      <Rise delay={240}>
        <View style={st.card}>
          <Text style={st.cardTitle}>Approved & Active Shops ({data.shops?.length || 0})</Text>
          {!data.shops || data.shops.length === 0 ? (
            <Text style={st.emptyText}>No referred shops yet. Get started by referring one!</Text>
          ) : (
            <View style={{ marginTop: 4 }}>
              {data.shops.map((s, i) => <ShopRow key={s.id} item={s} index={i} />)}
            </View>
          )}
        </View>
      </Rise>

      {/* Pending applications */}
      <Rise delay={320}>
        <View style={[st.card, { marginTop: 14 }]}>
          <Text style={st.cardTitle}>Pending Applications ({pendingCount})</Text>
          {!data.pending_applications || data.pending_applications.length === 0 ? (
            <Text style={st.emptyText}>No pending applications.</Text>
          ) : (
            <View style={{ marginTop: 4 }}>
              {data.pending_applications.map((a, i) => <ShopRow key={a.id} item={a} index={i} pending />)}
            </View>
          )}
        </View>
      </Rise>
    </AgentScreenWrap>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: agent.bg },
  referBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: 15, paddingVertical: 10, ...shadow.emphasis },
  referText: { fontFamily: fonts.bold, fontSize: 13, color: '#1d4ed8' },
  summaryCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(226,232,240,0.7)', padding: 14, ...shadow.card },
  summaryLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginBottom: 3 },
  summaryValue: { fontFamily: fonts.extrabold, fontSize: 23 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(226,232,240,0.7)', padding: 15, marginTop: 14, ...shadow.card },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink },
  emptyText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
  shopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 12 },
  logo: { width: 42, height: 42, borderRadius: 12 },
  shopName: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: 170 },
  metaText: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, flexShrink: 1 },
  metaSub: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  statusPill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontFamily: fonts.semibold, fontSize: 10, textTransform: 'capitalize' },
});
