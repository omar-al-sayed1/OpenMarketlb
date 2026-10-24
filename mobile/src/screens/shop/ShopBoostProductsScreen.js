import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Image, Modal, ScrollView, Animated, Easing, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Circle } from 'react-native-svg';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { ShopScreenWrap, Rise, Float, Pulse, CountUp, PressScale, Spinner, SingleSlider, toast } from '../../components/shop/ShopKit';
import ConfirmSpendSheet from '../../components/shop/ConfirmSpendSheet';
import PurchaseConfirmSheet from '../../components/shop/PurchaseConfirmSheet';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* animated countdown ring for an active boost */
function CountdownRing({ daysLeft, totalDays }) {
  const R = 26, C = 2 * Math.PI * R;
  const progress = Math.min(1, Math.max(0, totalDays > 0 ? daysLeft / totalDays : 0));
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: progress, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress, a]);
  return (
    <View style={{ width: 62, height: 62, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={62} height={62} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={31} cy={31} r={R} stroke="#fde68a" strokeWidth={5} fill="none" />
        <AnimatedCircle cx={31} cy={31} r={R} stroke="#f59e0b" strokeWidth={5} fill="none" strokeLinecap="round"
          strokeDasharray={`${C} ${C}`}
          strokeDashoffset={a.interpolate({ inputRange: [0, 1], outputRange: [C, 0] })} />
      </Svg>
      <Text style={{ fontFamily: fonts.extrabold, fontSize: 16, color: '#d97706' }}>{daysLeft}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 6.5, color: '#b45309', letterSpacing: 0.5 }}>DAYS LEFT</Text>
    </View>
  );
}

