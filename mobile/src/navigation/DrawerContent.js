import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { buildMenu } from './menu';
import { colors, gradients, radius, font, shadow } from '../theme/theme';
import { Alert } from '../components/AppDialog';
import { isDark, setScheme, reloadApp } from '../lib/appearance';

export default function DrawerContent(props) {
  const { navigation } = props;
  const { user, isLoggedIn, isStaff, role, logout } = useAuth();
  const sections = buildMenu({ isLoggedIn, isStaff, role });
  const dark = isDark();

  const go = (item) => {
    navigation.closeDrawer();
    if (item.tab) navigation.navigate('Tabs', { screen: item.tab, params: item.params });
    else if (item.route) navigation.navigate(item.route, item.params);
  };

  const onToggleTheme = async () => {
    const next = dark ? 'light' : 'dark';
    await setScheme(next);
    Alert.alert(`Switch to ${next} mode`, 'The app will reload to apply the new appearance.', [
      { text: 'Later', style: 'cancel' },
      { text: 'Reload now', onPress: () => reloadApp() },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Brand / user header */}
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logo}><Ionicons name="storefront" size={22} color={colors.white} /></View>
          <Text style={styles.brand}>OpenMarket</Text>
        </View>

        {isLoggedIn ? (
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(user?.name || 'U').slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>{user?.name || 'Welcome'}</Text>
              <View style={styles.roleChip}><Text style={styles.roleChipText}>{role}</Text></View>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.signInBtn} onPress={() => { navigation.closeDrawer(); navigation.navigate('Auth'); }} activeOpacity={0.85}>
            <Ionicons name="log-in" size={18} color={colors.primaryDark} />
            <Text style={styles.signInText}>Sign in / Register</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 8 }}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item) => (
              <TouchableOpacity key={item.label} style={styles.item} activeOpacity={0.7} onPress={() => go(item)}>
                <View style={styles.itemIcon}>
                  <Ionicons name={item.icon} size={19} color={colors.primaryDark} />
                </View>
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Dark mode toggle */}
        <TouchableOpacity style={styles.themeToggle} activeOpacity={0.85} onPress={onToggleTheme} testID="theme-toggle">
          <View style={styles.itemIcon}><Ionicons name={dark ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.violet} /></View>
          <Text style={styles.themeText}>{dark ? 'Light mode' : 'Dark mode'}</Text>
          <View style={[styles.switchTrack, dark && styles.switchTrackOn]}>
            <View style={[styles.switchThumb, dark && styles.switchThumbOn]} />
          </View>
        </TouchableOpacity>

        {isLoggedIn && (
          <TouchableOpacity style={styles.logout} activeOpacity={0.8} onPress={() => { logout(); navigation.closeDrawer(); }}>
            <Ionicons name="log-out-outline" size={19} color={colors.rose} />
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.version}>OpenMarket • v1.0.0</Text>
      </DrawerContentScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 54, paddingBottom: 18, paddingHorizontal: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  logo: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  brand: { color: colors.white, fontSize: font.h3, fontWeight: font.weightBold, letterSpacing: 0.3 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarText: { color: colors.white, fontWeight: font.weightBold, fontSize: 18 },
  userName: { color: colors.white, fontWeight: font.weightBold, fontSize: font.body },
  roleChip: {
    alignSelf: 'flex-start', marginTop: 4, backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill,
  },
  roleChipText: { color: colors.white, fontSize: font.tiny, fontWeight: font.weightSemi, textTransform: 'capitalize' },
  signInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.white, paddingVertical: 12, borderRadius: radius.pill, ...shadow.sm,
  },
  signInText: { color: colors.primaryDark, fontWeight: font.weightBold, fontSize: font.body },
  section: { paddingHorizontal: 12, marginBottom: 6 },
  sectionTitle: {
    fontSize: font.tiny, fontWeight: font.weightBold, color: colors.textFaint,
    textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 8, marginTop: 12, marginBottom: 4,
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, paddingHorizontal: 10, borderRadius: radius.md,
  },
  itemIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  itemLabel: { flex: 1, fontSize: font.body, color: colors.text, fontWeight: font.weightMed },
  logout: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 16,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.roseSoft,
  },
  logoutText: { color: colors.rose, fontWeight: font.weightBold, fontSize: font.body },
  themeToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 16,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.surfaceMuted,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  themeText: { flex: 1, fontSize: font.body, color: colors.text, fontWeight: font.weightMed },
  switchTrack: { width: 42, height: 24, borderRadius: 12, backgroundColor: colors.border, padding: 3, justifyContent: 'center' },
  switchTrackOn: { backgroundColor: colors.violet },
  switchThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.white, ...shadow.card },
  switchThumbOn: { alignSelf: 'flex-end' },
  version: { textAlign: 'center', color: colors.textFaint, fontSize: font.tiny, marginTop: 22, marginBottom: 30 },
});
