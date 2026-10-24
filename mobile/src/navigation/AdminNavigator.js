import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Alert } from '../components/AppDialog';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator, DrawerContentScrollView } from '@react-navigation/drawer';
import { DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { AdminTopBar } from '../components/admin/AdminKit';
import { ToastHost } from '../components/shop/ShopKit';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminAnalyticsScreen from '../screens/admin/AdminAnalyticsScreen';
import AdminFinanceCenterScreen from '../screens/admin/AdminFinanceCenterScreen';
import AdminOrdersScreen from '../screens/admin/AdminOrdersScreen';
import AdminProductsScreen from '../screens/admin/AdminProductsScreen';
import AdminCategoriesScreen from '../screens/admin/AdminCategoriesScreen';
import AdminShopsScreen from '../screens/admin/AdminShopsScreen';
import AdminMapScreen from '../screens/admin/AdminMapScreen';
import AdminRequestsScreen, { ShopSalesView } from '../screens/admin/AdminRequestsScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminAgentsScreen from '../screens/admin/AdminAgentsScreen';
import AdminEmployeesScreen from '../screens/admin/AdminEmployeesScreen';
import AdminPayoutsScreen from '../screens/admin/AdminPayoutsScreen';
import AdminMessagesScreen from '../screens/admin/AdminMessagesScreen';
import AdminAllConversationsScreen from '../screens/admin/AdminAllConversationsScreen';
import AdminContactMessagesScreen from '../screens/admin/AdminContactMessagesScreen';
import AdminPromotionsScreen from '../screens/admin/AdminPromotionsScreen';
import AdminLoyaltyScreen from '../screens/admin/AdminLoyaltyScreen';
import AdminSubscriptionTiersScreen from '../screens/admin/AdminSubscriptionTiersScreen';
import AdminThemesScreen from '../screens/admin/AdminThemesScreen';
import AdminGalleryScreen from '../screens/admin/AdminGalleryScreen';
import AdminSpinWheelScreen from '../screens/admin/AdminSpinWheelScreen';
import AdminEventsScreen from '../screens/admin/AdminEventsScreen';
import AdminAdvertisingScreen from '../screens/admin/AdminAdvertisingScreen';
import AdminSettingsScreen from '../screens/admin/AdminSettingsScreen';
import AdminDatabaseScreen from '../screens/admin/AdminDatabaseScreen';
import AdminPageScreen from '../screens/admin/AdminPageScreen';

const REAL = ['AdminHome', 'AdminAnalytics', 'AdminFinance', 'AdminOrders', 'AdminProducts', 'AdminCategories', 'AdminShops', 'AdminMap', 'AdminRequests', 'AdminShopSales', 'AdminUsers', 'AdminAgents', 'AdminEmployees', 'AdminPayouts', 'AdminMessages', 'AdminAllConversations', 'AdminContactMessages', 'AdminPromotions', 'AdminLoyalty', 'AdminSubscriptionTiers', 'AdminThemes', 'AdminGallery', 'AdminSpinWheel', 'AdminEvents', 'AdminAdvertising', 'AdminSettings', 'AdminDatabase'];
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';
import { colors, admin, radius, fonts, shadow } from '../theme/theme';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

/* header-right cluster: notifications + logout */
function AdminHeaderRight() {
  const { logout } = useAuth();
  const confirm = () => Alert.alert('Log out', 'Sign out of the admin console?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log out', style: 'destructive', onPress: () => logout() },
  ]);
  return (
    <View style={styles.headerRight}>
      <NotificationBell color={colors.white} onDark />
      <TouchableOpacity onPress={confirm} activeOpacity={0.8} style={styles.logoutBtn} accessibilityLabel="Log out">
        <Ionicons name="log-out-outline" size={21} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

// route: 'AdminHome' | 'AdminAnalytics' | 'AdminFinance' | 'AdminPage' (title)
const MAIN = [
  { label: 'Dashboard', icon: 'grid', route: 'AdminHome' },
  { label: 'Finance Center', icon: 'cash', route: 'AdminFinance' },
  { label: 'Analytics', icon: 'analytics', route: 'AdminAnalytics' },
  { label: 'Shops', icon: 'storefront', route: 'AdminShops', badgeKey: 'shop_pending' },
  { label: 'Map', icon: 'map', route: 'AdminMap' },
  { label: 'Shop Payouts', icon: 'wallet', route: 'AdminPayouts', params: { kind: 'shop' } },
  { label: 'Agent Payouts', icon: 'wallet', route: 'AdminPayouts', params: { kind: 'agent' } },
  { label: 'Products', icon: 'cube', route: 'AdminProducts' },
  { label: 'Orders', icon: 'bag-handle', route: 'AdminOrders' },
];
const REQUESTS = [
  { label: 'Cancel Requests', icon: 'close-circle', badgeKey: 'cancel_requests', route: 'AdminRequests', params: { kind: 'cancel' } },
  { label: 'Credit Requests', icon: 'card', badgeKey: 'wallet_requests', route: 'AdminRequests', params: { kind: 'credit' } },
  { label: 'Cash Out Requests', icon: 'cash', badgeKey: 'cashout_requests', route: 'AdminRequests', params: { kind: 'cashout' } },
  { label: 'Agent Cash-out Requests', icon: 'person-circle', badgeKey: 'agent_cashout_requests', route: 'AdminRequests', params: { kind: 'agent_cashout' } },
  { label: 'Shop Requests', icon: 'ribbon', badgeKey: 'subscription_requests', route: 'AdminRequests', params: { kind: 'shop_requests' } },
  { label: 'Shops Verification', icon: 'shield-checkmark', badgeKey: 'verification_requests', route: 'AdminRequests', params: { kind: 'verification' } },
  { label: 'Shop Sales', icon: 'pricetag', route: 'AdminShopSales' },
];
const REST = [
  { label: 'Categories', icon: 'file-tray-stacked', route: 'AdminCategories' }, { label: 'Users', icon: 'people', route: 'AdminUsers' },
  { label: 'Agents', icon: 'person-circle', route: 'AdminAgents' }, { label: 'Employees', icon: 'briefcase', route: 'AdminEmployees' },
  { label: 'Gallery', icon: 'images', route: 'AdminGallery' }, { label: 'Messages', icon: 'chatbubble-ellipses', route: 'AdminMessages' },
  { label: 'All Conversations', icon: 'chatbubbles', route: 'AdminAllConversations' }, { label: 'Contact Forms', icon: 'mail', badgeKey: 'contact_messages', route: 'AdminContactMessages' },
  { label: 'Loyalty', icon: 'gift', route: 'AdminLoyalty' }, { label: 'Promotions', icon: 'megaphone', route: 'AdminPromotions' },
  { label: 'Advertising', icon: 'rocket', route: 'AdminAdvertising' }, { label: 'Subscription Tiers', icon: 'ribbon', route: 'AdminSubscriptionTiers' },
  { label: 'Spin Wheel', icon: 'sparkles', route: 'AdminSpinWheel' }, { label: 'Storefront Themes', icon: 'color-palette', route: 'AdminThemes' },
  { label: 'Events', icon: 'calendar', route: 'AdminEvents' }, { label: 'Settings', icon: 'settings', route: 'AdminSettings' },
  { label: 'Database Tables', icon: 'server', route: 'AdminDatabase' },
];

function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ header: ({ navigation, options, route }) => (
      <AdminTopBar
        title={options.title || route.params?.title || route.name}
        onMenu={() => navigation.dispatch(DrawerActions.openDrawer())}
        right={<AdminHeaderRight />}
      />
    ) }}>
      <Stack.Screen name="AdminHome" component={AdminDashboardScreen} options={{ title: 'Admin Dashboard' }} />
      <Stack.Screen name="AdminAnalytics" component={AdminAnalyticsScreen} options={{ title: 'Analytics' }} />
      <Stack.Screen name="AdminFinance" component={AdminFinanceCenterScreen} options={{ title: 'Finance Center' }} />
      <Stack.Screen name="AdminOrders" component={AdminOrdersScreen} options={{ title: 'Orders' }} />
      <Stack.Screen name="AdminProducts" component={AdminProductsScreen} options={{ title: 'Products' }} />
      <Stack.Screen name="AdminCategories" component={AdminCategoriesScreen} options={{ title: 'Categories' }} />
      <Stack.Screen name="AdminShops" component={AdminShopsScreen} options={{ title: 'Shops' }} />
      <Stack.Screen name="AdminMap" component={AdminMapScreen} options={{ title: 'Shops Map' }} />
      <Stack.Screen name="AdminRequests" component={AdminRequestsScreen} options={{ title: 'Requests' }} />
      <Stack.Screen name="AdminShopSales" component={ShopSalesView} options={{ title: 'Shop Sales' }} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: 'Users' }} />
      <Stack.Screen name="AdminAgents" component={AdminAgentsScreen} options={{ title: 'Referral Agents' }} />
      <Stack.Screen name="AdminEmployees" component={AdminEmployeesScreen} options={{ title: 'Employees' }} />
      <Stack.Screen name="AdminPayouts" component={AdminPayoutsScreen} options={{ title: 'Payouts' }} />
      <Stack.Screen name="AdminMessages" component={AdminMessagesScreen} options={{ title: 'Messages' }} />
      <Stack.Screen name="AdminAllConversations" component={AdminAllConversationsScreen} options={{ title: 'All Conversations' }} />
      <Stack.Screen name="AdminContactMessages" component={AdminContactMessagesScreen} options={{ title: 'Contact Forms' }} />
      <Stack.Screen name="AdminPromotions" component={AdminPromotionsScreen} options={{ title: 'Promotions' }} />
      <Stack.Screen name="AdminLoyalty" component={AdminLoyaltyScreen} options={{ title: 'Loyalty' }} />
      <Stack.Screen name="AdminSubscriptionTiers" component={AdminSubscriptionTiersScreen} options={{ title: 'Subscription Tiers' }} />
      <Stack.Screen name="AdminThemes" component={AdminThemesScreen} options={{ title: 'Storefront Themes' }} />
      <Stack.Screen name="AdminGallery" component={AdminGalleryScreen} options={{ title: 'Gallery' }} />
      <Stack.Screen name="AdminSpinWheel" component={AdminSpinWheelScreen} options={{ title: 'Spin Wheel' }} />
      <Stack.Screen name="AdminEvents" component={AdminEventsScreen} options={{ title: 'Events' }} />
      <Stack.Screen name="AdminAdvertising" component={AdminAdvertisingScreen} options={{ title: 'Advertising' }} />
      <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="AdminDatabase" component={AdminDatabaseScreen} options={{ title: 'Database Tables' }} />
      <Stack.Screen name="AdminPage" component={AdminPageScreen} />
    </Stack.Navigator>
  );
}

