import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { G, Path, Text as SvgText, Defs, LinearGradient as SvgGradient, RadialGradient, Stop, Circle, Line } from 'react-native-svg';
import { api } from '../../lib/api';
import { tapLight, tapMedium, notifySuccess, notifyError } from '../../lib/haptics';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { PressScale, Spinner, toast } from './ShopKit';
import ConfirmSpendSheet from './ConfirmSpendSheet';

const SEGMENT_COLORS = [
  [colors.p450, colors.p500], ['#EC4899', '#DB2777'], ['#10B981', '#059669'], ['#F59E0B', '#D97706'],
  ['#3B82F6', '#2563EB'], ['#EF4444', '#DC2626'], ['#06B6D4', '#0891B2'], ['#F97316', '#EA580C'],
];

const RESULT_META = {
  free_sponsors_4: { icon: 'megaphone', tint: '#f59e0b', grad: ['#fbbf24', '#f97316'] },
  free_sponsor_10_days: { icon: 'megaphone', tint: '#3b82f6', grad: ['#60a5fa', colors.s600] },
  free_subscription: { icon: 'ribbon', tint: '#f59e0b', grad: ['#fbbf24', '#f97316'] },
  subscription_extension: { icon: 'ribbon', tint: '#3b82f6', grad: ['#60a5fa', colors.s600] },
  wallet_credit_small: { icon: 'wallet', tint: '#10b981', grad: ['#34d399', '#14b8a6'] },
  wallet_credit_large: { icon: 'wallet', tint: '#10b981', grad: ['#34d399', '#14b8a6'] },
  free_theme: { icon: 'color-palette', tint: '#ffc0cb', grad: ['#e879f9', colors.p400] },
  another_spin: { icon: 'flash', tint: colors.p450, grad: [colors.p400, colors.p400] },
  try_again: { icon: 'refresh', tint: '#94a3b8', grad: ['#94a3b8', '#64748b'] },
  default: { icon: 'gift', tint: '#ec4899', grad: ['#f472b6', '#fb7185'] },
};

const getResultMessage = (data) => {
  if (!data) return '';
  const effects = data.applied_effects;
  switch (data.outcome.key) {
    case 'free_sponsors_4': return `${effects?.count || 4} free product sponsor credits added! Use them to boost your products for free.`;
    case 'free_sponsor_10_days': return `${effects?.count || 1} free 10-day sponsor credit added! Boost any product for 10 days at no cost.`;
    case 'free_subscription': return `${effects?.days_added || 30} days added to your subscription!`;
    case 'subscription_extension': return `${effects?.days_added || 15} days added to your subscription!`;
    case 'wallet_credit_small': case 'wallet_credit_large': return `$${effects?.amount || 0} added to your wallet!`;
    case 'free_theme':
      if (effects?.theme_name) return `You won the "${effects.theme_name}" storefront theme! It's been unlocked and applied to your shop.`;
      return 'You won a free storefront theme! You already own every theme, so we added a free theme credit for you.';
    case 'another_spin': return 'You won a free spin! Spin again!';
    case 'try_again': return 'Better luck next time!';
    default: return data.outcome.label;
  }
};

/* Confetti burst — 20 falling colored dots */
function Confetti() {
  const pieces = useRef(Array.from({ length: 20 }, (_, i) => ({
    a: new Animated.Value(0),
    left: Math.random() * 100,
    color: [colors.p450, '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444'][i % 6],
    dur: 1500 + Math.random() * 2000,
    delay: Math.random() * 500,
  }))).current;
  useEffect(() => {
    pieces.forEach(p => Animated.timing(p.a, { toValue: 1, duration: p.dur, delay: p.delay, easing: Easing.in(Easing.quad), useNativeDriver: true }).start());
  }, [pieces]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', top: -8, left: `${p.left}%`, width: 8, height: 8, borderRadius: 4, backgroundColor: p.color,
          opacity: p.a.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateY: p.a.interpolate({ inputRange: [0, 1], outputRange: [0, 400] }) },
            { rotate: p.a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] }) },
          ],
        }} />
      ))}
    </View>
  );
}

