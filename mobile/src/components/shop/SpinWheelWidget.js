import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { tapMedium } from '../../lib/haptics';
import { colors, fonts } from '../../theme/theme';
import { TAB_SPACE } from '../ui';
import SpinWheelModal from './SpinWheelModal';

/**
 * Floating Spin Wheel FAB (port of components/SpinWheelWidget.js).
 * violet-600 -> indigo-600 gradient, pulsing ring when free spins exist,
 * bobbing float loop, emerald free-spin count badge. Opens the wheel modal.
 */
export default function SpinWheelWidget({ navigation }) {
  const [isOpen, setIsOpen] = useState(false);
  const [spinInfo, setSpinInfo] = useState(null);
  const bob = useRef(new Animated.Value(0)).current;
  const ping = useRef(new Animated.Value(0)).current;

  const fetchData = async () => {
    try {
      const [spinRes] = await Promise.allSettled([api.shopSpin.getInfo(), api.shopTier.getInfo()]);
      if (spinRes.status === 'fulfilled') setSpinInfo(spinRes.value.data);
    } catch (e) {}
  };
  useEffect(() => { fetchData(); }, []);

  // bobbing float loop
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, [bob]);

  const freeSpins = spinInfo?.free_spins || 0;

  // pulse ring (only when free spins exist — mirrors the web animate-ping)
  useEffect(() => {
    if (freeSpins > 0) {
      const loop = Animated.loop(Animated.timing(ping, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }));
      loop.start();
      return () => loop.stop();
    }
  }, [freeSpins, ping]);

  return (
    <>
      <Animated.View pointerEvents="box-none" style={[styles.wrap, { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) }] }]}>
        {freeSpins > 0 && (
          <Animated.View pointerEvents="none" style={[styles.ping, {
            opacity: ping.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
            transform: [{ scale: ping.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
          }]} />
        )}
        <TouchableOpacity activeOpacity={0.85} onPress={() => { tapMedium(); setIsOpen(true); }} testID="spin-widget-fab">
          <LinearGradient colors={[colors.p500, colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
            <Ionicons name="sparkles" size={22} color={colors.white} />
          </LinearGradient>
          {freeSpins > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{freeSpins}</Text></View>
          )}
        </TouchableOpacity>
      </Animated.View>

      <SpinWheelModal
        open={isOpen}
        onOpenChange={setIsOpen}
        spinInfo={spinInfo}
        navigation={navigation}
        onSpinComplete={() => { api.shopSpin.getInfo().then(r => setSpinInfo(r.data)).catch(() => {}); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 16, bottom: TAB_SPACE + 8, zIndex: 40 },
  ping: { ...StyleSheet.absoluteFillObject, borderRadius: 28, backgroundColor: colors.p400 },
  fab: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.p450, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  badge: {
    position: 'absolute', top: -3, right: -3, width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#10b981', borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10 },
});
