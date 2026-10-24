import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Alert } from '../components/AppDialog';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator, DrawerContentScrollView } from '@react-navigation/drawer';
import { DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';
import { ShopTopBar, ToastHost, Pulse } from '../components/shop/ShopKit';
import SpinWheelWidget from '../components/shop/SpinWheelWidget';
import WalletChip from '../components/shop/WalletChip';
import ShopDashboardScreen from '../screens/shop/ShopDashboardScreen';
import ShopProductsScreen from '../screens/shop/ShopProductsScreen';
import ShopGiftsScreen from '../screens/shop/ShopGiftsScreen';
import ShopOrdersScreen from '../screens/shop/ShopOrdersScreen';
import ShopMyOrdersScreen from '../screens/shop/ShopMyOrdersScreen';
import ShopCreateOrderScreen from '../screens/shop/ShopCreateOrderScreen';
import ShopWalletScreen from '../screens/shop/ShopWalletScreen';
import ShopAnalyticsScreen from '../screens/shop/ShopAnalyticsScreen';
import ShopBoostProductsScreen from '../screens/shop/ShopBoostProductsScreen';
import ShopAdvertisingScreen from '../screens/shop/ShopAdvertisingScreen';
import ShopSalesScreen from '../screens/shop/ShopSalesScreen';
import ShopThemeScreen from '../screens/shop/ShopThemeScreen';
import ShopGalleryScreen from '../screens/shop/ShopGalleryScreen';
import ShopMessagesScreen from '../screens/shop/ShopMessagesScreen';
import ShopLocationScreen from '../screens/shop/ShopLocationScreen';
import ShopVerificationScreen from '../screens/shop/ShopVerificationScreen';
import ShopSpinScreen from '../screens/shop/ShopSpinScreen';
import ShopSettingsScreen from '../screens/shop/ShopSettingsScreen';
import ShopPageScreen from '../screens/shop/ShopPageScreen';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';
import { colors, shop, radius, fonts, shadow } from '../theme/theme';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

/* Seen-count badge mechanics (port of ShopSidebar localStorage logic) */
const SEEN_KEY = 'shop_badge_seen';
const getSeenCounts = async () => { try { return JSON.parse((await AsyncStorage.getItem(SEEN_KEY)) || '{}'); } catch { return {}; } };
const setSeenCount = async (key, value) => { const seen = await getSeenCounts(); seen[key] = value; await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(seen)); };

const REAL = ['ShopHome', 'ShopProducts', 'ShopGifts', 'ShopOrders', 'ShopMyOrders', 'ShopCreateOrder', 'ShopWallet', 'ShopAnalytics', 'ShopBoost', 'ShopAdvertising', 'ShopSales', 'ShopTheme', 'ShopGallery', 'ShopMessages', 'ShopLocation', 'ShopVerification', 'ShopSpin', 'ShopSettings'];

/* Command Drawer items — exact order + special badges (ported from ShopSidebar navItems) */
const NAV_ITEMS = [
  { icon: 'grid', label: 'Dashboard', route: 'ShopHome' },
  { icon: 'cube', label: 'Products', route: 'ShopProducts' },
  { icon: 'cart', label: 'Orders', route: 'ShopOrders', badgeKey: 'pending_orders' },
  { icon: 'wallet', label: 'My Wallet', route: 'ShopWallet' },
  { icon: 'bar-chart', label: 'Analytics', route: 'ShopAnalytics' },
  { icon: 'rocket', label: 'Advertising', route: 'ShopAdvertising' },
  { icon: 'add-circle', label: 'Create Order', route: 'ShopCreateOrder' },
  { icon: 'gift', label: 'Add Gift', route: 'ShopGifts' },
  { icon: 'images', label: 'Gallery', route: 'ShopGallery' },
  { icon: 'chatbubble-ellipses', label: 'Messages', route: 'ShopMessages', badgeType: 'unread' },
  { icon: 'megaphone', label: 'Boost a Product', route: 'ShopBoost', sponsorBadge: true },
  { icon: 'pricetag', label: 'Shop Sales', route: 'ShopSales' },
  { icon: 'color-palette', label: 'Storefront Theme', route: 'ShopTheme', hasDynamicBadge: true },
  { icon: 'location', label: 'Shop Location', route: 'ShopLocation' },
  { icon: 'shield-checkmark', label: 'Verification', route: 'ShopVerification' },
  { icon: 'sparkles', label: 'Spin the Wheel', route: 'ShopSpin', spinBadge: true },
  { icon: 'clipboard', label: 'My Orders', route: 'ShopMyOrders' },
  { icon: 'settings', label: 'Settings', route: 'ShopSettings' },
];

