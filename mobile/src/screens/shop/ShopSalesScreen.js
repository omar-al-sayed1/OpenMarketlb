import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, ScrollView, Image, Animated, Easing, KeyboardAvoidingView, Platform } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { notifySuccess } from '../../lib/haptics';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { ShopScreenWrap, Rise, Pulse, CountUp, PressScale, Spinner, toast } from '../../components/shop/ShopKit';
import { useReveal } from '../../lib/useReveal';
import { SkeletonRows } from '../../components/ui';

const FIRE = ['#f43f5e', '#ec4899', '#f97316']; // rose-500 -> pink-500 -> orange-500

/* live countdown chips (ticks every second) — ported from CountdownTimer */
function getTimeLeft(end) {
  const diff = new Date(end) - new Date();
  if (diff <= 0) return { expired: true };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    minutes: Math.floor((diff / 60000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}
function CountdownTimer({ endDate }) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(endDate));
  useEffect(() => {
    const t = setInterval(() => setTimeLeft(getTimeLeft(endDate)), 1000);
    return () => clearInterval(t);
  }, [endDate]);
  if (timeLeft.expired) return <Text style={{ color: '#fecdd3', fontFamily: fonts.bold, fontSize: 12 }}>Expired</Text>;
  const TimeBox = ({ value, label }) => (
    <View style={{ alignItems: 'center' }}>
      <View style={ct.box}><Text style={ct.value}>{String(value).padStart(2, '0')}</Text></View>
      <Text style={ct.label}>{label}</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}>
      {timeLeft.days > 0 && <TimeBox value={timeLeft.days} label="D" />}
      <TimeBox value={timeLeft.hours} label="H" />
      <TimeBox value={timeLeft.minutes} label="M" />
      <TimeBox value={timeLeft.seconds} label="S" />
    </View>
  );
}
const ct = StyleSheet.create({
  box: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, minWidth: 34, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', ...shadow.card },
  value: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.text, letterSpacing: 0.5 },
  label: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.bold, fontSize: 8, marginTop: 2, letterSpacing: 1 },
});

/* animated flame-gradient border wrapper for live sales */
function FlameBorder({ children }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, [a]);
  return (
    <View>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: radius.xl + 3, opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }]}>
        <LinearGradient colors={['#fb923c', '#f43f5e', '#fb923c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.xl + 3 }]} />
      </Animated.View>
      <View style={{ margin: 3 }}>{children}</View>
    </View>
  );
}

/* quick duration presets — the native stand-in for datetime-local */
const DURATIONS = [
  { l: '24 hours', h: 24 }, { l: '3 days', h: 72 }, { l: '7 days', h: 168 }, { l: '14 days', h: 336 }, { l: '30 days', h: 720 },
];

