import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Share, Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { MEDIA_BASE_URL } from '../../lib/media';
import { tapLight } from '../../lib/haptics';
import { colors, agent, radius, fonts, shadow } from '../../theme/theme';
import { Rise, Float, CountUp, PressScale, Spinner, toast } from '../../components/shop/ShopKit';
import { AgentScreenWrap, AgentHero, TiltCard } from '../../components/agent/AgentKit';

// The public web origin — in dev the web app runs on :3000 next to the API.
const WEB_ORIGIN = MEDIA_BASE_URL.replace(/:\d+$/, ':3000');

/* copy button whose icon ripples into a checkmark on copy */
function CopyButton({ onCopy, testID }) {
  const [copied, setCopied] = useState(false);
  const ring = useRef(new Animated.Value(0)).current;
  const press = () => {
    onCopy();
    tapLight();
    setCopied(true);
    ring.setValue(0);
    Animated.timing(ring, { toValue: 1, duration: 550, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <TouchableOpacity onPress={press} activeOpacity={0.8} style={cbs.btn} testID={testID}>
      {copied && (
        <Animated.View style={[cbs.ring, {
          opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
          transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
        }]} />
      )}
      <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={13} color={copied ? '#059669' : colors.textSecondary} />
    </TouchableOpacity>
  );
}
const cbs = StyleSheet.create({
  btn: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 30, height: 30, borderRadius: 9, backgroundColor: '#34d399' },
});

/* stat card — exact quartet colors + sub-lines */
function StatCard({ icon, label, value, prefix = '', decimals = 0, grad, sub, index }) {
  return (
    <Rise delay={100 + index * 80} style={st.statWrap}>
      <View style={st.stat}>
        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.statTile}>
          <Ionicons name={icon} size={17} color={colors.white} />
        </LinearGradient>
        <CountUp value={value} prefix={prefix} decimals={decimals} style={st.statValue} />
        <Text style={st.statLabel}>{label}</Text>
        {sub ? <Text style={st.statSub}>{sub}</Text> : null}
      </View>
    </Rise>
  );
}

