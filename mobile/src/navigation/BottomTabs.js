import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, I18nManager, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import AppHeader from '../components/AppHeader';
import AIChatbot from '../components/AIChatbot';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { colors, radius, fonts } from '../theme/theme';

import HomeScreen from '../screens/HomeScreen';
import MapScreen from '../screens/MapScreen';
import ShopScreen from '../screens/ShopScreen';
import CartScreen from '../screens/CartScreen';
import MessagesScreen from '../screens/MessagesScreen';
import BecomeSellerScreen from '../screens/BecomeSellerScreen';
import ProfileScreen from '../screens/ProfileScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AdminNavigator from './AdminNavigator';
import ShopNavigator from './ShopNavigator';
import DeliveryCockpitScreen from '../screens/delivery/DeliveryCockpitScreen';
import AgentNavigator from './AgentNavigator';

const Tab = createBottomTabNavigator();

// Per-route presentation (outline icon inactive, filled active). Center tab flagged.
const META = {
  Home: { label: 'Explore', icon: 'compass-outline', activeIcon: 'compass', center: true },
  Map: { label: 'Map', icon: 'map-outline', activeIcon: 'map' },
  Shop: { label: 'Shop', icon: 'storefront-outline', activeIcon: 'storefront' },
  Cart: { label: 'Cart', icon: 'cart-outline', activeIcon: 'cart' },
  Messages: { label: 'Messages', icon: 'chatbubble-ellipses-outline', activeIcon: 'chatbubble-ellipses' },
  Sell: { label: 'Sell', icon: 'rocket-outline', activeIcon: 'rocket' },
  Profile: { label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
  Dashboard: { label: 'Dashboard', icon: 'grid-outline', activeIcon: 'grid' },
};

const IMMERSIVE = new Set(['Map', 'Cart', 'Dashboard']);   // screens that hide the bottom bar (Dashboard = shop/staff cockpit)
const NO_AI = new Set(['Map', 'Cart', 'Shop', 'Dashboard', 'Messages']); // screens where the floating AI assistant is hidden
const DUR = 160;                                    // every tab animation: fast + lightweight
const EASE = Easing.out(Easing.cubic);

/* =====================================================================
   A clean, minimal floating navigation bar.
   • Solid rounded bar, floated above the safe area, single soft shadow.
   • A small rounded pill slides behind the active icon (native transform).
   • Active icon: filled, tinted, nudges up a few px + a subtle scale.
   • Only the active tab shows its label (opacity fade, reserved height).
   • Center "Explore" tab is slightly more prominent (not oversized).
   • Colors come from tokens → light/dark + admin palette adapt automatically.
   ===================================================================== */
function FloatingNav({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { count } = useCart();
  const reduced = useReducedMotion();
  const active = state.routes[state.index]?.name;
  const [barW, setBarW] = useState(0);
  const n = state.routes.length;
  const tabW = barW ? barW / n : 0;

  const pos = useSharedValue(state.index);
  useEffect(() => {
    pos.value = reduced ? state.index : withTiming(state.index, { duration: DUR, easing: EASE });
    try { Haptics.selectionAsync(); } catch (_) {} // subtle tick on tab change
  }, [state.index]); // eslint-disable-line

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value * tabW }] }));

  if (IMMERSIVE.has(active)) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: (insets.bottom || 8) + 6 }]}>
      <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
        {tabW > 0 && (
          <Reanimated.View pointerEvents="none" style={[styles.indicatorWrap, { width: tabW }, I18nManager.isRTL && { right: 0 }, pillStyle]}>
            <View style={[styles.indicator, { backgroundColor: colors.primarySoft }]} />
          </Reanimated.View>
        )}
        <View style={[styles.row, I18nManager.isRTL && { flexDirection: 'row-reverse' }]}>
          {state.routes.map((route, i) => {
            const meta = META[route.name] || { label: route.name, icon: 'ellipse-outline', activeIcon: 'ellipse' };
            const focused = state.index === i;
            const onPress = () => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
            };
            return (
              <NavTab key={route.key} reduced={reduced} meta={meta} focused={focused} onPress={onPress}
                badgeCount={route.name === 'Cart' ? count : 0} center={!!meta.center} />
            );
          })}
        </View>
      </View>
    </View>
  );
}

/* A single tab — inactive is icon-only; active fills the icon, nudges it up,
   fades in its label, and the shared pill slides in behind it. */
