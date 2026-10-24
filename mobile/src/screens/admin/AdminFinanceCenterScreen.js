import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ScrollView, Animated, Easing, Share, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PieChart, LineChart, BarChart } from 'react-native-gifted-charts';
import * as FileSystem from 'expo-file-system/legacy';
import { api, getAuthToken } from '../../lib/api';
import { API_BASE_URL } from '../../config';
import { toast, Spinner } from '../../components/shop/ShopKit';
import { notifySuccess, notifyError } from '../../lib/haptics';
import { AdminScreen, AdminHeroCard, AdminCard, Shimmer } from '../../components/admin/AdminKit';
import { colors, admin, radius, fonts, shadow } from '../../theme/theme';

const CHART_W = Dimensions.get('window').width - 72;
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const fmtDate = (s) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return s; }
};

const TABS = [
  { key: 'admin-revenue', label: 'Admin Revenue', icon: 'cash', grad: ['#10b981', '#14b8a6'] },
  { key: 'shop-money', label: 'Shop Money', icon: 'storefront', grad: [colors.p450, colors.p400] },
  { key: 'agent-money', label: 'Agent Money', icon: 'people', grad: ['#ffc0cb', '#ec4899'] },
  { key: 'pending-orders', label: 'Pending', icon: 'time', grad: ['#f59e0b', '#f97316'] },
  { key: 'delivery-fees', label: 'Delivery', icon: 'car', grad: ['#3b82f6', colors.s500] },
];

const SECTION = {
  subscriptions: { label: 'Subscriptions', icon: 'card', color: '#2563eb' },
  commissions: { label: 'Commissions', icon: 'trending-up', color: '#059669' },
  adjustments: { label: 'Adjustments', icon: 'settings', color: '#ea580c' },
  platform_services: { label: 'Platform Services', icon: 'sparkles', color: colors.p600 },
  monthly_credits: { label: 'New Shop Credits + Monthly Credits', icon: 'gift', color: '#dc2626' },
  admin_cashouts: { label: 'Admin Cash Outs', icon: 'wallet', color: '#334155' },
  loyalty_deductions: { label: 'Loyalty Point Deductions', icon: 'remove-circle', color: '#e11d48' },
  shop_referral_first_pay: { label: 'Shop referrals first pay', icon: 'gift', color: '#f06a92' },
  agent_commission: { label: 'Agent Commission Payouts', icon: 'people', color: '#f06a92' },
};

const CHART_GRAD = { profit: '#10b981', subs: '#3b82f6', comm: colors.p450, svc: '#f59e0b', credits: '#ef4444', payouts: '#ec4899' };

/* ---------- Currency count-up (sign-aware) ---------- */
function MoneyCountUp({ value = 0, style, testID }) {
  const a = useRef(new Animated.Value(0)).current;
  const [txt, setTxt] = useState('$0.00');
  useEffect(() => {
    a.setValue(0);
    const id = a.addListener(({ value: v }) => { const cur = v * value; setTxt(`${cur < 0 ? '-' : ''}$${Math.abs(cur).toFixed(2)}`); });
    Animated.timing(a, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => a.removeListener(id);
  }, [value]); // eslint-disable-line
  return <Text style={style} testID={testID}>{txt}</Text>;
}

/* ---------- Entrance cascade wrapper ---------- */
function Cascade({ children, index = 0, style }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 400, delay: index * 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []); // eslint-disable-line
  return <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>{children}</Animated.View>;
}

/* ---------- Gradient money hero ---------- */
function MoneyHero({ grad, label, labelColor, value, sub, icon, testID, valueTestID }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(p, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(p, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, []); // eslint-disable-line
  return (
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.moneyHero} testID={testID}>
      <View style={styles.mhCircle} />
      <Animated.View style={[styles.mhParticle, { transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.mhLabel, { color: labelColor }]}>{label}</Text>
        <MoneyCountUp value={value} style={styles.mhValue} testID={valueTestID} />
        <Text style={[styles.mhSub, { color: labelColor }]}>{sub}</Text>
      </View>
      <View style={styles.mhTile}><Ionicons name={icon} size={26} color={colors.white} /></View>
    </LinearGradient>
  );
}

/* ---------- Tinted summary card ---------- */
function TintCard({ bg, border, children, testID, style }) {
  return <View style={[styles.tint, { backgroundColor: bg, borderColor: border }, style]} testID={testID}>{children}</View>;
}

/* ---------- Openable breakdown stat (web StatCard) ---------- */
const TILE_GRAD = {
  blue: ['#3b82f6', colors.s500], emerald: ['#10b981', '#14b8a6'], orange: ['#f59e0b', '#f97316'],
  purple: [colors.p450, colors.p500], red: ['#ef4444', '#f43f5e'], slate: ['#64748b', '#475569'],
  rose: ['#f43f5e', '#e11d48'], fuchsia: ['#ffc0cb', '#f06a92'],
};
function FinanceStatCard({ title, value, icon, tint = 'indigo', subtext, onPress, testID }) {
  const grad = TILE_GRAD[tint] || [colors.s600, colors.s500];
  const orb = useRef(new Animated.Value(0)).current;
  const set = (to) => Animated.spring(orb, { toValue: to, useNativeDriver: true, speed: 30 }).start();
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} onPressIn={() => set(1)} onPressOut={() => set(0)} style={styles.fstat} testID={testID}>
      <Animated.View style={[styles.fstatOrb, { backgroundColor: grad[1], opacity: orb.interpolate({ inputRange: [0, 1], outputRange: [0.07, 0.14] }), transform: [{ scale: orb.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }] }]} />
      <View style={styles.fstatTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fstatTitle} numberOfLines={2}>{title}</Text>
          <MoneyCountUp value={value} style={styles.fstatValue} />
          {subtext ? <Text style={styles.fstatSub} numberOfLines={2}>{subtext}</Text> : null}
        </View>
        <Animated.View style={{ transform: [{ scale: orb.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }] }}>
          <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fstatTile}><Ionicons name={icon} size={18} color={colors.white} /></LinearGradient>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

