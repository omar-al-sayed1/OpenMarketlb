import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { PressScale } from './ShopKit';

const STEP_ICONS = { products: 'cube', profile: 'settings', verification: 'shield-checkmark' };
const STEP_COLORS = {
  products: { grad: ['#3b82f6', colors.s500], soft: '#eff6ff', text: '#1d4ed8', ring: '#bfdbfe' },
  profile: { grad: ['#f59e0b', '#f97316'], soft: '#fffbeb', text: '#b45309', ring: '#fde68a' },
  verification: { grad: [colors.p450, colors.p400], soft: colors.p50, text: colors.p800, ring: colors.p200 },
};

/* web step.link -> mobile navigation */
const LINK_ROUTES = {
  '/shop/products': { screen: 'ShopProducts' },
  '/shop/settings': { screen: 'ShopSettings' },
  '/shop/verification': { screen: 'ShopVerification' },
};

/**
 * Port of components/ShopOnboarding.js — setup checklist wizard.
 * Dark slate-900 -> slate-800 header, spring progress fill,
 * gradient step tiles (blue/amber/violet), ring highlight on the next step.
 */
export default function ShopOnboarding({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => { fetchStatus(); }, []);

  const fetchStatus = async () => {
    try {
      const { data: result } = await api.shop.getOnboardingStatus();
      setData(result);
    } catch (e) {
      setData(null); // Silently fail (don't show wizard)
    } finally { setLoading(false); }
  };

  // progress fills with a spring
  useEffect(() => {
    if (data?.progress != null) {
      Animated.spring(progress, { toValue: data.progress, friction: 8, tension: 30, useNativeDriver: false }).start();
    }
  }, [data, progress]);

  // Hide ONLY when all steps are complete. Onboarding cannot be dismissed manually.
  if (loading || !data || data.all_complete) return null;

  const nextStep = data.steps.find(s => !s.completed);
  const goTo = (link) => {
    const r = LINK_ROUTES[link] || { screen: 'ShopHome' };
    navigation.navigate(r.screen, r.params);
  };

  return (
    <View style={styles.card} testID="shop-onboarding-wizard">
      {/* Header */}
      <LinearGradient colors={shop.onboardHead} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.head}>
        <View style={styles.headRow}>
          <LinearGradient colors={['#34d399', '#14b8a6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.rocket}>
            <Ionicons name="rocket" size={19} color={colors.white} />
          </LinearGradient>
          <View>
            <Text style={styles.headTitle}>Setup Your Shop</Text>
            <Text style={styles.headSub}>Complete these steps to start selling</Text>
          </View>
        </View>
        <View style={styles.progressRow}>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: progress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
          </View>
          <Text style={styles.count}>{data.completed}/{data.total}</Text>
        </View>
      </LinearGradient>

      {/* Steps */}
      <View style={styles.steps}>
        {data.steps.map((step) => {
          const c = STEP_COLORS[step.id] || STEP_COLORS.products;
          const isNext = nextStep?.id === step.id;
          return (
            <TouchableOpacity
              key={step.id} activeOpacity={0.8} onPress={() => goTo(step.link)}
              style={[
                styles.step,
                step.completed ? styles.stepDone : isNext ? { backgroundColor: c.soft, borderColor: c.ring, borderWidth: 2 } : styles.stepIdle,
              ]}
              testID={`onboarding-step-${step.id}`}
            >
              {step.completed ? (
                <View style={styles.doneTile}><Ionicons name="checkmark-circle" size={20} color="#059669" /></View>
              ) : (
                <LinearGradient colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tile}>
                  <Ionicons name={STEP_ICONS[step.id] || 'cube'} size={17} color={colors.white} />
                </LinearGradient>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.stepTitle, step.completed && styles.stepTitleDone]}>{step.title}</Text>
                  {step.count !== undefined && step.count > 0 && (
                    <View style={styles.countChip}><Text style={styles.countChipText}>{step.count}</Text></View>
                  )}
                </View>
                <Text style={styles.stepDesc}>{step.description}</Text>
                {step.status === 'pending' && (
                  <View style={styles.pendingRow}>
                    <Ionicons name="sparkles" size={11} color="#d97706" />
                    <Text style={styles.pendingText}>Under review</Text>
                  </View>
                )}
              </View>
              {!step.completed && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* CTA for next step */}
      {nextStep && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
          <PressScale onPress={() => goTo(nextStep.link)}>
            <LinearGradient colors={['#10b981', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta} testID="onboarding-next-step-btn">
              <Text style={styles.ctaText}>{nextStep.title}</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.white} />
            </LinearGradient>
          </PressScale>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden', ...shadow.card },
  head: { padding: 16 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 },
  rocket: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', shadowColor: '#10b981', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  headTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  headSub: { color: 'rgba(255,255,255,0.5)', fontFamily: fonts.body, fontSize: 11.5, marginTop: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: '#34d399' },
  count: { color: '#34d399', fontFamily: fonts.bold, fontSize: 12 },
  steps: { padding: 14, gap: 9 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11, borderRadius: radius.md },
  stepDone: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderLight, opacity: 0.7 },
  stepIdle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tile: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  doneTile: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  stepTitleDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  countChip: { backgroundColor: '#d1fae5', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  countChipText: { fontFamily: fonts.bold, fontSize: 9, color: '#047857' },
  stepDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  pendingText: { fontFamily: fonts.semibold, fontSize: 10, color: '#d97706' },
  cta: { height: 42, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, shadowColor: '#10b981', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  ctaText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13.5 },
});