function ShopHeaderRight({ navigation }) {
  const { logout } = useAuth();
  const confirm = () => Alert.alert('Log out', 'Sign out of your shop?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log out', style: 'destructive', onPress: () => logout() },
  ]);
  return (
    <View style={styles.headerRight}>
      <TouchableOpacity onPress={() => navigation?.navigate('Home')} activeOpacity={0.85} style={styles.shopBtn} accessibilityLabel="Continue shopping">
        <Ionicons name="bag-handle" size={13} color={colors.white} />
        <Text style={styles.shopBtnText}>Shop</Text>
      </TouchableOpacity>
      <WalletChip onViewAll={() => navigation?.navigate('ShopWallet')} />
      <NotificationBell color={colors.white} onDark />
      <TouchableOpacity onPress={confirm} activeOpacity={0.8} style={styles.logoutBtn} accessibilityLabel="Log out">
        <Ionicons name="log-out-outline" size={19} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

function ShopStack({ navigation }) {
  const [activeRoute, setActiveRoute] = useState({ name: 'ShopHome', title: '' });
  // Hide the floating Spin Wheel widget where it overlaps content (create-order, messages)
  const hideSpinWidget = activeRoute.name === 'ShopCreateOrder' || activeRoute.name === 'ShopMessages' ||
    (activeRoute.name === 'ShopPage' && ['Create Order', 'Messages'].includes(activeRoute.title));
  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator
        screenListeners={{
          state: (e) => {
            const routes = e.data?.state?.routes || [];
            const r = routes[e.data?.state?.index ?? 0];
            if (r) setActiveRoute({ name: r.name, title: r.params?.title || '' });
          },
        }}
        screenOptions={{ header: ({ navigation: nav, options, route }) => (
          <ShopTopBar
            title={options.title || route.params?.title || route.name}
            onMenu={() => nav.dispatch(DrawerActions.openDrawer())}
            right={<ShopHeaderRight navigation={nav} />}
          />
        ) }}
      >
        <Stack.Screen name="ShopHome" component={ShopDashboardScreen} options={{ title: 'Shop Dashboard' }} />
        <Stack.Screen name="ShopProducts" component={ShopProductsScreen} options={{ title: 'Products' }} />
        <Stack.Screen name="ShopGifts" component={ShopGiftsScreen} options={{ title: 'Product Gifts' }} />
        <Stack.Screen name="ShopOrders" component={ShopOrdersScreen} options={{ title: 'Orders' }} />
        <Stack.Screen name="ShopMyOrders" component={ShopMyOrdersScreen} options={{ title: 'My Orders' }} />
        <Stack.Screen name="ShopCreateOrder" component={ShopCreateOrderScreen} options={{ title: 'Create Order' }} />
        <Stack.Screen name="ShopWallet" component={ShopWalletScreen} options={{ title: 'My Wallet' }} />
        <Stack.Screen name="ShopAnalytics" component={ShopAnalyticsScreen} options={{ title: 'Analytics' }} />
        <Stack.Screen name="ShopBoost" component={ShopBoostProductsScreen} options={{ title: 'Boost a Product' }} />
        <Stack.Screen name="ShopAdvertising" component={ShopAdvertisingScreen} options={{ title: 'Advertising' }} />
        <Stack.Screen name="ShopSales" component={ShopSalesScreen} options={{ title: 'Shop Sales' }} />
        <Stack.Screen name="ShopTheme" component={ShopThemeScreen} options={{ title: 'Storefront Theme' }} />
        <Stack.Screen name="ShopGallery" component={ShopGalleryScreen} options={{ title: 'Gallery' }} />
        <Stack.Screen name="ShopMessages" component={ShopMessagesScreen} options={{ title: 'Messages' }} />
        <Stack.Screen name="ShopLocation" component={ShopLocationScreen} options={{ title: 'Shop Location' }} />
        <Stack.Screen name="ShopVerification" component={ShopVerificationScreen} options={{ title: 'Verification' }} />
        <Stack.Screen name="ShopSpin" component={ShopSpinScreen} options={{ title: 'Spin the Wheel' }} />
        <Stack.Screen name="ShopSettings" component={ShopSettingsScreen} options={{ title: 'Settings' }} />
        <Stack.Screen name="ShopPage" component={ShopPageScreen} />
      </Stack.Navigator>
      {!hideSpinWidget && <SpinWheelWidget navigation={navigation} />}
      <ToastHost />
    </View>
  );
}