export default function ShopBoostProductsScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
  const [shopProfile, setShopProfile] = useState({ free_sponsor_credits: 0, free_sponsor_10day_credits: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyPrice, setDailyPrice] = useState(2);
  const [showTransactions, setShowTransactions] = useState(false);

  // Boost dialog
  const [boostDialogOpen, setBoostDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [durationDays, setDurationDays] = useState(7);
  const [boosting, setBoosting] = useState(false);
  const [useFreeCredit, setUseFreeCredit] = useState(false);
  const [confirmSpendOpen, setConfirmSpendOpen] = useState(false);

  // Wallet request dialog + txn detail + cancel + purchase confirmation
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [promoToCancel, setPromoToCancel] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDetails, setConfirmDetails] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const [productsRes, promosRes, walletRes, settingsRes, shopRes] = await Promise.allSettled([
        api.shop.getProducts(),
        api.shopPromotions.getAll(),
        api.shopWallet.get(),
        api.admin.getPlatformSettings(),
        api.shop.getProfile(),
      ]);
      if (productsRes.status === 'fulfilled') setProducts(productsRes.value.data);
      if (promosRes.status === 'fulfilled') setPromotions(promosRes.value.data?.promotions || []);
      if (walletRes.status === 'fulfilled') setWallet(walletRes.value.data || { balance: 0 });
      if (settingsRes.status === 'fulfilled') setDailyPrice(settingsRes.value.data?.promotion_daily_price || 2);
      if (shopRes.status === 'fulfilled') setShopProfile(shopRes.value.data || { free_sponsor_credits: 0, free_sponsor_10day_credits: 0 });
    } catch (err) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }, [fetchData]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  }, [products, searchQuery]);

  const totalCost = dailyPrice * durationDays;
  const isProductBoosted = (pid) => promotions.some(p => p.product_id === pid && p.status === 'active');
  const activePromos = promotions.filter(p => p.status === 'active');
  const freeShortCredits = shopProfile?.free_sponsor_credits || 0;
  const freeLongCredits = shopProfile?.free_sponsor_10day_credits || 0;
  const totalFreeCredits = freeShortCredits + freeLongCredits;
  const usingFreeCredit = useFreeCredit && ((freeShortCredits > 0 && durationDays === 3) || (freeLongCredits > 0 && durationDays === 10));

  /* ---- boost — validation ported verbatim; paid spends pass through ConfirmSpendSheet ---- */
  const handleBoost = () => {
    if (!usingFreeCredit && totalCost > wallet.balance) {
      toast.error(`Not enough credits in wallet. Need $${totalCost.toFixed(2)}, have $${wallet.balance.toFixed(2)}. Contact admin to add money.`);
      return;
    }
    if (useFreeCredit && !usingFreeCredit) {
      toast.error('Free sponsor credits can only be used for 3-day (regular) or 10-day (special) boosts.');
      return;
    }
    if (usingFreeCredit) executeBoost();
    else setConfirmSpendOpen(true);
  };

  const executeBoost = async () => {
    setBoosting(true);
    setConfirmSpendOpen(false);
    try {
      await api.shopPromotions.create({ product_id: selectedProduct.id, duration_days: durationDays, use_free_credit: usingFreeCredit });
      setBoostDialogOpen(false);
      setConfirmDetails({
        productName: selectedProduct?.name,
        amount: usingFreeCredit ? 0 : totalCost,
        duration: `${durationDays} days`,
        message: usingFreeCredit ? 'Free sponsor credit used. Boost activated!' : `Remaining wallet balance: $${(wallet.balance - totalCost).toFixed(2)}`,
      });
      setConfirmOpen(true);
      setUseFreeCredit(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to boost');
    } finally { setBoosting(false); }
  };

  const handleWalletRequest = async () => {
    const amt = parseFloat(requestAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    setRequesting(true);
    try {
      await api.shopWallet.requestTopup(amt);
      toast.success('Top-up request sent to admin!');
      setWalletDialogOpen(false); setRequestAmount('');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Request failed'); }
    finally { setRequesting(false); }
  };

  const handleCancelPromo = async (promoId) => {
    try {
      await api.shopPromotions.cancel(promoId);
      toast.success('Promotion cancelled');
      setPromoToCancel(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading) {
    return <View style={st.center}><Spinner size={34} color="#f59e0b" /></View>;
  }

  return (
    <>
    <ShopScreenWrap wash={['#f8fafc', '#ffffff', colors.p50]} refreshing={refreshing} onRefresh={onRefresh} testID="shop-boost-page">
      {/* Header — amber world */}
      <Rise duration={500} distance={0}>
        <View style={st.headerCard}>
          <Float style={{ position: 'absolute', top: '30%', right: '25%' }} dur={4000}><View style={st.particle} /></Float>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
            <LinearGradient colors={shop.boost} style={st.headerIcon}><Ionicons name="megaphone" size={22} color={colors.white} /></LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={st.headerTitle}>Boost a Product</Text>
              <Text style={st.headerSub}>Promote your products to reach more customers</Text>
            </View>
          </View>
          {totalFreeCredits > 0 && (
            <Pulse>
              <LinearGradient colors={['#fbbf24', '#f97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.freeBadge} testID="boost-page-free-sponsor-badge">
                <Ionicons name="gift" size={14} color={colors.white} />
                <Text style={st.freeBadgeText}>{totalFreeCredits} Free Sponsor{totalFreeCredits > 1 ? 's' : ''}</Text>
              </LinearGradient>
            </Pulse>
          )}
        </View>
      </Rise>

      {/* Wallet hero — violet-600 -> indigo-600 -> purple-700 */}
      <Rise delay={80}>
        <LinearGradient colors={[colors.p500, colors.s500, colors.p900]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.walletCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <View style={st.walletIcon}><Ionicons name="wallet" size={17} color={colors.white} /></View>
            <Text style={st.walletKicker}>Wallet Balance</Text>
          </View>
          <CountUp value={Number(wallet.balance || 0)} prefix="$" decimals={2} style={st.walletValue} />
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="logo-usd" size={12} color={colors.p200} /><Text style={st.walletMeta}>Rate: ${dailyPrice}/day</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="megaphone" size={12} color={colors.p200} /><Text style={st.walletMeta}>{activePromos.length} active boost{activePromos.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <PressScale onPress={() => setWalletDialogOpen(true)}>
              <View style={st.walletTopupBtn}><Ionicons name="add" size={14} color={colors.p800} /><Text style={st.walletTopupText}>Request Top-up</Text></View>
            </PressScale>
            <PressScale onPress={() => setShowTransactions(!showTransactions)}>
              <View style={st.walletGhostBtn}>
                <Ionicons name="time" size={12} color="rgba(255,255,255,0.9)" />
                <Text style={st.walletGhostText}>{showTransactions ? 'Hide' : 'Show'} Transactions</Text>
              </View>
            </PressScale>
          </View>
        </LinearGradient>
      </Rise>

      {/* Transactions collapsible */}
      {showTransactions && wallet.transactions?.length > 0 && (
        <Rise>
          <View style={st.txnCard}>
            <View style={st.txnHead}><Ionicons name="time" size={14} color={colors.p450} /><Text style={st.txnHeadText}>Recent Transactions</Text></View>
            {wallet.transactions.slice(0, 15).map((txn, i) => (
              <TouchableOpacity key={txn.id || i} activeOpacity={0.75} onPress={() => setSelectedTxn(txn)}
                style={[st.txnRow, i < 14 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={{ flex: 1 }}>
                  <Text style={st.txnNote} numberOfLines={1}>{txn.note}</Text>
                  <Text style={st.txnMeta}>{new Date(txn.created_at).toLocaleDateString()} · {(txn.type || '').replace(/_/g, ' ')}</Text>
                </View>
                <Text style={[st.txnAmount, { color: txn.amount >= 0 ? '#059669' : '#ef4444' }]}>
                  {txn.amount >= 0 ? '+' : ''}{txn.amount?.toFixed(2)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Rise>
      )}

      {/* Active boosts — animated countdown rings */}
      {activePromos.length > 0 && (
        <Rise delay={140}>
          <View style={st.activeCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <Ionicons name="megaphone" size={16} color="#f59e0b" />
              <Text style={st.activeTitle}>Active Boosts ({activePromos.length})</Text>
            </View>
            <View style={{ gap: 10 }}>
              {activePromos.map(promo => {
                const daysLeft = Math.max(0, Math.ceil((new Date(promo.end_date) - new Date()) / 86400000));
                return (
                  <LinearGradient key={promo.id} colors={['#fffbeb', '#fff7ed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.promoCard}>
                    <CountdownRing daysLeft={daysLeft} totalDays={promo.duration_days || Math.max(daysLeft, 1)} />
                    <View style={{ flex: 1 }}>
                      <Text style={st.promoName} numberOfLines={1}>{promo.product_name}</Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                        <View style={st.promoStat}><Text style={[st.promoStatVal, { color: '#2563eb' }]}>{promo.views || 0}</Text><Text style={st.promoStatKey}>Views</Text></View>
                        <View style={st.promoStat}><Text style={[st.promoStatVal, { color: '#059669' }]}>{promo.orders || 0}</Text><Text style={st.promoStatKey}>Orders</Text></View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 }}>
                        <Text style={st.promoSpent}>${(promo.total_cost || 0).toFixed(2)} spent</Text>
                        <TouchableOpacity onPress={() => setPromoToCancel(promo)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Ionicons name="ban" size={11} color="#ef4444" />
                          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: '#ef4444' }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </LinearGradient>
                );
              })}
            </View>
          </View>
        </Rise>
      )}

      {/* Search */}
      <Rise delay={180}>
        <View style={st.search}>
          <Ionicons name="search" size={15} color={colors.textMuted} />
          <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search products to boost..."
            placeholderTextColor={colors.textMuted} style={st.searchInput} testID="boost-search" />
        </View>
      </Rise>

      {/* Products grid */}
      <View style={st.grid}>
        {filteredProducts.map((product, i) => {
          const boosted = isProductBoosted(product.id);
          const hasDiscount = product.discount_price && product.discount_price < product.price;
          return (
            <Rise key={product.id} delay={Math.min(500, 220 + i * 40)} style={st.gridItem}>
              <View style={[st.prodCard, boosted && { borderColor: '#fbbf24', borderWidth: 2 }]}>
                <View style={st.prodImgWrap}>
                  {product.images?.[0] ? (
                    <Image source={{ uri: img(product.images[0]) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="cube" size={26} color={colors.border} /></View>
                  )}
                  {boosted && <LinearGradient colors={['rgba(245,158,11,0.3)', 'transparent']} style={StyleSheet.absoluteFill} />}
                  {boosted && (
                    <LinearGradient colors={['#fbbf24', '#f97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.boostedTag}>
                      <Ionicons name="megaphone" size={9} color={colors.white} />
                      <Text style={st.boostedTagText}>Boosted</Text>
                    </LinearGradient>
                  )}
                </View>
                <View style={{ padding: 10 }}>
                  <Text style={st.prodName} numberOfLines={1}>{product.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={st.prodPrice}>${(hasDiscount ? product.discount_price : product.price)?.toFixed(2)}</Text>
                      {hasDiscount && <Text style={st.prodOld}>${product.price?.toFixed(2)}</Text>}
                    </View>
                    <View style={st.stockPill}><Text style={st.stockText}>Stock: {product.stock}</Text></View>
                  </View>
                  {hasDiscount && (
                    <View style={st.offPill}><Text style={st.offText}>{Math.round(((product.price - product.discount_price) / product.price) * 100)}% OFF</Text></View>
                  )}
                  {boosted ? (
                    <LinearGradient colors={['#fef3c7', '#ffedd5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.currentlyBoosted}>
                      <Text style={st.currentlyBoostedText}>Currently Boosted</Text>
                    </LinearGradient>
                  ) : (
                    <PressScale onPress={() => { setSelectedProduct(product); setDurationDays(7); setBoostDialogOpen(true); }} style={{ marginTop: 9 }}>
                      <LinearGradient colors={shop.boost} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.boostBtn} testID={`boost-btn-${product.id}`}>
                        <Ionicons name="megaphone" size={12} color={colors.white} />
                        <Text style={st.boostBtnText}>Boost</Text>
                      </LinearGradient>
                    </PressScale>
                  )}
                </View>
              </View>
            </Rise>
          );
        })}
      </View>
      {filteredProducts.length === 0 && <Text style={st.noProducts}>No products found</Text>}
    </ShopScreenWrap>

    {/* Boost dialog */}
    <Modal visible={boostDialogOpen} transparent animationType="fade" onRequestClose={() => { setBoostDialogOpen(false); setUseFreeCredit(false); }}>
      <BlurView intensity={24} tint="dark" style={st.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => { setBoostDialogOpen(false); setUseFreeCredit(false); }} />
        <View style={st.dialog} testID="boost-dialog">
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 560 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ionicons name="megaphone" size={18} color="#f59e0b" />
              <Text style={st.dialogTitle}>Boost Product</Text>
            </View>
            <View style={st.prodBox}>
              <Text style={st.prodBoxName}>{selectedProduct?.name}</Text>
              <Text style={st.prodBoxDesc}>Your product will appear across the platform</Text>
            </View>

            {/* Free sponsor credits box */}
            {totalFreeCredits > 0 && (
              <LinearGradient colors={['#ecfdf5', '#f0fdfa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.creditsBox} testID="free-credits-box">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Ionicons name="sparkles" size={14} color="#059669" />
                  <Text style={st.creditsTitle}>Free Sponsor Credits Available</Text>
                </View>
                {freeShortCredits > 0 && <Text style={st.creditsLine}>• {freeShortCredits} × 7-day sponsor credit{freeShortCredits > 1 ? 's' : ''}</Text>}
                {freeLongCredits > 0 && <Text style={st.creditsLine}>• {freeLongCredits} × 10-day sponsor credit{freeLongCredits > 1 ? 's' : ''}</Text>}
                <TouchableOpacity activeOpacity={0.8} style={st.creditToggle} testID="use-free-credit-toggle"
                  onPress={() => {
                    const next = !useFreeCredit;
                    setUseFreeCredit(next);
                    // Free sponsor = 3 days (regular). Fall back to 10-day only if that's all the shop has.
                    if (next) {
                      if (freeShortCredits > 0) setDurationDays(3);
                      else if (freeLongCredits > 0) setDurationDays(10);
                    }
                  }}>
                  <View style={[st.checkbox, useFreeCredit && st.checkboxOn]}>{useFreeCredit && <Ionicons name="checkmark" size={12} color={colors.white} />}</View>
                  <Text style={st.creditToggleText}>Use a free sponsor credit ({durationDays === 10 ? '10-day' : '3-day'})</Text>
                </TouchableOpacity>
              </LinearGradient>
            )}

            {/* Duration slider */}
            <Text style={st.durLabel}>
              Duration: <Text style={{ fontFamily: fonts.extrabold }} testID="boost-duration-value">{durationDays} days{useFreeCredit && (durationDays === 3 || durationDays === 10) ? ' (FREE)' : ''}</Text>
            </Text>
            <View testID="boost-duration-range" style={useFreeCredit && { opacity: 0.6 }}>
              <SingleSlider min={1} max={30} step={1} value={durationDays} onChange={setDurationDays} disabled={useFreeCredit} tint="#f59e0b" testID="boost-duration-slider" />
            </View>
            <View style={st.rangeLabels}><Text style={st.rangeText}>1 day</Text><Text style={st.rangeText}>30 days</Text></View>
            {useFreeCredit && <Text style={st.lockNote}>Free credit sets the duration to 3 days (or 10 for a special credit) and locks it.</Text>}

            {/* glowing live cost preview — violet-50 -> indigo-50 */}
            <Pulse min={0.85} dur={1200}>
              <LinearGradient colors={[colors.p50, colors.s50]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.costBox}>
                <View style={st.costRow}><Text style={st.costKey}>Rate</Text><Text style={st.costVal}>${dailyPrice}/day</Text></View>
                <View style={st.costRow}><Text style={st.costKey}>Duration</Text><Text style={st.costVal}>{durationDays} days</Text></View>
                <View style={st.costDivider} />
                <View style={st.costRow}>
                  <Text style={st.totalKey}>Total</Text>
                  <Text style={[st.totalVal, useFreeCredit && { color: '#059669' }]} testID="boost-cost-preview">{useFreeCredit ? 'FREE' : `$${totalCost.toFixed(2)}`}</Text>
                </View>
                {!useFreeCredit && (
                  <View style={st.costRow}>
                    <Text style={[st.costKey, { fontSize: 11 }]}>Wallet Balance</Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: wallet.balance >= totalCost ? '#16a34a' : '#ef4444' }}>${(wallet.balance || 0).toFixed(2)}</Text>
                  </View>
                )}
              </LinearGradient>
            </Pulse>

            {!useFreeCredit && totalCost > wallet.balance && (
              <View style={st.notEnough}>
                <Ionicons name="ban" size={16} color="#ef4444" style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={st.notEnoughTitle}>Not enough credits</Text>
                  <Text style={st.notEnoughDesc}>You need ${(totalCost - wallet.balance).toFixed(2)} more. Contact admin to add money to your wallet.</Text>
                </View>
              </View>
            )}

            <PressScale onPress={handleBoost} disabled={boosting || (!useFreeCredit && totalCost > wallet.balance)} style={{ marginTop: 14 }}>
              <LinearGradient colors={shop.boost} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[st.submitBtn, (boosting || (!useFreeCredit && totalCost > wallet.balance)) && { opacity: 0.55 }]} testID="boost-confirm-button">
                {boosting ? <Spinner size={15} /> : <Ionicons name={useFreeCredit ? 'gift' : 'megaphone'} size={15} color={colors.white} />}
                <Text style={st.submitText}>{boosting ? 'Boosting...' : useFreeCredit ? `Boost for FREE (${durationDays}d)` : `Boost for $${totalCost.toFixed(2)}`}</Text>
              </LinearGradient>
            </PressScale>
          </ScrollView>
        </View>
      </BlurView>
    </Modal>

    {/* Confirm spend for paid boosts */}
    <ConfirmSpendSheet
      open={confirmSpendOpen}
      onClose={() => setConfirmSpendOpen(false)}
      onConfirm={executeBoost}
      title="Confirm Boost Payment"
      description={`Boost "${selectedProduct?.name || ''}" for ${durationDays} days`}
      icon="rocket"
      iconGradient={['#f59e0b', '#f97316']}
      walletBalance={wallet.balance || 0}
      spendAmount={totalCost}
      itemName={selectedProduct?.name || ''}
      confirmLabel={`Boost for $${totalCost.toFixed(2)}`}
      confirmGradient={['#f59e0b', '#f97316']}
      loading={boosting}
    />

    {/* Wallet request dialog */}
    <Modal visible={walletDialogOpen} transparent animationType="fade" onRequestClose={() => setWalletDialogOpen(false)}>
      <BlurView intensity={24} tint="dark" style={st.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setWalletDialogOpen(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={st.dialog}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Ionicons name="wallet" size={17} color={colors.p450} />
              <Text style={st.dialogTitle}>Request Wallet Top-up</Text>
            </View>
            <Text style={st.dialogHint}>Request the admin to add funds to your boost wallet.</Text>
            <Text style={st.fieldLabel}>Amount ($)</Text>
            <TextInput value={requestAmount} onChangeText={setRequestAmount} keyboardType="decimal-pad" placeholder="Enter amount"
              placeholderTextColor={colors.textMuted} style={st.input} />
            <PressScale onPress={handleWalletRequest} disabled={requesting} style={{ marginTop: 14 }}>
              <View style={st.violetBtn}>
                {requesting ? <Spinner size={13} /> : null}
                <Text style={st.violetText}>{requesting ? 'Sending...' : 'Send Request'}</Text>
              </View>
            </PressScale>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>

    {/* Transaction detail popup */}
    <Modal visible={!!selectedTxn} transparent animationType="fade" onRequestClose={() => setSelectedTxn(null)}>
      <BlurView intensity={24} tint="dark" style={st.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSelectedTxn(null)} />
        <View style={st.dialog}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Ionicons name="logo-usd" size={17} color={colors.p450} />
            <Text style={st.dialogTitle}>Transaction Details</Text>
          </View>
          {selectedTxn && (
            <>
              <View style={st.txnDetailBox}>
                <View style={st.costRow}><Text style={st.costKey}>Type</Text><Text style={[st.costVal, { textTransform: 'capitalize' }]}>{(selectedTxn.type || '').replace(/_/g, ' ')}</Text></View>
                <View style={st.costRow}><Text style={st.costKey}>Amount</Text>
                  <Text style={{ fontFamily: fonts.extrabold, fontSize: 16, color: selectedTxn.amount >= 0 ? '#059669' : '#ef4444' }}>
                    {selectedTxn.amount >= 0 ? '+' : ''}${selectedTxn.amount?.toFixed(2)}
                  </Text>
                </View>
                {selectedTxn.balance_after !== undefined && (
                  <View style={st.costRow}><Text style={st.costKey}>Balance After</Text><Text style={st.costVal}>${selectedTxn.balance_after?.toFixed(2)}</Text></View>
                )}
                <View style={st.costRow}><Text style={st.costKey}>Status</Text>
                  <View style={[st.statusPill, { backgroundColor: selectedTxn.status === 'completed' ? '#d1fae5' : selectedTxn.status === 'pending' ? '#fef3c7' : '#f1f5f9' }]}>
                    <Text style={[st.statusPillText, { color: selectedTxn.status === 'completed' ? '#047857' : selectedTxn.status === 'pending' ? '#b45309' : '#475569' }]}>{selectedTxn.status}</Text>
                  </View>
                </View>
                <View style={st.costRow}><Text style={st.costKey}>Date</Text><Text style={st.costVal}>{new Date(selectedTxn.created_at).toLocaleString()}</Text></View>
              </View>
              <View style={st.noteBox}><Text style={st.noteText}><Text style={{ fontFamily: fonts.bold }}>Note:</Text> {selectedTxn.note || 'No note'}</Text></View>
            </>
          )}
        </View>
      </BlurView>
    </Modal>

    {/* Cancel boost confirmation */}
    <Modal visible={!!promoToCancel} transparent animationType="fade" onRequestClose={() => setPromoToCancel(null)}>
      <BlurView intensity={24} tint="dark" style={st.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setPromoToCancel(null)} />
        <View style={st.dialog}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Ionicons name="ban" size={17} color="#dc2626" />
            <Text style={[st.dialogTitle, { color: '#dc2626' }]}>Cancel Boost</Text>
          </View>
          {promoToCancel && (
            <>
              <Text style={st.cancelQuestion}>Are you sure you want to cancel the boost for <Text style={{ fontFamily: fonts.bold }}>{promoToCancel.product_name}</Text>?</Text>
              <View style={st.cancelBox}>
                <View style={st.costRow}><Text style={st.cancelKey}>Total Paid</Text><Text style={[st.cancelKey, { fontFamily: fonts.extrabold }]}>${(promoToCancel.total_cost || 0).toFixed(2)}</Text></View>
                <View style={st.costRow}><Text style={st.cancelKey}>Days Used</Text><Text style={[st.cancelKey, { fontFamily: fonts.bold }]}>{Math.max(0, (promoToCancel.duration_days || 0) - Math.ceil((new Date(promoToCancel.end_date) - new Date()) / 86400000))} of {promoToCancel.duration_days}</Text></View>
                <View style={st.costRow}><Text style={st.cancelKey}>Refund Amount</Text><Text style={{ fontFamily: fonts.extrabold, fontSize: 12.5, color: '#059669' }}>$0.00</Text></View>
                <Text style={st.cancelNote}>Note: Cancellations are non-refundable. The remaining boost days will be forfeited.</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <PressScale style={{ flex: 1 }} onPress={() => setPromoToCancel(null)}>
                  <View style={st.outlineBtn}><Text style={st.outlineText}>Keep Boost</Text></View>
                </PressScale>
                <PressScale style={{ flex: 1 }} onPress={() => handleCancelPromo(promoToCancel.id)}>
                  <View style={st.redBtn}><Text style={st.redText}>Confirm Cancel</Text></View>
                </PressScale>
              </View>
            </>
          )}
        </View>
      </BlurView>
    </Modal>

    {/* Purchase confirmation — confetti */}
    <PurchaseConfirmSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} type="boost" details={confirmDetails} />
    </>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: shop.bg },
  headerCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, padding: 17, overflow: 'hidden', ...shadow.card },
  headerIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', ...shadow.amberGlow },
  headerTitle: { fontFamily: fonts.heading, fontSize: 21, color: colors.ink, letterSpacing: -0.4 },
  headerSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  particle: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(252,211,77,0.6)' },
  freeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 7, marginTop: 12, ...shadow.amberGlow },
  freeBadgeText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 12.5 },
  walletCard: { borderRadius: radius.xl, padding: 20, marginTop: 14, overflow: 'hidden', ...shadow.emphasis },
  walletIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  walletKicker: { color: colors.p200, fontFamily: fonts.medium, fontSize: 12.5 },
  walletValue: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 40, letterSpacing: -1 },
  walletMeta: { color: colors.p200, fontFamily: fonts.body, fontSize: 11.5 },
  walletTopupBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 10, ...shadow.card },
  walletTopupText: { fontFamily: fonts.bold, fontSize: 12, color: colors.p800 },
  walletGhostBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  walletGhostText: { fontFamily: fonts.semibold, fontSize: 11, color: 'rgba(255,255,255,0.9)' },
  txnCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: 12, overflow: 'hidden', ...shadow.card },
  txnHead: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceMuted, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 14, paddingVertical: 10 },
  txnHeadText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  txnNote: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  txnMeta: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 1, textTransform: 'capitalize' },
  txnAmount: { fontFamily: fonts.extrabold, fontSize: 13 },
  activeCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, marginTop: 12, ...shadow.card },
  activeTitle: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
  promoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.md, padding: 12 },
  promoName: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  promoStat: { flex: 1, backgroundColor: colors.white, borderRadius: radius.sm, paddingVertical: 6, alignItems: 'center' },
  promoStatVal: { fontFamily: fonts.extrabold, fontSize: 15 },
  promoStatKey: { fontFamily: fonts.body, fontSize: 8.5, color: colors.textMuted },
  promoSpent: { fontFamily: fonts.semibold, fontSize: 11, color: '#b45309' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, marginTop: 12, ...shadow.card },
  searchInput: { flex: 1, paddingVertical: 11, fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  gridItem: { flexBasis: '47%', flexGrow: 1 },
  prodCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden', ...shadow.card },
  prodImgWrap: { height: 130, backgroundColor: colors.surfaceMuted },
  boostedTag: { position: 'absolute', top: 7, left: 7, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3.5, ...shadow.card },
  boostedTagText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 9 },
  prodName: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text },
  prodPrice: { fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.p500 },
  prodOld: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted, textDecorationLine: 'line-through' },
  stockPill: { backgroundColor: colors.borderLight, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  stockText: { fontFamily: fonts.body, fontSize: 8.5, color: colors.textMuted },
  offPill: { alignSelf: 'flex-start', backgroundColor: '#ffe4e6', borderRadius: radius.badge, paddingHorizontal: 5, paddingVertical: 2, marginTop: 4 },
  offText: { fontFamily: fonts.extrabold, fontSize: 8, color: '#e11d48' },
  currentlyBoosted: { borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.md, paddingVertical: 8, alignItems: 'center', marginTop: 9 },
  currentlyBoostedText: { fontFamily: fonts.bold, fontSize: 11, color: '#b45309' },
  boostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: radius.md, paddingVertical: 8, ...shadow.amberGlow },
  boostBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 11 },
  noProducts: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 26 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 18 },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 18, ...shadow.dropdown },
  dialogTitle: { fontFamily: fonts.extrabold, fontSize: 16.5, color: colors.ink },
  dialogHint: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginBottom: 4 },
  prodBox: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 13, marginBottom: 12 },
  prodBoxName: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  prodBoxDesc: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  creditsBox: { borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.md, padding: 13, marginBottom: 12 },
  creditsTitle: { fontFamily: fonts.bold, fontSize: 12.5, color: '#065f46' },
  creditsLine: { fontFamily: fonts.body, fontSize: 11, color: '#047857', marginTop: 2 },
  creditToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: '#6ee7b7', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#059669', borderColor: '#059669' },
  creditToggleText: { fontFamily: fonts.bold, fontSize: 12, color: '#065f46', flex: 1 },
  durLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text, marginBottom: 4 },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  rangeText: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  lockNote: { fontFamily: fonts.body, fontSize: 10, color: '#059669', marginTop: 4 },
  costBox: { borderWidth: 1, borderColor: colors.p200, borderRadius: radius.md, padding: 14, marginTop: 12 },
  costRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  costKey: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
  costVal: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  costDivider: { height: 1, backgroundColor: colors.p200, marginVertical: 10 },
  totalKey: { fontFamily: fonts.extrabold, fontSize: 15.5, color: colors.ink },
  totalVal: { fontFamily: fonts.extrabold, fontSize: 16.5, color: colors.p800 },
  notEnough: { flexDirection: 'row', gap: 9, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: radius.md, padding: 12, marginTop: 12 },
  notEnoughTitle: { fontFamily: fonts.bold, fontSize: 12.5, color: '#991b1b' },
  notEnoughDesc: { fontFamily: fonts.body, fontSize: 10.5, color: '#dc2626', marginTop: 1 },
  submitBtn: { height: 48, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, ...shadow.amberGlow },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13.5 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text, marginTop: 10, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  violetBtn: { height: 46, borderRadius: radius.md, backgroundColor: colors.p500, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  violetText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },
  txnDetailBox: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 14, gap: 7 },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2.5 },
  statusPillText: { fontFamily: fonts.bold, fontSize: 10, textTransform: 'capitalize' },
  noteBox: { backgroundColor: colors.p50, borderRadius: radius.md, padding: 11, marginTop: 10 },
  noteText: { fontFamily: fonts.body, fontSize: 12, color: '#5b21b6', lineHeight: 17 },
  cancelQuestion: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  cancelBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: radius.md, padding: 13, marginTop: 12, gap: 6 },
  cancelKey: { fontFamily: fonts.body, fontSize: 12, color: '#b91c1c' },
  cancelNote: { fontFamily: fonts.body, fontSize: 10.5, color: '#dc2626', marginTop: 4, lineHeight: 15 },
  outlineBtn: { height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  redBtn: { height: 44, borderRadius: radius.md, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' },
  redText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12.5 },
});
