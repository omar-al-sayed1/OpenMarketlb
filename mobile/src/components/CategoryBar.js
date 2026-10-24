import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigationState } from '@react-navigation/native';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { colors, fonts, radius, shadow } from '../theme/theme';

export default function CategoryBar({ navigation, activeId: activeIdProp }) {
  const [cats, setCats] = useState([]);
  const { width: W } = useWindowDimensions();
  const scrollRef = useRef(null);
  const layouts = useRef({}); // pillKey -> { x, w }
  const setLayout = (key, x, w) => { layouts.current[key] = { x, w }; };
  // Derive the active pill from the LIVE focused tab. On Shop we use `activeTopCat`
  // (the top-level ancestor the filter selection maps to), which ShopScreen keeps in
  // sync: a single value highlights that pill; the '__multi__' sentinel (mixed parents)
  // is truthy but matches no pill → nothing highlighted (not even "All"); null → "All".
  const derivedActiveId = useNavigationState((state) => {
    const r = state?.routes?.[state.index];
    return r?.name === 'Shop' ? (r.params?.activeTopCat ?? null) : null;
  });
  const activeId = derivedActiveId !== undefined ? derivedActiveId : activeIdProp;

  useEffect(() => {
    // getTree returns the nested tree — its top-level array is exactly the level-1 categories (no subcategories)
    api.categories.getTree(true)
      .then(({ data }) => setCats(Array.isArray(data) ? data : data?.categories || []))
      .catch(() => setCats([]));
  }, []);

  const go = (cat) => navigation.navigate('Shop', cat ? { categoryId: cat.id, categoryName: cat.name } : { categoryId: null });

  // Creative reaction to a category change (e.g. from a swipe): scroll the bar to
  // center the newly-active pill (the pill itself pops — see Pill).
  useEffect(() => {
    const key = activeId == null ? 'all' : activeId;
    const l = layouts.current[key];
    if (l && scrollRef.current) scrollRef.current.scrollTo({ x: Math.max(0, l.x + l.w / 2 - W / 2), animated: true });
  }, [activeId, W, cats.length]);

  return (
    <View style={styles.wrap}>
      <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Pill index={0} pillKey="all" label="All" active={!activeId} onPress={() => go(null)} onMeasure={setLayout} />
        {cats.map((c, i) => (
          <Pill key={c.id} index={i + 1} pillKey={c.id} label={c.name} active={activeId === c.id} onPress={() => go(c)} onMeasure={setLayout} />
        ))}
      </ScrollView>
    </View>
  );
}

function Pill({ label, active, onPress, index, pillKey, onMeasure }) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // Simple: the active pill just changes colour; the bar auto-scrolls to it (no pop animation).
  const Inner = <Text style={[styles.pillText, active && styles.pillTextOn]} numberOfLines={1}>{label}</Text>;
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 12) * 35)} onLayout={(e) => onMeasure(pillKey, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}>
      <Pressable onPress={onPress} onPressIn={() => { scale.value = withSpring(0.92); }} onPressOut={() => { scale.value = withSpring(1); }}>
        <Animated.View style={aStyle}>
          {active
            ? <LinearGradient colors={[colors.p500, colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.pill, styles.pillActive]}>{Inner}</LinearGradient>
            : <View style={[styles.pill, styles.pillIdle]}>{Inner}</View>}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  row: { paddingHorizontal: 12, paddingVertical: 4, gap: 6, alignItems: 'center' },
  pill: { height: 24, borderRadius: radius.pill, paddingHorizontal: 10, justifyContent: 'center' },
  pillIdle: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderLight },
  pillActive: { ...shadow.violetGlow },
  pillInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pillText: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.textSecondary, maxWidth: 130 },
  pillTextOn: { fontFamily: fonts.bold, color: colors.white },
});
