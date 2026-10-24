import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ScrollView, Animated, Easing, Share, Platform, Dimensions } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PieChart, LineChart } from 'react-native-gifted-charts';
import * as FileSystem from 'expo-file-system/legacy';
import { api, getAuthToken } from '../../lib/api';
import { API_BASE_URL } from '../../config';
import { toast, Spinner } from '../../components/shop/ShopKit';
import { notifySuccess, notifyError } from '../../lib/haptics';
import { AdminScreen, AdminHeroCard, PillButton, AdminStatCard, AdminCard, StatusPill, Shimmer, CountUp } from '../../components/admin/AdminKit';
import { colors, admin, radius, fonts, shadow } from '../../theme/theme';

/* ===== Dashboard chart palette (verbatim from web COLORS) ===== */
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', colors.p450, '#ec4899'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STATUSES = ['pending', 'confirmed', 'paid', 'shipped', 'delivered'];
const ORDER_VARIANT = { pending: 'amber', confirmed: 'blue', paid: 'violet', shipped: 'blue', delivered: 'emerald', completed: 'emerald', cancelled: 'red' };
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const CHART_W = Dimensions.get('window').width - 72;

const EMPTY_MONTH = {
  orders: 0, sales: 0, commissions: 0, subscriptions: 0, adjustments: 0, platform_services: 0,
  monthly_credits: 0, loyalty_deductions: 0, agent_commission_payouts: 0, agent_approval_bonus_payouts: 0, items_sold: 0,
};

/* ---------- Fade + slide-in wrapper (cross-fade on period change) ---------- */
function FadeSlideIn({ children, style, dy = 8, duration = 350 }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []); // eslint-disable-line
  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/* ---------- Animated horizontal shop-revenue bar (grows from baseline) ---------- */