export default function ShopSalesScreen() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ discount_percent: 10, end_date: '', title: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [higherDiscountProducts, setHigherDiscountProducts] = useState([]);
  const [pendingFormData, setPendingFormData] = useState(null);

  const fetchSales = useCallback(async () => {
    try {
      const { data } = await api.shop.getSales();
      setSales(data || []);
    } catch { toast.error('Failed to load sales'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchSales(); }, [fetchSales]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchSales(); setRefreshing(false); }, [fetchSales]);

  const resetForm = () => {
    setShowForm(false); setEditing(null);
    setForm({ discount_percent: 10, end_date: '', title: '', description: '' });
  };

  const createSaleDirectly = async (data) => {
    try {
      await api.shop.createSale(data);
      notifySuccess();
      toast.success('🎉 Sale launched! Prices updated on all products.');
      resetForm();
      fetchSales();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create sale'); }
  };

  const handleSubmit = async () => {
    if (!form.end_date) { toast.error('End date is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        try {
          await api.shop.updateSale(editing, form);
          toast.success('Sale updated successfully');
          resetForm();
          fetchSales();
        } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update sale'); }
        return;
      }
      // preview first — warn if products already have higher discounts
      const previewData = { ...form, end_date: new Date(form.end_date).toISOString() };
      try {
        const { data } = await api.shop.previewSale(previewData);
        if (data.total > 0) {
          setHigherDiscountProducts(data.products_with_higher_discount);
          setPendingFormData(previewData);
          setShowConfirmPopup(true);
        } else {
          await createSaleDirectly(previewData);
        }
      } catch (err) { toast.error(err.response?.data?.detail || 'Failed to preview sale'); }
    } finally { setSaving(false); }
  };

  const handleConfirmSale = async () => {
    if (pendingFormData) await createSaleDirectly(pendingFormData);
    setShowConfirmPopup(false);
    setHigherDiscountProducts([]);
    setPendingFormData(null);
  };
  const handleCancelConfirm = () => {
    setShowConfirmPopup(false);
    setHigherDiscountProducts([]);
    setPendingFormData(null);
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Sale', 'Delete this sale? Original prices will be restored on all products.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.shop.deleteSale(id);
          toast.success('Sale deleted - prices restored');
          fetchSales();
        } catch { toast.error('Failed to delete sale'); }
      } },
    ]);
  };

  const handleEdit = (sale) => {
    setEditing(sale.id);
    setForm({
      discount_percent: sale.discount_percent,
      end_date: sale.end_date?.slice(0, 16) || '',
      title: sale.title || '',
      description: sale.description || '',
    });
    setShowForm(true);
  };

  const isExpired = (sale) => new Date(sale.end_date) < new Date();
  // Memoized so the reveal hook below sees a stable array reference (else it resets each render).
  const activeSales = useMemo(() => sales.filter(s => s.is_active && !isExpired(s)), [sales]);
  const expiredSales = useMemo(() => sales.filter(s => !s.is_active || isExpired(s)), [sales]);
  const totalDiscountOffered = activeSales.reduce((sum, s) => sum + (s.discount_percent || 0), 0);
  const avgDiscount = activeSales.length > 0 ? Math.round(totalDiscountOffered / activeSales.length) : 0;
  const { visible: visibleExpired, hasMore: moreExpired, revealing: revealingExpired, revealMore: revealExpired } = useReveal(expiredSales, 8);

  const setDurationHours = (h) => {
    const end = new Date(Date.now() + h * 3600000);
    setForm(prev => ({ ...prev, end_date: end.toISOString().slice(0, 16) }));
  };
  const endDateLabel = form.end_date ? new Date(form.end_date).toLocaleString() : 'Pick a duration below';

  if (loading) {
    return <View style={st.center}><Spinner size={34} color="#f43f5e" /></View>;
  }

  return (
    <>
    <ShopScreenWrap testID="shop-sales-page" onEndReached={() => moreExpired && revealExpired()}>
      {/* Fire hero */}
      <Rise duration={500} distance={0}>
        <LinearGradient colors={FIRE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.hero}>
          <View style={[st.blob, { top: -48, right: -48, backgroundColor: 'rgba(255,255,255,0.2)' }]} />
          <View style={[st.blob, { bottom: -48, left: -48, width: 220, height: 220, backgroundColor: 'rgba(253,224,71,0.2)' }]} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 6 }}>
            <View style={st.heroIcon}><Ionicons name="flame" size={22} color={colors.white} /></View>
            <Text style={st.heroTitle}>Sales Center</Text>
          </View>
          <Text style={st.heroSub}>Launch store-wide discounts to boost sales and attract more customers</Text>
          <PressScale onPress={() => { if (showForm) { resetForm(); } else { setShowForm(true); setEditing(null); setForm({ discount_percent: 10, end_date: '', title: '', description: '' }); } }} style={{ marginTop: 14, alignSelf: 'flex-start' }}>
            <View style={st.heroBtn} testID="create-sale-btn">
              <Ionicons name={showForm ? 'close' : 'sparkles'} size={15} color="#e11d48" />
              <Text style={st.heroBtnText}>{showForm ? 'Cancel' : 'New Sale'}</Text>
            </View>
          </PressScale>
        </LinearGradient>
      </Rise>

      {/* Stats */}
      <View style={st.statsGrid}>
        {[
          { label: 'Active', value: activeSales.length, icon: 'flash', tint: '#10b981' },
          { label: 'Average', value: avgDiscount, suffix: '%', icon: 'pricetag', tint: colors.p450 },
          { label: 'Total Sales', value: sales.length, icon: 'trending-up', tint: '#3b82f6' },
          { label: 'Expired', value: expiredSales.length, icon: 'time', tint: '#94a3b8' },
        ].map((s, i) => (
          <Rise key={s.label} delay={80 + i * 60} style={st.statWrap}>
            <View style={st.stat}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={st.statLabel}>{s.label}</Text>
                <Ionicons name={s.icon} size={15} color={s.tint} />
              </View>
              <CountUp value={s.value} suffix={s.suffix || ''} style={st.statValue} />
            </View>
          </Rise>
        ))}
      </View>

      {/* Sale form */}
      {showForm && (
        <Rise>
          <View style={st.formCard} testID="sale-form">
            <LinearGradient colors={['#fff1f2', '#fdf2f8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.formHead}>
              <Ionicons name={editing ? 'create' : 'sparkles'} size={15} color="#e11d48" />
              <Text style={st.formTitle}>{editing ? 'Edit Sale' : 'Create New Sale'}</Text>
            </LinearGradient>
            <View style={{ padding: 15, gap: 12 }}>
              <View>
                <View style={st.labelRow}><Ionicons name="pricetag" size={12} color="#f43f5e" /><Text style={st.label}>Sale Title</Text></View>
                <TextInput value={form.title} onChangeText={(t) => setForm(prev => ({ ...prev, title: t }))} placeholder="e.g. Summer Mega Sale"
                  placeholderTextColor={colors.textMuted} style={st.input} testID="sale-title-input" />
              </View>
              <View>
                <View style={st.labelRow}><Ionicons name="pricetag" size={12} color="#f43f5e" /><Text style={st.label}>Discount %</Text></View>
                <View style={{ justifyContent: 'center' }}>
                  <TextInput value={String(form.discount_percent || '')} keyboardType="number-pad"
                    onChangeText={(t) => setForm(prev => ({ ...prev, discount_percent: parseFloat(t) || 0 }))}
                    placeholder="10" placeholderTextColor={colors.textMuted} style={[st.input, { paddingRight: 34 }]} testID="sale-discount-input" />
                  <Text style={st.pctMark}>%</Text>
                </View>
              </View>
              <View>
                <View style={st.labelRow}><Ionicons name="calendar" size={12} color="#f43f5e" /><Text style={st.label}>End Date & Time</Text></View>
                <View style={[st.input, { justifyContent: 'center' }]} testID="sale-end-date-input">
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: form.end_date ? colors.text : colors.textMuted }}>{endDateLabel}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 7 }}>
                  {DURATIONS.map(d => (
                    <TouchableOpacity key={d.l} onPress={() => setDurationHours(d.h)} style={st.durChip}>
                      <Text style={st.durChipText}>{d.l}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View>
                <View style={st.labelRow}><Ionicons name="alert-circle" size={12} color="#f43f5e" /><Text style={st.label}>Description (optional)</Text></View>
                <TextInput value={form.description} onChangeText={(t) => setForm(prev => ({ ...prev, description: t }))} placeholder="Brief description"
                  placeholderTextColor={colors.textMuted} style={st.input} />
              </View>

              {/* live preview */}
              {form.discount_percent > 0 && (
                <LinearGradient colors={['#fff1f2', '#fdf2f8', '#fff7ed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.previewBox}>
                  <Text style={st.previewKicker}>PREVIEW</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 7 }}>
                    <LinearGradient colors={['#f43f5e', '#f97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.previewPct}>
                      <Text style={st.previewPctText}>-{form.discount_percent}%</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={st.previewTitle}>{form.title || 'Untitled Sale'}</Text>
                      {form.description ? <Text style={st.previewDesc}>{form.description}</Text> : null}
                    </View>
                  </View>
                </LinearGradient>
              )}

              <View style={{ borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 12, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="alert-circle" size={12} color="#d97706" />
                  <Text style={st.warnNote}>All product prices will be updated immediately</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <PressScale style={{ flex: 1 }} onPress={resetForm}>
                    <View style={st.outlineBtn}><Text style={st.outlineText}>Cancel</Text></View>
                  </PressScale>
                  <PressScale style={{ flex: 1.4 }} onPress={handleSubmit} disabled={saving}>
                    <LinearGradient colors={['#f43f5e', '#db2777']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.saveBtn} testID="save-sale-btn">
                      {saving ? <Spinner size={14} /> : <Ionicons name={editing ? 'create' : 'sparkles'} size={14} color={colors.white} />}
                      <Text style={st.saveText}>{editing ? 'Update Sale' : 'Launch Sale'}</Text>
                    </LinearGradient>
                  </PressScale>
                </View>
              </View>
            </View>
          </View>
        </Rise>
      )}

      {/* Live sales */}
      {activeSales.length > 0 && (
        <View style={{ marginTop: 16, gap: 10 }} testID="sales-list">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Pulse><View style={st.liveDot} /></Pulse>
            <Text style={st.sectionTitle}>LIVE SALES</Text>
          </View>
          {activeSales.map((sale, i) => (
            <Rise key={sale.id} delay={i * 90}>
              <FlameBorder>
                <LinearGradient colors={FIRE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.saleCard} testID={`sale-card-${sale.id}`}>
                  <View style={[st.blob, { top: -32, right: -32, width: 128, height: 128, backgroundColor: 'rgba(255,255,255,0.12)' }]} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                    {/* discount circle */}
                    <View style={st.discCircle}>
                      <View style={st.discDashed} />
                      <Text style={st.discPct}>{sale.discount_percent}%</Text>
                      <Text style={st.discOff}>OFF</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <View style={st.activeBadge}>
                          <Pulse><View style={st.activeBadgeDot} /></Pulse>
                          <Text style={st.activeBadgeText}>ACTIVE</Text>
                        </View>
                        <Ionicons name="sparkles" size={12} color="#fce883" />
                      </View>
                      <Text style={st.saleTitle} numberOfLines={1}>{sale.title}</Text>
                      {sale.description ? <Text style={st.saleDesc} numberOfLines={2}>{sale.description}</Text> : null}
                    </View>
                  </View>
                  {/* countdown */}
                  <View style={{ marginTop: 13 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                      <Ionicons name="timer" size={12} color="rgba(255,255,255,0.9)" />
                      <Text style={st.endsIn}>ENDS IN</Text>
                    </View>
                    <CountdownTimer endDate={sale.end_date} />
                  </View>
                  {/* actions */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 13 }}>
                    <PressScale style={{ flex: 1 }} onPress={() => handleEdit(sale)}>
                      <View style={st.glassBtn} testID={`edit-sale-${sale.id}`}>
                        <Ionicons name="create" size={13} color={colors.white} />
                        <Text style={st.glassText}>Edit</Text>
                      </View>
                    </PressScale>
                    <PressScale style={{ flex: 1 }} onPress={() => handleDelete(sale.id)}>
                      <View style={[st.glassBtn, { backgroundColor: 'rgba(239,68,68,0.3)' }]} testID={`delete-sale-${sale.id}`}>
                        <Ionicons name="trash" size={13} color={colors.white} />
                        <Text style={st.glassText}>Delete</Text>
                      </View>
                    </PressScale>
                  </View>
                </LinearGradient>
              </FlameBorder>
            </Rise>
          ))}
        </View>
      )}

      {/* Past sales */}
      {expiredSales.length > 0 && (
        <View style={{ marginTop: 16, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <View style={[st.liveDot, { backgroundColor: colors.textMuted }]} />
            <Text style={[st.sectionTitle, { color: colors.textMuted }]}>PAST SALES</Text>
          </View>
          {visibleExpired.map(sale => (
            <View key={sale.id} style={st.pastCard} testID={`sale-card-${sale.id}`}>
              <View style={st.pastPct}><Text style={st.pastPctText}>{sale.discount_percent}%</Text></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={st.pastTitle} numberOfLines={1}>{sale.title}</Text>
                  <View style={[st.pastBadge, { backgroundColor: isExpired(sale) ? '#fee2e2' : '#f1f5f9' }]}>
                    <Text style={[st.pastBadgeText, { color: isExpired(sale) ? '#dc2626' : '#64748b' }]}>{isExpired(sale) ? 'EXPIRED' : 'INACTIVE'}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                  <Ionicons name="calendar-outline" size={10} color={colors.textMuted} />
                  <Text style={st.pastDate}>{new Date(sale.end_date).toLocaleDateString()}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => handleDelete(sale.id)} style={st.pastDelete} testID={`delete-sale-${sale.id}`}>
                <Ionicons name="trash" size={13} color="#dc2626" />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: '#dc2626' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
          {revealingExpired && <SkeletonRows count={2} height={72} style={{ paddingHorizontal: 0 }} />}
        </View>
      )}

      {/* Empty state */}
      {sales.length === 0 && (
        <Rise delay={150}>
          <View style={st.empty}>
            <LinearGradient colors={['#f43f5e', '#f97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.emptyIcon}>
              <Ionicons name="pricetag" size={34} color={colors.white} />
            </LinearGradient>
            <Text style={st.emptyTitle}>No Sales Yet</Text>
            <Text style={st.emptyDesc}>Boost your sales by launching a discount campaign across your entire store. Your products will display attention-grabbing badges.</Text>
            <PressScale onPress={() => setShowForm(true)} style={{ marginTop: 14 }}>
              <LinearGradient colors={['#f43f5e', '#db2777']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.saveBtn}>
                <Ionicons name="sparkles" size={14} color={colors.white} />
                <Text style={st.saveText}>Launch Your First Sale</Text>
              </LinearGradient>
            </PressScale>
          </View>
        </Rise>
      )}
    </ShopScreenWrap>

    {/* Higher-discount confirmation popup */}
    <Modal visible={showConfirmPopup} transparent animationType="fade" onRequestClose={handleCancelConfirm}>
      <BlurView intensity={24} tint="dark" style={st.backdrop} testID="sale-confirm-popup-overlay">
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleCancelConfirm} />
        <View style={st.confirmSheet} testID="sale-confirm-popup">
          <View style={st.confirmHead}>
            <View style={st.confirmIcon}><Ionicons name="warning" size={19} color="#d97706" /></View>
            <View style={{ flex: 1 }}>
              <Text style={st.confirmTitle}>Products with Higher Discounts</Text>
              <Text style={st.confirmSub}>{higherDiscountProducts.length} product(s) currently have a higher discount</Text>
            </View>
            <TouchableOpacity onPress={handleCancelConfirm} style={{ padding: 5 }}><Ionicons name="close" size={17} color={colors.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ padding: 16 }}>
            <Text style={st.confirmBody}>
              These products will have their discount <Text style={{ fontFamily: fonts.bold }}>reduced</Text> to {pendingFormData?.discount_percent}%. Do you want to proceed?
            </Text>
            <View style={{ gap: 8, marginTop: 12 }}>
              {higherDiscountProducts.map(p => (
                <View key={p.id} style={st.confirmProd} testID={`confirm-product-${p.id}`}>
                  {p.image ? <Image source={{ uri: img(p.image) }} style={st.confirmImg} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={st.confirmProdName} numberOfLines={1}>{p.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: '#e11d48' }}>Current: {p.existing_discount_percent}% off</Text>
                      <Ionicons name="arrow-forward" size={10} color={colors.textMuted} />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: '#d97706' }}>New: {pendingFormData?.discount_percent}% off</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={st.confirmFoot}>
            <PressScale style={{ flex: 1 }} onPress={handleCancelConfirm}>
              <View style={st.outlineBtn} testID="cancel-sale-confirm"><Text style={st.outlineText}>Cancel</Text></View>
            </PressScale>
            <PressScale style={{ flex: 1.2 }} onPress={handleConfirmSale}>
              <View style={st.amberBtn} testID="confirm-sale-btn"><Text style={st.saveText}>Apply {pendingFormData?.discount_percent}% to All</Text></View>
            </PressScale>
          </View>
        </View>
      </BlurView>
    </Modal>
    </>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: shop.bg },
  hero: { borderRadius: radius.xl, padding: 20, overflow: 'hidden', ...shadow.emphasis },
  blob: { position: 'absolute', width: 190, height: 190, borderRadius: 120 },
  heroIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 25, letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, maxWidth: 300 },
  heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 11, ...shadow.emphasis },
  heroBtnText: { fontFamily: fonts.extrabold, fontSize: 13, color: '#e11d48' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  statWrap: { flexBasis: '47%', flexGrow: 1 },
  stat: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(226,232,240,0.6)', padding: 13, ...shadow.card },
  statLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  statValue: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text },
  formCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, marginTop: 14, overflow: 'hidden', ...shadow.emphasis },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 15, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#ffe4e6' },
  formTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13.5, color: colors.text, backgroundColor: colors.surface },
  pctMark: { position: 'absolute', right: 12, fontFamily: fonts.extrabold, fontSize: 13, color: '#f43f5e' },
  durChip: { borderWidth: 1, borderColor: '#fecdd3', backgroundColor: '#fff1f2', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6 },
  durChipText: { fontFamily: fonts.semibold, fontSize: 11, color: '#e11d48' },
  previewBox: { borderWidth: 1, borderColor: '#fecdd3', borderRadius: radius.md, padding: 13 },
  previewKicker: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.textMuted, letterSpacing: 1.2 },
  previewPct: { borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 9, shadowColor: '#f43f5e', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  previewPctText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 21 },
  previewTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  previewDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  warnNote: { fontFamily: fonts.body, fontSize: 11, color: '#d97706' },
  outlineBtn: { height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  saveBtn: { height: 44, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, shadowColor: '#f43f5e', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  saveText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  sectionTitle: { fontFamily: fonts.extrabold, fontSize: 11.5, color: colors.textSecondary, letterSpacing: 1.2 },
  saleCard: { borderRadius: radius.xl, padding: 16, overflow: 'hidden' },
  discCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.emphasis },
  discDashed: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: 38, borderWidth: 2, borderStyle: 'dashed', borderColor: '#fecdd3' },
  discPct: { fontFamily: fonts.extrabold, fontSize: 23, color: '#e11d48', letterSpacing: -0.5 },
  discOff: { fontFamily: fonts.extrabold, fontSize: 8.5, color: '#fb7185', letterSpacing: 1.2 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#34d399', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2.5 },
  activeBadgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#064e3b' },
  activeBadgeText: { fontFamily: fonts.extrabold, fontSize: 8.5, color: '#064e3b', letterSpacing: 0.8 },
  saleTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 19, letterSpacing: -0.3 },
  saleDesc: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.body, fontSize: 11.5, marginTop: 2 },
  endsIn: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.bold, fontSize: 9.5, letterSpacing: 1.2 },
  glassBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: radius.md, paddingVertical: 9 },
  glassText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
  pastCard: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, opacity: 0.8 },
  pastPct: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  pastPctText: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.textMuted },
  pastTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
  pastBadge: { borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  pastBadgeText: { fontFamily: fonts.extrabold, fontSize: 8 },
  pastDate: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted },
  pastDelete: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#fecaca', borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 7 },
  empty: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, paddingVertical: 40, paddingHorizontal: 24, marginTop: 16 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 14, ...shadow.emphasis },
  emptyTitle: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink },
  emptyDesc: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  confirmSheet: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', ...shadow.dropdown },
  confirmHead: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fffbeb', borderBottomWidth: 1, borderBottomColor: '#fde68a', padding: 15 },
  confirmIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' },
  confirmTitle: { fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink },
  confirmSub: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, marginTop: 1 },
  confirmBody: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },
  confirmProd: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.md, padding: 10 },
  confirmImg: { width: 44, height: 44, borderRadius: 10 },
  confirmProdName: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  confirmFoot: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceMuted, padding: 14 },
  amberBtn: { height: 44, borderRadius: radius.md, backgroundColor: '#d97706', alignItems: 'center', justifyContent: 'center' },
});
