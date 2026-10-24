import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, I18nManager } from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, useReducedMotion, FadeInDown, Easing } from 'react-native-reanimated';
import CategoryBar from './CategoryBar';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useFlyToCart } from '../context/FlyToCartContext';
import { api } from '../lib/api';
import { img } from '../lib/media';
import { tapLight } from '../lib/haptics';
import { useTheme } from '../theme/useTheme';

const RTL = I18nManager.isRTL;
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');

/**
 * The Command Deck — Bar 1 (glass command bar) + Bar 2 (category bar).
 * Fully token-driven via useTheme(); re-theming the admin palette re-skins it
 * with zero edits. `showCategories` hides Bar 2 on non-browse screens.
 */
export default function AppHeader({ navigation, showCategories = true, activeCategoryId }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { isLoggedIn, role } = useAuth();
  const { count } = useCart();
  const { registerCartAnchor } = useFlyToCart();
  const reduced = useReducedMotion();

  // Publish the cart button's window position so product cards can fly items into it.
  const cartRef = useRef(null);
  const measureCart = () => {
    requestAnimationFrame(() => {
      cartRef.current?.measureInWindow?.((x, y, w, h) => {
        if (w || h) registerCartAnchor({ x: x + w / 2, y: y + h / 2 });
      });
    });
  };

  const [loyalty, setLoyalty] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) { setLoyalty(null); return; }
    api.loyalty.getStatus().then(({ data }) => setLoyalty(data?.enabled ? data : null)).catch(() => {});
  }, [isLoggedIn]);

  const openDrawer = () => { tapLight(); navigation.dispatch(DrawerActions.openDrawer()); };

  // Logged-in users get a slimmer, more compact command bar (shorter + smaller buttons).
  const compact = isLoggedIn;

  return (
    <View>
      {/* Bar 1 — glass command bar */}
      <View style={{ paddingTop: insets.top }}>
        <BlurView intensity={t.blur.barIntensity} tint={t.blurTint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.barSurface }]} pointerEvents="none" />
        <View style={[styles.bar1, compact && styles.bar1Compact, { borderBottomColor: t.colors.barBorder, flexDirection: RTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity onPress={openDrawer} style={[styles.iconBtn, compact && styles.iconBtnSm, { backgroundColor: t.colors.searchField }]} accessibilityRole="button" accessibilityLabel="Open menu">
            <Ionicons name="menu" size={compact ? 20 : 22} color={t.colors.iconActive} />
          </TouchableOpacity>

          {/* Search bar → opens the search suggestions screen. Same target as the home hero search. */}
          <Pressable style={[styles.search, compact && styles.searchSm, { backgroundColor: t.colors.searchField, flexDirection: RTL ? 'row-reverse' : 'row' }]} onPress={() => navigation.navigate('Search')} accessibilityRole="search" accessibilityLabel="Search">
            <View style={[styles.searchGlyph, compact && styles.searchGlyphSm, { backgroundColor: t.colors.primary }]}>
              <Ionicons name="search" size={compact ? 12 : 13} color="#fff" />
            </View>
            <Text style={[styles.searchInput, { color: t.colors.textMuted, textAlign: RTL ? 'right' : 'left' }]} numberOfLines={1}>Search products, shops…</Text>
          </Pressable>

          <View style={{ flexDirection: RTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
            {/* Notification bell removed for logged-in users (notifications live in the drawer). */}
            {isLoggedIn && loyalty ? (
              <TouchableOpacity onPress={() => { if (role === 'user') navigation.navigate('Profile'); }} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${loyalty.points_balance ?? 0} loyalty points`}>
                <LinearGradient colors={['#fbbf24', '#f59e0b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.loyalty, compact && styles.loyaltySm]}>
                  <Ionicons name="sparkles" size={12} color="#fff" />
                  <Text style={styles.loyaltyText}>{(loyalty.points_balance ?? 0).toLocaleString()}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => navigation.navigate('Wishlist')} style={[styles.iconBtn, compact && styles.iconBtnSm, { backgroundColor: t.colors.searchField }]} accessibilityRole="button" accessibilityLabel="Wishlist">
              <Ionicons name="heart-outline" size={compact ? 17 : 19} color={t.colors.iconActive} />
            </TouchableOpacity>
            <TouchableOpacity ref={cartRef} onLayout={measureCart} onPress={() => navigation.navigate('Cart')} style={[styles.iconBtn, compact && styles.iconBtnSm, { backgroundColor: t.colors.searchField }]} accessibilityRole="button" accessibilityLabel="Cart">
              <Ionicons name="cart-outline" size={compact ? 17 : 19} color={t.colors.iconActive} />
              {count > 0 ? <ChromeBadge count={count} t={t} /> : null}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bar 2 — category bar */}
      {showCategories && <CategoryBar navigation={navigation} activeId={activeCategoryId} />}
    </View>
  );
}

/* Chrome badge — pops + rolls the count. */
function ChromeBadge({ count, t }) {
  const s = useSharedValue(1);
  const prev = useRef(count);
  useEffect(() => { if (count !== prev.current) { s.value = withTiming(1.35, { duration: 110, easing: Easing.out(Easing.quad) }, () => { s.value = withSpring(1, { damping: 9 }); }); prev.current = count; } }, [count]); // eslint-disable-line
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[styles.badge, { backgroundColor: t.colors.badge, borderColor: t.colors.barSurface }, RTL ? { left: 2, right: undefined } : null, style]}>
      <Text style={[styles.badgeText, { color: t.colors.onBadge }]}>{count > 9 ? '9+' : count}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar1: { alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth },
  bar1Compact: { paddingVertical: 3, gap: 7 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconBtnSm: { width: 30, height: 30, borderRadius: 10 },
  search: { flex: 1, alignItems: 'center', gap: 8, height: 36, paddingLeft: 5, paddingRight: 12, borderRadius: 999 },
  searchSm: { height: 32 },
  loyalty: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 10, borderRadius: 12 },
  loyaltySm: { height: 30, paddingHorizontal: 9, borderRadius: 10 },
  loyaltyText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  searchGlyph: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  searchGlyphSm: { width: 22, height: 22, borderRadius: 11 },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },
  cancel: { paddingHorizontal: 4, paddingVertical: 6 },
  cancelText: { fontSize: 14, fontWeight: '700' },
  badge: { position: 'absolute', top: 3, right: 2, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  badgeText: { fontSize: 9.5, fontWeight: '800' },
});
