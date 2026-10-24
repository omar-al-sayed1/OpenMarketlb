import React, { useEffect } from 'react';
import { View, Text, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, cancelAnimation, Easing, interpolate } from 'react-native-reanimated';
import { colors, fonts } from './../theme/theme';

/**
 * Fully custom pull-to-refresh.
 *
 * The native RefreshControl is kept ONLY for its cross-platform pull gesture + trigger
 * (so list scrolling is never affected), but its spinner is made transparent. The visible
 * indicator is <RefreshIndicator>, a Reanimated orbit-of-dots + pulsing bag drawn in the
 * admin's live brand colors. Render the indicator as an overlay at the top of the screen.
 *
 * Usage:
 *   refreshControl={hiddenRefreshControl(refreshing, onRefresh)}
 *   ...and once, absolutely positioned near the top:
 *   <RefreshIndicator refreshing={refreshing} top={headerHeight} />
 */
export function hiddenRefreshControl(refreshing, onRefresh) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor="transparent"
      colors={['transparent']}
      progressBackgroundColor="transparent"
    />
  );
}

const DOTS = 8;

export function RefreshIndicator({ refreshing, top = 0 }) {
  const spin = useSharedValue(0);
  const show = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (refreshing) {
      show.value = withTiming(1, { duration: 220 });
      spin.value = withRepeat(withTiming(1, { duration: 850, easing: Easing.linear }), -1, false);
      pulse.value = withRepeat(withSequence(
        withTiming(1, { duration: 550, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 550, easing: Easing.inOut(Easing.quad) }),
      ), -1, false);
    } else {
      show.value = withTiming(0, { duration: 200 });
      cancelAnimation(spin); spin.value = 0;
      cancelAnimation(pulse); pulse.value = 0;
    }
  }, [refreshing]); // eslint-disable-line

  const wrap = useAnimatedStyle(() => ({
    opacity: show.value,
    transform: [{ translateY: interpolate(show.value, [0, 1], [-14, 0]) }, { scale: interpolate(show.value, [0, 1], [0.7, 1]) }],
  }));
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const bag = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(pulse.value, [0, 1], [0.86, 1.06]) }] }));

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, { top: top + 8 }, wrap]}>
      <View style={styles.badge}>
        <Animated.View style={[styles.ring, ring]}>
          {Array.from({ length: DOTS }).map((_, i) => {
            const angle = (i / DOTS) * 2 * Math.PI;
            const r = 15;
            return (
              <View
                key={i}
                style={[styles.dot, {
                  backgroundColor: i % 2 === 0 ? colors.primary : colors.secondary,
                  opacity: 0.25 + (i / DOTS) * 0.75,
                  transform: [{ translateX: r * Math.cos(angle) }, { translateY: r * Math.sin(angle) }],
                }]}
              />
            );
          })}
        </Animated.View>
        <Animated.View style={bag}><Ionicons name="bag-handle" size={15} color={colors.primary} /></Animated.View>
      </View>
      <Text style={styles.label}>Refreshing…</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  badge: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  ring: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5 },
  label: { marginTop: 7, fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
});