/* ---------- Horizontally-scrollable data table ---------- */
function DataTable({ columns, rows, testID, rowTestID, empty }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View testID={testID}>
        <View style={styles.tHead}>
          {columns.map((c) => (
            <Text key={c.key} style={[styles.tHeadCell, { width: c.width, textAlign: c.align || 'left' }]}>{c.label}</Text>
          ))}
        </View>
        {rows.length === 0 ? (
          <View style={styles.tEmpty}><Text style={styles.tEmptyText}>{empty || 'No data'}</Text></View>
        ) : rows.map((r, i) => (
          <View key={r._key || i} style={styles.tRow} testID={rowTestID ? rowTestID(r) : undefined}>
            {columns.map((c) => (
              <View key={c.key} style={{ width: c.width, alignItems: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start', justifyContent: 'center' }}>
                {c.render ? c.render(r) : <Text style={[styles.tCell, { textAlign: c.align || 'left' }]} numberOfLines={1}>{r[c.key]}</Text>}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default function AdminFinanceCenterScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartKey, setChartKey] = useState(0);
  const [tab, setTab] = useState('admin-revenue');

  const [cashoutHistory, setCashoutHistory] = useState([]);
  const [totalCashedOut, setTotalCashedOut] = useState(0);

  const [section, setSection] = useState(null); // transactions dialog
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [cashoutOpen, setCashoutOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const spin = useRef(new Animated.Value(0)).current;

  const fetchCashoutHistory = useCallback(async () => {
    try { const { data: r } = await api.admin.getRevenueCashouts(); setCashoutHistory(r.cashouts || []); setTotalCashedOut(r.total_cashed_out || 0); } catch {}
  }, []);

  const load = useCallback(async (spinIcon) => {
    if (spinIcon) {
      spin.setValue(0);
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true })).start();
    }
    const [fc, ts] = await Promise.allSettled([api.admin.getFinanceCenter(), api.admin.getFinanceTimeseries()]);
    if (fc.status === 'fulfilled') setData(fc.value.data);
    if (ts.status === 'fulfilled') setTimeseries(ts.value.data?.series || []);
    fetchCashoutHistory();
    setLoading(false); setRefreshing(false);
    setChartKey((k) => k + 1);
    spin.stopAnimation();
  }, [fetchCashoutHistory, spin]);

  useEffect(() => { load(); }, [load]);

  /* ===== derived analytics ===== */
  const tsData = timeseries || [];
  const analytics = useMemo(() => {
    const withData = tsData.filter((d) => (d.orders || 0) > 0 || (d.profit || 0) !== 0 || (d.subscriptions || 0) !== 0 || (d.commissions || 0) !== 0);
    const rel = withData.length ? withData : tsData;
    const profitNow = rel.length ? rel[rel.length - 1].profit : 0;
    const profitNowLabel = rel.length ? rel[rel.length - 1].label : '—';
    const profitPrev = rel.length >= 2 ? rel[rel.length - 2].profit : 0;
    const profitDelta = profitPrev !== 0 ? Math.round(((profitNow - profitPrev) / Math.abs(profitPrev)) * 100) : (profitNow > 0 ? 100 : 0);
    const ytdProfit = tsData.reduce((s, d) => s + (d.profit || 0), 0);
    const bestMonth = tsData.reduce((b, d) => (d.profit > (b?.profit ?? -Infinity) ? d : b), null);
    const totalOutflows = tsData.reduce((s, d) => s + (d.monthly_credits || 0) + (d.agent_payouts || 0) + (d.loyalty_deductions || 0), 0);
    return { profitNow, profitNowLabel, profitDelta, ytdProfit, bestMonth, totalOutflows };
  }, [tsData]);

  if (loading || !data) {
    return (
      <AdminScreen testID="admin-finance-center">
        <Shimmer height={90} radius={radius.lg} />
        <Shimmer height={120} radius={radius.xxl} style={{ marginTop: 12 }} />
        <Shimmer height={120} radius={radius.xxl} style={{ marginTop: 12 }} />
        <Shimmer height={48} radius={radius.pill} style={{ marginTop: 12 }} />
      </AdminScreen>
    );
  }

  const { admin_revenue = {}, shop_order_money = {}, agent_money = {}, pending_orders = {}, delivery_fees = {}, delivery_owed = {}, total_money_held, period } = data;
  const periodLabel = period?.label || 'All time';
  const availableBalance = admin_revenue.available_balance ?? Math.max(0, (admin_revenue.admin_profit ?? admin_revenue.net_total ?? 0) - (admin_revenue.admin_cashouts ?? 0));

  const heldBreakdown = [
    { name: 'Admin Available', value: Math.max(0, availableBalance), color: colors.s600 },
    { name: 'Shop Wallets', value: Math.max(0, shop_order_money.total || 0), color: colors.p450 },
    { name: 'Agent Wallets', value: Math.max(0, agent_money.total || 0), color: '#ec4899' },
    { name: 'Pending Orders', value: Math.max(0, pending_orders.total || 0), color: '#f59e0b' },
    { name: 'Held Delivery', value: Math.max(0, delivery_fees.total_unreleased || 0), color: '#06b6d4' },
  ].filter((d) => d.value > 0);
  const heldTotal = heldBreakdown.reduce((s, d) => s + d.value, 0);

  const refreshAll = () => { setRefreshing(true); load(true); };

  const downloadCsv = async () => {
    try {
      const dest = FileSystem.cacheDirectory + `finance_all_${new Date().toISOString().slice(0, 10)}.csv`;
      const { uri, status } = await FileSystem.downloadAsync(`${API_BASE_URL}${api.admin.financeCsvPath}?type=all`, dest, { headers: { Authorization: `Bearer ${getAuthToken()}` } });
      if (status !== 200) throw new Error('bad');
      notifySuccess(); toast.success('CSV exported');
      try { await Share.share(Platform.OS === 'ios' ? { url: uri } : { message: uri, title: 'Finance CSV' }); } catch {}
    } catch { toast.error('Failed to export CSV'); }
  };

  const confirmReset = async () => {
    setResetting(true);
    try { await api.admin.resetRevenue(); toast.success('Revenue & profit reset to $0'); setResetOpen(false); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || 'Failed to reset revenue'); }
    finally { setResetting(false); }
  };

  const releaseFee = async (feeId) => {
    try { await api.admin.releaseDeliveryFee(feeId); toast.success('Delivery fee released'); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || 'Failed to release fee'); }
  };
  const settleOne = async (orderId) => {
    try { await api.admin.settleDeliveryCash(orderId); toast.success('Order marked as paid'); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || 'Failed to mark paid'); }
  };
  const settleAll = async () => {
    try { const { data: r } = await api.admin.settleDeliveryCashBulk('all'); toast.success(r?.message || 'Bulk settle complete'); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || 'Failed to settle'); }
  };

  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <AdminScreen testID="admin-finance-center" refreshing={refreshing} onRefresh={refreshAll}>
      {/* ===== HEADER ===== */}
      <AdminHeroCard
        icon="wallet" title="Finance Center" titleTestID="admin-finance-center-title" subtitle="Complete overview of platform finances"
        actions={<>
          <HdrBtn label="Adjust" icon="settings-outline" tone="amber" onPress={() => setAdjustOpen(true)} testID="adjust-btn" />
          <HdrBtn label="CSV" icon="download-outline" tone="outline" onPress={downloadCsv} testID="download-csv-btn" />
          <HdrBtn icon="refresh" tone="outline" onPress={refreshAll} testID="refresh-btn" spinStyle={{ transform: [{ rotate: spinDeg }] }} />
          <HdrBtn label="Reset Revenue" icon="warning-outline" tone="rose" onPress={() => setResetOpen(true)} testID="reset-revenue-btn" />
        </>}
      />

      {/* ===== MONEY HEROES ===== */}
      <View style={{ gap: 12 }}>
        <MoneyHero testID="total-money-card" grad={[colors.p500, colors.s500]} label="Total Money Held" labelColor={colors.p200} value={total_money_held} sub="Live balances + pending orders + held delivery fees" icon="cash" />
        <MoneyHero testID="period-profit-card" grad={['#059669', '#0d9488']} label={`Admin Profit · ${periodLabel}`} labelColor="#a7f3d0" value={admin_revenue.admin_profit} valueTestID="period-profit-value" sub="Subscriptions + Commissions + Adjustments − Credits − Payouts" icon="trending-up" />
      </View>

      {/* ===== TABS ===== */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          const badge = t.key === 'agent-money' ? agent_money.agents?.length : t.key === 'pending-orders' ? pending_orders.orders?.length : t.key === 'delivery-fees' ? (delivery_fees.fees || []).filter((f) => !f.released).length : 0;
          const Inner = (
            <View style={styles.tabInner}>
              <Ionicons name={t.icon} size={14} color={active ? colors.white : colors.textSecondary} />
              <Text style={[styles.tabText, active && { color: colors.white }]}>{t.label}</Text>
              {badge > 0 && <View style={[styles.tabBadge, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}><Text style={[styles.tabBadgeText, active && { color: colors.white }]}>{badge}</Text></View>}
            </View>
          );
          return (
            <TouchableOpacity key={t.key} activeOpacity={0.85} onPress={() => setTab(t.key)} testID={`tab-${t.key}`}>
              {active ? <LinearGradient colors={t.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tabPill}>{Inner}</LinearGradient> : <View style={[styles.tabPill, styles.tabPillIdle]}>{Inner}</View>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ===== PANELS ===== */}
      <View key={`panel-${tab}`} style={{ marginTop: 14 }}>
        {tab === 'admin-revenue' && (
          <AdminRevenuePanel
            adminRevenue={admin_revenue} availableBalance={availableBalance} deliveryOwed={delivery_owed}
            cashoutHistory={cashoutHistory} totalCashedOut={totalCashedOut}
            onSection={setSection} onCashout={() => setCashoutOpen(true)} onSettleOne={settleOne} onSettleAll={settleAll}
          />
        )}
        {tab === 'shop-money' && <ShopMoneyPanel shopMoney={shop_order_money} />}
        {tab === 'agent-money' && <AgentMoneyPanel agentMoney={agent_money} adminRevenue={admin_revenue} onSection={setSection} onView={() => navigation.navigate('AdminAgents')} onRequests={() => navigation.navigate('AdminRequests', { kind: 'agent_cashout' })} />}
        {tab === 'pending-orders' && <PendingOrdersPanel pending={pending_orders} />}
        {tab === 'delivery-fees' && <DeliveryFeesPanel deliveryFees={delivery_fees} onRelease={releaseFee} />}
      </View>

      {/* ===== ANALYTICS ===== */}
      <View style={{ marginTop: 20 }} testID="finance-analytics-section">
        <View style={styles.anHead}>
          <LinearGradient colors={['#ffc0cb', colors.p500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.anTile}><Ionicons name="bar-chart" size={20} color={colors.white} /></LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.anTitle}>Analytics & Insights</Text>
            <Text style={styles.anSub}>Profit trends, revenue streams & money-held breakdown (last 12 months)</Text>
          </View>
        </View>

        {/* KPI strip */}
        <View style={styles.kpiRow}>
          <KpiTile testID="kpi-profit-mom" icon="pulse" iconColor="#10b981" label="Latest Month Profit" value={analytics.profitNow} foot={`${analytics.profitDelta >= 0 ? '▲' : '▼'} ${Math.abs(analytics.profitDelta)}% · ${analytics.profitNowLabel}`} footColor={analytics.profitDelta >= 0 ? '#059669' : '#ef4444'} />
          <KpiTile testID="kpi-ytd-profit" icon="trending-up" iconColor={colors.s600} label="12-Month Profit" value={analytics.ytdProfit} foot={`Across ${tsData.length} months`} />
        </View>
        <View style={[styles.kpiRow, { marginTop: 10 }]}>
          <KpiTile testID="kpi-best-month" icon="sparkles" iconColor="#f59e0b" label="Best Month" value={analytics.bestMonth ? analytics.bestMonth.profit : 0} foot={analytics.bestMonth ? analytics.bestMonth.label : 'No data'} />
          <KpiTile testID="kpi-outflows" icon="remove-circle" iconColor="#f43f5e" label="Total Outflows" value={analytics.totalOutflows} valueColor="#e11d48" foot="Credits + payouts + loyalty" />
        </View>

        {/* Charts */}
        <View key={`fc-${chartKey}`}>
          <AdminCard title="Profit Trend" icon="trending-up" testID="chart-profit-trend">
            {tsData.length > 0 ? (
              <LineChart areaChart curved isAnimated animationDuration={900} data={tsData.map((d) => ({ value: d.profit || 0, label: d.short }))}
                width={CHART_W} height={200} spacing={(CHART_W - 30) / Math.max(1, tsData.length)} initialSpacing={12} endSpacing={8}
                color={CHART_GRAD.profit} thickness={2.5} startFillColor={CHART_GRAD.profit} endFillColor={CHART_GRAD.profit} startOpacity={0.35} endOpacity={0.02}
                hideDataPoints hideRules yAxisThickness={0} xAxisThickness={0} noOfSections={3} xAxisLabelTextStyle={styles.axis} yAxisTextStyle={styles.axis} />
            ) : <Empty label="No data" />}
          </AdminCard>

          <AdminCard title="Money Held Breakdown" icon="pie-chart" testID="chart-held-breakdown">
            {heldBreakdown.length > 0 ? (
              <View style={{ alignItems: 'center' }}>
                <PieChart data={heldBreakdown.map((d) => ({ value: d.value, color: d.color }))} donut radius={82} innerRadius={52} isAnimated animationDuration={800}
                  centerLabelComponent={() => <View style={{ alignItems: 'center' }}><MoneyCountUp value={heldTotal} style={styles.donutCenter} /><Text style={styles.donutSub}>held</Text></View>} />
                <View style={{ alignSelf: 'stretch', marginTop: 12, gap: 6 }}>
                  {heldBreakdown.map((d) => (
                    <View key={d.name} style={styles.legendRow}>
                      <View style={styles.legendLeft}><View style={[styles.dot, { backgroundColor: d.color }]} /><Text style={styles.legendName}>{d.name}</Text></View>
                      <Text style={styles.legendVal}>{money(d.value)} <Text style={styles.legendPct}>({heldTotal ? Math.round(d.value / heldTotal * 100) : 0}%)</Text></Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : <Empty label="No money currently held" />}
          </AdminCard>

          <AdminCard title="Revenue Streams" icon="bar-chart" testID="chart-revenue-streams">
            {tsData.length > 0 ? (
              <View style={{ paddingTop: 6 }}>
                <BarChart stackData={tsData.map((d) => ({ label: d.short, stacks: [
                  { value: d.subscriptions || 0, color: CHART_GRAD.subs },
                  { value: d.commissions || 0, color: CHART_GRAD.comm },
                  { value: d.platform_services || 0, color: CHART_GRAD.svc },
                ] }))}
                  width={CHART_W} height={200} barWidth={14} spacing={Math.max(4, (CHART_W - 40) / Math.max(1, tsData.length) - 14)} initialSpacing={12}
                  isAnimated animationDuration={800} hideRules yAxisThickness={0} xAxisThickness={0} noOfSections={3} xAxisLabelTextStyle={styles.axis} yAxisTextStyle={styles.axis} />
                <View style={styles.chartLegend}>
                  <LegendChip color={CHART_GRAD.subs} label="Subscriptions" /><LegendChip color={CHART_GRAD.comm} label="Commissions" /><LegendChip color={CHART_GRAD.svc} label="Services" />
                </View>
              </View>
            ) : <Empty label="No data" />}
          </AdminCard>

          <AdminCard title="Outflows Over Time" icon="remove-circle" testID="chart-outflows">
            {tsData.length > 0 ? (
              <View style={{ paddingTop: 6 }}>
                <LineChart isAnimated animationDuration={900} curved
                  data={tsData.map((d) => ({ value: d.monthly_credits || 0, label: d.short }))}
                  data2={tsData.map((d) => ({ value: d.agent_payouts || 0 }))}
                  color1={CHART_GRAD.credits} color2={CHART_GRAD.payouts} thickness={2}
                  width={CHART_W} height={190} spacing={(CHART_W - 30) / Math.max(1, tsData.length)} initialSpacing={12} endSpacing={8}
                  hideDataPoints hideRules yAxisThickness={0} xAxisThickness={0} noOfSections={3} xAxisLabelTextStyle={styles.axis} yAxisTextStyle={styles.axis} />
                <View style={styles.chartLegend}>
                  <LegendChip color={CHART_GRAD.credits} label="Credits" /><LegendChip color={CHART_GRAD.payouts} label="Agent Payouts" />
                </View>
              </View>
            ) : <Empty label="No data" />}
          </AdminCard>
        </View>
      </View>

      {/* ===== DIALOGS ===== */}
      <TransactionsSheet section={section} onClose={() => setSection(null)} />
      <CashoutSheet open={cashoutOpen} onClose={() => setCashoutOpen(false)} available={Math.max(0, (admin_revenue.net_total || 0) - totalCashedOut)} onDone={load} />
      <AdjustSheet open={adjustOpen} onClose={() => setAdjustOpen(false)} onDone={load} />
      <ResetSheet open={resetOpen} onClose={() => setResetOpen(false)} onConfirm={confirmReset} resetting={resetting} />
    </AdminScreen>
  );
}

/* ================= Header button ================= */
function HdrBtn({ label, icon, tone, onPress, testID, spinStyle }) {
  const map = {
    amber: { bg: null, grad: ['#f59e0b', '#f97316'], fg: colors.white, border: null },
    rose: { bg: '#fff1f2', grad: null, fg: '#e11d48', border: '#fecdd3' },
    outline: { bg: colors.surface, grad: null, fg: colors.textSecondary, border: colors.border },
  }[tone] || {};
  const body = (
    <>
      <Animated.View style={spinStyle}><Ionicons name={icon} size={13} color={map.fg} /></Animated.View>
      {label ? <Text style={[styles.hdrText, { color: map.fg }]}>{label}</Text> : null}
    </>
  );
  if (map.grad) {
    return <TouchableOpacity activeOpacity={0.85} onPress={onPress} testID={testID}><LinearGradient colors={map.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.hdrBtn}>{body}</LinearGradient></TouchableOpacity>;
  }
  return <TouchableOpacity activeOpacity={0.8} onPress={onPress} testID={testID} style={[styles.hdrBtn, { backgroundColor: map.bg, borderWidth: 1, borderColor: map.border }]}>{body}</TouchableOpacity>;
}

/* ================= Admin Revenue panel ================= */
function AdminRevenuePanel({ adminRevenue, availableBalance, deliveryOwed, cashoutHistory, totalCashedOut, onSection, onCashout, onSettleOne, onSettleAll }) {
  const [confirmOrder, setConfirmOrder] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const allOrders = deliveryOwed?.orders || [];
  const owed = allOrders.filter((o) => !o.settled);
  const cb = adminRevenue.commission_breakdown || [];
  const stats = [
    { key: 'subscriptions', title: 'Subscriptions', value: adminRevenue.subscriptions, icon: 'card', tint: 'blue', subtext: 'From shop subscription payments' },
    { key: 'commissions', title: 'Commissions', value: adminRevenue.commissions, icon: 'trending-up', tint: 'emerald', subtext: 'From order commission fees' },
    { key: 'adjustments', title: 'Adjustments', value: adminRevenue.adjustments, icon: 'settings', tint: 'orange', subtext: 'Manual revenue adjustments' },
    { key: 'platform_services', title: 'Platform Services', value: adminRevenue.platform_services, icon: 'sparkles', tint: 'purple', subtext: 'Spin wheel & product boosts' },
    { key: 'monthly_credits', title: 'New Shop + Monthly Credits (Given)', value: -(adminRevenue.monthly_credits || 0), icon: 'gift', tint: 'red', subtext: 'Credits given to shops monthly' },
    { key: 'admin_cashouts', title: 'Admin Cash Out', value: -(adminRevenue.admin_cashouts || 0), icon: 'wallet', tint: 'slate', subtext: 'Money admin has withdrawn' },
    { key: 'loyalty_deductions', title: 'Loyalty Point Deductions (Shop)', value: -(adminRevenue.loyalty_deductions || 0), icon: 'remove-circle', tint: 'rose', subtext: 'Shop payouts on loyalty-redeemed orders' },
    { key: 'shop_referral_first_pay', title: 'Shop referrals first pay', value: -(adminRevenue.agent_approval_bonus_payouts || 0), icon: 'gift', tint: 'fuchsia', subtext: '$4 bonus on referred-shop approval', testID: 'finance-shop-referral-first-pay' },
    { key: 'agent_commission', title: 'Loyalty Point Deductions (Agent)', value: -(adminRevenue.agent_commission_payouts || 0), icon: 'people', tint: 'fuchsia', subtext: "Agents' share of commission", testID: 'finance-agent-commission' },
  ];
  return (
    <View style={{ gap: 12 }}>
      <Cascade index={0}>
        <TintCard testID="admin-profit-card" bg="#ecfdf5" border="#a7f3d0">
          <Text style={[styles.tintLabel, { color: '#047857' }]}>ADMIN PROFIT</Text>
          <MoneyCountUp value={adminRevenue.admin_profit ?? adminRevenue.net_total} style={[styles.tintValue, { color: '#065f46' }]} />
          <Text style={[styles.tintNote, { color: '#059669' }]}>Subscriptions + Commissions + Adjustments + Platform Services − Credits − Loyalty − Referral Payouts</Text>
        </TintCard>
      </Cascade>

      <Cascade index={1}>
        <TintCard testID="available-balance-card" bg={colors.s50} border="#a5f3fc">
          <View style={styles.abRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tintLabel, { color: '#0e7490' }]}>AVAILABLE BALANCE</Text>
              <MoneyCountUp value={availableBalance} style={[styles.tintValue, { color: '#155e75', fontSize: 24 }]} />
              <Text style={[styles.tintNote, { color: '#0891b2' }]}>Admin Profit − Admin Cash Outs (${(adminRevenue.admin_cashouts ?? 0).toFixed(2)} withdrawn)</Text>
            </View>
            <TouchableOpacity style={styles.cashoutBtn} onPress={onCashout} testID="admin-cashout-open-btn"><Ionicons name="arrow-down" size={13} color={colors.white} /><Text style={styles.cashoutBtnText}>Cash Out</Text></TouchableOpacity>
          </View>
        </TintCard>
      </Cascade>

      {/* breakdown stats — openable */}
      <Cascade index={2} style={styles.statGrid}>
        {stats.map((s) => (
          <View key={s.key} style={{ width: '48.5%' }}>
            <FinanceStatCard title={s.title} value={s.value} icon={s.icon} tint={s.tint} subtext={s.subtext} onPress={() => onSection(s.key)} testID={s.testID} />
          </View>
        ))}
      </Cascade>
      <Text style={styles.hint}>Tap any card above to view its transactions</Text>

      {/* Delivery cash owed */}
      {allOrders.length > 0 && (
        <Cascade index={3}>
          <View style={styles.owedCard} testID="delivery-owed-section">
            <LinearGradient colors={['#f97316', '#f59e0b', '#eab308']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.owedHead}>
              <View style={styles.owedHeadRow}>
                <View style={styles.owedIcon}><Ionicons name="car" size={22} color={colors.white} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.owedEyebrow}>MONEY ON ITS WAY TO YOU</Text>
                  <Text style={styles.owedTitle}>Delivery Cash Owed to Admin</Text>
                </View>
              </View>
              <View style={styles.owedTotalRow}>
                <View>
                  <Text style={styles.owedTotalLabel}>TOTAL OWED</Text>
                  <MoneyCountUp value={deliveryOwed.total || 0} style={styles.owedTotal} testID="delivery-owed-total" />
                  <Text style={styles.owedCount}>{deliveryOwed.orders_owed_count || 0} unsettled order{(deliveryOwed.orders_owed_count || 0) !== 1 ? 's' : ''}</Text>
                </View>
                {owed.length > 0 && (
                  <TouchableOpacity style={styles.markAllBtn} onPress={() => setConfirmAll(true)} testID="settle-all-orders"><Ionicons name="checkmark-circle" size={15} color="#c2410c" /><Text style={styles.markAllText}>Mark All Paid</Text></TouchableOpacity>
                )}
              </View>
            </LinearGradient>
            <View style={{ padding: 12 }}>
              <DataTable
                testID="delivery-owed-table"
                rowTestID={(r) => `delivery-owed-row-${r.order_id}`}
                empty="No delivered orders yet"
                columns={[
                  { key: 'order_id', label: 'Order', width: 84, render: (r) => <Text style={styles.tMono}>#{String(r.order_id || '').slice(0, 8)}</Text> },
                  { key: 'customer_name', label: 'Customer', width: 110, render: (r) => <Text style={styles.tCell} numberOfLines={1}>{r.customer_name || 'Customer'}</Text> },
                  { key: 'total_amount', label: 'Total', width: 76, align: 'right', render: (r) => <Text style={styles.tCell}>{money(r.total_amount)}</Text> },
                  { key: 'delivery_fee', label: 'Fee', width: 66, align: 'right', render: (r) => <Text style={styles.tMuted}>{money(r.delivery_fee)}</Text> },
                  { key: 'amount_owed', label: 'Owed', width: 80, align: 'right', render: (r) => <Text style={styles.tOwed}>{money(r.amount_owed)}</Text> },
                  { key: 'action', label: 'Action', width: 90, align: 'right', render: (r) => r.settled
                    ? <View style={styles.paidBadge} testID={`paid-badge-${r.order_id}`}><Ionicons name="checkmark-circle" size={12} color="#059669" /><Text style={styles.paidBadgeText}>Paid</Text></View>
                    : <TouchableOpacity style={styles.paidBtn} onPress={() => setConfirmOrder(r)} testID={`paid-order-${r.order_id}`}><Ionicons name="checkmark-circle" size={12} color={colors.white} /><Text style={styles.paidBtnText}>Paid</Text></TouchableOpacity> },
                ]}
                rows={allOrders.map((o) => ({ ...o, _key: o.order_id }))}
              />
            </View>
          </View>
        </Cascade>
      )}

      {/* Commission breakdown */}
      <Cascade index={4}>
        <AdminCard title="Commission Breakdown by Shop" icon="trending-up" testID="commission-breakdown-section" right={<Text style={styles.badgeOutline}>{money(adminRevenue.commissions)} total</Text>}>
          {cb.length > 0 ? (
            <DataTable
              rowTestID={(r) => `commission-row-${r.shop_id}`}
              columns={[
                { key: 'shop_name', label: 'Shop', width: 120, render: (r) => <Text style={styles.tCell} numberOfLines={1}>{r.shop_name}</Text> },
                { key: 'commission_type', label: 'Type', width: 96, render: (r) => <Text style={styles.tMuted}>{r.commission_type === 'on_shop' ? 'On Shop' : r.commission_type === 'half_half' ? 'Half/Half' : 'On Customer'}</Text> },
                { key: 'rate', label: 'Rate', width: 56, align: 'right', render: (r) => <Text style={styles.tMuted}>{r.commission_percentage != null ? `${r.commission_percentage}%` : '—'}</Text> },
                { key: 'order_count', label: 'Orders', width: 60, align: 'right', render: (r) => <Text style={styles.tMuted}>{r.order_count}</Text> },
                { key: 'total_order_value', label: 'Order Value', width: 92, align: 'right', render: (r) => <Text style={styles.tMuted}>{money(r.total_order_value)}</Text> },
                { key: 'total_commission', label: 'Earned', width: 84, align: 'right', render: (r) => <Text style={styles.tEmerald}>{money(r.total_commission)}</Text> },
              ]}
              rows={cb.map((s, i) => ({ ...s, _key: s.shop_id || i }))}
            />
          ) : (
            <View style={styles.empty}><Ionicons name="trending-up" size={26} color={colors.textMuted} /><Text style={styles.emptyText}>No commission data yet</Text></View>
          )}
        </AdminCard>
      </Cascade>

      {/* Recent cash outs */}
      {cashoutHistory.length > 0 && (
        <Cascade index={5}>
          <AdminCard title="Recent Admin Cash Outs" icon="wallet" testID="admin-cashout-section" right={<Text style={styles.badgeOutline}>Total: {money(totalCashedOut)}</Text>}>
            {cashoutHistory.slice(0, 5).map((c) => (
              <View key={c.id} style={styles.coRow}>
                <Text style={styles.coNote} numberOfLines={1}>{c.note}</Text>
                <View style={{ alignItems: 'flex-end' }}><Text style={styles.coAmt}>{money(c.amount)}</Text><Text style={styles.coDate}>{fmtDate(c.created_at)}</Text></View>
              </View>
            ))}
          </AdminCard>
        </Cascade>
      )}

      <ConfirmSheet open={!!confirmOrder} onClose={() => setConfirmOrder(null)} testID="confirm-paid-dialog"
        title="Mark this order as paid?" body={confirmOrder ? `Confirm you received ${money(confirmOrder.amount_owed)} for order #${String(confirmOrder.order_id).slice(0, 8)} from delivery.` : ''}
        confirmLabel="Yes, mark as paid" onConfirm={() => { const id = confirmOrder.order_id; setConfirmOrder(null); onSettleOne(id); }} />
      <ConfirmSheet open={confirmAll} onClose={() => setConfirmAll(false)} testID="confirm-paid-all-dialog"
        title={`Mark all ${owed.length} order(s) as paid?`} body={`Confirm you received a total of ${money(deliveryOwed.total || 0)} from delivery. This sets all ${owed.length} unsettled order(s) to Paid.`}
        confirmLabel="Yes, mark all as paid" onConfirm={() => { setConfirmAll(false); onSettleAll(); }} />
    </View>
  );
}

/* ================= Shop Money panel ================= */
function ShopMoneyPanel({ shopMoney }) {
  return (
    <View style={{ gap: 12 }}>
      <Cascade index={0}>
        <TintCard testID="shop-money-total-card" bg="#eff6ff" border="#bfdbfe">
          <Text style={[styles.tintLabel, { color: '#1d4ed8' }]}>TOTAL SHOP MONEY (NOT CASHED OUT)</Text>
          <MoneyCountUp value={shopMoney.total} style={[styles.tintValue, { color: '#1e3a8a' }]} />
          <Text style={[styles.tintNote, { color: '#2563eb' }]}>Sum of all shop wallet balances (without delivery fees)</Text>
        </TintCard>
      </Cascade>
      <Cascade index={1}>
        <AdminCard title="Shop Wallet Breakdown" icon="storefront">
          <DataTable
            testID="shop-money-table" empty="No shops with wallet balance"
            columns={[
              { key: 'shop_name', label: 'Shop', width: 130, render: (r) => <Text style={styles.tCell} numberOfLines={1}>{r.shop_name}</Text> },
              { key: 'tier', label: 'Tier', width: 70, render: (r) => <Text style={styles.tMuted}>{r.tier ? r.tier.charAt(0).toUpperCase() + r.tier.slice(1) : '—'}</Text> },
              { key: 'wallet_balance', label: 'Wallet', width: 84, align: 'right', render: (r) => <Text style={styles.tCell}>{money(r.wallet_balance)}</Text> },
              { key: 'pending_cashout', label: 'Pending', width: 84, align: 'right', render: (r) => <Text style={styles.tAmber}>{money(r.pending_cashout)}</Text> },
              { key: 'total_cashed_out', label: 'Cashed Out', width: 92, align: 'right', render: (r) => <Text style={styles.tMuted}>{money(r.total_cashed_out)}</Text> },
            ]}
            rows={(shopMoney.shops || []).map((s) => ({ ...s, _key: s.shop_id }))}
          />
        </AdminCard>
      </Cascade>
    </View>
  );
}

/* ================= Agent Money panel ================= */
function AgentMoneyPanel({ agentMoney, adminRevenue, onSection, onView, onRequests }) {
  return (
    <View style={{ gap: 12 }}>
      <Cascade index={0}>
        <TintCard testID="agent-money-total-card" bg="#fff0f3" border="#ffd6de">
          <Text style={[styles.tintLabel, { color: '#be3a5c' }]}>TOTAL AGENT MONEY (NOT CASHED OUT)</Text>
          <MoneyCountUp value={agentMoney.total || 0} style={[styles.tintValue, { color: '#be3a5c' }]} />
          <Text style={[styles.tintNote, { color: '#f06a92' }]}>Wallet balances held by all referral agents</Text>
          <View style={styles.agentPendRow}>
            <View><Text style={styles.agentPendLabel}>Pending Cash-outs</Text><Text style={styles.agentPendVal}>{money(agentMoney.pending_cashout_amount || 0)}</Text><Text style={styles.agentPendCount}>{agentMoney.pending_cashout_count || 0} request(s)</Text></View>
            <TouchableOpacity style={styles.reqBtn} onPress={onRequests}><Ionicons name="open-outline" size={13} color="#be3a5c" /><Text style={styles.reqBtnText}>Cash-out Requests</Text></TouchableOpacity>
          </View>
        </TintCard>
      </Cascade>

      {/* the two finance-* deduction cards live here per CD2 */}
      <Cascade index={1} style={styles.statGrid}>
        <View style={{ width: '48.5%' }}>
          <FinanceStatCard testID="finance-shop-referral-first-pay" title="Shop referrals first pay" value={-(adminRevenue.agent_approval_bonus_payouts || 0)} icon="gift" tint="fuchsia" subtext="$4 bonus on referred-shop approval" onPress={() => onSection('shop_referral_first_pay')} />
        </View>
        <View style={{ width: '48.5%' }}>
          <FinanceStatCard testID="finance-agent-commission" title="Agent Commission Payouts" value={-(adminRevenue.agent_commission_payouts || 0)} icon="people" tint="fuchsia" subtext="Agents' share of commission" onPress={() => onSection('agent_commission')} />
        </View>
      </Cascade>

      <Cascade index={2}>
        <AdminCard title="Referral Agents & Their Wallets" icon="people">
          <DataTable
            empty="No referral agents yet"
            rowTestID={(r) => `agent-money-row-${r.agent_id}`}
            columns={[
              { key: 'name', label: 'Agent', width: 130, render: (r) => <View><Text style={styles.tCell} numberOfLines={1}>{r.name}</Text><Text style={styles.tMuted} numberOfLines={1}>{r.email}</Text></View> },
              { key: 'referral_code', label: 'Code', width: 84, render: (r) => <Text style={styles.tMono}>{r.referral_code || '—'}</Text> },
              { key: 'comm', label: 'Share', width: 56, align: 'right', render: (r) => <Text style={styles.tMuted}>{Number(r.commission_share_percent ?? 30).toFixed(0)}%</Text> },
              { key: 'bonus', label: 'Bonus', width: 60, align: 'right', render: (r) => <Text style={styles.tMuted}>${Number(r.approval_bonus_amount ?? 4).toFixed(2)}</Text> },
              { key: 'referred', label: 'Referred', width: 72, align: 'right', render: (r) => <Text style={styles.tMuted}>{r.referred_shops_approved || 0}/{r.referred_shops_count || 0}</Text> },
              { key: 'wallet_balance', label: 'Wallet', width: 80, align: 'right', render: (r) => <Text style={styles.tEmerald}>{money(r.wallet_balance)}</Text> },
              { key: 'total_earned', label: 'Lifetime', width: 84, align: 'right', render: (r) => <Text style={styles.tCell}>{money(r.total_earned)}</Text> },
              { key: 'total_cashed_out', label: 'Cashed Out', width: 92, align: 'right', render: (r) => <Text style={styles.tMuted}>{money(r.total_cashed_out)}</Text> },
              { key: 'pending', label: 'Pending', width: 80, align: 'right', render: (r) => <Text style={styles.tAmber}>{money(r.pending_cashout_amount)}</Text> },
              { key: 'action', label: '', width: 60, align: 'right', render: () => <TouchableOpacity style={styles.viewMini} onPress={onView}><Ionicons name="eye-outline" size={12} color={colors.textSecondary} /><Text style={styles.viewMiniText}>View</Text></TouchableOpacity> },
            ]}
            rows={(agentMoney.agents || []).map((a) => ({ ...a, _key: a.agent_id }))}
          />
        </AdminCard>
      </Cascade>
    </View>
  );
}

/* ================= Pending Orders panel ================= */
function PendingOrdersPanel({ pending }) {
  return (
    <View style={{ gap: 12 }}>
      <Cascade index={0}>
        <TintCard testID="pending-orders-total-card" bg="#fffbeb" border="#fde68a">
          <Text style={[styles.tintLabel, { color: '#b45309' }]}>TOTAL PENDING ORDERS MONEY</Text>
          <MoneyCountUp value={pending.total || 0} style={[styles.tintValue, { color: '#92400e' }]} />
          <Text style={[styles.tintNote, { color: '#d97706' }]}>Orders paid by wallet or card, not yet set to "paid"</Text>
        </TintCard>
      </Cascade>
      <Cascade index={1}>
        <AdminCard title="Pending Orders (Paid by Card or Wallet)" icon="time">
          <DataTable
            testID="pending-orders-table" empty="No pending wallet/card orders"
            columns={[
              { key: 'order_id', label: 'Order', width: 84, render: (r) => <Text style={styles.tMono}>#{String(r.order_id || '').slice(0, 8)}</Text> },
              { key: 'customer_name', label: 'Customer', width: 110, render: (r) => <Text style={styles.tCell} numberOfLines={1}>{r.customer_name}</Text> },
              { key: 'payment_method', label: 'Method', width: 72, render: (r) => <Text style={[styles.tMuted, { color: r.payment_method === 'wallet' ? colors.p500 : '#2563eb' }]}>{r.payment_method === 'wallet' ? 'Wallet' : 'Card'}</Text> },
              { key: 'order_status', label: 'Status', width: 84, render: (r) => <Text style={styles.tMuted}>{r.order_status}</Text> },
              { key: 'total_amount', label: 'Total', width: 76, align: 'right', render: (r) => <Text style={styles.tCell}>{money(r.total_amount)}</Text> },
              { key: 'commission_amount', label: 'Comm.', width: 72, align: 'right', render: (r) => <Text style={styles.tEmerald}>{money(r.commission_amount)}</Text> },
              { key: 'delivery_fee', label: 'Delivery', width: 74, align: 'right', render: (r) => <Text style={[styles.tCell, { color: '#2563eb' }]}>{money(r.delivery_fee)}</Text> },
              { key: 'created_at', label: 'Date', width: 96, align: 'right', render: (r) => <Text style={styles.tMuted}>{fmtDate(r.created_at)}</Text> },
            ]}
            rows={(pending.orders || []).map((o) => ({ ...o, _key: o.order_id }))}
          />
        </AdminCard>
      </Cascade>
    </View>
  );
}

/* ================= Delivery Fees panel ================= */
function DeliveryFeesPanel({ deliveryFees, onRelease }) {
  const [confirmFee, setConfirmFee] = useState(null);
  return (
    <View style={{ gap: 12 }}>
      <Cascade index={0} style={{ flexDirection: 'row', gap: 10 }}>
        <TintCard bg="#eff6ff" border="#bfdbfe" style={{ flex: 1 }}>
          <Text style={[styles.tintLabel, { color: '#1d4ed8' }]}>UNRELEASED FEES</Text>
          <MoneyCountUp value={deliveryFees.total_unreleased || 0} style={[styles.tintValue, { color: '#1e3a8a', fontSize: 22 }]} />
          <Text style={[styles.tintNote, { color: '#2563eb' }]}>Held from paid orders</Text>
        </TintCard>
        <TintCard bg="#ecfdf5" border="#a7f3d0" style={{ flex: 1 }}>
          <Text style={[styles.tintLabel, { color: '#047857' }]}>RELEASED FEES</Text>
          <MoneyCountUp value={deliveryFees.total_released || 0} style={[styles.tintValue, { color: '#065f46', fontSize: 22 }]} />
          <Text style={[styles.tintNote, { color: '#059669' }]}>Released to delivery</Text>
        </TintCard>
      </Cascade>
      <Cascade index={1}>
        <AdminCard title="Delivery Fees (Paid by Card & Wallet)" icon="car">
          <DataTable
            testID="delivery-fees-table" empty="No delivery fees yet"
            columns={[
              { key: 'order_id', label: 'Order', width: 84, render: (r) => <Text style={styles.tMono}>#{String(r.order_id || '').slice(0, 8)}</Text> },
              { key: 'shop_name', label: 'Shop', width: 100, render: (r) => <Text style={styles.tCell} numberOfLines={1}>{r.shop_name || '—'}</Text> },
              { key: 'customer_name', label: 'Customer', width: 100, render: (r) => <Text style={styles.tMuted} numberOfLines={1}>{r.customer_name || '—'}</Text> },
              { key: 'order_status', label: 'Status', width: 72, render: (r) => <Text style={styles.tMuted}>{r.order_status || '—'}</Text> },
              { key: 'amount', label: 'Amount', width: 78, align: 'right', render: (r) => <Text style={[styles.tCell, { color: '#1d4ed8' }]}>{money(r.amount)}</Text> },
              { key: 'released', label: 'Released', width: 66, align: 'center', render: (r) => <Ionicons name={r.released ? 'checkmark-circle' : 'alert-circle'} size={18} color={r.released ? '#10b981' : '#f59e0b'} /> },
              { key: 'action', label: 'Action', width: 88, align: 'center', render: (r) => (!r.released && r.order_status === 'paid')
                ? <TouchableOpacity style={styles.releaseBtn} onPress={() => setConfirmFee(r)} testID={`release-fee-${r.id}`}><Text style={styles.releaseText}>Release</Text></TouchableOpacity>
                : r.released ? <Text style={[styles.tMuted, { color: '#059669' }]}>Released</Text> : <Text style={styles.tMuted}>Waiting</Text> },
            ]}
            rows={(deliveryFees.fees || []).map((f) => ({ ...f, _key: f.id }))}
          />
        </AdminCard>
      </Cascade>
      <ConfirmSheet open={!!confirmFee} onClose={() => setConfirmFee(null)} title="Release Delivery Fee?"
        body={confirmFee ? `Release the delivery fee of ${money(confirmFee.amount)} for order #${String(confirmFee.order_id || '').slice(0, 8)}? This decreases it from money held.` : ''}
        confirmLabel="Confirm Release" tone="blue" onConfirm={() => { const id = confirmFee.id; setConfirmFee(null); onRelease(id); }} />
    </View>
  );
}

/* ================= KPI tile ================= */
function KpiTile({ icon, iconColor, label, value, foot, footColor, valueColor, testID }) {
  return (
    <View style={styles.kpi} testID={testID}>
      <View style={styles.kpiHead}><Ionicons name={icon} size={13} color={iconColor} /><Text style={styles.kpiLabel}>{label}</Text></View>
      <MoneyCountUp value={value} style={[styles.kpiValue, valueColor && { color: valueColor }]} />
      <Text style={[styles.kpiFoot, footColor && { color: footColor }]}>{foot}</Text>
    </View>
  );
}

function LegendChip({ color, label }) {
  return <View style={styles.legendLeft}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={styles.legendChipText}>{label}</Text></View>;
}
function Empty({ label }) { return <View style={styles.empty}><Text style={styles.emptyText}>{label}</Text></View>; }

/* ================= Transactions sheet ================= */
function TransactionsSheet({ section, onClose }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [txns, setTxns] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [busy, setBusy] = useState(false);
  const meta = section ? SECTION[section] : null;

  const fetch = useCallback((type, p) => {
    setBusy(true);
    api.admin.getFinanceTransactions(type, p, 20).then(({ data }) => {
      setTxns(data.transactions || []); setTotal(data.total || 0); setTotalPages(data.total_pages || 0); setPage(p);
    }).catch(() => setTxns([])).finally(() => setBusy(false));
  }, []);
  useEffect(() => { if (section) fetch(section, 1); }, [section, fetch]);

  return (
    <Modal visible={!!section} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb, height: '80%' }]} testID="transactions-dialog">
        <View style={styles.grabber} />
        <View style={styles.txHeadRow}>
          {meta && <Ionicons name={meta.icon} size={18} color={meta.color} />}
          <Text style={styles.sheetTitle}>{meta ? `${meta.label} Transactions` : 'Transactions'}</Text>
        </View>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {busy ? <View style={{ paddingVertical: 40, alignItems: 'center' }}><Spinner size={26} color={colors.violet} /></View>
            : txns.length === 0 ? <View style={styles.empty}><Ionicons name="time-outline" size={26} color={colors.textMuted} /><Text style={styles.emptyText}>No transactions yet</Text></View>
              : txns.map((t, i) => {
                const debit = t.direction === 'debit';
                return (
                  <View key={t.id || i} style={styles.txRow} testID="transaction-row">
                    <View style={[styles.txIcon, { backgroundColor: debit ? '#fee2e2' : '#d1fae5' }]}><Ionicons name={debit ? 'arrow-down' : 'arrow-up'} size={15} color={debit ? '#dc2626' : '#059669'} /></View>
                    <View style={{ flex: 1 }}><Text style={styles.txNote} numberOfLines={1}>{t.note || t.description || t.subtype || 'Transaction'}</Text><Text style={styles.txDate}>{t.shop_name ? `${t.shop_name} · ` : ''}{fmtDate(t.created_at)}</Text></View>
                    <Text style={[styles.txAmt, { color: debit ? '#dc2626' : '#059669' }]}>{debit ? '-' : '+'}{money(t.amount)}</Text>
                  </View>
                );
              })}
        </ScrollView>
        {totalPages > 1 && (
          <View style={styles.pager}>
            <Text style={styles.pagerText}>Page {page} of {totalPages} ({total} total)</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity disabled={page <= 1} onPress={() => fetch(section, page - 1)} style={[styles.pagerBtn, page <= 1 && styles.pagerDisabled]}><Text style={styles.pagerBtnText}>Prev</Text></TouchableOpacity>
              <TouchableOpacity disabled={page >= totalPages} onPress={() => fetch(section, page + 1)} style={[styles.pagerBtn, page >= totalPages && styles.pagerDisabled]}><Text style={styles.pagerBtnText}>Next</Text></TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

/* ================= Cashout sheet ================= */
function CashoutSheet({ open, onClose, available, onDone }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    setBusy(true);
    try { await api.admin.cashoutRevenue({ amount: amt, note: note || 'Admin revenue cash out' }); notifySuccess(); toast.success('Cash out complete'); setAmount(''); setNote(''); onClose(); onDone(); }
    catch (e) { notifyError(); toast.error(e?.response?.data?.detail || 'Cash out failed'); }
    finally { setBusy(false); }
  };
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
        <View style={styles.grabber} />
        <View style={styles.txHeadRow}><Ionicons name="wallet" size={18} color={colors.seller} /><Text style={styles.sheetTitle}>Cash Out Revenue</Text></View>
        <View style={styles.availBox}><Text style={styles.availLabel}>Available to cash out</Text><Text style={styles.availValue}>{money(available)}</Text></View>
        <TextInput style={styles.input} placeholder="Amount ($)" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={amount} onChangeText={setAmount} testID="admin-cashout-amount" />
        <TextInput style={styles.input} placeholder="Note (optional)" placeholderTextColor={colors.textMuted} value={note} onChangeText={setNote} />
        <TouchableOpacity activeOpacity={0.9} onPress={submit} disabled={busy} testID="admin-cashout-confirm">
          <LinearGradient colors={['#10b981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>{busy ? <Spinner size={18} color={colors.white} /> : <Text style={styles.submitText}>Cash Out {amount ? `$${parseFloat(amount || 0).toFixed(2)}` : ''}</Text>}</LinearGradient>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

/* ================= Adjust sheet ================= */
function AdjustSheet({ open, onClose, onDone }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [type, setType] = useState('increase');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    setBusy(true);
    try { await api.admin.adjustRevenue({ amount: amt, type, description: note || `Manual ${type}` }); notifySuccess(); toast.success(`Revenue ${type}d by $${amt.toFixed(2)}`); setAmount(''); setNote(''); setType('increase'); onClose(); onDone(); }
    catch (e) { notifyError(); toast.error(e?.response?.data?.detail || 'Adjustment failed'); }
    finally { setBusy(false); }
  };
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
        <View style={styles.grabber} />
        <View style={styles.txHeadRow}><Ionicons name="settings" size={18} color="#ea580c" /><Text style={styles.sheetTitle}>Adjust Admin Revenue</Text></View>
        <View style={styles.toggle}>
          <TouchableOpacity style={[styles.toggleBtn, type === 'increase' && styles.toggleInc]} onPress={() => setType('increase')}><Ionicons name="add-circle" size={18} color={type === 'increase' ? '#047857' : colors.textMuted} /><Text style={[styles.toggleText, type === 'increase' && { color: '#047857' }]}>Increase</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtn, type === 'decrease' && styles.toggleDec]} onPress={() => setType('decrease')}><Ionicons name="remove-circle" size={18} color={type === 'decrease' ? '#be123c' : colors.textMuted} /><Text style={[styles.toggleText, type === 'decrease' && { color: '#be123c' }]}>Decrease</Text></TouchableOpacity>
        </View>
        <TextInput style={styles.input} placeholder="Amount ($)" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={amount} onChangeText={setAmount} testID="adjust-amount-input" />
        <TextInput style={styles.input} placeholder="Note (optional)" placeholderTextColor={colors.textMuted} value={note} onChangeText={setNote} />
        <TouchableOpacity activeOpacity={0.9} onPress={submit} disabled={busy} testID="confirm-adjust-btn">
          <LinearGradient colors={type === 'increase' ? ['#10b981', '#059669'] : ['#f43f5e', '#e11d48']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>{busy ? <Spinner size={18} color={colors.white} /> : <Text style={styles.submitText}>{type === 'increase' ? 'Increase' : 'Decrease'} by {amount ? `$${parseFloat(amount || 0).toFixed(2)}` : '$0.00'}</Text>}</LinearGradient>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

/* ================= Reset sheet ================= */
function ResetSheet({ open, onClose, onConfirm, resetting }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const items = ['Subscription revenue records', 'Order commission amounts (set to $0)', 'Profit ledger (platform services, credits, loyalty)', 'Manual revenue adjustments', 'Admin cash-out history (available balance)'];
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]} testID="reset-revenue-dialog">
        <View style={styles.grabber} />
        <View style={styles.txHeadRow}><Ionicons name="alert-circle" size={18} color="#dc2626" /><Text style={[styles.sheetTitle, { color: '#dc2626' }]}>Reset Revenue & Profit?</Text></View>
        <Text style={styles.resetIntro}>This permanently resets <Text style={{ fontFamily: fonts.bold }}>both Total Revenue and Admin Profit to $0</Text>. It clears:</Text>
        <View style={{ gap: 5, marginVertical: 10 }}>
          {items.map((it) => <View key={it} style={styles.resetItem}><View style={styles.resetDot} /><Text style={styles.resetItemText}>{it}</Text></View>)}
        </View>
        <Text style={styles.resetWarn}>Shop wallets & orders are kept. This cannot be undone.</Text>
        <View style={styles.resetActions}>
          <TouchableOpacity style={styles.resetCancel} onPress={onClose} testID="reset-revenue-cancel"><Text style={styles.resetCancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={styles.resetConfirm} onPress={onConfirm} disabled={resetting} testID="reset-revenue-confirm">{resetting ? <Spinner size={16} color={colors.white} /> : <Text style={styles.resetConfirmText}>Reset Everything</Text>}</TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ================= Generic confirm sheet ================= */
function ConfirmSheet({ open, onClose, title, body, confirmLabel, onConfirm, tone = 'emerald', testID }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const grad = tone === 'blue' ? ['#3b82f6', '#2563eb'] : ['#10b981', '#059669'];
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]} testID={testID}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>{title}</Text>
        <Text style={styles.confirmBody}>{body}</Text>
        <View style={styles.resetActions}>
          <TouchableOpacity style={styles.resetCancel} onPress={onClose}><Text style={styles.resetCancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} onPress={onConfirm} style={{ flex: 1 }}><LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmBtn}><Text style={styles.confirmBtnText}>{confirmLabel}</Text></LinearGradient></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /* header buttons */
  hdrBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  hdrText: { fontFamily: fonts.bold, fontSize: 11.5 },

  /* money heroes */
  moneyHero: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 18, overflow: 'hidden', ...shadow.emphasis },
  mhCircle: { position: 'absolute', top: -40, right: -30, width: 130, height: 130, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.06)' },
  mhParticle: { position: 'absolute', top: 22, right: 90, width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  mhLabel: { fontFamily: fonts.semibold, fontSize: 12.5 },
  mhValue: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 30, letterSpacing: -1, marginTop: 2 },
  mhSub: { fontFamily: fonts.body, fontSize: 10.5, marginTop: 6, opacity: 0.9 },
  mhTile: { width: 56, height: 56, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },

  /* tint cards */
  tint: { borderRadius: radius.lg, borderWidth: 1, padding: 16 },
  tintLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  tintValue: { fontFamily: fonts.extrabold, fontSize: 28, letterSpacing: -0.5, marginTop: 4 },
  tintNote: { fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  abRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cashoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0891b2', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  cashoutBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },

  /* tabs */
  tabPill: { borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  tabPillIdle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.textSecondary },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  tabBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.violet },

  /* finance stat cards */
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  fstat: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 14, overflow: 'hidden', ...shadow.card, minHeight: 108 },
  fstatOrb: { position: 'absolute', top: -14, right: -14, width: 56, height: 56, borderRadius: 28 },
  fstatTop: { flexDirection: 'row', gap: 8 },
  fstatTitle: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.3, textTransform: 'uppercase', color: colors.textMuted },
  fstatValue: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink, marginTop: 4, letterSpacing: -0.5 },
  fstatSub: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted, marginTop: 4 },
  fstatTile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 2 },

  /* tables */
  tHead: { flexDirection: 'row', gap: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 },
  tHeadCell: { fontFamily: fonts.bold, fontSize: 9.5, letterSpacing: 0.3, textTransform: 'uppercase', color: colors.textMuted },
  tRow: { flexDirection: 'row', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight, alignItems: 'center' },
  tCell: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
  tMuted: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary },
  tMono: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  tEmerald: { fontFamily: fonts.bold, fontSize: 12, color: '#059669' },
  tAmber: { fontFamily: fonts.semibold, fontSize: 12, color: '#d97706' },
  tOwed: { fontFamily: fonts.bold, fontSize: 12, color: '#c2410c' },
  tEmpty: { paddingVertical: 24, alignItems: 'center' },
  tEmptyText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
  badgeOutline: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.textSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  viewMini: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  viewMiniText: { fontFamily: fonts.bold, fontSize: 10, color: colors.textSecondary },

  /* delivery owed */
  owedCard: { borderRadius: radius.lg, overflow: 'hidden', ...shadow.emphasis, backgroundColor: colors.surface },
  owedHead: { padding: 16 },
  owedHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  owedIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  owedEyebrow: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1 },
  owedTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 18, marginTop: 2 },
  owedTotalRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 },
  owedTotalLabel: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.5 },
  owedTotal: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 30, letterSpacing: -1 },
  owedCount: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  markAllText: { color: '#c2410c', fontFamily: fonts.bold, fontSize: 12 },
  paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#d1fae5', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  paidBadgeText: { color: '#059669', fontFamily: fonts.bold, fontSize: 10 },
  paidBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#10b981', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  paidBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10 },

  /* agent pending */
  agentPendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#ffd6de' },
  agentPendLabel: { fontFamily: fonts.bold, fontSize: 10, color: '#b45309', textTransform: 'uppercase' },
  agentPendVal: { fontFamily: fonts.extrabold, fontSize: 18, color: '#92400e', marginTop: 2 },
  agentPendCount: { fontFamily: fonts.body, fontSize: 10, color: '#d97706' },
  reqBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#ffd6de', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  reqBtnText: { fontFamily: fonts.bold, fontSize: 11, color: '#be3a5c' },

  /* cash outs */
  coRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.borderLight },
  coNote: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  coAmt: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink },
  coDate: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted },

  /* analytics */
  anHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  anTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', ...shadow.violetGlow },
  anTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink },
  anSub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpi: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 14, ...shadow.card },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  kpiLabel: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.3, textTransform: 'uppercase', color: colors.textMuted, flex: 1 },
  kpiValue: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink, letterSpacing: -0.5 },
  kpiFoot: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.textMuted, marginTop: 4 },

  /* charts shared */
  axis: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 9 },
  donutCenter: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
  donutSub: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legendLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  legendVal: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  legendPct: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  chartLegend: { flexDirection: 'row', gap: 16, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
  legendChipText: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
  empty: { paddingVertical: 30, alignItems: 'center', gap: 6 },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  /* sheets */
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink },
  txHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  txIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  txNote: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  txDate: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, marginTop: 1 },
  txAmt: { fontFamily: fonts.extrabold, fontSize: 13.5 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight, marginTop: 8 },
  pagerText: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  pagerBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  pagerBtnText: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary },
  pagerDisabled: { opacity: 0.4 },
  availBox: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.md, padding: 12, marginBottom: 12 },
  availLabel: { fontFamily: fonts.semibold, fontSize: 11, color: '#059669' },
  availValue: { fontFamily: fonts.extrabold, fontSize: 22, color: '#047857', marginTop: 2 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 14, color: colors.ink, marginBottom: 10 },
  toggle: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border },
  toggleInc: { borderColor: colors.seller, backgroundColor: colors.sellerSoft },
  toggleDec: { borderColor: colors.sale, backgroundColor: colors.saleSoft },
  toggleText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },
  submit: { height: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },

  /* reset + confirm */
  resetIntro: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  resetItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resetDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.textMuted },
  resetItemText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, flex: 1 },
  resetWarn: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#ef4444' },
  resetActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  resetCancel: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, alignItems: 'center', paddingVertical: 13 },
  resetCancelText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
  resetConfirm: { flex: 1, backgroundColor: '#dc2626', borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingVertical: 13 },
  resetConfirmText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  confirmBody: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: 8 },
  confirmBtn: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingVertical: 13 },
  confirmBtnText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  releaseBtn: { borderWidth: 1, borderColor: '#bfdbfe', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  releaseText: { fontFamily: fonts.bold, fontSize: 11, color: '#2563eb' },
});
