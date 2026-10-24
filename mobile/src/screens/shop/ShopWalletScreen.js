import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { api } from '../../lib/api';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { ShopScreenWrap, Rise, Float, Pulse, CountUp, PressScale, Spinner, toast } from '../../components/shop/ShopKit';

/* transaction labels + colors — ported verbatim */
const getTypeLabel = (type) => {
  switch (type) {
    case 'order_revenue': return 'Order Revenue';
    case 'cashout_request': return 'Cash Out Request';
    case 'cashout_refund': return 'Cash Out Refund';
    case 'admin_topup': return 'Admin Top-up';
    case 'admin_deduction': return 'Admin Deduction';
    case 'admin_bulk_topup': return 'Bulk Top-up';
    case 'topup_request': return 'Top-up Request';
    case 'subscription_credit': return 'Subscription Credit';
    case 'promotion_spend': return 'Boost Spend';
    case 'spin_purchase': return 'Spin Purchase';
    case 'spin_win': return 'Spin Win';
    case 'subscription_renewal': return 'Subscription Renewal';
    case 'monthly_credit': return 'Monthly Credit';
    default: return type ? type.replace(/_/g, ' ') : 'Transaction';
  }
};
const getTypeColors = (type) => {
  if (['order_revenue', 'admin_topup', 'admin_bulk_topup', 'cashout_refund', 'spin_win', 'subscription_credit', 'monthly_credit'].includes(type)) return ['#d1fae5', '#047857'];
  if (['cashout_request', 'promotion_spend', 'spin_purchase', 'admin_deduction', 'subscription_renewal', 'boost_payment'].includes(type)) return ['#fee2e2', '#b91c1c'];
  return ['#f1f5f9', '#475569'];
};
const statusColors = (s) => s === 'completed' ? ['#d1fae5', '#047857'] : s === 'pending' ? ['#fef3c7', '#b45309'] : s === 'rejected' ? ['#fee2e2', '#b91c1c'] : ['#f1f5f9', '#64748b'];

const CASHOUT_METHODS = [
  { v: 'cash', l: 'Cash', icon: 'cash' },
  { v: 'whish', l: 'Wish Money', icon: 'phone-portrait' },
  { v: 'omt', l: 'OMT', icon: 'phone-portrait' },
];

/* Compact wallet quick-action chip — primary (white) for Cash Out, ghost for the rest. */
function WalletChipBtn({ icon, label, onPress, primary, testID }) {
  return (
    <PressScale onPress={onPress}>
      <View style={[st.walletBtn, primary && st.walletBtnPrimary]} testID={testID}>
        <Ionicons name={icon} size={12} color={primary ? '#047857' : colors.white} />
        <Text style={[st.walletBtnText, primary && st.walletBtnTextPrimary]}>{label}</Text>
      </View>
    </PressScale>
  );
}