function ShopBar({ name, value, max, color, delay }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value]); // eslint-disable-line
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <View style={styles.sbRow}>
      <Text style={styles.sbName} numberOfLines={1}>{name}</Text>
      <View style={styles.sbTrack}>
        <Animated.View style={[styles.sbFill, { backgroundColor: color, width: a.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${pct}%`] }) }]} />
      </View>
      <Text style={styles.sbVal}>{money(value)}</Text>
    </View>
  );
}

export default function AdminDashboardScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [monthlyMap, setMonthlyMap] = useState({});
  const [dailyMap, setDailyMap] = useState({});
  const [adjustments, setAdjustments] = useState([]);
  const [totalAdjustments, setTotalAdjustments] = useState(0);
  const [pendingShops, setPendingShops] = useState([]);
  const [orders, setOrders] = useState([]);
  const [chartKey, setChartKey] = useState(0);

  const _now = new Date();
  const [selYear, setSelYear] = useState(_now.getFullYear());
  const [selMonth, setSelMonth] = useState(_now.getMonth() + 1); // 1-12, 0 = whole year
  const [selDay, setSelDay] = useState(0); // 0 = all days
  const didInitSel = useRef(false);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [selectedShopDetail, setSelectedShopDetail] = useState(null);

  /* ===== Parallel fetch of the five read calls ===== */
  const load = useCallback(async () => {
    const [a, r, adj, m, s] = await Promise.allSettled([
      api.admin.getAnalytics(),
      api.admin.getRevenue(),
      api.admin.getRevenueAdjustments(),
      api.admin.getMonthlyAnalytics(),
      api.admin.getShops(),
    ]);
    if (a.status === 'fulfilled') {
      setAnalytics(a.value.data);
      setOrders((a.value.data?.pending_orders || []).slice(0, 5));
    }
    if (r.status === 'fulfilled') setRevenueData(r.value.data);
    if (adj.status === 'fulfilled') {
      setAdjustments(adj.value.data?.adjustments || []);
      setTotalAdjustments(adj.value.data?.total || 0);
    }
    if (m.status === 'fulfilled') {
      const d = m.value.data || {};
      setMonthlyMap(d.monthly || {});
      setDailyMap(d.daily || {});
      // Default selection to the API's current month key — only on first load.
      if (!didInitSel.current) {
        const ck = d.current_month_key;
        if (ck && /^\d{4}-\d{2}$/.test(ck)) {
          setSelYear(parseInt(ck.slice(0, 4), 10));
          setSelMonth(parseInt(ck.slice(5, 7), 10));
        }
        didInitSel.current = true;
      }
    }
    if (s.status === 'fulfilled') {
      const list = Array.isArray(s.value.data) ? s.value.data : (s.value.data?.shops || []);
      setPendingShops(list.filter((x) => x.status === 'pending'));
    }
    setLoading(false); setRefreshing(false);
    setChartKey((k) => k + 1); // replay chart entrances on (re)load
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ===== Selected-period profit (year → month → day drill-down) ===== */
  const availableYears = useMemo(() => {
    const ys = new Set(Object.keys(monthlyMap).map((k) => k.slice(0, 4)).filter(Boolean));
    ys.add(String(_now.getFullYear()));
    return Array.from(ys).map(Number).sort((a, b) => b - a);
  }, [monthlyMap]); // eslint-disable-line

  const sumWhere = (map, pred) => {
    const acc = { ...EMPTY_MONTH };
    Object.entries(map || {}).forEach(([k, v]) => {
      if (!pred(k)) return;
      Object.keys(EMPTY_MONTH).forEach((f) => { acc[f] += v[f] || 0; });
    });
    return acc;
  };

  const isAllYears = selYear === 0;
  const selKey = `${selYear}-${String(selMonth).padStart(2, '0')}`;
  const dayKey = `${selKey}-${String(selDay).padStart(2, '0')}`;
  const daysInSelMonth = selMonth > 0 ? new Date(selYear, selMonth, 0).getDate() : 31;

  const periodData = isAllYears
    ? sumWhere(monthlyMap, () => true)
    : (selMonth === 0
      ? sumWhere(monthlyMap, (k) => k.slice(0, 4) === String(selYear))
      : (selDay > 0 ? (dailyMap[dayKey] || EMPTY_MONTH) : (monthlyMap[selKey] || EMPTY_MONTH)));

  const periodLabel = isAllYears
    ? 'All Years'
    : (selMonth === 0
      ? `${selYear}`
      : (selDay > 0 ? `${MONTH_NAMES[selMonth - 1]} ${selDay}, ${selYear}` : `${MONTH_NAMES[selMonth - 1]} ${selYear}`));

  const cmSubscriptions = periodData?.subscriptions || 0;
  const cmCommissions = periodData?.commissions || 0;
  const cmAdjustments = periodData?.adjustments || 0;
  const cmPlatformServices = periodData?.platform_services || 0;
  const cmMonthlyCredits = periodData?.monthly_credits || 0;
  const cmLoyaltyDeductions = periodData?.loyalty_deductions || 0;
  const cmAgentCommission = periodData?.agent_commission_payouts || 0;
  const cmAgentApprovalBonus = periodData?.agent_approval_bonus_payouts || 0;
  const totalAdminProfit = cmSubscriptions + cmCommissions + cmAdjustments + cmPlatformServices
    - cmMonthlyCredits - cmLoyaltyDeductions - cmAgentCommission - cmAgentApprovalBonus;

  const breakdown = [
    { label: 'Subscriptions', value: cmSubscriptions, icon: 'card' },
    { label: 'Commissions', value: cmCommissions, icon: 'pie-chart' },
    { label: 'Adjustments', value: totalAdjustments, icon: totalAdjustments >= 0 ? 'add-circle' : 'remove-circle' },
    { label: 'Platform Services', value: cmPlatformServices, icon: 'flash' },
    { label: 'New Shop Credits + Monthly Credits', value: -cmMonthlyCredits, icon: 'remove-circle' },
    { label: 'Loyalty Point Deductions (Shop)', value: -cmLoyaltyDeductions, icon: 'remove-circle' },
    { label: 'Shop referrals first pay', value: -cmAgentApprovalBonus, icon: 'remove-circle' },
    { label: 'Loyalty Point Deductions (Agent)', value: -cmAgentCommission, icon: 'remove-circle' },
  ];

  /* ===== Chart datasets (mirror the web selectors) ===== */
  const monthlyData = useMemo(() => {
    const mr = analytics?.monthly_revenue;
    if (!mr) return [];
    return Object.entries(mr).map(([month, d]) => ({
      label: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
      value: d.total || 0,
    })).slice(-6);
  }, [analytics]);

  const shopRevenueData = useMemo(() => {
    if (!revenueData?.shops_breakdown) return [];
    return revenueData.shops_breakdown.slice(0, 5).map((shop) => ({
      name: shop.shop_name?.slice(0, 12) || 'Unknown',
      value: shop.net_revenue || shop.gross_revenue || 0,
    }));
  }, [revenueData]);

  const adminRevenueData = useMemo(() => {
    if (!revenueData?.admin_revenue) return [];
    return [
      { name: 'Subscriptions', value: revenueData.admin_revenue.subscriptions || 0, color: '#10b981' },
      { name: 'Commissions', value: revenueData.admin_revenue.commissions || 0, color: '#3b82f6' },
    ].filter((i) => i.value > 0);
  }, [revenueData]);

  const totalOrders = analytics?.total_orders || 0;
  const pendingCount = analytics?.pending_orders?.length || 0;
  const completed = Math.max(0, totalOrders - pendingCount);
  const orderStatusData = [
    { name: 'Completed', value: completed, color: '#10b981' },
    { name: 'Pending', value: pendingCount, color: '#f59e0b' },
  ].filter((i) => i.value > 0);
  const shopMax = Math.max(...shopRevenueData.map((s) => s.value), 1);

  /* ===== Handlers ===== */
  const handleStatusChange = async (orderId, newStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, order_status: newStatus } : o)));
    try {
      await api.orders.updateStatus(orderId, newStatus);
      toast.success('Order status updated');
      load();
    } catch { toast.error('Failed to update order status'); load(); }
  };

  const downloadReport = async () => {
    setDownloadingReport(true);
    try {
      const dest = FileSystem.cacheDirectory + `openmarketlb_report_${new Date().toISOString().split('T')[0]}.pdf`;
      const { uri, status } = await FileSystem.downloadAsync(`${API_BASE_URL}${api.admin.reportPdfPath}`, dest, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (status !== 200) throw new Error('bad status');
      notifySuccess();
      toast.success('Report downloaded!');
      try { await Share.share(Platform.OS === 'ios' ? { url: uri } : { message: uri, title: 'OpenMarketlb Report' }); } catch {}
    } catch { toast.error('Failed to download report'); }
    finally { setDownloadingReport(false); }
  };

  const handleResetRevenue = () => {
    Alert.alert('Reset revenue', 'This clears all manual revenue adjustments. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive', onPress: async () => {
          try { await api.admin.resetRevenue(); toast.success('Revenue reset'); load(); }
          catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
        },
      },
    ]);
  };

  /* ===== Loading skeleton (mirrors the web pulse) ===== */
  if (loading) {
    return (
      <AdminScreen>
        <View style={styles.skHeroRow}>
          <Shimmer width={48} height={48} radius={radius.lg} />
          <View style={{ gap: 6 }}><Shimmer width={150} height={22} /><Shimmer width={96} height={12} /></View>
        </View>
        <View style={styles.statRow}>{[0, 1].map((i) => <Shimmer key={i} width="48%" height={110} radius={radius.lg} />)}</View>
        <View style={[styles.statRow, { marginTop: 10 }]}>{[2, 3].map((i) => <Shimmer key={i} width="48%" height={110} radius={radius.lg} />)}</View>
        <Shimmer height={240} radius={radius.xxl} style={{ marginTop: 14 }} />
        <Shimmer height={64} radius={radius.lg} style={{ marginTop: 14 }} />
      </AdminScreen>
    );
  }

  return (
    <AdminScreen testID="admin-dashboard-content" refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      {/* ===== HERO HEADER ===== */}
      <AdminHeroCard
        icon="shield-checkmark"
        title="Admin Dashboard"
        titleTestID="admin-dashboard-title"
        subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        actions={<>
          <PillButton label="Adjust Revenue" icon="cash-outline" onPress={() => setAdjustOpen(true)} />
          <PillButton label="Report" busyLabel="Generating…" icon="download-outline" variant="primary" loading={downloadingReport} onPress={downloadReport} testID="download-report-btn" />
        </>}
      />

      {/* ===== MAIN STATS ===== */}
      <View style={styles.statRow}>
        <AdminStatCard testID="stat-total-orders" label="Total Orders" value={totalOrders} icon="cart" variant="blue" index={0} />
        <AdminStatCard testID="stat-platform-sales" label="Platform Sales" value={analytics?.total_revenue || 0} prefix="$" decimals={0} icon="cash" variant="emerald" index={1} />
      </View>
      <View style={[styles.statRow, { marginTop: 10 }]}>
        <AdminStatCard testID="stat-pending-orders" label="Pending Orders" value={pendingCount} icon="time" variant="amber" index={2} />
        <AdminStatCard testID="stat-active-shops" label="Active Shops" value={revenueData?.shops_breakdown?.length || 0} icon="storefront" variant="violet" index={3} />
      </View>

      {/* ===== MONTHLY PROFIT HERO ===== */}
      <ProfitHero
        periodLabel={periodLabel}
        profit={totalAdminProfit}
        breakdown={breakdown}
        periodKey={`${selKey}-${selDay}`}
        selYear={selYear} selMonth={selMonth} selDay={selDay}
        isAllYears={isAllYears} availableYears={availableYears} daysInSelMonth={daysInSelMonth}
        onYear={(y) => { setSelYear(y); if (y === 0) { setSelMonth(0); setSelDay(0); } else { setSelDay(0); } }}
        onMonth={(mo) => { setSelMonth(mo); setSelDay(0); }}
        onDay={(d) => setSelDay(d)}
        onFinance={() => navigation.navigate('AdminFinance')}
        onAnalytics={() => navigation.navigate('AdminAnalytics')}
      />

      {/* ===== CHARTS ===== */}
      <View key={`charts-${chartKey}`}>
        {/* Revenue Sources donut */}
        <AdminCard title="Revenue Sources" icon="cash" testID="admin-revenue-pie">
          {adminRevenueData.length > 0 ? (
            <View style={styles.pieWrap}>
              <PieChart
                data={adminRevenueData.map((d) => ({ value: d.value, color: d.color }))}
                donut radius={78} innerRadius={48} isAnimated animationDuration={800}
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center' }}>
                    <CountUp value={totalAdminProfit} prefix="$" decimals={2} style={styles.pieCenter} />
                    <Text style={styles.pieCenterSub}>total</Text>
                  </View>
                )}
              />
              <View style={{ flex: 1, gap: 10 }}>
                {adminRevenueData.map((item) => (
                  <View key={item.name} style={styles.legendItem}>
                    <View style={styles.legendLeft}><View style={[styles.dot, { backgroundColor: item.color }]} /><Text style={styles.legendName}>{item.name}</Text></View>
                    <Text style={styles.legendVal}>{money(item.value)}</Text>
                  </View>
                ))}
                <View style={styles.legendTotal}><Text style={styles.legendTotalLabel}>Total</Text><Text style={styles.legendTotalVal}>{money(totalAdminProfit)}</Text></View>
              </View>
            </View>
          ) : <Empty label="No revenue data yet" />}
        </AdminCard>

        {/* Monthly Revenue Trend area */}
        <AdminCard title="Monthly Revenue Trend" icon="trending-up" testID="monthly-revenue-chart">
          {monthlyData.length > 0 ? (
            <View style={{ paddingTop: 8 }}>
              <LineChart
                areaChart curved isAnimated animationDuration={900}
                data={monthlyData}
                width={CHART_W} height={170}
                spacing={(CHART_W - 30) / Math.max(1, monthlyData.length)}
                initialSpacing={12} endSpacing={8}
                color={colors.s600} thickness={2}
                startFillColor={colors.s600} endFillColor={colors.s600} startOpacity={0.3} endOpacity={0.02}
                hideDataPoints hideRules yAxisThickness={0} xAxisThickness={0}
                xAxisLabelTextStyle={styles.axisLabel} yAxisTextStyle={styles.axisLabel} noOfSections={3}
              />
            </View>
          ) : <Empty label="No data yet" />}
        </AdminCard>

        {/* Top Shops by Revenue bars */}
        <AdminCard title="Top Shops by Revenue" icon="storefront" testID="shop-revenue-chart">
          {shopRevenueData.length > 0 ? (
            <View style={{ gap: 12, paddingTop: 4 }}>
              {shopRevenueData.map((s, i) => (
                <ShopBar key={s.name + i} name={s.name} value={s.value} max={shopMax} color={COLORS[i % COLORS.length]} delay={i * 90} />
              ))}
            </View>
          ) : <Empty label="No shop revenue data" />}
        </AdminCard>

        {/* Order Status donut */}
        <AdminCard title="Order Status" icon="albums" testID="order-status-chart">
          {orderStatusData.length > 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 4 }}>
              <PieChart
                data={orderStatusData.map((d) => ({ value: d.value, color: d.color }))}
                donut radius={72} innerRadius={45} isAnimated animationDuration={800}
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center' }}>
                    <CountUp value={totalOrders} style={styles.pieCenter} />
                    <Text style={styles.pieCenterSub}>orders</Text>
                  </View>
                )}
              />
              <View style={styles.legendRow}>
                {orderStatusData.map((item) => (
                  <View key={item.name} style={styles.legendLeft}><View style={[styles.dot, { backgroundColor: item.color }]} /><Text style={styles.legendName}>{item.name}: {item.value}</Text></View>
                ))}
              </View>
            </View>
          ) : <Empty label="No orders yet" />}
        </AdminCard>
      </View>

      {/* ===== SHOP REQUESTS ===== */}
      {pendingShops.length > 0 && (
        <AdminCard
          title="Shop Requests" icon="storefront" testID="shop-requests-section"
          right={<TouchableOpacity onPress={() => navigation.navigate('AdminShops')}><Text style={styles.manageAll}>Manage All ›</Text></TouchableOpacity>}
        >
          <Text style={styles.sectionSub}>{pendingShops.length} pending request{pendingShops.length !== 1 ? 's' : ''}</Text>
          {pendingShops.slice(0, 10).map((shop) => (
            <View key={shop.id} style={styles.shopRow} testID={`shop-request-row-${shop.id}`}>
              <View style={styles.shopIcon}><Ionicons name="storefront" size={16} color={colors.seller} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
                <Text style={styles.shopMeta} numberOfLines={1}>{shop.email || shop.city || shop.state || '—'}</Text>
              </View>
              <TouchableOpacity style={styles.viewBtn} onPress={() => setSelectedShopDetail(shop)} testID={`view-shop-${shop.id}`}>
                <Ionicons name="eye-outline" size={13} color={colors.textSecondary} /><Text style={styles.viewText}>View</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.approveBtn} onPress={() => navigation.navigate('AdminShops')} testID={`approve-shop-${shop.id}`}>
                <Ionicons name="checkmark" size={13} color={colors.white} /><Text style={styles.approveText}>Approve</Text>
              </TouchableOpacity>
            </View>
          ))}
        </AdminCard>
      )}

      {/* ===== PENDING ORDERS ===== */}
      {orders.length > 0 && (
        <AdminCard
          title="Pending Orders" icon="time" testID="pending-orders-list"
          right={<TouchableOpacity onPress={() => navigation.navigate('AdminOrders')}><Text style={styles.manageAll}>View All ›</Text></TouchableOpacity>}
        >
          {orders.map((o) => {
            const st = (o.order_status || 'pending').toLowerCase();
            return (
              <View key={o.id} style={styles.orderRow} testID={`pending-order-${o.id}`}>
                <View style={styles.orderIcon}><Ionicons name="cart" size={15} color={colors.amber} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderName} numberOfLines={1}>{o.guest_name || o.customer_name || 'Guest'}</Text>
                  <Text style={styles.orderId}>{String(o.id).slice(0, 12)}…</Text>
                </View>
                <Text style={styles.orderAmt}>{money(o.total_amount)}</Text>
                <StatusPicker status={st} onChange={(v) => handleStatusChange(o.id, v)} />
              </View>
            );
          })}
        </AdminCard>
      )}

      <ShopDetailSheet shop={selectedShopDetail} onClose={() => setSelectedShopDetail(null)} onApprove={() => { setSelectedShopDetail(null); navigation.navigate('AdminShops'); }} />
      <AdjustSheet open={adjustOpen} onClose={() => setAdjustOpen(false)} adjustments={adjustments} onDone={load} onReset={handleResetRevenue} />
    </AdminScreen>
  );
}

/* ---------- Monthly Profit gradient hero ---------- */
function ProfitHero({ periodLabel, profit, breakdown, periodKey, selYear, selMonth, selDay, isAllYears, availableYears, daysInSelMonth, onYear, onMonth, onDay, onFinance, onAnalytics }) {
  const slide = useRef(new Animated.Value(0)).current;
  const p1 = useRef(new Animated.Value(0)).current;
  const p2 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slide, { toValue: 1, duration: 500, delay: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = (v, dur, delay) => Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: dur, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    loop(p1, 4000, 0); loop(p2, 3000, 1000);
  }, []); // eslint-disable-line
  return (
    <Animated.View style={{ opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }} testID="admin-revenue-section">
      <LinearGradient colors={admin.profit} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profit}>
        <View style={[styles.pBlob, { top: -30, right: -30 }]} />
        <View style={[styles.pBlob, { bottom: -30, left: -20, width: 80, height: 80 }]} />
        <Animated.View style={[styles.particle, { top: '45%', right: '25%', transform: [{ translateY: p1.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]} />
        <Animated.View style={[styles.particle, { bottom: '25%', right: '50%', width: 6, height: 6, borderRadius: 3, transform: [{ translateY: p2.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]} />

        <View style={styles.profitHead}>
          <View style={styles.profitTile}><Ionicons name="pulse" size={20} color={colors.white} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profitTitle}>Monthly Profit</Text>
            <Text style={styles.profitPeriod} testID="profit-period-label">{periodLabel}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.profitEyebrow}>ADMIN PROFIT</Text>
            <FadeSlideIn key={`v-${periodKey}`}><CountUp value={profit} prefix="$" decimals={2} style={styles.profitValue} testID="admin-total-revenue" /></FadeSlideIn>
          </View>
        </View>

        {/* Year selector */}
        <View style={styles.selectRow} testID="profit-year-select">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <Sel active={isAllYears} label="All Years" onPress={() => onYear(0)} testID="profit-year-option-all" />
            {availableYears.map((y) => <Sel key={y} active={selYear === y} label={String(y)} onPress={() => onYear(y)} testID={`profit-year-option-${y}`} />)}
          </ScrollView>
        </View>
        {/* Month selector */}
        {!isAllYears && (
          <View style={styles.selectRow} testID="profit-month-select">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              <Sel active={selMonth === 0} label="All months" onPress={() => onMonth(0)} testID="profit-month-option-all" />
              {MONTH_NAMES.map((mn, i) => <Sel key={mn} active={selMonth === i + 1} label={mn.slice(0, 3)} onPress={() => onMonth(i + 1)} testID={`profit-month-option-${i + 1}`} />)}
            </ScrollView>
          </View>
        )}
        {/* Day selector */}
        {!isAllYears && selMonth > 0 && (
          <View style={styles.selectRow} testID="profit-day-select">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              <Sel active={selDay === 0} label="All days" onPress={() => onDay(0)} testID="profit-day-option-all" />
              {Array.from({ length: daysInSelMonth }, (_, i) => i + 1).map((d) => <Sel key={d} active={selDay === d} label={String(d)} onPress={() => onDay(d)} testID={`profit-day-option-${d}`} />)}
            </ScrollView>
          </View>
        )}

        {/* Breakdown */}
        <FadeSlideIn key={`b-${periodKey}`} style={{ marginTop: 14, gap: 7 }}>
          {breakdown.map((r) => (
            <View key={r.label} style={styles.bRow}>
              <View style={styles.bLeft}><Ionicons name={r.icon} size={12} color="rgba(255,255,255,0.6)" /><Text style={styles.bLabel} numberOfLines={1}>{r.label}</Text></View>
              <Text style={[styles.bValue, { color: r.value < 0 ? '#fda4af' : '#6ee7b7' }]}>{r.value < 0 ? '−' : '+'}{money(Math.abs(r.value))}</Text>
            </View>
          ))}
        </FadeSlideIn>

        {/* Footer nav */}
        <View style={styles.profitFooter}>
          <TouchableOpacity style={styles.footBtn} onPress={onFinance}><Ionicons name="wallet-outline" size={12} color="rgba(255,255,255,0.85)" /><Text style={styles.footText}>Finance Center ›</Text></TouchableOpacity>
          <TouchableOpacity style={styles.footBtn} onPress={onAnalytics}><Ionicons name="bar-chart-outline" size={12} color="rgba(255,255,255,0.85)" /><Text style={styles.footText}>Full Analytics ›</Text></TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function Sel({ active, label, onPress, testID }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.sel, active && styles.selOn]} testID={testID}>
      <Text style={[styles.selText, active && { color: colors.white, fontFamily: fonts.bold }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Empty({ label }) {
  return <View style={styles.empty}><Text style={styles.emptyText}>{label}</Text></View>;
}

/* ---------- Inline order status picker (pill morphs on change) ---------- */
function StatusPicker({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const variant = ORDER_VARIANT[status] || 'slate';
  return (
    <>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setOpen(true)}>
        <View style={styles.pickTrigger}>
          <StatusPill label={status} variant={variant} />
          <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.pickBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.pickCard}>
            {STATUSES.map((s) => (
              <TouchableOpacity key={s} style={styles.pickRow} onPress={() => { setOpen(false); if (s !== status) onChange(s); }}>
                <View style={[styles.dot, { backgroundColor: (admin.pills[ORDER_VARIANT[s]] || admin.pills.slate)[1] }]} />
                <Text style={styles.pickText}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
                {s === status && <Ionicons name="checkmark" size={16} color={colors.violet} style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

/* ---------- Shop request detail bottom sheet ---------- */
function ShopDetailSheet({ shop, onClose, onApprove }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  return (
    <Modal visible={!!shop} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
        <View style={styles.grabber} />
        {shop && (
          <>
            <View style={styles.sdHead}>
              <View style={styles.sdIcon}><Ionicons name="storefront" size={26} color={colors.white} /></View>
              <View style={{ flex: 1 }}><Text style={styles.sdName}>{shop.name}</Text><Text style={styles.sdEmail}>{shop.email || '—'}</Text></View>
            </View>
            <View style={styles.sdGrid}>
              <Field label="Phone" value={shop.phone} />
              <Field label="City" value={shop.city} />
              <Field label="State" value={shop.state} />
              <Field label="Address" value={shop.address} />
            </View>
            {shop.description ? <View style={styles.sdDesc}><Text style={styles.fieldLabel}>DESCRIPTION</Text><Text style={styles.sdDescText}>{shop.description}</Text></View> : null}
            <View style={styles.sdActions}>
              <TouchableOpacity style={styles.sdClose} onPress={onClose}><Text style={styles.sdCloseText}>Close</Text></TouchableOpacity>
              <TouchableOpacity style={styles.sdApprove} onPress={onApprove}><Ionicons name="checkmark" size={16} color={colors.white} /><Text style={styles.sdApproveText}>Go to Approve</Text></TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
function Field({ label, value }) {
  return <View style={styles.fieldBox}><Text style={styles.fieldLabel}>{label.toUpperCase()}</Text><Text style={styles.fieldValue}>{value || '—'}</Text></View>;
}

/* ---------- Adjust Revenue bottom sheet ---------- */
function AdjustSheet({ open, onClose, adjustments, onDone, onReset }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [type, setType] = useState('increase');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter valid amount'); return; }
    if (!description.trim()) { toast.error('Enter a reason'); return; }
    setBusy(true);
    try {
      await api.admin.adjustRevenue({ amount: amt, type, description });
      setDone(true); notifySuccess();
      toast.success(`Revenue ${type === 'increase' ? 'increased' : 'decreased'} by $${amt.toFixed(2)}`);
      setTimeout(() => { setDone(false); setAmount(''); setDescription(''); onClose(); onDone(); }, 900);
    } catch (e) { notifyError(); toast.error(e?.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };

  const preview = parseFloat(amount);
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
        <View style={styles.grabber} />
        <View style={styles.sheetTitleRow}>
          <Text style={styles.sheetTitle}>Adjust Revenue</Text>
          <TouchableOpacity onPress={onReset}><Text style={styles.resetLink}>Reset Revenue</Text></TouchableOpacity>
        </View>
        <View style={styles.toggle}>
          <TouchableOpacity style={[styles.toggleBtn, type === 'increase' && styles.toggleInc]} onPress={() => setType('increase')} testID="adjust-increase-btn">
            <Ionicons name="add-circle" size={18} color={type === 'increase' ? '#047857' : colors.textMuted} /><Text style={[styles.toggleText, type === 'increase' && { color: '#047857' }]}>Increase</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtn, type === 'decrease' && styles.toggleDec]} onPress={() => setType('decrease')} testID="adjust-decrease-btn">
            <Ionicons name="remove-circle" size={18} color={type === 'decrease' ? '#be123c' : colors.textMuted} /><Text style={[styles.toggleText, type === 'decrease' && { color: '#be123c' }]}>Decrease</Text>
          </TouchableOpacity>
        </View>
        <TextInput style={styles.input} placeholder="Amount ($)" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={amount} onChangeText={setAmount} testID="adjust-amount-input" />
        <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} placeholder="Reason *" placeholderTextColor={colors.textMuted} multiline value={description} onChangeText={setDescription} testID="adjust-description-input" />
        {preview > 0 && (
          <View style={[styles.previewBox, type === 'increase' ? styles.previewInc : styles.previewDec]}>
            <Text style={[styles.previewText, { color: type === 'increase' ? '#047857' : '#be123c' }]}>Revenue will be {type === 'increase' ? 'increased' : 'decreased'} by ${preview.toFixed(2)}</Text>
          </View>
        )}
        <TouchableOpacity activeOpacity={0.9} onPress={submit} disabled={busy || done} testID="confirm-adjust-btn">
          <LinearGradient colors={type === 'increase' ? ['#10b981', '#059669'] : ['#f43f5e', '#e11d48']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>
            {done ? <Ionicons name="checkmark-circle" size={20} color={colors.white} /> : busy ? <Spinner size={18} color={colors.white} /> : <Text style={styles.submitText}>Confirm</Text>}
          </LinearGradient>
        </TouchableOpacity>

        {adjustments.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.histTitle}>Recent adjustments</Text>
            {adjustments.slice(0, 6).map((a, i) => (
              <View key={a.id || i} style={styles.histRow}>
                <Text style={styles.histReason} numberOfLines={1}>{a.description || a.reason || 'Adjustment'}</Text>
                <Text style={[styles.histAmt, { color: (a.amount || 0) < 0 ? colors.sale : colors.seller }]}>{(a.amount || 0) < 0 ? '−' : '+'}{money(Math.abs(a.amount || 0))}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  skHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  statRow: { flexDirection: 'row', gap: 10 },

  /* profit hero */
  profit: { borderRadius: radius.xxl, padding: 18, marginTop: 14, overflow: 'hidden', ...shadow.violetGlow },
  pBlob: { position: 'absolute', width: 130, height: 130, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.05)' },
  particle: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },
  profitHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profitTile: { width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  profitTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 17 },
  profitPeriod: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  profitEyebrow: { color: 'rgba(255,255,255,0.5)', fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' },
  profitValue: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 30, letterSpacing: -1 },
  selectRow: { marginTop: 12 },
  sel: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  selOn: { backgroundColor: 'rgba(255,255,255,0.28)' },
  selText: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.semibold, fontSize: 12 },
  bRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9 },
  bLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  bLabel: { color: 'rgba(255,255,255,0.75)', fontFamily: fonts.medium, fontSize: 11, flex: 1 },
  bValue: { fontFamily: fonts.bold, fontSize: 13 },
  profitFooter: { flexDirection: 'row', gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  footBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  footText: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.semibold, fontSize: 10.5 },

  /* charts */
  pieWrap: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 4 },
  pieCenter: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink },
  pieCenterSub: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  legendItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legendLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  legendVal: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink },
  legendTotal: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 8 },
  legendTotalLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  legendTotalVal: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.seller },
  legendRow: { flexDirection: 'row', gap: 16, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  axisLabel: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 10 },
  empty: { height: 150, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  /* shop bars */
  sbRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sbName: { width: 84, fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textSecondary },
  sbTrack: { flex: 1, height: 14, borderRadius: 7, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  sbFill: { height: 14, borderRadius: 7 },
  sbVal: { width: 62, textAlign: 'right', fontFamily: fonts.bold, fontSize: 11.5, color: colors.ink },

  /* section rows */
  manageAll: { fontFamily: fonts.bold, fontSize: 12, color: colors.violet },
  sectionSub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: -6, marginBottom: 4 },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.borderLight },
  shopIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.sellerSoft, alignItems: 'center', justifyContent: 'center' },
  shopName: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  shopMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  viewText: { fontFamily: fonts.bold, fontSize: 10, color: colors.textSecondary },
  approveBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.seller, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  approveText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10 },

  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.borderLight },
  orderIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.amberSoft, alignItems: 'center', justifyContent: 'center' },
  orderName: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink },
  orderId: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  orderAmt: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink },
  pickTrigger: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  /* status picker modal */
  pickBackdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 40 },
  pickCard: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 6, width: 200, ...shadow.dropdown },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  pickText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },

  /* generic bottom sheet */
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '88%' },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },

  /* shop detail */
  sdHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  sdIcon: { width: 54, height: 54, borderRadius: 15, backgroundColor: colors.seller, alignItems: 'center', justifyContent: 'center' },
  sdName: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink },
  sdEmail: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  sdGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fieldBox: { width: '47%', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 12 },
  fieldLabel: { fontFamily: fonts.bold, fontSize: 9, color: colors.textMuted, letterSpacing: 0.5 },
  fieldValue: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, marginTop: 2 },
  sdDesc: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 12, marginTop: 10 },
  sdDescText: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 3 },
  sdActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  sdClose: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, alignItems: 'center', paddingVertical: 12 },
  sdCloseText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
  sdApprove: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.seller, borderRadius: radius.pill, paddingVertical: 12 },
  sdApproveText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },

  /* adjust sheet */
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink },
  resetLink: { fontFamily: fonts.bold, fontSize: 12, color: colors.sale },
  toggle: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border },
  toggleInc: { borderColor: colors.seller, backgroundColor: colors.sellerSoft },
  toggleDec: { borderColor: colors.sale, backgroundColor: colors.saleSoft },
  toggleText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 14, color: colors.ink, marginBottom: 10 },
  previewBox: { borderWidth: 1, borderRadius: radius.md, padding: 12, marginBottom: 10 },
  previewInc: { backgroundColor: colors.sellerSoft, borderColor: '#a7f3d0' },
  previewDec: { backgroundColor: colors.saleSoft, borderColor: '#fecdd3' },
  previewText: { fontFamily: fonts.semibold, fontSize: 13 },
  submit: { height: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  histTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  histRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.borderLight },
  histReason: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.text },
  histAmt: { fontFamily: fonts.bold, fontSize: 13 },
});
