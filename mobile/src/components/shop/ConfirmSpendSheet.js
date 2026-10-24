import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { colors, radius, fonts, shadow } from '../../theme/theme';
import { PressScale, Spinner, CountUp } from './ShopKit';

/**
 * Native port of components/ConfirmSpendDialog.js — wallet spend confirmation.
 * Bottom-sheet card over a blurred black/50 backdrop.
 */
export default function ConfirmSpendSheet({
  open, onClose, onConfirm,
  title = 'Confirm Payment',
  description = 'This action will deduct from your wallet balance.',
  icon = 'wallet',
  iconGradient = [colors.p450, colors.s600],
  walletBalance = 0, spendAmount = 0, itemName = '',
  confirmLabel = 'Confirm & Pay',
  confirmGradient = [colors.p500, colors.s500],
  loading = false,
}) {
  const balanceAfter = walletBalance - spendAmount;
  const canAfford = walletBalance >= spendAmount;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!loading) onClose(); }}>
      <BlurView intensity={26} tint="dark" style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => { if (!loading) onClose(); }} />
        <View style={styles.sheet}>
          {/* Header */}
          <LinearGradient colors={iconGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.head}>
            <View style={[styles.blob, { top: -40, left: '25%', width: 160, height: 160 }]} />
            <View style={[styles.blob, { bottom: -20, right: '15%', width: 120, height: 120 }]} />
            <TouchableOpacity onPress={onClose} disabled={loading} style={styles.close} activeOpacity={0.8}>
              <Ionicons name="close" size={16} color={colors.white} />
            </TouchableOpacity>
            <View style={styles.headIcon}><Ionicons name={icon} size={30} color={colors.white} /></View>
            <Text style={styles.headTitle}>{title}</Text>
            <Text style={styles.headSub}>{description}</Text>
          </LinearGradient>

          {/* Payment details */}
          <View style={{ paddingHorizontal: 20, marginTop: -18 }}>
            <View style={styles.details}>
              {itemName ? (
                <View style={[styles.row, styles.rowDivide]}>
                  <Text style={styles.rowLabelCaps}>Item</Text>
                  <Text style={styles.rowItem} numberOfLines={1}>{itemName}</Text>
                </View>
              ) : null}
              <View style={styles.row}>
                <View style={styles.rowLeft}><Ionicons name="wallet" size={15} color={colors.seller} /><Text style={styles.rowLabel}>Current Balance</Text></View>
                <Text style={[styles.rowVal, { color: '#059669' }]}>${walletBalance.toFixed(2)}</Text>
              </View>
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={styles.minus}><Text style={styles.minusTxt}>−</Text></View>
                  <Text style={styles.rowLabel}>Amount to Spend</Text>
                </View>
                <CountUp value={spendAmount} prefix="−$" decimals={2} style={[styles.rowVal, { color: colors.saleAlt }]} />
              </View>
              <View style={styles.afterRow}>
                <View style={styles.rowLeft}><Ionicons name="arrow-forward" size={15} color="#3b82f6" /><Text style={[styles.rowLabel, { fontFamily: fonts.bold }]}>Balance After</Text></View>
                <Text style={[styles.afterVal, { color: balanceAfter >= 0 ? '#2563eb' : '#dc2626' }]}>${balanceAfter.toFixed(2)}</Text>
              </View>
            </View>
            {!canAfford && (
              <View style={styles.warn}>
                <Ionicons name="warning" size={15} color={colors.saleAlt} />
                <Text style={styles.warnText}>Insufficient wallet balance. Please add funds first.</Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <PressScale onPress={onClose} disabled={loading} style={{ flex: 1 }}>
              <View style={styles.cancelBtn}><Text style={styles.cancelText}>Cancel</Text></View>
            </PressScale>
            <PressScale onPress={onConfirm} disabled={!canAfford || loading} style={{ flex: 1 }}>
              <LinearGradient colors={confirmGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.confirmBtn, (!canAfford || loading) && { opacity: 0.5 }]}>
                {loading ? (<><Spinner size={14} /><Text style={styles.confirmText}>Processing...</Text></>) : (
                  <Text style={styles.confirmText}>{confirmLabel}</Text>
                )}
              </LinearGradient>
            </PressScale>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', padding: 14 },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', ...shadow.dropdown, marginBottom: 14 },
  head: { paddingTop: 30, paddingBottom: 36, paddingHorizontal: 22, alignItems: 'center', overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.1)' },
  close: { position: 'absolute', top: 12, right: 12, zIndex: 5, padding: 7, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.2)' },
  headIcon: { width: 60, height: 60, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  headTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 19, letterSpacing: -0.3 },
  headSub: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.body, fontSize: 12.5, marginTop: 4, textAlign: 'center' },
  details: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.borderLight, gap: 11 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowDivide: { paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabelCaps: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  rowItem: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, maxWidth: 200 },
  rowLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  rowVal: { fontFamily: fonts.bold, fontSize: 13 },
  minus: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  minusTxt: { color: colors.saleAlt, fontSize: 11, fontFamily: fonts.bold, lineHeight: 13 },
  afterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: colors.border, paddingTop: 10 },
  afterVal: { fontFamily: fonts.extrabold, fontSize: 15 },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 },
  warnText: { flex: 1, fontFamily: fonts.medium, fontSize: 11.5, color: '#dc2626' },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 18 },
  cancelBtn: { height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  cancelText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  confirmBtn: { height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, ...shadow.violetGlow },
  confirmText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.white },
});
