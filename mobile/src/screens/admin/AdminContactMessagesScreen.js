import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, FlatList, Image, Modal, Animated, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { tapLight, notifySuccess } from '../../lib/haptics';
import { img } from '../../lib/media';
import { colors, radius, fonts, shadow } from '../../theme/theme';

const TYPE = {
  general:     { label: 'General Inquiry', short: 'General',     icon: 'help-circle', bg: colors.p100, fg: colors.p800, accent: colors.p500 },
  bug:         { label: 'Bug Report',      short: 'Bugs',        icon: 'bug',         bg: '#fee2e2', fg: '#b91c1c', accent: '#ef4444' },
  suggestion:  { label: 'Suggestion',      short: 'Suggestions', icon: 'bulb',        bg: '#fef3c7', fg: '#b45309', accent: '#f59e0b' },
  complaint:   { label: 'Complaint',       short: 'Complaints',  icon: 'warning',     bg: '#ffedd5', fg: '#c2410c', accent: '#f97316' },
  partnership: { label: 'Partnership',     short: 'Partnership', icon: 'people',      bg: '#d1fae5', fg: '#047857', accent: '#10b981' },
};
const typeCfg = (t) => TYPE[t] || TYPE.general;
const STATUS = {
  new:       { label: 'New',       icon: 'mail',            bg: '#dbeafe', fg: '#1d4ed8' },
  read:      { label: 'Read',      icon: 'eye',             bg: '#f1f5f9', fg: '#475569' },
  resolved:  { label: 'Resolved',  icon: 'checkmark-circle',bg: '#d1fae5', fg: '#047857' },
  dismissed: { label: 'Dismissed', icon: 'close-circle',    bg: '#fee2e2', fg: '#dc2626' },
};
const statusCfg = (s) => STATUS[s] || STATUS.new;

/* strike-through morph over text */
function StrikeText({ struck, style, children }) {
  const w = useRef(new Animated.Value(struck ? 1 : 0)).current;
  const [tw, setTw] = useState(0);
  useEffect(() => { Animated.timing(w, { toValue: struck ? 1 : 0, duration: 320, useNativeDriver: false }).start(); }, [struck]); // eslint-disable-line
  return (
    <View>
      <Text style={style} numberOfLines={2} onLayout={(e) => setTw(e.nativeEvent.layout.width)}>{children}</Text>
      <Animated.View style={{ position: 'absolute', top: '50%', left: 0, height: 1.5, backgroundColor: colors.textMuted, width: w.interpolate({ inputRange: [0, 1], outputRange: [0, tw] }) }} />
    </View>
  );
}

