import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { colors, radius, fonts, shadow } from '../../theme/theme';
import { PressScale } from './ShopKit';

const CONFETTI_COLORS = [colors.p500, '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#f97316'];

/* Port of components/ShopPurchaseConfirmation.js — success popup with confetti. */
const CONFIGS = {
  boost: { icon: 'rocket', title: 'Product Boosted!', subtitle: 'Your product is now being promoted to more customers', grad: ['#f59e0b', '#f97316'] },
  spin: { icon: 'sparkles', title: 'Spin Complete!', subtitle: 'Check your reward below', grad: [colors.p450, colors.p400] },
  theme: { icon: 'color-palette', title: 'Theme Applied!', subtitle: 'Your storefront has a fresh new look', grad: ['#10b981', '#14b8a6'] },
  gift: { icon: 'gift', title: 'Purchase Complete!', subtitle: 'Your purchase was successful', grad: ['#ec4899', '#f43f5e'] },
};

function Confetti() {
  const pieces = useRef(Array.from({ length: 40 }, (_, i) => ({
    a: new Animated.Value(0),
    left: Math.random() * 100,
    size: 6 + Math.random() * 6,
    round: Math.random() > 0.5,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    dur: 1500 + Math.random() * 2000,
    delay: Math.random() * 1500,
  }))).current;
  useEffect(() => {
    pieces.forEach(p => Animated.timing(p.a, { toValue: 1, duration: p.dur, delay: p.delay, easing: Easing.out(Easing.quad), useNativeDriver: true }).start());
  }, [pieces]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 50, overflow: 'hidden' }]}>
      {pieces.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', top: -10, left: `${p.left}%`, width: p.size, height: p.size,
          borderRadius: p.round ? p.size / 2 : 2, backgroundColor: p.color,
          opacity: p.a.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateY: p.a.interpolate({ inputRange: [0, 1], outputRange: [0, 500] }) },
            { rotate: p.a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] }) },
          ],
        }} />
      ))}
    </View>
  );
}

export default function PurchaseConfirmSheet({ open, onClose, type = 'boost', details = {} }) {
  const config = CONFIGS[type] || CONFIGS.gift;
  const bounce = useRef(new Animated.Value(0)).current;

  // gentle bounce on the icon
  useEffect(() => {
    if (open) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
  }, [open, bounce]);

  const Row = ({ label, value, bold, color }) => (
    <View style={st.row}>
      <Text style={st.rowKey}>{label}</Text>
      <Text style={[st.rowVal, bold && { fontFamily: fonts.extrabold }, color && { color }]} numberOfLines={1}>{value}</Text>
    </View>
  );

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={26} tint="dark" style={st.backdrop}>
        <View style={st.sheet} testID="shop-purchase-confirmation">
          {open && <Confetti />}
          <TouchableOpacity onPress={onClose} style={st.close}><Ionicons name="close" size={15} color={colors.textSecondary} /></TouchableOpacity>
          <LinearGradient colors={config.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.head}>
            <View style={[st.blob, { top: -50, left: '20%', width: 200, height: 200 }]} />
            <View style={[st.blob, { bottom: -30, right: '10%', width: 150, height: 150 }]} />
            <Animated.View style={[st.headIcon, { transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }]}>
              <Ionicons name={config.icon} size={38} color={colors.white} />
            </Animated.View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 }}>
              <Ionicons name="checkmark-circle" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={st.success}>Success</Text>
            </View>
            <Text style={st.title}>{config.title}</Text>
            <Text style={st.subtitle}>{config.subtitle}</Text>
          </LinearGradient>

          <View style={{ paddingHorizontal: 20, marginTop: -18 }}>
            <View style={st.details}>
              {details.productName ? <Row label="Product" value={details.productName} bold /> : null}
              {details.themeName ? <Row label="Theme" value={details.themeName} bold /> : null}
              {details.amount !== undefined ? <Row label="Amount" value={`$${parseFloat(details.amount).toFixed(2)}`} bold color="#059669" /> : null}
              {details.duration ? <Row label="Duration" value={details.duration} /> : null}
              {details.reward ? <Row label="Reward" value={details.reward} bold color={colors.p500} /> : null}
              {details.message ? <Text style={st.message}>{details.message}</Text> : null}
            </View>
          </View>

          <View style={{ padding: 20 }}>
            <PressScale onPress={onClose}>
              <LinearGradient colors={config.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.btn} testID="confirmation-close-btn">
                <Text style={st.btnText}>Continue</Text>
              </LinearGradient>
            </PressScale>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', ...shadow.dropdown },
  close: { position: 'absolute', top: 12, right: 12, zIndex: 60, padding: 7, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.85)', ...shadow.card },
  head: { paddingTop: 36, paddingBottom: 44, paddingHorizontal: 22, alignItems: 'center', overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.1)' },
  headIcon: { width: 76, height: 76, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 14, ...shadow.emphasis },
  success: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.medium, fontSize: 13 },
  title: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: -0.4 },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.body, fontSize: 12.5, marginTop: 4, textAlign: 'center' },
  details: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowKey: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted },
  rowVal: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, maxWidth: 200 },
  message: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary, textAlign: 'center', paddingTop: 2 },
  btn: { height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', ...shadow.emphasis },
  btnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 },
});
