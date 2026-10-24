import React, { useEffect, useState, useCallback } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager, Modal } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { AdminScreen, AdminHeroCard, Shimmer } from '../../components/admin/AdminKit';
import { colors, admin, radius, fonts, shadow } from '../../theme/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true);

export default function AdminCategoriesScreen() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState({});
  const [formOpen, setFormOpen] = useState(false);
  const [parentId, setParentId] = useState(null);

  const load = useCallback(() => {
    api.categories.getTree(false).then(({ data }) => setTree(Array.isArray(data) ? data : data?.categories || [])).catch(() => setTree([])).finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (id) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setOpen((o) => ({ ...o, [id]: !o[id] })); };
  const del = (c) => Alert.alert('Delete category', `Remove "${c.name}"?`, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.categories.delete(c.id); load(); } catch (_) {} } }]);
  const addUnder = (pid) => { setParentId(pid); setFormOpen(true); };

  const Node = (c, level) => {
    const kids = c.children || c.subcategories || [];
    const isOpen = open[c.id];
    return (
      <View key={c.id}>
        <View style={[styles.node, { marginLeft: level * 16 }, level > 0 && styles.subNode]}>
          {kids.length > 0 ? (
            <TouchableOpacity onPress={() => toggle(c.id)} style={styles.chev}><Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.violet} /></TouchableOpacity>
          ) : <View style={styles.chev} />}
          {c.image_url ? <Image source={{ uri: img(c.image_url) }} style={styles.nodeImg} /> : <View style={[styles.nodeImg, styles.nodeImgFallback]}><Ionicons name="pricetag" size={14} color={colors.violet} /></View>}
          <Text style={[styles.nodeName, level > 0 && { fontSize: 13, color: colors.textSecondary }]} numberOfLines={1}>{c.name}</Text>
          {kids.length > 0 && <View style={styles.countChip}><Text style={styles.countText}>{kids.length}</Text></View>}
          {level < 2 && <TouchableOpacity onPress={() => addUnder(c.id)} style={styles.addSub}><Ionicons name="add" size={16} color={colors.violet} /></TouchableOpacity>}
          <TouchableOpacity onPress={() => del(c)} style={styles.nodeDel}><Ionicons name="trash-outline" size={15} color={colors.textMuted} /></TouchableOpacity>
        </View>
        {isOpen && kids.map((k) => Node(k, level + 1))}
      </View>
    );
  };

  if (loading) return <AdminScreen>{[0, 1, 2, 3, 4].map((i) => <Shimmer key={i} height={52} radius={radius.md} style={{ marginBottom: 8 }} />)}</AdminScreen>;

  return (
    <View style={{ flex: 1 }}>
      <AdminScreen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} contentStyle={{ paddingBottom: 90 }}>
        <AdminHeroCard title="Categories" subtitle={`${tree.length} top-level categories`} icon="file-tray-stacked" />
        <View style={{ marginTop: 6 }}>{tree.map((c) => Node(c, 0))}</View>
        {tree.length === 0 && <Text style={styles.empty}>No categories yet.</Text>}
      </AdminScreen>
      <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={() => addUnder(null)}>
        <LinearGradient colors={admin.heroTile} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}><Ionicons name="add" size={26} color={colors.white} /></LinearGradient>
      </TouchableOpacity>
      <CategoryForm open={formOpen} parentId={parentId} onClose={() => setFormOpen(false)} onDone={load} />
    </View>
  );
}

function CategoryForm({ open, parentId, onClose, onDone }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { await api.categories.create({ name: name.trim(), parent_id: parentId || null, is_active: true }); setName(''); onClose(); onDone(); }
    catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Could not create category.'); }
    finally { setBusy(false); }
  };
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>{parentId ? 'Add subcategory' : 'Add category'}</Text>
        <TextInput style={styles.input} placeholder="Category name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} autoFocus />
        <TouchableOpacity activeOpacity={0.9} onPress={submit} disabled={busy}>
          <LinearGradient colors={admin.heroTile} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}><Text style={styles.submitText}>{busy ? 'Saving…' : 'Create'}</Text></LinearGradient>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  node: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, padding: 9, marginBottom: 6, ...shadow.card },
  subNode: { borderLeftWidth: 2, borderLeftColor: colors.primarySoft },
  chev: { width: 22, alignItems: 'center' },
  nodeImg: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  nodeImgFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  nodeName: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  countChip: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1 },
  countText: { fontFamily: fonts.bold, fontSize: 10, color: colors.violet700 },
  addSub: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  nodeDel: { padding: 4 },
  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56 },
  fabInner: { flex: 1, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...shadow.violetGlow },
  empty: { textAlign: 'center', fontFamily: fonts.medium, color: colors.textMuted, marginTop: 20 },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink, marginBottom: 14 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 48, fontFamily: fonts.body, fontSize: 15, color: colors.ink, marginBottom: 12 },
  submit: { height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
});