export default function AdminContactMessagesScreen() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    api.admin.getContactMessages()
      .then(({ data }) => setMessages((data || []).slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const changeStatus = async (id, status) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
    setSelected((s) => (s && s.id === id ? { ...s, status } : s));
    try { await api.admin.updateMessageStatus(id, status); notifySuccess(); } catch (_) { load(); }
  };

  const openDetail = (m) => { tapLight(); setSelected(m); if (!m.status || m.status === 'new') changeStatus(m.id, 'read'); };

  const typeCounts = useMemo(() => ({
    all: messages.length,
    general: messages.filter((m) => m.message_type === 'general').length,
    bug: messages.filter((m) => m.message_type === 'bug').length,
    suggestion: messages.filter((m) => m.message_type === 'suggestion').length,
    complaint: messages.filter((m) => m.message_type === 'complaint').length,
    partnership: messages.filter((m) => m.message_type === 'partnership').length,
  }), [messages]);
  const newCount = messages.filter((m) => !m.status || m.status === 'new').length;

  const filtered = useMemo(() => messages.filter((m) => {
    if (search) { const q = search.toLowerCase(); if (!((m.name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q) || (m.message || '').toLowerCase().includes(q))) return false; }
    if (typeFilter !== 'all' && m.message_type !== typeFilter) return false;
    if (statusFilter !== 'all' && (m.status || 'new') !== statusFilter) return false;
    return true;
  }), [messages, search, typeFilter, statusFilter]);

  const typeTabs = [{ key: 'all', label: 'All', icon: 'funnel' }, ...Object.keys(TYPE).map((k) => ({ key: k, label: TYPE[k].short, icon: TYPE[k].icon }))];
  const statuses = ['all', 'new', 'read', 'resolved', 'dismissed'];

  if (loading) return <View style={[styles.flex, styles.center]}><ActivityIndicator color={colors.violet} /><Text style={styles.loadingText}>Loading messages…</Text></View>;

  return (
    <View style={styles.flex}>
      <LinearGradient colors={['#f8fafc', '#ffffff', colors.s50]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.topRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Contact Messages</Text>
                <Text style={styles.subtitle}>Messages from the contact form</Text>
              </View>
              <View style={styles.newPill}><Text style={styles.newPillText}>{newCount} New</Text></View>
            </View>

            {/* type tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {typeTabs.map((t) => {
                const active = typeFilter === t.key;
                return (
                  <TouchableOpacity key={t.key} onPress={() => setTypeFilter(t.key)} activeOpacity={0.85} style={[styles.tab, active && styles.tabActive]}>
                    <Ionicons name={t.icon} size={12} color={active ? colors.white : colors.textSecondary} />
                    <Text style={[styles.tabText, active && { color: colors.white }]}>{t.label}</Text>
                    <View style={[styles.tabCount, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}><Text style={[styles.tabCountText, active && { color: colors.white }]}>{typeCounts[t.key] || 0}</Text></View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* search */}
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput style={styles.searchInput} placeholder="Search name, email, message…" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
            </View>

            {/* status chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
              {statuses.map((s) => {
                const active = statusFilter === s;
                return (
                  <TouchableOpacity key={s} onPress={() => setStatusFilter(s)} style={[styles.statusChipBtn, active && styles.statusChipBtnActive]}>
                    <Text style={[styles.statusChipBtnText, active && { color: colors.violet, fontFamily: fonts.bold }]}>{s === 'all' ? 'All Statuses' : statusCfg(s).label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.countLine}>
              <Text style={styles.countText}>Showing {filtered.length} of {messages.length}</Text>
              {(search || typeFilter !== 'all' || statusFilter !== 'all') ? (
                <TouchableOpacity onPress={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); }}><Text style={styles.clearText}>Clear Filters</Text></TouchableOpacity>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="chatbox-ellipses-outline" size={40} color={colors.textMuted} /><Text style={styles.emptyText}>No contact messages found</Text></View>}
        renderItem={({ item }) => {
          const tc = typeCfg(item.message_type);
          const sc = statusCfg(item.status || 'new');
          const isNew = !item.status || item.status === 'new';
          const resolved = item.status === 'resolved';
          return (
            <TouchableOpacity activeOpacity={0.85} onPress={() => openDetail(item)} style={[styles.card, { borderLeftColor: tc.accent }, isNew && styles.cardNew]}>
              <View style={styles.cardTop}>
                <View style={[styles.typeChip, { backgroundColor: tc.bg }]}><Ionicons name={tc.icon} size={12} color={tc.fg} /><Text style={[styles.typeChipText, { color: tc.fg }]}>{tc.label}</Text></View>
                <View style={[styles.statusPill, { backgroundColor: sc.bg }]}><Ionicons name={sc.icon} size={11} color={sc.fg} /><Text style={[styles.statusPillText, { color: sc.fg }]}>{sc.label}</Text></View>
              </View>
              <View style={styles.cardBody}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.sender} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
                  <StrikeText struck={resolved} style={[styles.preview, resolved && { color: colors.textMuted }]}>{item.message}</StrikeText>
                </View>
                {item.photo ? <Image source={{ uri: img(item.photo) }} style={styles.thumb} /> : null}
              </View>
              <View style={styles.cardFoot}>
                <View style={styles.dateRow}><Ionicons name="time-outline" size={12} color={colors.textMuted} /><Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text></View>
                {item.phone_number ? <Text style={styles.phone}>{item.phone_number}</Text> : null}
              </View>
            </TouchableOpacity>
          );
        }}
      />
      <DetailModal message={selected} onClose={() => setSelected(null)} onStatus={changeStatus} />
    </View>
  );
}

function DetailModal({ message, onClose, onStatus }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  if (!message) return null;
  const tc = typeCfg(message.message_type);
  const mail = () => Linking.openURL(`mailto:${message.email}?subject=${encodeURIComponent('Re: ' + tc.label + ' - OpenMarketlb')}`).catch(() => {});
  return (
    <Modal visible={!!message} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
        <View style={styles.grabber} />
        <View style={styles.sheetHead}>
          <Ionicons name="chatbox-ellipses" size={18} color={colors.violet} />
          <Text style={styles.sheetTitle}>Message Details</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}><Ionicons name="close" size={20} color={colors.textSecondary} /></TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
          <View style={styles.detailTop}>
            <View style={[styles.typeChip, { backgroundColor: tc.bg }]}><Ionicons name={tc.icon} size={13} color={tc.fg} /><Text style={[styles.typeChipText, { color: tc.fg }]}>{tc.label}</Text></View>
            <Text style={styles.detailDate}>{new Date(message.created_at).toLocaleString()}</Text>
          </View>
          <View style={[styles.infoBox, { borderColor: tc.bg }]}>
            <View style={styles.infoGrid}>
              <View style={styles.infoCell}><Text style={styles.infoLabel}>Name</Text><Text style={styles.infoValue}>{message.name}</Text></View>
              <View style={styles.infoCell}><Text style={styles.infoLabel}>Email</Text><TouchableOpacity onPress={mail}><Text style={styles.infoLink}>{message.email}</Text></TouchableOpacity></View>
              {message.phone_number ? <View style={styles.infoCell}><Text style={styles.infoLabel}>Phone</Text><Text style={styles.infoValue}>{message.phone_number}</Text></View> : null}
            </View>
          </View>
          <Text style={styles.infoLabel}>Message</Text>
          <View style={styles.msgBox}><Text style={styles.msgText}>{message.message}</Text></View>
          {message.photo ? (
            <>
              <Text style={[styles.infoLabel, { marginTop: 12 }]}>Attached Photo</Text>
              <Image source={{ uri: img(message.photo) }} style={styles.detailPhoto} resizeMode="contain" />
            </>
          ) : null}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actBtn, { borderColor: '#a7f3d0' }]} onPress={() => { onStatus(message.id, 'resolved'); onClose(); }}>
              <Ionicons name="checkmark-circle" size={15} color={colors.seller} /><Text style={[styles.actText, { color: colors.seller }]}>Resolve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actBtn, { borderColor: '#fecaca' }]} onPress={() => { onStatus(message.id, 'dismissed'); onClose(); }}>
              <Ionicons name="close-circle" size={15} color={colors.red} /><Text style={[styles.actText, { color: colors.red }]}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actBtn, { borderColor: colors.primarySoft }]} onPress={mail}>
              <Ionicons name="mail" size={15} color={colors.violet} /><Text style={[styles.actText, { color: colors.violet }]}>Reply</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, marginBottom: 10 },
  title: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.ink, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  newPill: { backgroundColor: '#dbeafe', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  newPillText: { fontFamily: fonts.bold, fontSize: 12, color: '#1d4ed8' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight },
  tabActive: { backgroundColor: colors.violet, borderColor: colors.violet },
  tabText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  tabCount: { backgroundColor: colors.bgAlt, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  tabCountText: { fontFamily: fonts.bold, fontSize: 10, color: colors.textSecondary },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 14, height: 44, marginTop: 10, marginBottom: 8 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink, paddingVertical: 0 },
  statusChipBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight },
  statusChipBtnActive: { borderColor: colors.violet, backgroundColor: colors.primarySoft },
  statusChipBtnText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  countLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  countText: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  clearText: { fontFamily: fonts.bold, fontSize: 11, color: colors.violet },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, borderLeftWidth: 4, padding: 12, marginBottom: 10, ...shadow.card },
  cardNew: { backgroundColor: '#f5f9ff', shadowColor: '#3b82f6', shadowOpacity: 0.18, shadowRadius: 10, elevation: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  typeChipText: { fontFamily: fonts.bold, fontSize: 11 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  statusPillText: { fontFamily: fonts.bold, fontSize: 10 },
  cardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sender: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  email: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  preview: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.bgAlt },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  phone: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  // detail modal
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sheetTitle: { flex: 1, fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink },
  closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  detailTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  detailDate: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  infoBox: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, borderWidth: 1, padding: 14, marginBottom: 14 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  infoCell: { minWidth: '42%' },
  infoLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginBottom: 3 },
  infoValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  infoLink: { fontFamily: fonts.bold, fontSize: 14, color: colors.violet },
  msgBox: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.lg, padding: 14, marginTop: 4 },
  msgText: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  detailPhoto: { width: '100%', height: 220, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 18 },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 44, borderRadius: radius.md, borderWidth: 1 },
  actText: { fontFamily: fonts.bold, fontSize: 12 },
});
