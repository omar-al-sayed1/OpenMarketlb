import React, { useEffect, useRef, useState } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, Switch, useWindowDimensions } from 'react-native';
// (Alert not required here — confirmations use in-sheet buttons and hold-to-confirm)
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { notifySuccess, notifyError, tapMedium } from '../../lib/haptics';
import { toast, Spinner } from '../shop/ShopKit';
import { StatusPill, CountUp } from './AdminKit';
import AdminProductForm from './AdminProductForm';
import AdminOrderDetail from './AdminOrderDetail';
import { colors, radius, fonts, shadow } from '../../theme/theme';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const STATUS_META = {
  active: { variant: 'emerald', label: 'Active' }, trial: { variant: 'blue', label: 'Trial' },
  pending: { variant: 'amber', label: 'Pending' }, expired: { variant: 'red', label: 'Expired' },
  suspended: { variant: 'slate', label: 'Suspended' }, rejected: { variant: 'red', label: 'Rejected' },
};
const statusMeta = (s) => STATUS_META[s] || STATUS_META.pending;
const orderVariant = (s) => (s === 'delivered' ? 'emerald' : s === 'paid' ? 'blue' : 'amber');
const isSubscribed = (shop) => shop?.subscription_required !== false && ['active', 'trial'].includes(shop?.subscription_status);
const commTypeLabel = (t) => (t === 'on_shop' ? 'On Shop' : t === 'half_half' ? 'Half/Half' : 'On Customer');
const TABS = ['Overview', 'Products', 'Orders', 'Subscription'];
const DURATIONS = [['1', '1 month'], ['2', '2 months'], ['3', '3 months'], ['6', '6 months'], ['12', '12 months (Yearly)']];
const COMM_TYPES = [
  { value: 'on_shop', label: 'Commission on Shop', desc: 'Customer sees listed price. Commission deducted from shop revenue.' },
  { value: 'on_customer', label: 'Commission on Customer', desc: 'Customer sees marked-up price. Shop gets full listed price.' },
  { value: 'half_half', label: 'Commission Half/Half', desc: 'Split equally: half markup, half deduction.' },
];

