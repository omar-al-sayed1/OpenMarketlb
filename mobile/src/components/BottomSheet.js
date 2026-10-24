import React, { useEffect, useState } from 'react';
import { Modal, View, Pressable, StyleSheet, useWindowDimensions, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate, Extrapolation, runOnJS, Easing } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, shadow } from '../theme/theme';

const AnimatedBlur = Animated.createAnimatedComponent(BlurView);

/**
 * The app-wide creative bottom sheet.
 * - Backdrop: dark blur + a soft violet glow that fades in (instead of flat black).
 * - Sheet: springs up from the bottom with a subtle scale + fade.
 * Usage: <BottomSheet visible={open} onClose={fn} maxHeight="86%">{content}</BottomSheet>
 */
export default function BottomSheet({ visible, onClose, children, maxHeight = '90%', style, grabber = true }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [sheetH, setSheetH] = useState(height * 0.5);
  const [kb, setKb] = useState(0);
  const prog = useSharedValue(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => setKb(e.endCoordinates?.height || 0));
    const h = Keyboard.addListener(hideEvt, () => setKb(0));
    return () => { s.remove(); h.remove(); };
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      prog.value = withSpring(1, { damping: 20, stiffness: 190, mass: 0.75 });
    } else if (mounted) {
      prog.value = withTiming(0, { duration: 230, easing: Easing.in(Easing.cubic) }, (fin) => { if (fin) runOnJS(setMounted)(false); });
    }
  }, [visible]); // eslint-disable-line

  const backdropStyle = useAnimatedStyle(() => ({ opacity: prog.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(prog.value, [0, 0.6, 1], [0, 1, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(prog.value, [0, 1], [sheetH + 40, 0], Extrapolation.CLAMP) },
      { scale: interpolate(prog.value, [0, 1], [0.94, 1], Extrapolation.CLAMP) },
    ],
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <AnimatedBlur intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(15,23,42,0.38)', 'rgba(88,28,135,0.22)', 'rgba(124,58,237,0.30)']} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        onLayout={(e) => setSheetH(e.nativeEvent.layout.height || sheetH)}
        style={[styles.sheet, { paddingBottom: kb > 0 ? 14 : (insets.bottom || 12) + 10, marginBottom: kb, maxHeight }, sheetStyle, style]}
      >
        <View style={styles.glow} pointerEvents="none">
          <LinearGradient colors={['rgba(139,92,246,0.16)', 'transparent']} style={StyleSheet.absoluteFill} />
        </View>
        {grabber ? <View style={styles.grabberWrap}><LinearGradient colors={[colors.p300, colors.p450]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.grabber} /></View> : null}
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 10,
    borderTopWidth: 1, borderColor: 'rgba(139,92,246,0.14)',
    ...shadow.dropdown,
  },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 90, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  grabberWrap: { alignItems: 'center', marginBottom: 14 },
  grabber: { width: 44, height: 5, borderRadius: 3 },
});