function NavTab({ reduced, meta, focused, onPress, badgeCount, center }) {
  const f = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    f.value = reduced ? (focused ? 1 : 0) : withTiming(focused ? 1 : 0, { duration: DUR, easing: EASE });
  }, [focused]); // eslint-disable-line

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -3 * f.value }, { scale: 1 + 0.08 * f.value }] }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: f.value, transform: [{ translateY: (1 - f.value) * 3 }] }));
  const size = center ? 24 : 22;

  return (
    <Pressable style={styles.tab} onPress={onPress} hitSlop={8}
      accessibilityRole="button" accessibilityState={{ selected: focused }} accessibilityLabel={meta.label}>
      <Reanimated.View style={[styles.iconBox, iconStyle]}>
        <Ionicons name={focused ? meta.activeIcon : meta.icon} size={size} color={focused ? colors.primarySoftText : colors.textMuted} />
        {badgeCount > 0 ? <NavBadge count={badgeCount} /> : null}
      </Reanimated.View>
      <View style={styles.labelBox}>
        <Reanimated.Text numberOfLines={1} style={[styles.label, { color: colors.primarySoftText }, labelStyle]}>{meta.label}</Reanimated.Text>
      </View>
    </Pressable>
  );
}

/* Small modern cart badge — count only, subtle scale bump when it changes. */
function NavBadge({ count }) {
  const s = useSharedValue(1);
  const prev = useRef(count);
  useEffect(() => {
    if (count !== prev.current) { s.value = withTiming(1.18, { duration: 90 }, () => { s.value = withTiming(1, { duration: 110 }); }); }
    prev.current = count;
  }, [count]); // eslint-disable-line
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Reanimated.View style={[styles.badge, { backgroundColor: colors.rose, borderColor: colors.surface }, style]}>
      <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </Reanimated.View>
  );
}

/* ---------- Tab navigator ---------- */
export default function BottomTabs() {
  const { isLoggedIn, isStaff, role } = useAuth();
  const [activeTab, setActiveTab] = useState('Home');

  if (role === 'admin') return <AdminNavigator />;
  if (role === 'delivery') return <DeliveryCockpitScreen />;

  // Slot 4: guests keep the Cart tab; once logged in it becomes Messages (cart still lives in the top bar).
  const fourth = isLoggedIn
    ? { name: 'Messages', component: MessagesScreen, options: { headerShown: false } }
    : { name: 'Cart', component: CartScreen, options: { headerShown: false } };

  // Slot 5: varies by role.
  const fifth = !isLoggedIn
    ? { name: 'Sell', component: BecomeSellerScreen }
    : role === 'shop'
    ? { name: 'Dashboard', component: ShopNavigator, options: { headerShown: false } }
    : role === 'agent'
    ? { name: 'Dashboard', component: AgentNavigator, options: { headerShown: false } }
    : isStaff
    ? { name: 'Dashboard', component: DashboardScreen }
    : { name: 'Profile', component: ProfileScreen };

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="Home"
        backBehavior="history"
        tabBar={(props) => <FloatingNav {...props} />}
        screenListeners={{
          state: (e) => { const st = e?.data?.state; if (st?.routeNames) setActiveTab(st.routeNames[st.index]); },
        }}
        screenOptions={({ navigation, route }) => ({
          animation: 'fade',        // very short cross-fade; state is preserved between tabs
          lazy: true,
          header: () => (
            <AppHeader
              navigation={navigation}
              showCategories={route.name === 'Home' || route.name === 'Shop'}
              activeCategoryId={route.name === 'Shop' ? (route.params?.categoryId ?? null) : null}
            />
          ),
        })}
      >
        {/* First three are fixed: Explore · Shop · Map. Last two vary with the user's role. */}
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Shop" component={ShopScreen} />
        <Tab.Screen name="Map" component={MapScreen} options={{ headerShown: false }} />
        <Tab.Screen name={fourth.name} component={fourth.component} options={fourth.options} />
        <Tab.Screen name={fifth.name} component={fifth.component} options={fifth.options} />
      </Tab.Navigator>
      {!NO_AI.has(activeTab) && <AIChatbot />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, alignItems: 'stretch' },
  bar: {
    height: 62, borderRadius: 24, borderWidth: 1, overflow: 'hidden',
    // one soft, subtle shadow — just enough to float above content
    ...Platform.select({
      ios: { shadowColor: '#0f172a', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 8 },
    }),
  },
  indicatorWrap: { position: 'absolute', top: 8, height: 40, alignItems: 'center', justifyContent: 'center' },
  indicator: { width: '62%', height: '100%', borderRadius: 16 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8, minHeight: 48 },
  iconBox: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  labelBox: { height: 14, justifyContent: 'center' },
  label: { fontSize: 10.5, fontFamily: fonts.bold, letterSpacing: 0.2 },
  badge: { position: 'absolute', top: -4, right: -6, minWidth: 15, height: 15, borderRadius: 8, paddingHorizontal: 3.5, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  badgeText: { color: colors.white, fontSize: 8.5, fontFamily: fonts.bold },
});