export default function SpinWheelModal({ open, onOpenChange, spinInfo, onSpinComplete, navigation }) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [useFreeSpin, setUseFreeSpin] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confirmSpendOpen, setConfirmSpendOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const rotation = useRef(new Animated.Value(0)).current;
  const currentRotation = useRef(0);
  const glow = useRef(new Animated.Value(0)).current;
  const hapticTimers = useRef([]);

  const outcomes = (spinInfo?.outcomes || []).filter(o => o.is_active !== false);
  const freeSpins = spinInfo?.free_spins || 0;
  const spinCost = spinInfo?.spin_cost || 7;
  const segmentCount = outcomes.length || 6;
  const segmentAngle = 360 / segmentCount;

  useEffect(() => { setUseFreeSpin(freeSpins > 0); }, [freeSpins]);

  useEffect(() => {
    if (open) {
      setShowResult(false); setResult(null); setShowConfetti(false); setConfirmSpendOpen(false);
      rotation.setValue(0); currentRotation.current = 0;
      // Fetch wallet balance when opening
      api.shopTier.getInfo().then(({ data }) => setWalletBalance(data?.wallet_balance || 0)).catch(() => {});
    }
    return () => { hapticTimers.current.forEach(clearTimeout); hapticTimers.current = []; };
  }, [open]); // eslint-disable-line

  /* haptic crescendo: ticks that stretch out as the wheel decelerates, big hit at the end */
  const runHaptics = () => {
    hapticTimers.current.forEach(clearTimeout); hapticTimers.current = [];
    let t = 0, gap = 60;
    while (t < 4200) { const at = t; hapticTimers.current.push(setTimeout(tapLight, at)); gap *= 1.18; t += gap; }
    hapticTimers.current.push(setTimeout(tapMedium, 4400));
  };

  const handleSpin = () => {
    if (spinning) return;
    const usingFree = useFreeSpin && freeSpins > 0;
    if (!usingFree) { setConfirmSpendOpen(true); return; }
    executeSpin(true);
  };

  const executeSpin = async (usingFree) => {
    setSpinning(true); setShowResult(false); setResult(null); setShowConfetti(false); setConfirmSpendOpen(false);
    try {
      const { data } = await api.shopSpin.play({ use_free_spin: usingFree });
      const outcomeIdx = Math.max(0, outcomes.findIndex(o => o.key === data.outcome.key));
      const fullRotations = (5 + Math.floor(Math.random() * 3)) * 360;
      const targetAngle = outcomeIdx * segmentAngle + segmentAngle / 2;
      const finalRotation = currentRotation.current + fullRotations + (360 - targetAngle);
      currentRotation.current = finalRotation;

      runHaptics();
      Animated.loop(Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])).start();
      // real deceleration physics — same cubic-bezier as the web (0.17, 0.67, 0.12, 0.99), 4.5s
      Animated.timing(rotation, {
        toValue: finalRotation, duration: 4500,
        easing: Easing.bezier(0.17, 0.67, 0.12, 0.99), useNativeDriver: true,
      }).start();

      setTimeout(() => {
        glow.stopAnimation(); glow.setValue(0);
        setResult(data); setShowResult(true); setSpinning(false);
        if (data.outcome.key !== 'try_again') { setShowConfetti(true); notifySuccess(); } else { notifyError(); }
        if (onSpinComplete) onSpinComplete(data);
        // Reset wheel to default after showing result
        setTimeout(() => { rotation.setValue(0); currentRotation.current = 0; }, 2000);
      }, 5000);
    } catch (error) {
      setSpinning(false);
      hapticTimers.current.forEach(clearTimeout); hapticTimers.current = [];
      toast.error(error.response?.data?.detail || 'Failed to spin');
    }
  };

  /* ---- SVG wheel (ported from web renderWheel) ---- */
  const renderWheel = () => {
    if (outcomes.length === 0) return null;
    const size = Math.min(Dimensions.get('window').width - 90, 320);
    const center = size / 2;
    const wheelRadius = center - 8;
    const segments = [];

    outcomes.forEach((outcome, i) => {
      const startAngleDeg = i * segmentAngle - 90;
      const endAngleDeg = startAngleDeg + segmentAngle;
      const startRad = (startAngleDeg * Math.PI) / 180;
      const endRad = (endAngleDeg * Math.PI) / 180;
      const x1 = center + wheelRadius * Math.cos(startRad);
      const y1 = center + wheelRadius * Math.sin(startRad);
      const x2 = center + wheelRadius * Math.cos(endRad);
      const y2 = center + wheelRadius * Math.sin(endRad);
      const largeArc = segmentAngle > 180 ? 1 : 0;
      const d = `M${center},${center} L${x1},${y1} A${wheelRadius},${wheelRadius} 0 ${largeArc},1 ${x2},${y2} Z`;
      const midAngleRad = ((startAngleDeg + endAngleDeg) / 2 * Math.PI) / 180;
      const textRadius = wheelRadius * 0.62;
      const textX = center + textRadius * Math.cos(midAngleRad);
      const textY = center + textRadius * Math.sin(midAngleRad);
      const textRotation = (startAngleDeg + endAngleDeg) / 2;

      // Split label into lines if long
      const label = outcome.label || '';
      const words = label.split(' ');
      let lines;
      if (words.length <= 2 || label.length <= 12) lines = [label];
      else { const mid = Math.ceil(words.length / 2); lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]; }

      segments.push(
        <G key={i}>
          <Path d={d} fill={`url(#seg-grad-${i})`} stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
          {lines.map((line, li) => (
            <SvgText
              key={li} x={textX} y={textY + (li - (lines.length - 1) / 2) * 11}
              fill="white" fontSize={lines.length > 1 ? 9 : 10} fontWeight="700"
              textAnchor="middle" alignmentBaseline="middle"
              transform={`rotate(${textRotation}, ${textX}, ${textY + (li - (lines.length - 1) / 2) * 11})`}
            >
              {line.length > 14 ? line.substring(0, 14) + '..' : line}
            </SvgText>
          ))}
        </G>
      );
    });

    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <SvgGradient id="outerRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#C084FC" /><Stop offset="50%" stopColor="#818CF8" /><Stop offset="100%" stopColor="#C084FC" />
          </SvgGradient>
          <RadialGradient id="centerGrad">
            <Stop offset="0%" stopColor="#312e81" /><Stop offset="100%" stopColor={colors.s950} />
          </RadialGradient>
          {outcomes.map((_, i) => {
            const [c1, c2] = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
            return (
              <SvgGradient key={i} id={`seg-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={c1} /><Stop offset="100%" stopColor={c2} />
              </SvgGradient>
            );
          })}
        </Defs>
        <Circle cx={center} cy={center} r={wheelRadius + 4} fill="none" stroke="url(#outerRing)" strokeWidth="6" />
        {Array.from({ length: segmentCount * 2 }, (_, i) => {
          const angle = (i * 360 / (segmentCount * 2) - 90) * Math.PI / 180;
          return (
            <Line key={`tick-${i}`}
              x1={center + (wheelRadius + 1) * Math.cos(angle)} y1={center + (wheelRadius + 1) * Math.sin(angle)}
              x2={center + (wheelRadius + 6) * Math.cos(angle)} y2={center + (wheelRadius + 6) * Math.sin(angle)}
              stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
          );
        })}
        {segments}
        <Circle cx={center} cy={center} r="32" fill="url(#centerGrad)" stroke="white" strokeWidth="3" />
        <SvgText x={center} y={center - 4} fill="white" fontSize="8" fontWeight="600" textAnchor="middle" alignmentBaseline="middle" letterSpacing="1">LUCKY</SvgText>
        <SvgText x={center} y={center + 8} fill="#C084FC" fontSize="10" fontWeight="800" textAnchor="middle" alignmentBaseline="middle">SPIN</SvgText>
      </Svg>
    );
  };

  const meta = result ? (RESULT_META[result.outcome.key] || RESULT_META.default) : RESULT_META.default;

  return (
    <>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => onOpenChange(false)}>
      <BlurView intensity={26} tint="dark" style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => { if (!spinning) onOpenChange(false); }} />
        <View style={styles.sheet}>
          {!showResult ? (
            <>
              {/* Header with animated gradient */}
              <LinearGradient colors={shop.spinFab} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.head}>
                <View style={[styles.headBlob, { top: -30, left: -30 }]} />
                <View style={[styles.headBlob, { bottom: -24, right: -24, width: 70, height: 70 }]} />
                <View style={styles.headTitleRow}>
                  <Ionicons name="star" size={14} color="#fcd34d" />
                  <Text style={styles.headTitle}>Lucky Spin Wheel</Text>
                  <Ionicons name="star" size={14} color="#fcd34d" />
                </View>
                <Text style={styles.headSub}>
                  {freeSpins > 0 ? `${freeSpins} free spin${freeSpins > 1 ? 's' : ''} available!` : `$${spinCost} per spin from wallet`}
                </Text>
              </LinearGradient>

              {/* Wheel area */}
              <LinearGradient colors={['#eefdffcc', '#ffffff']} style={styles.wheelArea}>
                {/* Pointer */}
                <View style={styles.pointerWrap}>
                  <View style={styles.pointer} />
                  <View style={styles.pointerDot} />
                </View>
                <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }] }}>
                  {renderWheel()}
                </Animated.View>
                {/* Glow while spinning */}
                {spinning && (
                  <Animated.View pointerEvents="none" style={[styles.spinGlow, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.4] }) }]} />
                )}
              </LinearGradient>

              {/* Controls */}
              <View style={styles.controls}>
                {freeSpins > 0 && (
                  <TouchableOpacity activeOpacity={0.8} onPress={() => setUseFreeSpin(!useFreeSpin)} style={styles.freeRow} testID="use-free-spin-toggle">
                    <View style={[styles.checkbox, useFreeSpin && styles.checkboxOn]}>
                      {useFreeSpin && <Ionicons name="checkmark" size={12} color={colors.white} />}
                    </View>
                    <Text style={styles.freeText}>Use free spin ({freeSpins} left)</Text>
                  </TouchableOpacity>
                )}
                <PressScale onPress={handleSpin} disabled={spinning}>
                  <LinearGradient colors={[colors.p500, colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.spinBtn}>
                    {spinning ? (<><Spinner size={18} /><Text style={styles.spinBtnText}>Spinning...</Text></>) : (
                      <><Ionicons name="sparkles" size={18} color={colors.white} />
                      <Text style={styles.spinBtnText}>{useFreeSpin && freeSpins > 0 ? 'Spin Free!' : `Spin for $${spinCost}`}</Text></>
                    )}
                  </LinearGradient>
                </PressScale>
              </View>
            </>
          ) : result && (
            <View>
              {showConfetti && <Confetti />}
              <LinearGradient colors={meta.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.resultHead}>
                <View style={styles.resultIcon}><Ionicons name={meta.icon} size={40} color={colors.white} /></View>
                <Text style={styles.resultTitle}>{result.outcome.key === 'try_again' ? 'Try Again!' : 'Congratulations!'}</Text>
                <Text style={styles.resultLabel}>{result.outcome.label}</Text>
              </LinearGradient>
              <View style={styles.resultBody}>
                <Text style={styles.resultMsg}>{getResultMessage(result)}</Text>
                <View style={styles.resultStats}>
                  <View style={styles.resultRow}><Text style={styles.resultKey}>Spin Type</Text><Text style={styles.resultVal}>{(result.spin_type || '').replace('_', ' ')}</Text></View>
                  <View style={styles.resultRow}><Text style={styles.resultKey}>Free Spins Left</Text><Text style={styles.resultVal}>{result.free_spins_remaining}</Text></View>
                  <View style={styles.resultRow}><Text style={styles.resultKey}>Wallet Balance</Text><Text style={[styles.resultVal, { color: '#059669' }]}>${Number(result.wallet_balance || 0).toFixed(2)}</Text></View>
                </View>
                {result.outcome.key === 'free_theme' && result.applied_effects?.theme_key && (
                  <PressScale onPress={() => { onOpenChange(false); navigation?.navigate('ShopTheme'); }}>
                    <LinearGradient colors={['#f06a92', colors.p600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.themeBtn}>
                      <Ionicons name="color-palette" size={15} color={colors.white} />
                      <Text style={styles.spinBtnText}>View in Storefront Theme</Text>
                    </LinearGradient>
                  </PressScale>
                )}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(result.outcome.key === 'try_again' || result.outcome.key === 'another_spin') && (
                    <PressScale style={{ flex: 1 }} onPress={() => { setShowResult(false); setResult(null); setShowConfetti(false); }}>
                      <LinearGradient colors={[colors.p500, colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.againBtn}>
                        <Ionicons name="refresh" size={15} color={colors.white} />
                        <Text style={styles.spinBtnText}>Spin Again</Text>
                      </LinearGradient>
                    </PressScale>
                  )}
                  <PressScale style={{ flex: 1 }} onPress={() => onOpenChange(false)}>
                    <View style={styles.closeBtn}><Text style={styles.closeText}>Close</Text></View>
                  </PressScale>
                </View>
              </View>
            </View>
          )}
        </View>
      </BlurView>
    </Modal>

    {/* Confirm Spend Dialog for paid spins */}
    <ConfirmSpendSheet
      open={confirmSpendOpen}
      onClose={() => setConfirmSpendOpen(false)}
      onConfirm={() => executeSpin(false)}
      title="Confirm Spin Payment"
      description="This will be deducted from your wallet balance"
      icon="sparkles"
      iconGradient={[colors.p450, colors.p400]}
      walletBalance={walletBalance}
      spendAmount={spinCost}
      itemName="Lucky Spin Wheel"
      confirmLabel="Spin Now"
      confirmGradient={[colors.p500, colors.s500]}
      loading={spinning}
    />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 18 },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', ...shadow.dropdown },
  head: { padding: 16, alignItems: 'center', overflow: 'hidden' },
  headBlob: { position: 'absolute', width: 100, height: 100, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.12)' },
  headTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 17, letterSpacing: 0.4 },
  headSub: { color: colors.p200, fontFamily: fonts.body, fontSize: 11.5, marginTop: 3 },
  wheelArea: { alignItems: 'center', justifyContent: 'center', paddingVertical: 22, paddingHorizontal: 16 },
  pointerWrap: { position: 'absolute', top: 8, alignSelf: 'center', zIndex: 20, alignItems: 'center' },
  pointer: { width: 0, height: 0, borderLeftWidth: 12, borderRightWidth: 12, borderTopWidth: 24, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#EF4444' },
  pointerDot: { position: 'absolute', top: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white },
  spinGlow: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: colors.p400 },
  controls: { padding: 16, paddingTop: 6, gap: 11 },
  freeRow: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#ecfdf5', padding: 11, borderRadius: radius.md, borderWidth: 1, borderColor: '#a7f3d0' },
  checkbox: { width: 19, height: 19, borderRadius: 5, borderWidth: 1.5, borderColor: '#6ee7b7', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#059669', borderColor: '#059669' },
  freeText: { fontFamily: fonts.semibold, fontSize: 13.5, color: '#065f46' },
  spinBtn: { height: 50, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...shadow.violetGlow },
  spinBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  resultHead: { padding: 30, alignItems: 'center' },
  resultIcon: { width: 78, height: 78, borderRadius: 39, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  resultTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 22 },
  resultLabel: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.semibold, fontSize: 16, marginTop: 3 },
  resultBody: { padding: 18, gap: 14 },
  resultMsg: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  resultStats: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 14, gap: 9 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between' },
  resultKey: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  resultVal: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, textTransform: 'capitalize' },
  themeBtn: { height: 46, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  againBtn: { height: 46, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  closeBtn: { height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
});