function CommandDrawer(props) {
  const { navigation } = props;
  const [badges, setBadges] = useState({});
  const [reqOpen, setReqOpen] = useState(true);
  const chev = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const load = () => api.admin.getBadgeCounts().then(({ data }) => setBadges(data || {})).catch(() => {});
    load(); const t = setInterval(load, 15000); return () => clearInterval(t);
  }, []);

  const nested = props.state?.routes?.[0]?.state;
  const activeName = nested ? nested.routes[nested.index]?.name : 'AdminHome';
  const activeParams = nested ? nested.routes[nested.index]?.params : null;
  const activeTitle = activeParams?.title;

  const go = (item) => {
    navigation.closeDrawer();
    if (item.route && REAL.includes(item.route)) {
      navigation.navigate('AdminStack', { screen: item.route, params: item.params });
    } else {
      navigation.navigate('AdminStack', { screen: 'AdminPage', params: { title: item.label } });
    }
  };
  const isActive = (item) => item.route
    ? (item.route === activeName && (!item.params?.kind || activeParams?.kind === item.params.kind))
    : (activeName === 'AdminPage' && activeTitle === item.label);

  const toggleReq = () => { const next = !reqOpen; setReqOpen(next); Animated.spring(chev, { toValue: next ? 1 : 0, useNativeDriver: true }).start(); };
  const reqBadgeTotal = REQUESTS.reduce((n, it) => n + (it.badgeKey ? (badges[it.badgeKey] || 0) : 0), 0);

  const Row = (item, sub = false) => {
    const active = isActive(item);
    const count = item.badgeKey ? (badges[item.badgeKey] || 0) : 0;
    const inner = (
      <TouchableOpacity key={item.label} activeOpacity={0.8} onPress={() => go(item)} style={[styles.row, sub && styles.subRow]}>
        {active ? (
          <LinearGradient colors={admin.activePill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.rowActive}>
            <View style={styles.chipActive}><Ionicons name={item.icon} size={17} color={colors.white} /></View>
            <Text style={styles.labelActive}>{item.label}</Text>
            {count > 0 && <Badge count={count} light />}
          </LinearGradient>
        ) : (
          <View style={styles.rowIdle}>
            <View style={styles.chip}><Ionicons name={item.icon} size={17} color={colors.violet} /></View>
            <Text style={styles.label}>{item.label}</Text>
            {count > 0 && <Badge count={count} />}
          </View>
        )}
      </TouchableOpacity>
    );
    return inner;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <LinearGradient colors={admin.topBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.drawerHead}>
        <View style={styles.drawerLogo}><Ionicons name="shield-checkmark" size={22} color={colors.white} /></View>
        <View><Text style={styles.drawerBrand}>Admin</Text><Text style={styles.drawerSub}>Command Center</Text></View>
      </LinearGradient>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 6 }}>
        {MAIN.map((it) => Row(it))}

        {/* Requests dropdown */}
        <TouchableOpacity activeOpacity={0.8} onPress={toggleReq} style={styles.row}>
          <View style={styles.rowIdle}>
            <View style={styles.chip}><Ionicons name="albums" size={17} color={colors.violet} /></View>
            <Text style={styles.label}>Requests</Text>
            {reqBadgeTotal > 0 && <Badge count={reqBadgeTotal} />}
            <Animated.View style={{ transform: [{ rotate: chev.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </Animated.View>
          </View>
        </TouchableOpacity>
        {reqOpen && <View style={styles.reqRail}>{REQUESTS.map((it) => Row(it, true))}</View>}

        {REST.map((it) => Row(it))}
        <View style={{ height: 30 }} />
      </DrawerContentScrollView>
    </View>
  );
}

function Badge({ count, light }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 4, tension: 140 }).start(); }, [count]); // eslint-disable-line
  return (
    <Animated.View style={[styles.badge, light && { backgroundColor: 'rgba(255,255,255,0.3)' }, { transform: [{ scale: a }] }]}>
      <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </Animated.View>
  );
}

export default function AdminNavigator() {
  return (
    <View style={{ flex: 1 }}>
      <Drawer.Navigator
        drawerContent={(props) => <CommandDrawer {...props} />}
        screenOptions={{ headerShown: false, drawerType: 'front', swipeEnabled: false, drawerStyle: { width: 296 } }}
      >
        <Drawer.Screen name="AdminStack" component={AdminStack} />
      </Drawer.Navigator>
      <ToastHost />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoutBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  drawerHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 54, paddingBottom: 18, paddingHorizontal: 18 },
  drawerLogo: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  drawerBrand: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 18 },
  drawerSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 11 },
  row: { paddingHorizontal: 10, marginBottom: 2 },
  subRow: { paddingHorizontal: 0 },
  rowIdle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 9, borderRadius: radius.md },
  rowActive: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 9, borderRadius: radius.md, ...shadow.violetGlow },
  chip: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  chipActive: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  labelActive: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  reqRail: { marginLeft: 30, borderLeftWidth: 2, borderLeftColor: colors.primarySoft, paddingLeft: 6 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10 },
});
