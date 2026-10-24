import React, { useEffect, useState, useCallback } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, LayoutAnimation, Platform, UIManager, Modal, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { tapLight } from '../../lib/haptics';
import { AdminScreen, CountUp, Shimmer } from '../../components/admin/AdminKit';
import { colors, radius, fonts, shadow } from '../../theme/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true);

const typeColor = (t) => {
  if (!t) return { bg: '#f1f5f9', fg: '#475569' };
  if (t.includes('string')) return { bg: '#eff6ff', fg: '#2563eb' };
  if (t.includes('integer') || t.includes('float')) return { bg: '#ecfdf5', fg: '#059669' };
  if (t.includes('boolean')) return { bg: '#fffbeb', fg: '#b45309' };
  if (t.includes('array')) return { bg: '#fff0f3', fg: '#f06a92' };
  if (t.includes('object')) return { bg: colors.p50, fg: colors.p500 };
  return { bg: '#f1f5f9', fg: '#94a3b8' };
};
const cell = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'object') { const s = JSON.stringify(v); return s.length > 60 ? s.slice(0, 60) + '…' : s; }
  const s = String(v); return s.length > 60 ? s.slice(0, 60) + '…' : s;
};

export default function AdminDatabaseScreen() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [openColl, setOpenColl] = useState(null);

  const load = useCallback(() => { setLoading(true); api.admin.getDatabaseOverview().then(({ data }) => setOverview(data)).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); }); }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (name) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); tapLight(); setExpanded((e) => ({ ...e, [name]: !e[name] })); };
  const collections = (overview?.collections || []).filter((c) => !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminScreen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      {/* dark matrix hero */}
      <LinearGradient colors={['#0f172a', '#312e81', colors.p925]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={[styles.blob, { top: -30, right: -20 }]} />
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}><Ionicons name="server" size={22} color={colors.white} /></View>
          <View style={{ flex: 1 }}><Text style={styles.heroTitle}>Database Tables</Text><Text style={styles.heroSub}>{overview?.database || '…'} · every collection</Text></View>
        </View>
        <View style={styles.chipRow}>
          <View style={styles.chip}><Text style={styles.chipLabel}>TABLES</Text><CountUp value={overview?.total_collections || 0} style={styles.chipVal} /></View>
          <View style={styles.chip}><Text style={styles.chipLabel}>RECORDS</Text><CountUp value={overview?.total_documents || 0} style={styles.chipVal} /></View>
          <View style={styles.chip}><Text style={styles.chipLabel}>SECURITY</Text><Text style={styles.chipSecure}>Secrets hidden</Text></View>
        </View>
      </LinearGradient>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={15} color={colors.textMuted} />
        <TextInput style={styles.searchInput} placeholder="Search tables…" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
      </View>

      {loading ? [0, 1, 2].map((i) => <Shimmer key={i} height={90} radius={radius.lg} style={{ marginBottom: 10 }} />)
        : collections.length === 0 ? <View style={styles.empty}><Ionicons name="server-outline" size={38} color={colors.textMuted} /><Text style={styles.emptyText}>No tables match "{search}"</Text></View>
        : collections.map((coll) => {
          const open = !!expanded[coll.name];
          return (
            <View key={coll.name} style={styles.card}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => toggle(coll.name)} style={styles.cardHead}>
                <LinearGradient colors={[colors.s600, colors.p450]} style={styles.tableIcon}><Ionicons name="grid" size={15} color={colors.white} /></LinearGradient>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.tableName} numberOfLines={1}>{coll.name}</Text>
                  {coll.description ? <Text style={styles.tableDesc} numberOfLines={1}>{coll.description}</Text> : <Text style={styles.tableDesc}>{coll.field_count} columns</Text>}
                </View>
                <View style={styles.countBadge}><Ionicons name="ellipsis-horizontal" size={10} color={colors.s700} /><CountUp value={coll.count || 0} style={styles.countText} /></View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
              </TouchableOpacity>
              {open ? (
                <View style={styles.schema}>
                  {coll.fields.length === 0 ? <Text style={styles.emptySchema}>Empty table — no columns yet</Text> : coll.fields.map((f) => {
                    const tc = typeColor(f.type);
                    return (
                      <View key={f.name} style={styles.fieldRow}>
                        <Text style={[styles.fieldName, f.name === 'id' && { color: colors.ink, fontFamily: fonts.bold }]} numberOfLines={1}>{f.name}{f.sensitive ? ' 🔑' : ''}</Text>
                        <View style={[styles.typeChip, { backgroundColor: tc.bg }]}><Text style={[styles.typeText, { color: tc.fg }]}>{f.type}</Text></View>
                      </View>
                    );
                  })}
                  <TouchableOpacity onPress={() => setOpenColl(coll.name)} disabled={coll.count === 0} style={[styles.viewBtn, coll.count === 0 && { opacity: 0.5 }]}>
                    <Ionicons name="eye-outline" size={14} color={colors.violet} />
                    <Text style={styles.viewText}>{coll.count === 0 ? 'No records' : `View ${coll.count} records`}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })}

      <RecordsModal name={openColl} onClose={() => setOpenColl(null)} />
    </AdminScreen>
  );
}

