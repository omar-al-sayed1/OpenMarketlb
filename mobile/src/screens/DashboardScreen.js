import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { TAB_SPACE } from '../components/ui';
import NotificationBell from '../components/NotificationBell';
import { colors, gradients, radius, fonts, shadow } from '../theme/theme';

// lucide -> Ionicons
const ICON = {
  LayoutDashboard: 'grid', Package: 'cube', ShoppingCart: 'cart', Wallet: 'wallet', Rocket: 'rocket',
  PlusCircle: 'add-circle', Gift: 'gift', Images: 'images', ImageIcon: 'images', MessageSquare: 'chatbubble-ellipses',
  Megaphone: 'megaphone', Tag: 'pricetag', Palette: 'color-palette', MapPin: 'location', Map: 'map',
  Shield: 'shield-checkmark', Sparkles: 'sparkles', ClipboardList: 'clipboard', Settings: 'settings', Store: 'storefront',
  Receipt: 'receipt', PlusSquare: 'add-circle', Banknote: 'cash', XCircle: 'close-circle', CreditCard: 'card',
  UserCog: 'person-circle', Crown: 'ribbon', ShoppingBag: 'bag-handle', FolderTree: 'file-tray-stacked', Users: 'people',
  Briefcase: 'briefcase', MessagesSquare: 'chatbubbles', Inbox: 'mail', CalendarDays: 'calendar', Database: 'server',
};

// Ported verbatim from ShopSidebar / AgentSidebar / AdminSidebar
const SHOP_ITEMS = [
  { icon: 'LayoutDashboard', label: 'Dashboard' }, { icon: 'Package', label: 'Products' },
  { icon: 'ShoppingCart', label: 'Orders', badgeKey: 'pending_orders' }, { icon: 'Wallet', label: 'My Wallet' },
  { icon: 'Rocket', label: 'Advertising' }, { icon: 'PlusCircle', label: 'Create Order' },
  { icon: 'Gift', label: 'Add Gift' }, { icon: 'Images', label: 'Gallery' },
  { icon: 'MessageSquare', label: 'Messages', route: 'Messages', unread: true }, { icon: 'Megaphone', label: 'Boost a Product' },
  { icon: 'Tag', label: 'Shop Sales' }, { icon: 'Palette', label: 'Storefront Theme' },
  { icon: 'MapPin', label: 'Shop Location' }, { icon: 'Shield', label: 'Verification' },
  { icon: 'Sparkles', label: 'Spin the Wheel' }, { icon: 'ClipboardList', label: 'My Orders' },
  { icon: 'Settings', label: 'Settings' },
];
const AGENT_ITEMS = [
  { icon: 'LayoutDashboard', label: 'Dashboard' }, { icon: 'Wallet', label: 'My Wallet' },
  { icon: 'Store', label: 'Referred Shops' }, { icon: 'Receipt', label: 'Commissions' },
  { icon: 'PlusSquare', label: 'Refer a Shop' }, { icon: 'MessageSquare', label: 'Messages', route: 'Messages', unread: true },
  { icon: 'Banknote', label: 'Cash Out' },
];
const ADMIN_REQUESTS = [
  { icon: 'XCircle', label: 'Cancel Requests', badgeKey: 'cancel_requests' },
  { icon: 'CreditCard', label: 'Credit Requests', badgeKey: 'wallet_requests' },
  { icon: 'Banknote', label: 'Cash Out Requests', badgeKey: 'cashout_requests' },
  { icon: 'UserCog', label: 'Agent Cash-out Requests', badgeKey: 'agent_cashout_requests' },
  { icon: 'Crown', label: 'Shop Requests', badgeKey: 'subscription_requests' },
  { icon: 'Shield', label: 'Shops Verification', badgeKey: 'verification_requests' },
  { icon: 'Tag', label: 'Shop Sales' },
];
const ADMIN_MANAGE = [
  { icon: 'LayoutDashboard', label: 'Dashboard' }, { icon: 'Banknote', label: 'Finance Center' },
  { icon: 'Store', label: 'Shops', badgeKey: 'shop_pending' }, { icon: 'Map', label: 'Map' },
  { icon: 'Wallet', label: 'Shop Payouts' }, { icon: 'Wallet', label: 'Agent Payouts' },
  { icon: 'Package', label: 'Products' }, { icon: 'ShoppingBag', label: 'Orders' },
  { icon: 'FolderTree', label: 'Categories' }, { icon: 'Users', label: 'Users' },
  { icon: 'UserCog', label: 'Agents' }, { icon: 'Briefcase', label: 'Employees' },
  { icon: 'ImageIcon', label: 'Gallery' }, { icon: 'MessageSquare', label: 'Messages', route: 'Messages', unread: true },
  { icon: 'MessagesSquare', label: 'All Conversations' }, { icon: 'Inbox', label: 'Contact Forms', badgeKey: 'contact_messages' },
  { icon: 'Gift', label: 'Loyalty' }, { icon: 'Megaphone', label: 'Promotions' },
  { icon: 'Rocket', label: 'Advertising' }, { icon: 'Crown', label: 'Subscription Tiers' },
  { icon: 'Sparkles', label: 'Spin Wheel' }, { icon: 'Palette', label: 'Storefront Themes' },
  { icon: 'CalendarDays', label: 'Events' }, { icon: 'Settings', label: 'Settings' },
  { icon: 'Database', label: 'Database Tables' },
];