export default function ShopWalletScreen({ navigation }) {
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [cashoutDialogOpen, setCashoutDialogOpen] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [cashoutMethod, setCashoutMethod] = useState('cash');
  const [cashoutNumber, setCashoutNumber] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);
  const [subStatus, setSubStatus] = useState(null);
  const [renewingNow, setRenewingNow] = useState(false);
  const [minCashout, setMinCashout] = useState(5);

  const fetchWallet = useCallback(async () => {
    try { const { data } = await api.shopWallet.get(); setWallet(data); }
    catch (e) {} finally { setLoading(false); }
  }, []);
  const fetchSubStatus = useCallback(() => {
    api.shop.getSubscriptionStatus().then(({ data }) => setSubStatus(data)).catch(() => {});
  }, []);
  const fetchCashoutSettings = useCallback(() => {
    api.shopWallet.getCashoutSettings().then(({ data }) => setMinCashout(data.min_cashout_amount || 5)).catch(() => {});
  }, []);

  useEffect(() => { fetchWallet(); fetchSubStatus(); fetchCashoutSettings(); }, []); // eslint-disable-line
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchWallet(); fetchSubStatus(); setRefreshing(false); }, [fetchWallet, fetchSubStatus]);

  const handleRequestTopup = async () => {
    if (!requestAmount || parseFloat(requestAmount) <= 0) { toast.error('Enter a valid amount'); return; }
    setRequesting(true);
    try {
      await api.shopWallet.requestTopup(parseFloat(requestAmount));
      toast.success('Top-up request sent to admin!');
      setRequestDialogOpen(false); setRequestAmount('');
      fetchWallet();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to send request'); }
    finally { setRequesting(false); }
  };

  const handleCashout = async () => {
    if (!cashoutAmount || parseFloat(cashoutAmount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (parseFloat(cashoutAmount) > (wallet.balance || 0)) { toast.error('Amount exceeds available balance'); return; }
    if ((cashoutMethod === 'whish' || cashoutMethod === 'omt') && !cashoutNumber.trim()) {
      toast.error('Enter the phone number for Wish Money / OMT'); return;
    }
    setCashingOut(true);
    try {
      await api.shopWallet.requestCashout(parseFloat(cashoutAmount), cashoutMethod, cashoutNumber.trim());
      toast.success('Cash out request submitted! Admin will process it shortly.');
      setCashoutDialogOpen(false); setCashoutAmount(''); setCashoutMethod('cash'); setCashoutNumber('');
      fetchWallet();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to submit cash out request'); }
    finally { setCashingOut(false); }
  };

  const handleRenewNow = async () => {
    setRenewingNow(true);
    try {
      const { data } = await api.shop.renewNow({ period: subStatus?.auto_renew_period || 'monthly' });
      toast.success(data.message);
      fetchWallet(); fetchSubStatus();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to renew subscription'); }
    finally { setRenewingNow(false); }
  };

  const handleCancelSubscription = () => {
    Alert.alert('Cancel Subscription', 'Are you sure you want to cancel your subscription? Your shop will become inactive after the current period ends.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel Subscription', style: 'destructive', onPress: async () => {
        try {
          await api.shop.cancelSubscription();
          toast.success('Subscription cancelled. Your shop will remain active until the end of the current period.');
          fetchSubStatus();
        } catch (e) { toast.error(e.response?.data?.detail || 'Failed to cancel subscription'); }
      } },
    ]);
  };

  // Separate revenue transactions — ported
  const revenueTransactions = wallet.transactions?.filter(t => t.type === 'order_revenue') || [];
  const totalRevenue = revenueTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const pendingCashouts = wallet.transactions?.filter(t => t.type === 'cashout_request' && t.status === 'pending') || [];
  const pendingCashoutTotal = pendingCashouts.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

  const cashoutDisabled = cashingOut || !cashoutAmount || parseFloat(cashoutAmount) <= 0 ||
    parseFloat(cashoutAmount) > (wallet.balance || 0) || parseFloat(cashoutAmount) < minCashout ||
    ((cashoutMethod === 'whish' || cashoutMethod === 'omt') && !cashoutNumber.trim());

  if (loading) {
    return <View style={st.center}><Spinner size={34} color="#059669" /></View>;
  }

  const showSubSection = subStatus && subStatus.subscription_required !== false && subStatus.subscription_status !== 'none';

  return (
    <>
    <ShopScreenWrap refreshing={refreshing} onRefresh={onRefresh}>
      {/* Digital Wallet — creative balance card with compact quick-actions */}
      <Rise delay={0}>
        <LinearGradient colors={shop.revenue} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.balanceCard}>
          <Float style={{ position: 'absolute', top: -14, right: -8 }} dur={4200}><Ionicons name="wallet" size={92} color="rgba(255,255,255,0.08)" /></Float>
          <View style={st.walletChip}><Ionicons name="wallet" size={12} color={colors.white} /><Text style={st.walletChipText}>Digital Wallet</Text></View>
          <Text style={st.balanceKicker}>Available balance</Text>
          <CountUp value={Number(wallet.balance || 0)} prefix="$" decimals={2} style={st.balanceValue} testID="wallet-balance" />
          {pendingCashoutTotal > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
              <Ionicons name="alert-circle" size={11} color="#a7f3d0" />
              <Text style={st.pendingNote}>${pendingCashoutTotal.toFixed(2)} pending cash out</Text>
            </View>
          )}
          <View style={st.walletActions}>
            <WalletChipBtn icon="cash" label="Cash Out" primary onPress={() => setCashoutDialogOpen(true)} testID="cashout-btn" />
            <WalletChipBtn icon="add-circle" label="Add Funds" onPress={() => setRequestDialogOpen(true)} testID="add-funds-btn" />
            <WalletChipBtn icon="megaphone" label="Advertisement" onPress={() => navigation.navigate('ShopAdvertising')} />
            <WalletChipBtn icon="sparkles" label="Spin a Wheel" onPress={() => navigation.navigate('ShopSpin')} />
            <WalletChipBtn icon="rocket" label="Boost" onPress={() => navigation.navigate('ShopBoost')} />
            <WalletChipBtn icon="color-palette" label="Buy Theme" onPress={() => navigation.navigate('ShopTheme')} />
          </View>
        </LinearGradient>
      </Rise>

      {/* Subscription Auto-Renew section */}
      {showSubSection && (
        <Rise delay={140}>
          <View style={[st.subCard, subStatus.is_near_expiry && { borderColor: '#fcd34d', backgroundColor: '#fffbeb' }]} testID="subscription-renew-section">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <Ionicons name="calendar" size={17} color={colors.p500} />
              <Text style={st.subTitle}>Subscription Renewal</Text>
              {subStatus.is_near_expiry && (
                <Pulse><View style={st.expiringBadge}><Text style={st.expiringText}>Expiring Soon!</Text></View></Pulse>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <View style={st.subStat}><Text style={st.subStatKey}>Current Tier</Text><Text style={st.subStatVal}>{subStatus.tier_name}</Text></View>
              <View style={st.subStat}>
                <Text style={st.subStatKey}>Days Left</Text>
                <Text style={[st.subStatVal, subStatus.days_left !== null && subStatus.days_left <= 7 && { color: '#d97706' }]}>{subStatus.days_left ?? '—'} days</Text>
              </View>
              <View style={st.subStat}><Text style={st.subStatKey}>Renewal ({subStatus.auto_renew_period || 'monthly'})</Text><Text style={st.subStatVal}>${(subStatus.renewal_price || 0).toFixed(2)}</Text></View>
            </View>

            {!subStatus.wallet_sufficient && (
              <Pulse min={0.7} dur={1100}>
                <View style={st.lowBalance} testID="low-balance-warning">
                  <Ionicons name="alert-circle" size={17} color="#ef4444" />
                  <View style={{ flex: 1 }}>
                    <Text style={st.lowBalanceTitle}>Insufficient wallet balance for renewal</Text>
                    <Text style={st.lowBalanceDesc}>You need ${(subStatus.renewal_price || 0).toFixed(2)} but have ${(subStatus.wallet_balance || 0).toFixed(2)}. Please add funds.</Text>
                  </View>
                </View>
              </Pulse>
            )}

            {/* Auto-renew — always on (matches the web's fixed toggle) */}
            <View style={st.autoRow}>
              <View style={st.autoSwitch}><View style={st.autoKnob} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.autoTitle}>Auto-Renew from Wallet <Text style={{ color: '#059669', fontSize: 10.5 }}>Always On</Text></Text>
                <Text style={st.autoDesc}>Automatically renews when subscription expires</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <PressScale onPress={handleRenewNow} disabled={renewingNow || !subStatus.wallet_sufficient} style={{ flex: 1 }}>
                <View style={[st.renewBtn, (renewingNow || !subStatus.wallet_sufficient) && { opacity: 0.55 }]} testID="renew-now-btn">
                  {renewingNow ? <Spinner size={13} /> : <Ionicons name="refresh" size={13} color={colors.white} />}
                  <Text style={st.renewText}>{renewingNow ? 'Renewing...' : 'Renew Now'}</Text>
                </View>
              </PressScale>
              <PressScale onPress={handleCancelSubscription} style={{ flex: 1 }}>
                <View style={st.cancelSubBtn} testID="cancel-subscription-btn">
                  <Text style={st.cancelSubText}>Cancel Subscription</Text>
                </View>
              </PressScale>
            </View>
          </View>
        </Rise>
      )}

      {/* Stats cards */}
      <View style={st.statsGrid}>
        {[
          { label: 'Available Balance', value: `$${(wallet.balance || 0).toFixed(2)}`, icon: 'logo-usd', soft: '#d1fae5', tint: '#059669' },
          { label: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}`, icon: 'trending-up', soft: '#dbeafe', tint: '#2563eb' },
          { label: 'Pending Cash Out', value: `$${pendingCashoutTotal.toFixed(2)}`, icon: 'cash', soft: '#fef3c7', tint: '#d97706' },
          { label: 'Monthly Credit', value: null, icon: 'megaphone', soft: colors.p100, tint: colors.p500, note: 'From your subscription plan' },
        ].map((s, i) => (
          <Rise key={s.label} delay={180 + i * 70} style={st.statWrap}>
            <View style={st.stat}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                <View style={[st.statIcon, { backgroundColor: s.soft }]}><Ionicons name={s.icon} size={14} color={s.tint} /></View>
                <Text style={st.statLabel}>{s.label}</Text>
              </View>
              {s.value != null ? <Text style={[st.statValue, { color: s.tint }]}>{s.value}</Text> : <Text style={st.statNote}>{s.note}</Text>}
            </View>
          </Rise>
        ))}
      </View>

      {/* Transaction history */}
      <Rise delay={420}>
        <View style={st.txnCard}>
          <View style={st.txnHead}>
            <Ionicons name="time" size={16} color={colors.textMuted} />
            <Text style={st.txnTitle}>Transaction History</Text>
          </View>
          {wallet.transactions?.length > 0 ? (
            wallet.transactions.map((txn, i) => {
              const [tBg, tFg] = getTypeColors(txn.type);
              const [sBg, sFg] = statusColors(txn.status);
              return (
                <View key={txn.id || i} style={[st.txnRow, i < wallet.transactions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                  <View style={[st.txnIcon, { backgroundColor: txn.amount > 0 ? '#d1fae5' : '#fee2e2' }]}>
                    <Ionicons name={txn.amount > 0 ? 'arrow-down' : 'arrow-up'} size={15} color={txn.amount > 0 ? '#047857' : '#dc2626'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.txnNote} numberOfLines={1}>{txn.note || getTypeLabel(txn.type)}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <View style={[st.typePill, { backgroundColor: tBg }]}><Text style={[st.typePillText, { color: tFg }]}>{getTypeLabel(txn.type)}</Text></View>
                      <Text style={st.txnDate}>{new Date(txn.created_at).toLocaleString()}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <Text style={[st.txnAmount, { color: txn.amount > 0 ? '#059669' : '#dc2626' }]}>
                      {txn.amount > 0 ? '+' : ''}${Math.abs(txn.amount).toFixed(2)}
                    </Text>
                    <View style={[st.typePill, { backgroundColor: sBg }]}><Text style={[st.typePillText, { color: sFg }]}>{txn.status}</Text></View>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 36 }}>
              <Ionicons name="wallet" size={42} color={colors.borderLight} />
              <Text style={st.emptyTitle}>No transactions yet</Text>
              <Text style={st.emptyDesc}>Revenue from your orders will appear here</Text>
            </View>
          )}
        </View>
      </Rise>
    </ShopScreenWrap>

    {/* Request Top-up sheet */}
    <Modal visible={requestDialogOpen} transparent animationType="fade" onRequestClose={() => setRequestDialogOpen(false)}>
      <BlurView intensity={24} tint="dark" style={st.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setRequestDialogOpen(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={st.dialog}>
            <Text style={st.dialogTitle}>Request Wallet Top-up</Text>
            <Text style={st.fieldLabel}>Amount (USD)</Text>
            <TextInput value={requestAmount} onChangeText={setRequestAmount} keyboardType="decimal-pad" placeholder="Enter amount"
              placeholderTextColor={colors.textMuted} style={st.input} />
            <Text style={st.dialogHint}>Your request will be sent to admin for approval.</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <PressScale style={{ flex: 1 }} onPress={() => setRequestDialogOpen(false)}>
                <View style={st.outlineBtn}><Text style={st.outlineText}>Cancel</Text></View>
              </PressScale>
              <PressScale style={{ flex: 1 }} onPress={handleRequestTopup} disabled={requesting}>
                <View style={st.emeraldBtn}>
                  {requesting ? <Spinner size={13} /> : <Ionicons name="add" size={14} color={colors.white} />}
                  <Text style={st.emeraldText}>Send Request</Text>
                </View>
              </PressScale>
            </View>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>

    {/* Cash Out sheet */}
    <Modal visible={cashoutDialogOpen} transparent animationType="fade" onRequestClose={() => setCashoutDialogOpen(false)}>
      <BlurView intensity={24} tint="dark" style={st.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setCashoutDialogOpen(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={st.dialog}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <Ionicons name="cash" size={17} color="#059669" />
              <Text style={st.dialogTitle}>Request Cash Out</Text>
            </View>
            <View style={st.availBox}><Text style={st.availText}>Available Balance: <Text style={{ fontFamily: fonts.extrabold }}>${(wallet.balance || 0).toFixed(2)}</Text></Text></View>
            <Text style={st.fieldLabel}>Cash Out Amount (USD)</Text>
            <TextInput value={cashoutAmount} onChangeText={setCashoutAmount} keyboardType="decimal-pad" placeholder="Enter amount"
              placeholderTextColor={colors.textMuted} style={st.input} testID="cashout-amount-input" />
            <TouchableOpacity onPress={() => setCashoutAmount(String(wallet.balance || 0))}>
              <Text style={st.fullBalance}>Cash out full balance</Text>
            </TouchableOpacity>
            <Text style={st.fieldLabel}>Cash Out Method</Text>
            <View style={{ flexDirection: 'row', gap: 7 }} testID="cashout-method-select">
              {CASHOUT_METHODS.map(m => (
                <TouchableOpacity key={m.v} onPress={() => { setCashoutMethod(m.v); if (m.v === 'cash') setCashoutNumber(''); }}
                  style={[st.methodChip, cashoutMethod === m.v && { backgroundColor: '#059669', borderColor: '#059669' }]}>
                  <Ionicons name={m.icon} size={13} color={cashoutMethod === m.v ? colors.white : colors.textSecondary} />
                  <Text style={[st.methodText, cashoutMethod === m.v && { color: colors.white }]}>{m.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {(cashoutMethod === 'whish' || cashoutMethod === 'omt') && (
              <>
                <Text style={st.fieldLabel}>{cashoutMethod === 'whish' ? 'Wish Money' : 'OMT'} Number</Text>
                <TextInput value={cashoutNumber} onChangeText={setCashoutNumber} keyboardType="phone-pad" placeholder="e.g. 70 123 456"
                  placeholderTextColor={colors.textMuted} style={st.input} testID="cashout-method-number-input" />
              </>
            )}
            <Text style={st.dialogHint}>Your cash out request will be reviewed and processed by admin. The amount will be deducted from your wallet immediately.</Text>
            {minCashout > 0 && <Text style={st.minNote}>Minimum cash out amount: ${minCashout.toFixed(2)}</Text>}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <PressScale style={{ flex: 1 }} onPress={() => setCashoutDialogOpen(false)}>
                <View style={st.outlineBtn}><Text style={st.outlineText}>Cancel</Text></View>
              </PressScale>
              <PressScale style={{ flex: 1 }} onPress={handleCashout} disabled={cashoutDisabled}>
                <View style={[st.emeraldBtn, cashoutDisabled && { opacity: 0.55 }]} testID="submit-cashout-btn">
                  {cashingOut ? <Spinner size={13} /> : <Ionicons name="cash" size={14} color={colors.white} />}
                  <Text style={st.emeraldText}>Submit</Text>
                </View>
              </PressScale>
            </View>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
    </>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: shop.bg },
  headerCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, padding: 17, overflow: 'hidden', ...shadow.card },
  headerIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  headerTitle: { fontFamily: fonts.heading, fontSize: 21, color: colors.ink, letterSpacing: -0.4 },
  headerSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  particle: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(110,231,183,0.5)' },
  balanceCard: { borderRadius: radius.xl, padding: 16, marginTop: 14, overflow: 'hidden', ...shadow.emphasis },
  walletChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3.5, marginBottom: 10 },
  walletChipText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.2 },
  balanceKicker: { color: '#a7f3d0', fontFamily: fonts.medium, fontSize: 11 },
  balanceValue: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 30, letterSpacing: -0.8, marginTop: 2, marginBottom: 8 },
  pendingNote: { color: '#a7f3d0', fontFamily: fonts.body, fontSize: 10.5 },
  walletActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  walletBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  walletBtnPrimary: { backgroundColor: colors.white, borderColor: colors.white },
  walletBtnText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.white },
  walletBtnTextPrimary: { color: '#047857' },
  subCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 16, marginTop: 14, ...shadow.card },
  subTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  expiringBadge: { backgroundColor: '#f59e0b', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2.5 },
  expiringText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 9.5 },
  subStat: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: 10 },
  subStatKey: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted },
  subStatVal: { fontFamily: fonts.extrabold, fontSize: 13.5, color: colors.ink, marginTop: 2 },
  lowBalance: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: radius.md, padding: 11, marginBottom: 12 },
  lowBalanceTitle: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#991b1b' },
  lowBalanceDesc: { fontFamily: fonts.body, fontSize: 10.5, color: '#dc2626', marginTop: 1 },
  autoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  autoSwitch: { width: 40, height: 24, borderRadius: 12, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 3 },
  autoKnob: { width: 17, height: 17, borderRadius: 9, backgroundColor: colors.white, ...shadow.card },
  autoTitle: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  autoDesc: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, marginTop: 1 },
  renewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.p500, borderRadius: radius.md, paddingVertical: 11 },
  renewText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12.5 },
  cancelSubBtn: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fecaca', borderRadius: radius.md, paddingVertical: 11 },
  cancelSubText: { fontFamily: fonts.semibold, fontSize: 12, color: '#dc2626' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  statWrap: { flexBasis: '47%', flexGrow: 1 },
  stat: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 13, ...shadow.card },
  statIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, flexShrink: 1 },
  statValue: { fontFamily: fonts.extrabold, fontSize: 19 },
  statNote: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted },
  txnCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: 14, overflow: 'hidden' },
  txnHead: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  txnTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  txnIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  txnNote: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  typePill: { borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  typePillText: { fontFamily: fonts.semibold, fontSize: 8.5, textTransform: 'capitalize' },
  txnDate: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted },
  txnAmount: { fontFamily: fonts.extrabold, fontSize: 13 },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.textSecondary, marginTop: 10 },
  emptyDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 18, ...shadow.dropdown },
  dialogTitle: { fontFamily: fonts.extrabold, fontSize: 16.5, color: colors.ink, marginBottom: 8 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text, marginTop: 10, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  dialogHint: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, marginTop: 10, lineHeight: 15 },
  minNote: { fontFamily: fonts.semibold, fontSize: 11, color: '#d97706', marginTop: 6 },
  availBox: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.md, padding: 11, marginTop: 4 },
  availText: { fontFamily: fonts.medium, fontSize: 12.5, color: '#047857' },
  fullBalance: { fontFamily: fonts.semibold, fontSize: 11, color: '#059669', marginTop: 6 },
  methodChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 9 },
  methodText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  outlineBtn: { height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  emeraldBtn: { height: 44, borderRadius: radius.md, backgroundColor: '#059669', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  emeraldText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },
});
