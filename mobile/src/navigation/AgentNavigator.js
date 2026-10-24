import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Alert } from '../components/AppDialog';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator, DrawerContentScrollView } from '@react-navigation/drawer';
import { DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { ShopTopBar, ToastHost, Spinner } from '../components/shop/ShopKit';
import WalletChip from '../components/shop/WalletChip';
import { AgentContext } from '../components/agent/AgentKit';
import AgentDashboardScreen from '../screens/agent/AgentDashboardScreen';
import AgentWalletScreen from '../screens/agent/AgentWalletScreen';
import AgentCommissionsScreen from '../screens/agent/AgentCommissionsScreen';
import AgentReferredShopsScreen from '../screens/agent/AgentReferredShopsScreen';
import AgentReferShopScreen from '../screens/agent/AgentReferShopScreen';
import AgentCashoutScreen from '../screens/agent/AgentCashoutScreen';
import AgentMessagesScreen from '../screens/agent/AgentMessagesScreen';
import AgentPageScreen from '../screens/agent/AgentPageScreen';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';
import { colors, agent, radius, fonts, shadow } from '../theme/theme';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const REAL = ['AgentHome', 'AgentWallet', 'AgentCommissions', 'AgentReferredShops', 'AgentRefer', 'AgentMessages', 'AgentCashout'];

/* Drawer items — exact order from AgentSidebar ALL_PAGES */
const NAV_ITEMS = [
  { icon: 'grid', label: 'Dashboard', route: 'AgentHome' },
  { icon: 'wallet', label: 'My Wallet', route: 'AgentWallet' },
  { icon: 'storefront', label: 'Referred Shops', route: 'AgentReferredShops' },
  { icon: 'receipt', label: 'Commissions', route: 'AgentCommissions' },
  { icon: 'add-circle', label: 'Refer a Shop', route: 'AgentRefer' },
  { icon: 'chatbubble-ellipses', label: 'Messages', route: 'AgentMessages', badgeType: 'unread' },
  { icon: 'cash', label: 'Cash Out', route: 'AgentCashout' },
];

function AgentHeaderRight({ navigation }) {
  const { logout } = useAuth();
  const confirm = () => Alert.alert('Log out', 'Sign out of the agent portal?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log out', style: 'destructive', onPress: () => logout() },
  ]);
  return (
    <View style={styles.headerRight}>
      <WalletChip fetcher={api.agent.wallet} label="Agent Wallet" onViewAll={() => navigation?.navigate('AgentWallet')} />
      <NotificationBell color={colors.white} onDark />
      <TouchableOpacity onPress={confirm} activeOpacity={0.8} style={styles.logoutBtn} accessibilityLabel="Log out">
        <Ionicons name="log-out-outline" size={21} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

function AgentStack() {
  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator
        screenOptions={{ header: ({ navigation: nav, options, route }) => (
          <ShopTopBar
            title={options.title || route.params?.title || route.name}
            onMenu={() => nav.dispatch(DrawerActions.openDrawer())}
            right={<AgentHeaderRight navigation={nav} />}
          />
        ) }}
      >
        <Stack.Screen name="AgentHome" component={AgentDashboardScreen} options={{ title: 'Agent Dashboard' }} />
        <Stack.Screen name="AgentWallet" component={AgentWalletScreen} options={{ title: 'My Wallet' }} />
        <Stack.Screen name="AgentCommissions" component={AgentCommissionsScreen} options={{ title: 'Commissions' }} />
        <Stack.Screen name="AgentReferredShops" component={AgentReferredShopsScreen} options={{ title: 'Referred Shops' }} />
        <Stack.Screen name="AgentRefer" component={AgentReferShopScreen} options={{ title: 'Refer a Shop' }} />
        <Stack.Screen name="AgentCashout" component={AgentCashoutScreen} options={{ title: 'Cash Out' }} />
        <Stack.Screen name="AgentMessages" component={AgentMessagesScreen} options={{ title: 'Messages' }} />
        <Stack.Screen name="AgentPage" component={AgentPageScreen} />
      </Stack.Navigator>
      <ToastHost />
    </View>
  );
}

function CommandDrawer(props) {
  const { navigation } = props;
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const load = () => api.messages.getUnreadCount().then(({ data }) => setUnreadCount(data.unread_count || 0)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const nested = props.state?.routes?.[0]?.state;
  const activeName = nested ? nested.routes[nested.index]?.name : 'AgentHome';
  const activeTitle = nested ? nested.routes[nested.index]?.params?.title : null;

  const go = (item) => {
    navigation.closeDrawer();
    if (item.route && REAL.includes(item.route)) {
      navigation.navigate('AgentStack', { screen: item.route });
    } else {
      navigation.navigate('AgentStack', { screen: 'AgentPage', params: { title: item.label } });
    }
  };
  const isActive = (item) => item.route
    ? item.route === activeName
    : (activeName === 'AgentPage' && activeTitle === item.label);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <LinearGradient colors={agent.drawerHead} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.drawerHead}>
        <View style={styles.drawerLogo}><Ionicons name="flash" size={22} color={colors.white} /></View>
        <View><Text style={styles.drawerBrand}>Agent</Text><Text style={styles.drawerSub}>Referral Portal</Text></View>
      </LinearGradient>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 6 }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const badge = item.badgeType === 'unread' ? unreadCount : 0;
          const inner = (
            <>
              <View style={active ? styles.chipActive : styles.chip}>
                <Ionicons name={item.icon} size={17} color={active ? colors.white : '#be3a5c'} />
              </View>
              <Text style={active ? styles.labelActive : styles.label} numberOfLines={1}>{item.label}</Text>
              {badge > 0 && <View style={[styles.badge, active && { backgroundColor: 'rgba(255,255,255,0.3)' }]}><Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text></View>}
            </>
          );
          return (
            <TouchableOpacity key={item.label} activeOpacity={0.8} onPress={() => go(item)} style={styles.row}
              testID={`agent-nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}>
              {active ? (
                <LinearGradient colors={agent.activePill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.rowActive}>
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

export default function AgentNavigator() {
  const { user } = useAuth();
  const [agentInfo, setAgentInfo] = useState(null);
  const [loaded, setLoaded] = useState(false);

  /* the AgentLayout gate — hydrate the agent profile before rendering the world */
  const refresh = useCallback(async () => {
    try { const { data } = await api.agent.me(); setAgentInfo(data); }
    catch { setAgentInfo(null); }
  }, []);
  useEffect(() => {
    (async () => { await refresh(); setLoaded(true); })();
  }, [refresh]);

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: agent.bg }}>
        <Spinner size={40} color={colors.p500} />
      </View>
    );
  }

  return (
    <AgentContext.Provider value={{ agent: agentInfo, refresh, user }}>
      <Drawer.Navigator
        drawerContent={(props) => <CommandDrawer {...props} />}
        screenOptions={{ headerShown: false, drawerType: 'front', swipeEnabled: false, drawerStyle: { width: 296 } }}
      >
        <Drawer.Screen name="AgentStack" component={AgentStack} />
      </Drawer.Navigator>
    </AgentContext.Provider>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  logoutBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  drawerHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 54, paddingBottom: 18, paddingHorizontal: 18 },
  drawerLogo: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  drawerBrand: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 18 },
  drawerSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 11 },
  row: { paddingHorizontal: 10, marginBottom: 2 },
  rowIdle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 9, borderRadius: radius.md },
  rowActive: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 9, borderRadius: radius.md, ...agent.fuchsiaGlow },
  chip: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#fae8ff', alignItems: 'center', justifyContent: 'center' },
  chipActive: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  labelActive: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10 },
});