export default function AdminShopDetail({ shop, agents, categories, platformSettings, onClose, onChanged, onMap }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const pagerRef = useRef(null);
  const [tab, setTab] = useState(0);
  const indicator = useSharedValue(0);

  const [analytics, setAnalytics] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [balance, setBalance] = useState(shop?.wallet_balance || 0);
  const [verified, setVerified] = useState(!!shop?.is_verified);
  const [status, setStatus] = useState(shop?.subscription_status);

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [walletType, setWalletType] = useState(null); // 'add' | 'decrease'
  const [subEditOpen, setSubEditOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);
  const [productForm, setProductForm] = useState(null); // { editing: product|null } when the add/edit sheet is open
  const [orderView, setOrderView] = useState(null);      // order being viewed in detail

  const reloadProducts = () => api.admin.getShopProducts(shop.id).then(({ data }) => setProducts(data || [])).catch(() => {});

  const badgeScale = useSharedValue(verified ? 1 : 0);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [a, p, o] = await Promise.allSettled([api.admin.getShopAnalytics(shop.id), api.admin.getShopProducts(shop.id), api.admin.getShopOrders(shop.id)]);
      if (!alive) return;
      if (a.status === 'fulfilled') setAnalytics(a.value.data);
      if (p.status === 'fulfilled') setProducts(p.value.data || []);
      if (o.status === 'fulfilled') setOrders(o.value.data || []);
    })();
    return () => { alive = false; };
  }, [shop.id]);

  // Simple: the indicator tracks the finger 1:1 while dragging, and a short linear
  // ease settles it on tab change — no spring bounce.
  const goTab = (i) => { pagerRef.current?.scrollTo({ x: i * width, animated: true }); setTab(i); indicator.value = withTiming(i, { duration: 180 }); };
  const onPagerScroll = (e) => { indicator.value = e.nativeEvent.contentOffset.x / width; };
  const onPagerEnd = (e) => { const i = Math.round(e.nativeEvent.contentOffset.x / width); setTab(i); indicator.value = withTiming(i, { duration: 140 }); };
  const indStyle = useAnimatedStyle(() => ({ transform: [{ translateX: indicator.value * ((width - 32) / 4) }] }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.value }] }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  const flashSuccess = () => { setSuccessFlash(true); notifySuccess(); setTimeout(() => setSuccessFlash(false), 900); };
  const doShake = () => { tapMedium(); shakeX.value = withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 })); };

  /* ===== actions ===== */
  const doVerify = async () => {
    try {
      if (verified) { await api.admin.unverifyShop(shop.id); setVerified(false); badgeScale.value = withTiming(0); toast.success('Verification removed'); }
      else { await api.admin.verifyShop(shop.id); setVerified(true); badgeScale.value = withSequence(withSpring(1.3), withSpring(1)); notifySuccess(); toast.success('Shop verified'); }
      setVerifyOpen(false); onChanged();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };
  const suspendNow = async () => { try { await api.admin.suspendShop(shop.id); setStatus('suspended'); toast.success('Shop suspended'); onChanged(); } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); } };
  const deleteNow = async () => { try { await api.admin.deleteShop(shop.id); notifySuccess(); toast.success('Shop deleted'); onChanged(); onClose(); } catch (e) { notifyError(); toast.error(e?.response?.data?.detail || 'Failed'); } };
  const setTier = async (newTier) => { try { await api.adminTier.setShopTier(shop.id, newTier); toast.success(`Tier set to ${newTier}`); onChanged(); } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); } };

  const rate = shop.commission_percentage ?? platformSettings?.commission_percentage ?? 10;
  const meta = statusMeta(status);

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* Header */}
        <LinearGradient colors={[colors.p450, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingTop: insets.top + 6 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.hBtn} hitSlop={8}><Ionicons name="close" size={22} color={colors.white} /></TouchableOpacity>
            <View style={styles.hLogo}>
              {shop.logo ? <Image source={{ uri: img(shop.logo) }} style={{ width: '100%', height: '100%' }} /> : <View style={styles.hLogoFallback}><Ionicons name="storefront" size={22} color={colors.white} /></View>}
              <Animated.View style={[styles.hBadge, badgeStyle]}><Ionicons name="shield-checkmark" size={12} color="#2563eb" /></Animated.View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hName} numberOfLines={1}>{shop.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <StatusPill label={meta.label} variant={meta.variant} />
                <Text style={styles.hId}>ID: {String(shop.id).slice(0, 8)}…</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setProductForm({ editing: null })} style={styles.hBtn} hitSlop={8} testID="admin-add-product-btn"><Ionicons name="add-circle-outline" size={22} color={colors.white} /></TouchableOpacity>
            <TouchableOpacity onPress={onMap} style={styles.hBtn} hitSlop={8}><Ionicons name="map" size={20} color={colors.white} /></TouchableOpacity>
          </View>
          {/* Tabs */}
          <View style={styles.tabBar}>
            <Animated.View style={[styles.tabIndicator, { width: (width - 32) / 4 }, indStyle]} />
            {TABS.map((t, i) => (
              <TouchableOpacity key={t} style={styles.tab} onPress={() => goTab(i)}>
                <Text style={[styles.tabText, tab === i && styles.tabTextOn]}>{t === 'Products' ? `Products (${products.length})` : t === 'Orders' ? `Orders (${orders.length})` : t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        {/* Pager */}
        <ScrollView ref={pagerRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onPagerScroll} scrollEventThrottle={16} onMomentumScrollEnd={onPagerEnd} keyboardShouldPersistTaps="handled">
          {/* Overview */}
          <ScrollView style={{ width }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
            <Card title="Contact Information" icon="mail">
              <Line icon="mail-outline" text={shop.email || 'Not provided'} />
              <Line icon="call-outline" text={shop.phone || 'Not provided'} />
              <Line icon="location-outline" text={shop.address || 'Not provided'} />
            </Card>
            <Card title="Analytics Summary" icon="stats-chart">
              <KV label="Total Revenue"><CountUp value={analytics?.gross_revenue || 0} prefix="$" decimals={2} style={styles.kvEmerald} /></KV>
              <KV label="Total Orders"><CountUp value={analytics?.total_orders || 0} style={styles.kvVal} /></KV>
              <KV label="Total Products"><CountUp value={products.length} style={styles.kvVal} /></KV>
              <KV label="Commission"><Text style={styles.kvVal}>{rate}% · {commTypeLabel(shop.commission_type)}</Text></KV>
              <KV label="Subscription"><Text style={[styles.kvVal, { color: shop.subscription_required === false ? '#059669' : colors.text }]}>{shop.subscription_required === false ? 'Free (No Sub)' : 'Required'}</Text></KV>
              <KV label="Wallet Balance"><CountUp value={balance} prefix="$" decimals={2} style={[styles.kvVal, { color: colors.violet }]} /></KV>
            </Card>
            {shop.description ? <Card title="Description" icon="document-text"><Text style={styles.desc}>{shop.description}</Text></Card> : null}
            <View style={styles.catCard} testID="shop-detail-categories">
              <Text style={styles.catTitle}>Categories Applied</Text>
              {Array.isArray(shop.category_ids) && shop.category_ids.length > 0 ? (
                <View style={styles.chips}>
                  {shop.category_ids.map((cid) => { const c = categories.find((x) => x.id === cid); return c ? <View key={cid} style={styles.catChip} testID={`shop-detail-category-${cid}`}><Text style={styles.catChipText}>{c.name}</Text></View> : null; })}
                </View>
              ) : <Text style={styles.catEmpty}>No categories selected by the shop.</Text>}
            </View>
            {shop.referred_by_agent_id ? (
              <Card title="Referral" icon="gift">
                <KV label="Agent"><Text style={styles.kvVal}>{shop.referred_by_agent_name || 'Agent'}</Text></KV>
                {shop.referral_code ? <KV label="Code"><Text style={styles.kvMono}>{shop.referral_code}</Text></KV> : null}
              </Card>
            ) : null}

            {/* Quick actions */}
            <View style={styles.actWrap}>
              {status === 'pending' && (
                <ActBtn grad={['#10b981', '#059669']} icon="checkmark-circle" label="Approve Shop" onPress={() => setApproveOpen(true)} />
              )}
              <Animated.View style={shakeStyle}>
                <View style={styles.actRow}>
                  <ActOutline icon={verified ? 'shield-outline' : 'shield-checkmark-outline'} color="#2563eb" label={verified ? 'Unverify' : 'Verify'} onPress={() => setVerifyOpen(true)} />
                  {status !== 'suspended' && <ActOutline icon="ban-outline" color="#d97706" label="Suspend" onPress={() => { doShake(); setTimeout(suspendNow, 220); }} />}
                </View>
              </Animated.View>
              <View style={styles.actRow}>
                <ActOutline icon="cash-outline" color="#059669" label="Add Wallet" onPress={() => setWalletType('add')} />
                <ActOutline icon="remove-circle-outline" color="#ea580c" label="Decrease" onPress={() => setWalletType('decrease')} />
              </View>
              <View style={styles.actRow}>
                <ActOutline icon="star-outline" color={colors.p500} label={`Tier: ${shop.tier === 'pro' ? 'Pro→Starter' : 'Starter→Pro'}`} onPress={() => setTier(shop.tier === 'pro' ? 'starter' : 'pro')} />
                <ActOutline icon="create-outline" color="#475569" label="Edit Shop" onPress={() => setEditOpen(true)} />
              </View>
              <DeleteHold onConfirm={deleteNow} />
            </View>
          </ScrollView>

          {/* Products */}
          <ScrollView style={{ width }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
            <TouchableOpacity onPress={() => setProductForm({ editing: null })} style={styles.addProdBtn} testID="admin-add-product-inline">
              <Ionicons name="add-circle" size={18} color={colors.violet} />
              <Text style={styles.addProdText}>Add a product for this shop</Text>
            </TouchableOpacity>
            {products.length === 0 ? <Empty icon="cube-outline" label="No products yet" /> : products.map((p) => (
              <TouchableOpacity key={p.id} style={styles.prodRow} activeOpacity={0.7} onPress={() => setProductForm({ editing: p })} testID={`admin-product-${p.id}`}>
                <Image source={{ uri: img(p.images?.[0]) }} style={styles.prodImg} />
                <View style={{ flex: 1 }}><Text style={styles.prodName} numberOfLines={1}>{p.name}</Text><Text style={styles.prodPrice}>{money(p.price)}</Text><Text style={styles.prodStock}>Stock: {p.stock}</Text></View>
                <Ionicons name="create-outline" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Orders */}
          <ScrollView style={{ width }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
            {orders.length === 0 ? <Empty icon="cart-outline" label="No orders yet" /> : orders.slice(0, 30).map((o) => (
              <TouchableOpacity key={o.id} style={styles.orderRow} activeOpacity={0.7} onPress={() => setOrderView(o)} testID={`admin-order-${o.id}`}>
                <View><Text style={styles.orderId}>Order #{String(o.id).slice(0, 8)}</Text><Text style={styles.orderDate}>{o.created_at ? new Date(o.created_at).toLocaleDateString() : ''}</Text></View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}><Text style={styles.orderAmt}>{money(o.total_amount)}</Text><StatusPill label={o.order_status} variant={orderVariant(o.order_status)} /></View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Subscription */}
          <ScrollView style={{ width }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
            <LinearGradient colors={[colors.p50, colors.s50]} style={styles.subCard}>
              <View style={styles.subHead}>
                <View><Text style={styles.subTitle}>Subscription Details</Text><Text style={styles.subSub}>Manage subscription, billing & commission</Text></View>
                <TouchableOpacity style={styles.subEditBtn} onPress={() => setSubEditOpen(true)}><Ionicons name="create-outline" size={15} color={colors.violet} /><Text style={styles.subEditText}>Edit</Text></TouchableOpacity>
              </View>
              <View style={styles.subGrid}>
                <SubCell label="Status"><StatusPill label={meta.label} variant={meta.variant} /></SubCell>
                <SubCell label="Payment"><Text style={styles.subVal}>{shop.payment_method === 'card' ? 'Card (Stripe)' : 'Manual'}</Text></SubCell>
                <SubCell label="Plan"><Text style={styles.subVal}>{shop.plan_type === 'yearly' ? 'Yearly' : shop.plan_type === 'monthly' ? 'Monthly' : 'N/A'}</Text></SubCell>
                <SubCell label="Subscribed"><Text style={styles.subVal}>{isSubscribed(shop) ? 'Yes' : 'No'}</Text></SubCell>
                <SubCell label="Started"><Text style={styles.subVal}>{shop.subscription_start ? new Date(shop.subscription_start).toLocaleDateString() : 'N/A'}</Text></SubCell>
                <SubCell label="Expires"><Text style={styles.subVal}>{shop.subscription_end ? new Date(shop.subscription_end).toLocaleDateString() : 'N/A'}</Text></SubCell>
              </View>
              {status === 'pending' && (
                <TouchableOpacity style={styles.approveInline} onPress={() => setApproveOpen(true)}><Ionicons name="checkmark" size={16} color={colors.white} /><Text style={styles.approveInlineText}>Approve & Activate</Text></TouchableOpacity>
              )}
            </LinearGradient>
          </ScrollView>
        </ScrollView>

        {/* success flash */}
        {successFlash && (
          <Animated.View entering={FadeIn.duration(120)} style={styles.flash} pointerEvents="none">
            <View style={styles.flashCheck}><Ionicons name="checkmark" size={44} color={colors.white} /></View>
          </Animated.View>
        )}

        {/* ===== dialogs ===== */}
        <VerifyDialog open={verifyOpen} verified={verified} onCancel={() => setVerifyOpen(false)} onConfirm={doVerify} />
        <ApproveDialog open={approveOpen} shop={shop} onClose={() => setApproveOpen(false)} onApproved={() => { setApproveOpen(false); flashSuccess(); setStatus('active'); onChanged(); }} onDenied={() => { setApproveOpen(false); setStatus('rejected'); onChanged(); }} />
        <WalletDialog type={walletType} shop={shop} balance={balance} onClose={() => setWalletType(null)} onDone={(nb) => { setBalance(nb); setWalletType(null); onChanged(); }} />
        <SubEditDialog open={subEditOpen} shop={shop} onClose={() => setSubEditOpen(false)} onSaved={() => { setSubEditOpen(false); toast.success('Subscription updated'); onChanged(); }} />
        <EditShopDialog open={editOpen} shop={shop} categories={categories} platformSettings={platformSettings} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); toast.success('Shop updated'); onChanged(); }} />

        {/* Add / edit a product for this shop — same UI as the shop dashboard */}
        {productForm && (
          <AdminProductForm
            open
            shop={shop}
            editingProduct={productForm.editing}
            platformSettings={platformSettings}
            onClose={() => setProductForm(null)}
            onSaved={() => { setProductForm(null); reloadProducts(); onChanged(); }}
          />
        )}

        {/* Order detail (read-only) */}
        {orderView && (
          <AdminOrderDetail orderId={orderView.id} orderSummary={orderView} onClose={() => setOrderView(null)} />
        )}
      </View>
    </Modal>
  );
}

/* ---------- small building blocks ---------- */
function Card({ title, icon, children }) { return <View style={styles.card}><View style={styles.cardHead}><Ionicons name={icon} size={15} color={colors.violet} /><Text style={styles.cardTitle}>{title}</Text></View>{children}</View>; }
function Line({ icon, text }) { return <View style={styles.line}><Ionicons name={icon} size={14} color={colors.textMuted} /><Text style={styles.lineText} numberOfLines={1}>{text}</Text></View>; }
function KV({ label, children }) { return <View style={styles.kv}><Text style={styles.kvLabel}>{label}</Text>{children}</View>; }
function SubCell({ label, children }) { return <View style={styles.subCell}><Text style={styles.subCellLabel}>{label}</Text><View style={{ marginTop: 3 }}>{children}</View></View>; }
function Empty({ icon, label }) { return <View style={styles.empty}><Ionicons name={icon} size={40} color={colors.border} /><Text style={styles.emptyText}>{label}</Text></View>; }
function ActBtn({ grad, icon, label, onPress, testID }) { return <TouchableOpacity activeOpacity={0.9} onPress={onPress} testID={testID}><LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actBtn}><Ionicons name={icon} size={18} color={colors.white} /><Text style={styles.actBtnText}>{label}</Text></LinearGradient></TouchableOpacity>; }
function ActOutline({ icon, color, label, onPress }) { return <TouchableOpacity style={styles.actOutline} onPress={onPress}><Ionicons name={icon} size={16} color={color} /><Text style={[styles.actOutlineText, { color }]} numberOfLines={1}>{label}</Text></TouchableOpacity>; }

/* ---------- hold-to-confirm delete ---------- */
function DeleteHold({ onConfirm }) {
  const p = useSharedValue(0);
  const timer = useRef(null);
  const fill = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  const start = () => { p.value = withTiming(1, { duration: 1400 }); timer.current = setTimeout(() => { tapMedium(); onConfirm(); }, 1400); };
  const cancel = () => { if (timer.current) clearTimeout(timer.current); p.value = withTiming(0, { duration: 150 }); };
  return (
    <TouchableOpacity activeOpacity={0.9} onPressIn={start} onPressOut={cancel} style={styles.delHold}>
      <Animated.View style={[styles.delFill, fill]} />
      <View style={styles.delInner}><Ionicons name="trash-outline" size={16} color={colors.sale} /><Text style={styles.delText}>Hold to delete shop</Text></View>
    </TouchableOpacity>
  );
}

/* ---------- verify confirm ---------- */
function VerifyDialog({ open, verified, onCancel, onConfirm }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const run = async () => { setBusy(true); await onConfirm(); setBusy(false); };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.centerBackdrop}>
        <View style={styles.centerCard} testID="verify-shop-confirm-dialog">
          <View style={[styles.centerIcon, { backgroundColor: verified ? '#fef3c7' : '#dbeafe' }]}><Ionicons name="shield-checkmark" size={28} color={verified ? '#d97706' : '#2563eb'} /></View>
          <Text style={styles.centerTitle}>{verified ? 'Remove verification?' : 'Verify this shop?'}</Text>
          <Text style={styles.centerBody}>{verified ? 'The verified badge will be removed from this shop.' : 'A verified badge will be shown on this shop across the platform.'}</Text>
          <View style={styles.centerActions}>
            <TouchableOpacity style={styles.centerCancel} onPress={onCancel} testID="verify-shop-cancel-btn"><Text style={styles.centerCancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity activeOpacity={0.9} onPress={run} disabled={busy} testID="verify-shop-confirm-btn" style={{ flex: 1 }}><LinearGradient colors={['#3b82f6', '#2563eb']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.centerConfirm}>{busy ? <Spinner size={16} color={colors.white} /> : <Text style={styles.centerConfirmText}>{verified ? 'Remove' : 'Verify'}</Text>}</LinearGradient></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- shared commission + subscription editor ---------- */
function SubCommEditor({ subReq, setSubReq, months, setMonths, rate, setRate, type, setType, editMode }) {
  return (
    <>
      <View style={styles.editBox} testID="subscription-toggle-section">
        <View style={styles.toggleRow}>
          <View><Text style={styles.editBoxTitle}>Activate Subscription?</Text><Text style={styles.editBoxHint}>If off, shop pays no monthly fees</Text></View>
          <Switch value={subReq} onValueChange={setSubReq} trackColor={{ true: '#2563eb' }} testID="subscription-required-toggle" />
        </View>
        {subReq && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.fieldLabel}>Subscription Duration</Text>
            <MiniSelect value={months} options={DURATIONS} onChange={setMonths} testID="subscription-duration-select" />
          </View>
        )}
      </View>
      <View style={[styles.editBox, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]} testID="commission-rate-section">
        <Text style={styles.editBoxTitle}>Commission Rate</Text>
        <Text style={styles.editBoxHint}>Percentage taken from each sale</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <TextInput style={[styles.input, { width: 110 }]} keyboardType="numeric" value={String(rate)} onChangeText={setRate} testID="commission-rate-input" />
          <Text style={{ fontFamily: fonts.bold, color: '#b45309' }}>%</Text>
        </View>
      </View>
      <View style={[styles.editBox, { backgroundColor: colors.p50, borderColor: colors.p200 }]} testID={editMode ? 'edit-commission-type-section' : 'commission-type-section'}>
        <Text style={styles.editBoxTitle}>Commission Type</Text>
        <Text style={styles.editBoxHint}>How commission applies to prices</Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          {COMM_TYPES.map((o) => {
            const on = type === o.value;
            return (
              <TouchableOpacity key={o.value} style={[styles.radioCard, on && styles.radioCardOn]} onPress={() => setType(o.value)} testID={`commission-type-${o.value}`}>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? colors.violet : colors.textMuted} />
                <View style={{ flex: 1 }}><Text style={styles.radioLabel}>{o.label}</Text><Text style={styles.radioDesc}>{o.desc}</Text></View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
}

/* ---------- approve / activate ---------- */
function ApproveDialog({ open, shop, onClose, onApproved, onDenied }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [subReq, setSubReq] = useState(false);
  const [months, setMonths] = useState(shop?.plan_type === 'yearly' ? '12' : '1');
  const [rate, setRate] = useState(String(shop?.commission_percentage ?? '10'));
  const [type, setType] = useState(shop?.commission_type || 'on_customer');
  const [busy, setBusy] = useState(false);
  const [denying, setDenying] = useState(false);
  if (!open) return null;
  const approve = async () => {
    const r = parseFloat(rate);
    if (isNaN(r) || r < 0 || r > 100) { toast.error('Commission must be 0–100'); return; }
    setBusy(true);
    try { await api.admin.approveShop(shop.id, { months: subReq ? parseInt(months, 10) : 1, subscription_required: subReq, commission_percentage: r, commission_type: type }); onApproved(); toast.success('Shop approved'); }
    catch (e) { notifyError(); toast.error(e?.response?.data?.detail || 'Failed to approve'); }
    finally { setBusy(false); }
  };
  const deny = async () => { setDenying(true); try { await api.admin.updateShop(shop.id, { status: 'rejected', subscription_status: 'rejected' }); toast.success('Shop denied'); onDenied(); } catch (e) { toast.error('Failed to deny'); } finally { setDenying(false); } };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb, maxHeight: '92%' }]}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>Approve — {shop.name}</Text>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <SubCommEditor subReq={subReq} setSubReq={setSubReq} months={months} setMonths={setMonths} rate={rate} setRate={setRate} type={type} setType={setType} />
          <View style={styles.bonusNote} testID="approval-welcome-bonus-note"><Ionicons name="sparkles" size={14} color={colors.p500} /><Text style={styles.bonusText}>On approval the shop receives a welcome bonus (free sponsor + wallet credit), recorded as New Shop Credits.</Text></View>
          <View style={styles.approveActions}>
            <TouchableOpacity style={styles.denyBtn} onPress={deny} disabled={denying} testID="deny-shop-btn">{denying ? <Spinner size={16} color={colors.white} /> : <><Ionicons name="close" size={16} color={colors.white} /><Text style={styles.denyText}>Deny</Text></>}</TouchableOpacity>
            <TouchableOpacity activeOpacity={0.9} onPress={approve} disabled={busy} testID="confirm-approve-btn" style={{ flex: 1.4 }}><LinearGradient colors={['#10b981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmApprove}>{busy ? <Spinner size={16} color={colors.white} /> : <><Ionicons name="checkmark" size={16} color={colors.white} /><Text style={styles.confirmApproveText}>Approve Shop</Text></>}</LinearGradient></TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ---------- wallet adjust ---------- */
function WalletDialog({ type, shop, balance, onClose, onDone }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!type) return null;
  const add = type === 'add';
  const submit = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }
    setBusy(true);
    try {
      if (add) await api.admin.addFunds(shop.id, amt, note || 'Admin top-up'); else await api.admin.decreaseFunds(shop.id, amt, note || 'Admin deduction');
      notifySuccess(); toast.success(add ? `Added ${money(amt)}` : `Deducted ${money(amt)}`);
      onDone(add ? balance + amt : Math.max(0, balance - amt));
    } catch (e) { notifyError(); toast.error(e?.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>{add ? 'Add Funds' : 'Decrease Funds'} — {shop.name}</Text>
        <View style={styles.balBox}><Text style={styles.balLabel}>Current Balance</Text><CountUp value={balance} prefix="$" decimals={2} style={styles.balVal} /></View>
        <TextInput style={styles.input} placeholder="Amount ($)" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={amount} onChangeText={setAmount} testID="wallet-adjust-amount" />
        <TextInput style={[styles.input, { marginTop: 10 }]} placeholder="Note (optional)" placeholderTextColor={colors.textMuted} value={note} onChangeText={setNote} />
        <TouchableOpacity activeOpacity={0.9} onPress={submit} disabled={busy} testID="confirm-wallet-adjust" style={{ marginTop: 12 }}>
          <LinearGradient colors={add ? ['#10b981', '#059669'] : ['#f97316', '#ea580c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>{busy ? <Spinner size={18} color={colors.white} /> : <Text style={styles.submitText}>{add ? 'Add Funds' : 'Deduct Funds'}</Text>}</LinearGradient>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

/* ---------- subscription editor ---------- */
function SubEditDialog({ open, shop, onClose, onSaved }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [subReq, setSubReq] = useState(shop?.subscription_required !== false);
  const [months, setMonths] = useState('1');
  const [rate, setRate] = useState(String(shop?.commission_percentage ?? '10'));
  const [type, setType] = useState(shop?.commission_type || 'on_customer');
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const save = async () => {
    setBusy(true);
    try {
      const r = parseFloat(rate);
      if (!isNaN(r)) await api.admin.updateShopCommission(shop.id, r);
      await api.admin.updateShop(shop.id, { commission_type: type, subscription_required: subReq });
      const end = new Date(); end.setMonth(end.getMonth() + (parseInt(months, 10) || 1));
      await api.admin.updateShopSubscription(shop.id, { subscription_status: subReq ? 'active' : (shop.subscription_status || 'pending'), subscription_end: subReq ? end.toISOString() : undefined });
      onSaved();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to update'); }
    finally { setBusy(false); }
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb, maxHeight: '92%' }]}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>Edit Subscription — {shop.name}</Text>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <SubCommEditor editMode subReq={subReq} setSubReq={setSubReq} months={months} setMonths={setMonths} rate={rate} setRate={setRate} type={type} setType={setType} />
          <TouchableOpacity activeOpacity={0.9} onPress={save} disabled={busy} style={{ marginTop: 6 }}><LinearGradient colors={[colors.p450, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>{busy ? <Spinner size={18} color={colors.white} /> : <Text style={styles.submitText}>Save subscription</Text>}</LinearGradient></TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ---------- edit shop ---------- */
function EditShopDialog({ open, shop, categories, platformSettings, onClose, onSaved }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [form, setForm] = useState({});
  const [type, setType] = useState(shop?.commission_type || 'on_customer');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setForm({ name: shop.name || '', email: shop.email || '', phone: shop.phone || '', address: shop.address || '', description: shop.description || '', commission_percentage: shop.commission_percentage != null ? String(shop.commission_percentage) : '', category_ids: shop.category_ids || [] }); setType(shop.commission_type || 'on_customer'); } }, [open]); // eslint-disable-line
  if (!open) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    setBusy(true);
    try {
      await api.admin.updateShop(shop.id, { name: form.name, email: form.email, phone: form.phone, address: form.address, description: form.description, commission_type: type, category_ids: form.category_ids });
      if (form.commission_percentage !== '') await api.admin.updateShopCommission(shop.id, parseFloat(form.commission_percentage));
      onSaved();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb, maxHeight: '92%' }]}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>Edit Shop</Text>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <FieldRow label="Shop name"><TextInput style={styles.input} value={form.name} onChangeText={(v) => set('name', v)} /></FieldRow>
          <FieldRow label="Email"><TextInput style={styles.input} value={form.email} onChangeText={(v) => set('email', v)} autoCapitalize="none" keyboardType="email-address" /></FieldRow>
          <FieldRow label="Phone"><TextInput style={styles.input} value={form.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" /></FieldRow>
          <FieldRow label="Address"><TextInput style={styles.input} value={form.address} onChangeText={(v) => set('address', v)} /></FieldRow>
          <FieldRow label="Description"><TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} multiline value={form.description} onChangeText={(v) => set('description', v)} /></FieldRow>
          <FieldRow label={`Commission % (default ${platformSettings?.commission_percentage ?? 10}%)`}><TextInput style={styles.input} keyboardType="numeric" value={form.commission_percentage} onChangeText={(v) => set('commission_percentage', v)} /></FieldRow>
          <View style={[styles.editBox, { backgroundColor: colors.p50, borderColor: colors.p200 }]} testID="edit-commission-type-section">
            <Text style={styles.editBoxTitle}>Commission Type</Text>
            <View style={{ gap: 8, marginTop: 8 }}>
              {COMM_TYPES.map((o) => { const on = type === o.value; return <TouchableOpacity key={o.value} style={[styles.radioCard, on && styles.radioCardOn]} onPress={() => setType(o.value)}><Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? colors.violet : colors.textMuted} /><Text style={styles.radioLabel}>{o.label}</Text></TouchableOpacity>; })}
            </View>
          </View>
          <FieldRow label="Categories">
            <View style={styles.chips} testID="admin-shop-categories-section">
              <View style={styles.chips} testID="admin-shop-categories-chips">
                {(categories || []).slice(0, 24).map((c) => { const on = (form.category_ids || []).includes(c.id); return <TouchableOpacity key={c.id} style={[styles.chip, on && styles.chipOn]} onPress={() => set('category_ids', on ? form.category_ids.filter((x) => x !== c.id) : [...(form.category_ids || []), c.id])}><Text style={[styles.chipText, on && { color: colors.white }]}>{c.name}</Text></TouchableOpacity>; })}
              </View>
            </View>
          </FieldRow>
          <TouchableOpacity activeOpacity={0.9} onPress={save} disabled={busy} style={{ marginTop: 6 }}><LinearGradient colors={[colors.p450, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>{busy ? <Spinner size={18} color={colors.white} /> : <Text style={styles.submitText}>Save changes</Text>}</LinearGradient></TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function FieldRow({ label, children }) { return <View style={{ marginBottom: 12 }}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>; }
function MiniSelect({ value, options, onChange, testID }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const label = (options.find(([v]) => v === value) || options[0])?.[1] || '';
  return (
    <>
      <TouchableOpacity style={styles.miniSelect} onPress={() => setOpen(true)} testID={testID}><Text style={styles.miniSelectText}>{label}</Text><Ionicons name="chevron-down" size={15} color={colors.textMuted} /></TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setOpen(false)} /></View>
        <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb, maxHeight: '60%' }]}>
          <View style={styles.grabber} />
          {options.map(([v, l]) => <TouchableOpacity key={v} style={styles.pickOpt} onPress={() => { onChange(v); setOpen(false); }}><Text style={[styles.pickOptText, v === value && { color: colors.violet, fontFamily: fonts.bold }]}>{l}</Text>{v === value && <Ionicons name="checkmark" size={17} color={colors.violet} />}</TouchableOpacity>)}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 12 },
  hBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  hLogo: { width: 46, height: 46, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.2)' },
  hLogoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hBadge: { position: 'absolute', bottom: -3, right: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  hName: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.white, letterSpacing: -0.3 },
  hId: { fontFamily: fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  tabBar: { flexDirection: 'row', paddingHorizontal: 16, position: 'relative' },
  tabIndicator: { position: 'absolute', bottom: 0, left: 16, height: 3, borderRadius: 2, backgroundColor: colors.white },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  tabText: { fontFamily: fonts.semibold, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  tabTextOn: { color: colors.white, fontFamily: fonts.bold },
  page: { padding: 16, gap: 12, paddingBottom: 40 },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 14, ...shadow.card },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  lineText: { fontFamily: fonts.body, fontSize: 13, color: colors.text, flex: 1 },
  kv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  kvLabel: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
  kvVal: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  kvEmerald: { fontFamily: fonts.extrabold, fontSize: 13.5, color: '#059669' },
  kvMono: { fontFamily: fonts.semibold, fontSize: 12, color: colors.violet },
  desc: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  catCard: { backgroundColor: colors.p50, borderWidth: 1, borderColor: colors.p200, borderRadius: radius.lg, padding: 14 },
  catTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.p800, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.p200, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  catChipText: { fontFamily: fonts.bold, fontSize: 11, color: colors.p800 },
  catEmpty: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },

  actWrap: { gap: 10, marginTop: 4 },
  actRow: { flexDirection: 'row', gap: 10 },
  actBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.md },
  actBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  actOutline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 46, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  actOutlineText: { fontFamily: fonts.bold, fontSize: 12, flexShrink: 1 },
  delHold: { height: 48, borderRadius: radius.md, backgroundColor: colors.saleSoft, overflow: 'hidden', justifyContent: 'center' },
  delFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#fecaca' },
  delInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  delText: { fontFamily: fonts.bold, fontSize: 13, color: colors.sale },

  addProdBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, marginBottom: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.violet, borderStyle: 'dashed', backgroundColor: colors.primarySoft },
  addProdText: { fontFamily: fonts.bold, fontSize: 13, color: colors.violet },
  prodRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, padding: 10, marginBottom: 8 },
  prodImg: { width: 60, height: 60, borderRadius: 10, backgroundColor: colors.surfaceMuted },
  prodName: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  prodPrice: { fontFamily: fonts.extrabold, fontSize: 13, color: '#059669', marginTop: 2 },
  prodStock: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  orderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, padding: 12 },
  orderId: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  orderDate: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  orderAmt: { fontFamily: fonts.extrabold, fontSize: 14, color: '#059669' },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },

  subCard: { borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.p200 },
  subHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  subTitle: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink },
  subSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  subEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.violet, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  subEditText: { fontFamily: fonts.bold, fontSize: 12, color: colors.violet },
  subGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  subCell: { width: '50%', paddingVertical: 8 },
  subCellLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted },
  subVal: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  approveInline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#10b981', borderRadius: radius.md, paddingVertical: 12, marginTop: 14 },
  approveInlineText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },

  flash: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,150,105,0.15)' },
  flashCheck: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', ...shadow.emphasis },

  /* dialogs shared */
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink, marginBottom: 12 },
  centerBackdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 30 },
  centerCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 22, width: '100%', alignItems: 'center', ...shadow.dropdown },
  centerIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  centerTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink, textAlign: 'center' },
  centerBody: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  centerActions: { flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' },
  centerCancel: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, alignItems: 'center', paddingVertical: 12 },
  centerCancelText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
  centerConfirm: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  centerConfirmText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },

  editBox: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: radius.md, padding: 14, marginBottom: 12 },
  editBoxTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  editBoxHint: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  radioCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 11, backgroundColor: colors.surface },
  radioCardOn: { borderColor: colors.violet, backgroundColor: colors.p50 },
  radioLabel: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink },
  radioDesc: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, marginTop: 1 },
  bonusNote: { flexDirection: 'row', gap: 8, backgroundColor: colors.p50, borderWidth: 1, borderColor: colors.p200, borderRadius: radius.md, padding: 12, marginBottom: 12 },
  bonusText: { flex: 1, fontFamily: fonts.body, fontSize: 11.5, color: colors.p800, lineHeight: 16 },
  approveActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  denyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#dc2626', borderRadius: radius.pill, paddingVertical: 13 },
  denyText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  confirmApprove: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: radius.pill, paddingVertical: 13 },
  confirmApproveText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  balBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 12, marginBottom: 12 },
  balLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  balVal: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink },
  submit: { height: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  miniSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11 },
  miniSelectText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  pickOpt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  pickOptText: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  chipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
});