export default function AgentDashboardScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: d } = await api.agent.dashboard();
      setData(d);
    } catch (e) { toast.error('Failed to load dashboard'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }, [fetchData]);

  const code = data?.referral_code || '';
  const link = `${WEB_ORIGIN}/become-seller?ref=${code}`;

  const copy = (text, label) => {
    Clipboard.setString(text);
    toast.success(`${label} copied!`);
  };

  /* the web share payload, verbatim */
  const shareNative = async () => {
    try {
      await Share.share({
        title: 'Open a shop on OpenMarket Lebanon',
        message: `Sign up your shop using my referral code ${code}! ${link}`,
        url: link,
      });
    } catch {}
  };

  if (loading) {
    return <View style={st.center}><Spinner size={36} color={colors.p500} /></View>;
  }

  const stats = data?.stats || {};

  return (
    <AgentScreenWrap refreshing={refreshing} onRefresh={onRefresh}>
      {/* Hero — violet-600 -> purple-600 -> fuchsia-600 with floating particles */}
      <Rise duration={500} distance={0}>
        <AgentHero grad={agent.hero} tag="Agent Portal"
          title={`Welcome, ${data?.agent?.first_name || 'Agent'} 👋`}
          sub="Refer shops, earn commission, and track your wallet — all in one place.">
          <Float style={{ position: 'absolute', top: '35%', right: '22%' }} dur={4000}><View style={st.particleLg} /></Float>
          <Float style={{ position: 'absolute', bottom: '25%', right: '38%' }} dur={3200} delay={900}><View style={st.particleSm} /></Float>
          <Float style={{ position: 'absolute', top: '28%', left: '55%' }} dur={3600} delay={1600}><View style={st.particleSm} /></Float>
        </AgentHero>
      </Rise>

      {/* Stat quartet — staggered cascade with odometer count-ups */}
      <View style={st.statsGrid}>
        <StatCard index={0} icon="wallet" label="Wallet Balance" value={Number(data?.wallet_balance || 0)} prefix="$" decimals={2}
          grad={agent.tiles.emerald} sub={`Lifetime earned: $${Number(stats.total_earned || 0).toFixed(2)}`} />
        <StatCard index={1} icon="storefront" label="Referred Shops" value={stats.referred_total ?? 0}
          grad={agent.tiles.blue} sub={`${stats.referred_approved ?? 0} approved`} />
        <StatCard index={2} icon="receipt" label="Commission Earned" value={Number(stats.total_commission || 0)} prefix="$" decimals={2}
          grad={agent.tiles.amber} sub={`Bonus: $${Number(stats.total_approval_bonus || 0).toFixed(2)}`} />
        <StatCard index={3} icon="cash" label="Cashed Out" value={Number(stats.total_cashed_out || 0)} prefix="$" decimals={2}
          grad={agent.tiles.fuchsia}
          sub={stats.pending_cashout_count ? `${stats.pending_cashout_count} pending ($${Number(stats.pending_cashout_amount || 0).toFixed(2)})` : 'No pending'} />
      </View>

      {/* Referral link card */}
      <Rise delay={420}>
        <View style={st.card}>
          <View style={{ flexDirection: 'row', gap: 11, marginBottom: 12 }}>
            <LinearGradient colors={agent.activePill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.shareTile}>
              <Ionicons name="share-social" size={19} color={colors.white} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={st.cardTitle}>Your Referral Link</Text>
              <Text style={st.cardSub}>
                Share this with shop owners. When their shop is approved, you earn <Text style={st.bold}>${Number(data?.settings?.approval_bonus_amount || 4).toFixed(2)}</Text> + <Text style={st.bold}>{Number(data?.settings?.commission_share_percent || 30).toFixed(0)}%</Text> of admin's commission on every order.
              </Text>
            </View>
          </View>
          <View style={{ gap: 9 }}>
            <View style={st.codeBox}>
              <Text style={st.codeLabel}>Referral Code</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={st.codeValue}>{code}</Text>
                <CopyButton onCopy={() => copy(code, 'Code')} testID="copy-referral-code" />
              </View>
            </View>
            <View style={st.codeBox}>
              <Text style={st.codeLabel}>Referral Link</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={st.linkValue} numberOfLines={1}>{link}</Text>
                <CopyButton onCopy={() => copy(link, 'Link')} testID="copy-referral-link" />
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <PressScale style={{ flex: 1 }} onPress={shareNative}>
              <LinearGradient colors={agent.drawerHead} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.shareBtn}>
                <Ionicons name="share-social" size={14} color={colors.white} />
                <Text style={st.shareText}>Share</Text>
              </LinearGradient>
            </PressScale>
            <PressScale style={{ flex: 1.3 }} onPress={() => navigation.navigate('AgentRefer')}>
              <View style={st.outlineBtn}>
                <Ionicons name="add-circle-outline" size={14} color={colors.text} />
                <Text style={st.outlineText}>Refer a Shop Now</Text>
              </View>
            </PressScale>
          </View>
        </View>
      </Rise>

      {/* Quick actions — tilt cards */}
      <Rise delay={500}>
        <View style={{ gap: 9, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <TiltCard icon="wallet" label="My Wallet" grad={agent.tiles.emerald} onPress={() => navigation.navigate('AgentWallet')} />
            <TiltCard icon="storefront" label="Referred Shops" grad={agent.tiles.blue} onPress={() => navigation.navigate('AgentReferredShops')} />
          </View>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <TiltCard icon="receipt" label="Commissions" grad={agent.tiles.amber} onPress={() => navigation.navigate('AgentCommissions')} />
            <TiltCard icon="cash" label="Cash Out" grad={agent.tiles.fuchsia} onPress={() => navigation.navigate('AgentCashout')} />
          </View>
        </View>
      </Rise>

      {/* Recent activity — rows printing in sequentially */}
      <Rise delay={580}>
        <View style={[st.card, { marginTop: 14 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Ionicons name="receipt" size={15} color={colors.p500} />
              <Text style={st.cardTitle}>Recent Activity</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('AgentWallet')} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Text style={st.viewAll}>View All</Text>
              <Ionicons name="arrow-forward" size={12} color={colors.violet} />
            </TouchableOpacity>
          </View>
          {(data?.recent_transactions || []).length === 0 ? (
            <Text style={st.emptyText}>No transactions yet. Refer your first shop to earn!</Text>
          ) : (
            data.recent_transactions.map((t, i) => {
              const positive = Number(t.amount) > 0;
              const typeLabel = (t.type || '').replace(/_/g, ' ').replace(/agent\s*/, '').replace(/^./, c => c.toUpperCase());
              return (
                <Rise key={t.id || i} delay={i * 110} distance={10}>
                  <View style={[st.txnRow, i < data.recent_transactions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                    <View style={[st.txnIcon, { backgroundColor: positive ? '#ecfdf5' : '#fef2f2' }]}>
                      <Ionicons name={positive ? 'checkmark-circle' : 'time'} size={15} color={positive ? '#059669' : '#dc2626'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.txnType}>{typeLabel}</Text>
                      <Text style={st.txnNote} numberOfLines={1}>{t.note}</Text>
                    </View>
                    <Text style={[st.txnAmount, { color: positive ? '#047857' : '#b91c1c' }]}>
                      {positive ? '+' : ''}${Number(t.amount || 0).toFixed(2)}
                    </Text>
                  </View>
                </Rise>
              );
            })
          )}
        </View>
      </Rise>
    </AgentScreenWrap>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: agent.bg },
  particleLg: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.25)' },
  particleSm: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  statWrap: { flexBasis: '47%', flexGrow: 1 },
  stat: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(226,232,240,0.7)', padding: 14, ...shadow.card },
  statTile: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 10, ...shadow.card },
  statValue: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.ink, letterSpacing: -0.4 },
  statLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  statSub: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 2, opacity: 0.8 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(226,232,240,0.7)', padding: 15, marginTop: 14, ...shadow.card },
  shareTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', ...agent.fuchsiaGlow },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink },
  cardSub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 3, lineHeight: 16 },
  bold: { fontFamily: fonts.bold, color: colors.text },
  codeBox: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 11 },
  codeLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginBottom: 4 },
  codeValue: { flex: 1, fontFamily: fonts.extrabold, fontSize: 14, color: colors.p800, letterSpacing: 0.6 },
  linkValue: { flex: 1, fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
  shareBtn: { height: 44, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, ...agent.fuchsiaGlow },
  shareText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },
  outlineBtn: { height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  outlineText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  viewAll: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.violet },
  emptyText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, textAlign: 'center', paddingVertical: 16 },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  txnIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txnType: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  txnNote: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, marginTop: 1 },
  txnAmount: { fontFamily: fonts.bold, fontSize: 13 },
});