const ROLE = {
  shop: { grad: [colors.p500, '#7e22ce', colors.s700], accent: colors.violet, soft: colors.primarySoft, kicker: 'SHOP WORKSPACE' },
  admin: { grad: ['#0f172a', '#334155', colors.s700], accent: colors.violet, soft: colors.primarySoft, kicker: 'ADMIN WORKSPACE' },
  agent: { grad: ['#059669', '#0d9488', colors.p500], accent: colors.seller, soft: colors.sellerSoft, kicker: 'AGENT WORKSPACE' },
};

/* fadeIn + slideUp entrance (mirrors the web shop-dashboard keyframes) */
function Rise({ delay = 0, children, style }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 500, delay, useNativeDriver: true }).start(); }, [a, delay]);
  return <Animated.View style={[{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }, style]}>{children}</Animated.View>;
}

export default function DashboardScreen({ navigation }) {
  const { user, role } = useAuth();
  const cfg = ROLE[role] || ROLE.shop;
  const [badges, setBadges] = useState({});
  const [unread, setUnread] = useState(0);
  const [stats, setStats] = useState([]);

  useEffect(() => {
    api.messages.getUnreadCount().then(({ data }) => setUnread(data?.unread_count || 0)).catch(() => {});
    if (role === 'admin') {
      api.admin.getBadgeCounts().then(({ data }) => {
        setBadges(data || {});
        const totalReq = ADMIN_REQUESTS.reduce((n, it) => n + (it.badgeKey ? (data?.[it.badgeKey] || 0) : 0), 0);
        setStats([
          { label: 'Pending requests', value: totalReq, icon: 'notifications', grad: gradients.sale },
          { label: 'Shops pending', value: data?.shop_pending || 0, icon: 'storefront', grad: gradients.primary },
          { label: 'Contact forms', value: data?.contact_messages || 0, icon: 'mail', grad: gradients.shopSale },
        ]);
      }).catch(() => {});
    } else if (role === 'agent') {
      api.agent.getDashboard().then(({ data }) => setStats([
        { label: 'Referred shops', value: data?.referred_shops_count ?? data?.shops_count ?? '—', icon: 'storefront', grad: gradients.seller },
        { label: 'Commissions', value: `$${Number(data?.total_commissions || 0).toFixed(0)}`, icon: 'cash', grad: gradients.primary },
        { label: 'Wallet', value: `$${Number(data?.wallet_balance || 0).toFixed(0)}`, icon: 'wallet', grad: gradients.violet },
      ])).catch(() => setStats([]));
    } else {
      Promise.allSettled([api.shop.getBadgeCounts(), api.shop.getProfile()]).then(([b, p]) => {
        if (b.status === 'fulfilled') setBadges(b.value.data || {});
        const prof = p.status === 'fulfilled' ? p.value.data : {};
        setStats([
          { label: 'Wallet', value: `$${Number(prof?.wallet_balance || 0).toFixed(0)}`, icon: 'wallet', grad: gradients.primary },
          { label: 'Pending orders', value: (b.status === 'fulfilled' ? b.value.data?.pending_orders : 0) || 0, icon: 'cart', grad: gradients.shopSale },
          { label: 'Status', value: prof?.subscription_status === 'active' ? 'Active' : 'Free', icon: 'ribbon', grad: gradients.seller },
        ]);
      });
    }
  }, [role]);

  const go = (item) => item.route ? navigation.navigate(item.route) : navigation.navigate('Page', { title: item.label });
  const badgeFor = (item) => (item.unread ? unread : (item.badgeKey ? (badges[item.badgeKey] || 0) : 0));

  const renderItem = (item, i) => {
    const count = badgeFor(item);
    return (
      <TouchableOpacity key={item.label + i} style={styles.item} activeOpacity={0.75} onPress={() => go(item)}>
        <View style={[styles.itemIcon, { backgroundColor: cfg.soft }]}><Ionicons name={ICON[item.icon] || 'ellipse'} size={19} color={cfg.accent} /></View>
        <Text style={styles.itemLabel}>{item.label}</Text>
        {count > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text></View>}
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  const sections = role === 'admin'
    ? [{ title: 'Requests', items: ADMIN_REQUESTS }, { title: 'Manage', items: ADMIN_MANAGE }]
    : [{ title: 'Menu', items: role === 'agent' ? AGENT_ITEMS : SHOP_ITEMS }];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: TAB_SPACE }} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={cfg.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerBell}><NotificationBell color={colors.white} onDark /></View>
        <Text style={styles.kicker}>{cfg.kicker}</Text>
        <Text style={styles.title}>Hi {user?.name || 'there'} 👋</Text>
        <Text style={styles.sub}>Your control center</Text>
      </LinearGradient>

      {/* Stat cards */}
      <View style={styles.statsRow}>
        {stats.map((s, i) => (
          <Rise key={s.label} delay={i * 120} style={{ flex: 1 }}>
            <View style={styles.stat}>
              <LinearGradient colors={s.grad} style={styles.statIcon}><Ionicons name={s.icon} size={16} color={colors.white} /></LinearGradient>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          </Rise>
        ))}
      </View>

      {sections.map((sec) => (
        <Rise key={sec.title} delay={150}>
          <Text style={styles.sectionTitle}>{sec.title}</Text>
          <View style={styles.card}>{sec.items.map(renderItem)}</View>
        </Rise>
      ))}

      <View style={styles.note}>
        <Ionicons name="information-circle" size={15} color={cfg.accent} />
        <Text style={styles.noteText}>Sidebar ported from the web. Sections open here as they're built out on mobile; full tools live in the web app.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 22, paddingBottom: 40, paddingHorizontal: 20 },
  headerBell: { position: 'absolute', top: 16, right: 14 },
  kicker: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.5 },
  title: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 26, marginTop: 6, letterSpacing: -0.5 },
  sub: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.body, fontSize: 13, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, marginTop: -24 },
  stat: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.borderLight, ...shadow.md },
  statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink },
  statLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  sectionTitle: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 8, marginHorizontal: 18 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, marginHorizontal: 14, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', ...shadow.card },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  itemIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.sale, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10 },
  note: { flexDirection: 'row', gap: 8, margin: 14, marginTop: 18, padding: 14, backgroundColor: colors.primarySoft, borderRadius: radius.md },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.text, lineHeight: 18 },
});