function CommandDrawer(props) {
  const { navigation } = props;
  const [badgeCounts, setBadgeCounts] = useState({});
  const [seenCounts, setSeenCounts] = useState({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [sponsorCredits, setSponsorCredits] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);
  const [themeBadge, setThemeBadge] = useState(null); // 'FREE' | 'SALE' | null

  const fetchUnreadCount = () => api.messages.getUnreadCount().then(({ data }) => setUnreadCount(data.unread_count || 0)).catch(() => {});
  const fetchBadgeCounts = () => api.shop.getBadgeCounts().then(({ data }) => setBadgeCounts(data || {})).catch(() => {});
  const fetchSponsorCredits = () => api.shop.getProfile().then(({ data }) => {
    setSponsorCredits((data?.free_sponsor_credits || 0) + (data?.free_sponsor_10day_credits || 0));
  }).catch(() => {});
  const fetchFreeSpins = () => api.shopSpin.getInfo().then(({ data }) => setFreeSpins(data?.free_spins || 0)).catch(() => {});
  const fetchThemeBadge = async () => {
    try {
      const [saleRes, themeRes] = await Promise.allSettled([api.themeSale.get(), api.shop.getStorefrontThemes()]);
      const salePercent = saleRes.status === 'fulfilled' ? (saleRes.value.data?.theme_sale_percent || 0) : 0;
      const freeUnlocks = themeRes.status === 'fulfilled' ? (themeRes.value.data?.free_unlocks_remaining || 0) : 0;
      if (freeUnlocks > 0) setThemeBadge('FREE');
      else if (salePercent > 0) setThemeBadge('SALE');
      else setThemeBadge(null);
    } catch { setThemeBadge(null); }
  };

  useEffect(() => {
    getSeenCounts().then(setSeenCounts);
    fetchUnreadCount(); fetchBadgeCounts(); fetchThemeBadge(); fetchSponsorCredits(); fetchFreeSpins();
    const interval = setInterval(() => { fetchUnreadCount(); fetchBadgeCounts(); fetchSponsorCredits(); fetchFreeSpins(); }, 15000);
    return () => clearInterval(interval);
  }, []);

  const nested = props.state?.routes?.[0]?.state;
  const activeName = nested ? nested.routes[nested.index]?.name : 'ShopHome';
  const activeTitle = nested ? nested.routes[nested.index]?.params?.title : null;

  const getNewBadge = (item) => {
    if (item.badgeType === 'unread') return unreadCount;
    if (item.badgeKey) {
      const current = badgeCounts[item.badgeKey] || 0;
      const seen = seenCounts[item.badgeKey] || 0;
      return Math.max(0, current - seen);
    }
    return 0;
  };

  const go = useCallback((item) => {
    navigation.closeDrawer();
    // Mark badge counts as seen on visit (same mechanics as the web sidebar)
    if (item.badgeKey && item.badgeType !== 'unread') {
      const current = badgeCounts[item.badgeKey] || 0;
      setSeenCount(item.badgeKey, current).then(() => getSeenCounts().then(setSeenCounts));
    }
    if (item.external) { navigation.navigate(item.external); return; }
    if (item.route && REAL.includes(item.route)) {
      navigation.navigate('ShopStack', { screen: item.route });
    } else {
      navigation.navigate('ShopStack', { screen: 'ShopPage', params: { title: item.label } });
    }
  }, [navigation, badgeCounts]);

  const isActive = (item) => item.route
    ? item.route === activeName
    : (activeName === 'ShopPage' && activeTitle === item.label);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <LinearGradient colors={shop.topBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.drawerHead}>
        <View style={styles.drawerLogo}><Ionicons name="storefront" size={22} color={colors.white} /></View>
        <View><Text style={styles.drawerBrand}>Shop</Text><Text style={styles.drawerSub}>Command Center</Text></View>
      </LinearGradient>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 6 }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const badge = getNewBadge(item);
          const inner = (
            <>
              <View style={active ? styles.chipActive : styles.chip}>
                <Ionicons name={item.icon} size={17} color={active ? colors.white : '#059669'} />
              </View>
              <Text style={active ? styles.labelActive : styles.label} numberOfLines={1}>{item.label}</Text>
              {/* sponsor badge (Boost a Product) — amber "N FREE" pulse */}
              {item.sponsorBadge && sponsorCredits > 0 && (
                <Pulse>
                  <View style={[styles.tinyBadge, active ? styles.tinyBadgeOnActive : { backgroundColor: '#fef3c7' }]} testID="shop-nav-sponsor-badge">
                    <Ionicons name="gift" size={8} color={active ? colors.white : '#b45309'} />
                    <Text style={[styles.tinyBadgeText, { color: active ? colors.white : '#b45309' }]}>{sponsorCredits} FREE</Text>
                  </View>
                </Pulse>
              )}
              {/* dynamic theme badge — FREE (free credits) or SALE */}
              {item.hasDynamicBadge && themeBadge && (
                <Pulse>
                  <View style={[styles.tinyBadge, active ? styles.tinyBadgeOnActive : { backgroundColor: themeBadge === 'FREE' ? '#d1fae5' : '#ffe4e6' }]}>
                    <Text style={[styles.tinyBadgeText, { color: active ? colors.white : themeBadge === 'FREE' ? '#047857' : '#be123c' }]}>{themeBadge}</Text>
                  </View>
                </Pulse>
              )}
              {/* spin badge — animated sparkle FREE */}
              {item.spinBadge && freeSpins > 0 && (
                <Pulse>
                  <View style={[styles.tinyBadge, active ? styles.tinyBadgeOnActive : { backgroundColor: '#d1fae5' }]} testID="shop-nav-spin-free-badge">
                    <Ionicons name="sparkles" size={8} color={active ? colors.white : '#047857'} />
                    <Text style={[styles.tinyBadgeText, { color: active ? colors.white : '#047857' }]}>FREE</Text>
                  </View>
                </Pulse>
              )}
              {badge > 0 && <CountBadge count={badge} light={active} />}
            </>
          );
          return (
            <TouchableOpacity key={item.label} activeOpacity={0.8} onPress={() => go(item)} style={styles.row}
              testID={`shop-nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}>
              {active ? (
                <LinearGradient colors={shop.activePill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.rowActive}>
                  {inner}
                </LinearGradient>
              ) : (
                <View style={styles.rowIdle}>{inner}</View>
              )}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 30 }} />
      </DrawerContentScrollView>
    </View>
  );
}

function CountBadge({ count, light }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 4, tension: 140 }).start(); }, [count]); // eslint-disable-line
  return (
    <Animated.View style={[styles.badge, light && { backgroundColor: 'rgba(255,255,255,0.3)' }, { transform: [{ scale: a }] }]}>
      <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </Animated.View>
  );
}

export default function ShopNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CommandDrawer {...props} />}
      screenOptions={{ headerShown: false, drawerType: 'front', swipeEnabled: false, drawerStyle: { width: 296 } }}
    >
      <Drawer.Screen name="ShopStack" component={ShopStack} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  shopBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  shopBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 11.5 },
  logoutBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  drawerHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 54, paddingBottom: 18, paddingHorizontal: 18 },
  drawerLogo: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  drawerBrand: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 18 },
  drawerSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 11 },
  row: { paddingHorizontal: 10, marginBottom: 2 },
  rowIdle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 9, borderRadius: radius.md },
  rowActive: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 9, borderRadius: radius.md, ...shop.emeraldGlow },
  chip: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.sellerSoft, alignItems: 'center', justifyContent: 'center' },
  chipActive: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  labelActive: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  tinyBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: radius.pill, paddingHorizontal: 5, paddingVertical: 2.5 },
  tinyBadgeOnActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tinyBadgeText: { fontFamily: fonts.bold, fontSize: 8, letterSpacing: 0.2 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10 },
});
