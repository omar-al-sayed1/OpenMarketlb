import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { api } from '../../lib/api';
import { colors, radius, fonts, shadow } from '../../theme/theme';
import { PressScale, Spinner, SingleSlider, Pulse, toast } from './ShopKit';
import ConfirmSpendSheet from './ConfirmSpendSheet';

/**
 * Native port of components/BoostProductDialog.js — quick boost from the
 * products screen. Duration slider with a glowing live cost preview; paid
 * boosts pass through ConfirmSpendSheet.
 */
export default function BoostSheet({ open, onClose, product, onSuccess }) {
  const [durationDays, setDurationDays] = useState(7);
  const [dailyPrice, setDailyPrice] = useState(3);
  const [boostCredits, setBoostCredits] = useState({ total: 0, remaining: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [confirmSpendOpen, setConfirmSpendOpen] = useState(false);

  useEffect(() => { if (open) { setDurationDays(7); fetchSettings(); } }, [open]);

  const fetchSettings = async () => {
    try {
      const { data } = await api.admin.getPlatformSettings();
      setDailyPrice(data.promotion_daily_price || 3);
      try {
        const tierData = await api.shopTier.getInfo();
        setBoostCredits(tierData.data?.boost_credits || { total: 0, remaining: 0 });
        setWalletBalance(tierData.data?.wallet_balance || 0);
      } catch (e) {}
    } catch (err) {}
  };

  const totalCost = boostCredits.remaining > 0 ? 0 : dailyPrice * durationDays;
  const useFreeBoost = boostCredits.remaining > 0;

  const handleSubmit = () => {
    if (useFreeBoost) { executeBoost(); return; }
    setConfirmSpendOpen(true);
  };

  const executeBoost = async () => {
    setSubmitting(true);
    setConfirmSpendOpen(false);
    try {
      await api.shopPromotions.create({
        product_id: product.id,
        duration_days: durationDays,
        payment_method: 'deduct_payout',
      });
      toast.success(useFreeBoost ? 'Free boost activated!' : 'Product boosted successfully!');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to boost product');
    } finally { setSubmitting(false); }
  };

  return (
    <>
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={24} tint="dark" style={st.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={st.sheet} testID="boost-dialog">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Ionicons name="megaphone" size={18} color="#f59e0b" />
            <Text style={st.title}>Boost Product</Text>
          </View>

          <View style={st.prodBox}>
            <Text style={st.prodName}>{product?.name}</Text>
            <Text style={st.prodDesc}>Your product will appear in sponsored sections across the platform</Text>
          </View>

          {useFreeBoost && (
            <View style={st.freeBox}>
              <Ionicons name="gift" size={17} color="#16a34a" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={st.freeTitle}>Free Boost Available!</Text>
                <Text style={st.freeDesc}>You have {boostCredits.remaining} free boost{boostCredits.remaining > 1 ? 's' : ''} this month (Pro perk)</Text>
              </View>
            </View>
          )}

          <Text style={st.durLabel}>Duration: <Text style={{ fontFamily: fonts.extrabold }}>{durationDays} days</Text></Text>
          <SingleSlider min={1} max={30} step={1} value={durationDays} onChange={setDurationDays} tint="#f59e0b" testID="boost-duration-slider" />
          <View style={st.rangeLabels}><Text style={st.rangeText}>1 day</Text><Text style={st.rangeText}>30 days</Text></View>

          {!useFreeBoost && (
            <View style={st.walletNote}><Text style={st.walletNoteText}>Payment will be deducted from your wallet balance</Text></View>
          )}

          {/* glowing live cost preview */}
          <Pulse min={0.85} dur={1200}>
            <LinearGradient colors={[colors.p50, colors.s50]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.costBox}>
              <View style={st.costRow}><Text style={st.costKey}>Daily Rate</Text><Text style={st.costVal}>${dailyPrice.toFixed(2)}/day</Text></View>
              <View style={st.costRow}><Text style={st.costKey}>Duration</Text><Text style={st.costVal}>{durationDays} days</Text></View>
              <View style={st.costDivider} />
              <View style={st.costRow}>
                <Text style={st.totalKey}>Total</Text>
                <Text style={[st.totalVal, useFreeBoost && { color: '#16a34a' }]} testID="boost-cost-preview">
                  {useFreeBoost ? 'FREE' : `$${totalCost.toFixed(2)}`}
                </Text>
              </View>
            </LinearGradient>
          </Pulse>

          <PressScale onPress={handleSubmit} disabled={submitting} style={{ marginTop: 14 }}>
            <LinearGradient colors={['#f59e0b', '#f97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.submitBtn} testID="boost-submit-btn">
              {submitting ? <Spinner size={15} /> : <Ionicons name="megaphone" size={15} color={colors.white} />}
              <Text style={st.submitText}>{submitting ? 'Boosting...' : useFreeBoost ? 'Use Free Boost' : `Boost for $${totalCost.toFixed(2)}`}</Text>
            </LinearGradient>
          </PressScale>
        </View>
      </BlurView>
    </Modal>

    {/* Confirm Spend for paid boosts */}
    <ConfirmSpendSheet
      open={confirmSpendOpen}
      onClose={() => setConfirmSpendOpen(false)}
      onConfirm={executeBoost}
      title="Confirm Boost Payment"
      description="This will promote your product across the platform"
      icon="rocket"
      iconGradient={['#f59e0b', '#f97316']}
      walletBalance={walletBalance}
      spendAmount={totalCost}
      itemName={product?.name || ''}
      confirmLabel={`Boost for $${totalCost.toFixed(2)}`}
      confirmGradient={['#f59e0b', '#f97316']}
      loading={submitting}
    />
    </>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 18 },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 18, ...shadow.dropdown },
  title: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink },
  prodBox: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 13, marginBottom: 12 },
  prodName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  prodDesc: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 3 },
  freeBox: { flexDirection: 'row', gap: 10, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: radius.md, padding: 13, marginBottom: 12 },
  freeTitle: { fontFamily: fonts.bold, fontSize: 13, color: '#166534' },
  freeDesc: { fontFamily: fonts.body, fontSize: 11.5, color: '#16a34a', marginTop: 1 },
  durLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text, marginBottom: 4 },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  rangeText: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  walletNote: { backgroundColor: colors.p50, borderRadius: radius.md, padding: 10, alignItems: 'center', marginTop: 10 },
  walletNoteText: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.p800 },
  costBox: { borderRadius: radius.md, padding: 14, marginTop: 12, borderWidth: 1, borderColor: colors.p200 },
  costRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  costKey: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
  costVal: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  costDivider: { height: 1, backgroundColor: colors.p200, marginVertical: 10 },
  totalKey: { fontFamily: fonts.extrabold, fontSize: 15.5, color: colors.ink },
  totalVal: { fontFamily: fonts.extrabold, fontSize: 16.5, color: colors.p800 },
  submitBtn: { height: 48, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, ...shadow.amberGlow },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13.5 },
});