function RecordsModal({ name, onClose }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const loadRows = useCallback((p, q) => { setLoading(true); api.admin.getDatabaseCollection(name, p, 25, q).then(({ data }) => { setRows(data); setPage(p); }).catch(() => {}).finally(() => setLoading(false)); }, [name]);
  useEffect(() => { if (name) { setSearch(''); setRows(null); loadRows(1, ''); } }, [name, loadRows]);

  if (!name) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.rmBackdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.rm, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
        <View style={styles.grabber} />
        <View style={styles.rmHead}>
          <Ionicons name="grid" size={16} color={colors.s600} />
          <Text style={styles.rmTitle}>{name}</Text>
          {rows ? <View style={styles.rmCount}><Text style={styles.rmCountText}>{rows.total} records</Text></View> : null}
          <TouchableOpacity onPress={onClose} style={styles.rmClose}><Ionicons name="close" size={20} color={colors.textSecondary} /></TouchableOpacity>
        </View>
        <View style={styles.rmSearch}>
          <Ionicons name="search" size={14} color={colors.textMuted} />
          <TextInput style={styles.rmSearchInput} placeholder="Search records…" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} onSubmitEditing={() => loadRows(1, search)} returnKeyType="search" />
          {rows ? (
            <View style={styles.pager}>
              <TouchableOpacity disabled={page <= 1 || loading} onPress={() => loadRows(page - 1, search)} style={styles.pagerBtn}><Ionicons name="chevron-back" size={16} color={page <= 1 ? colors.textMuted : colors.violet} /></TouchableOpacity>
              <Text style={styles.pagerText}>{rows.page}/{rows.total_pages}</Text>
              <TouchableOpacity disabled={page >= rows.total_pages || loading} onPress={() => loadRows(page + 1, search)} style={styles.pagerBtn}><Ionicons name="chevron-forward" size={16} color={page >= rows.total_pages ? colors.textMuted : colors.violet} /></TouchableOpacity>
            </View>
          ) : null}
        </View>
        {loading ? <View style={styles.rmLoading}><ActivityIndicator color={colors.violet} /></View>
          : !rows || rows.documents.length === 0 ? <Text style={styles.rmEmpty}>No records found</Text>
          : (
            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  <View style={styles.tRow}>
                    <Text style={[styles.tHead, styles.tNum]}>#</Text>
                    {rows.columns.map((c) => <Text key={c} style={[styles.tHead, styles.tCell, c === 'id' && { color: colors.s700 }]}>{c}</Text>)}
                  </View>
                  {rows.documents.map((doc, idx) => (
                    <View key={idx} style={[styles.tRow, idx % 2 ? { backgroundColor: colors.surfaceMuted } : null]}>
                      <Text style={[styles.tNum, styles.tNumVal]}>{(rows.page - 1) * rows.limit + idx + 1}</Text>
                      {rows.columns.map((c) => <Text key={c} style={[styles.tCell, styles.tCellVal]} numberOfLines={1}>{cell(doc[c])}</Text>)}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </ScrollView>
          )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xxl, padding: 20, overflow: 'hidden', marginBottom: 14, ...shadow.card },
  blob: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.05)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 21, letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  chip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.md, padding: 12 },
  chipLabel: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.bold, fontSize: 8, letterSpacing: 0.5 },
  chipVal: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 24, marginTop: 4, letterSpacing: -0.5 },
  chipSecure: { color: '#6ee7b7', fontFamily: fonts.bold, fontSize: 11, marginTop: 8 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 12, height: 44, marginBottom: 12 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink, paddingVertical: 0 },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', marginBottom: 10, ...shadow.card },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: colors.surfaceMuted },
  tableIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tableName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  tableDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  countBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.s100, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  countText: { fontFamily: fonts.bold, fontSize: 11, color: colors.s700 },
  schema: { padding: 12, borderTopWidth: 1, borderTopColor: colors.borderLight },
  emptySchema: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 10 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 5 },
  fieldName: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  typeChip: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  typeText: { fontFamily: fonts.bold, fontSize: 9 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 10, marginTop: 10 },
  viewText: { fontFamily: fonts.bold, fontSize: 12, color: colors.violet },
  rmBackdrop: { flex: 1, backgroundColor: colors.overlay },
  rm: { maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 },
  rmHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  rmTitle: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink },
  rmCount: { backgroundColor: colors.s100, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  rmCountText: { fontFamily: fonts.bold, fontSize: 10, color: colors.s700 },
  rmClose: { marginLeft: 'auto', width: 32, height: 32, borderRadius: 10, backgroundColor: colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  rmSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, height: 42, marginBottom: 12 },
  rmSearchInput: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.ink, paddingVertical: 0 },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pagerBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  pagerText: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, minWidth: 34, textAlign: 'center' },
  rmLoading: { paddingVertical: 40, alignItems: 'center' },
  rmEmpty: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 40 },
  tRow: { flexDirection: 'row' },
  tHead: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, backgroundColor: colors.surfaceMuted, paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  tNum: { width: 40, textAlign: 'center' },
  tNumVal: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, paddingVertical: 8 },
  tCell: { width: 150 },
  tCellVal: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, paddingVertical: 8, paddingHorizontal: 10 },
});
