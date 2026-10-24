import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { tapLight } from '../lib/haptics';
import { notificationTarget, notifStyle } from '../lib/notificationRoutes';
import { colors, gradients, radius, fonts, shadow } from '../theme/theme';

const timeAgo = (ts) => {
  if (!ts) return '';
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60) return 'now'; if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  if (d < 604800) return `${Math.floor(d / 86400)}d`;
  return `${Math.floor(d / 604800)}w`;
};

export default function NotificationBell({ navigation: navProp, color = colors.ink, onDark = false }) {
  const insets = useSafeAreaInsets();
  const fallbackNav = useNavigation();
  const navigation = navProp || fallbackNav;
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);

  const load = useCallback(() => {
    api.notifications.getAll().then(({ data }) => setItems(Array.isArray(data) ? data : data?.notifications || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 45000); return () => clearInterval(t); }, [load]);

  const unread = items.filter((n) => !n.is_read).length;

  const markAllRead = () => {
    if (!unread) return;
    tapLight();
    api.notifications.markAllRead().then(() => setItems((p) => p.map((n) => ({ ...n, is_read: true })))).catch(() => {});
  };

  // Tap a notification → mark just this one read, close, and route to its page.
  const onTapItem = (item) => {
    tapLight();
    if (!item.is_read) {
      setItems((p) => p.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      api.notifications.markRead(item.id).catch(() => {});
    }
    setOpen(false);
    const target = notificationTarget(role, item);
    if (target && navigation?.navigate) {
      // defer so the sheet finishes dismissing before the screen transition
      setTimeout(() => { try { navigation.navigate(target.screen, target.params); } catch (_) {} }, 260);
    }
  };

  return (
    <>
      <TouchableOpacity onPress={() => { tapLight(); setOpen(true); }} style={[styles.btn, onDark && styles.btnDark]} activeOpacity={0.75} accessibilityLabel="Notifications">
        <Ionicons name={onDark ? 'notifications' : 'notifications-outline'} size={onDark ? 17 : 23} color={color} />
        {unread > 0 && <View style={[styles.dot, onDark && styles.dotDark]}><Text style={styles.dotText}>{unread > 9 ? '9+' : unread}</Text></View>}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 6 }]}>
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
              <View style={styles.hIcon}><Ionicons name="notifications" size={17} color={colors.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.hTitle}>Notifications</Text>
                <Text style={styles.hSub}>{unread > 0 ? `${unread} unread` : 'All caught up'}</Text>
              </View>
              {unread > 0 && (
                <TouchableOpacity onPress={markAllRead} style={styles.hAction} activeOpacity={0.8}>
                  <Ionicons name="checkmark-done" size={14} color={colors.white} />
                  <Text style={styles.hActionText}>Mark all</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.hClose}><Ionicons name="close" size={19} color={colors.white} /></TouchableOpacity>
            </LinearGradient>
            <FlatList
              data={items}
              keyExtractor={(n, i) => n.id || String(i)}
              contentContainerStyle={{ padding: 12, paddingBottom: 4 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyRing}><Ionicons name="notifications-off-outline" size={30} color={colors.textMuted} /></View><Text style={styles.emptyText}>No notifications yet</Text><Text style={styles.emptySub}>Updates about orders, wallet and more show up here.</Text></View>}
              renderItem={({ item, index }) => {
                const st = notifStyle(item.type);
                const routable = !!notificationTarget(role, item);
                return (
                  <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(260)}>
                    <TouchableOpacity style={[styles.item, !item.is_read && styles.itemUnread]} activeOpacity={0.85} onPress={() => onTapItem(item)}>
                      {!item.is_read && <View style={[styles.accent, { backgroundColor: st.tint }]} />}
                      <View style={[styles.itemIcon, { backgroundColor: st.soft }]}><Ionicons name={st.icon} size={18} color={st.tint} /></View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.itemTop}>
                          <Text style={[styles.itemTitle, !item.is_read && { color: colors.ink }]} numberOfLines={1}>{item.title || 'Notification'}</Text>
                          <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
                        </View>
                        <Text style={styles.itemMsg} numberOfLines={2}>{item.message}</Text>
                      </View>
                      {routable && <Ionicons name="chevron-forward" size={15} color={colors.textMuted} style={{ marginLeft: 2 }} />}
                    </TouchableOpacity>
                  </Animated.View>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgAlt },
  btnDark: { width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)' },
  dot: { position: 'absolute', top: 5, right: 6, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.surface },
  dotDark: { top: 4, right: 4, borderColor: 'rgba(79,70,229,0.9)' },
  dotText: { color: colors.white, fontSize: 9, fontFamily: fonts.bold },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { maxHeight: '78%', backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  hIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  hTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 16 },
  hSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.medium, fontSize: 11.5, marginTop: 1 },
  hAction: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill },
  hActionText: { color: colors.white, fontFamily: fonts.bold, fontSize: 11.5 },
  hClose: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 46, gap: 8 },
  emptyRing: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.bgAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  emptySub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 40 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, paddingVertical: 12, paddingHorizontal: 13, borderRadius: radius.lg, marginBottom: 8, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' },
  itemUnread: { backgroundColor: colors.surface, borderColor: colors.border, ...shadow.card },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3.5 },
  itemIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
  itemTime: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginLeft: 8 },
  itemMsg: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
});
