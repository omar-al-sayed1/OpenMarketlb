import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Animated, Modal, Dimensions } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { notifySuccess, tapLight } from '../../lib/haptics';
import { img } from '../../lib/media';
import { AdminScreen, Shimmer } from '../../components/admin/AdminKit';
import { colors, radius, fonts, shadow } from '../../theme/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const STATUS = {
  approved: { icon: 'checkmark-circle', label: 'Approved', fg: '#047857', bg: '#d1fae5' },
  suspended: { icon: 'ban', label: 'Suspended', fg: '#b91c1c', bg: '#fee2e2' },
  pending: { icon: 'time', label: 'Pending', fg: '#b45309', bg: '#fef3c7' },
};
const sb = (s) => STATUS[(s || 'pending').toLowerCase()] || STATUS.pending;

function PhotoTile({ photo, size, onPress, deleting }) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => { if (deleting) Animated.timing(a, { toValue: 0, duration: 320, useNativeDriver: true }).start(); }, [deleting]); // eslint-disable-line
  const meta = sb(photo.status);
  return (
    <Animated.View style={{ opacity: a, transform: [{ scale: a }] }}>
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.tile, { width: size, height: size }]}>
        <Image source={{ uri: img(photo.url) }} style={styles.tileImg} />
        <View style={[styles.tileBadge, { backgroundColor: meta.bg }]}><Ionicons name={meta.icon} size={9} color={meta.fg} /></View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AdminGalleryScreen() {
  const [data, setData] = useState({ shops: [], total_shops: 0, total_photos: 0, approved_count: 0, pending_count: 0, suspended_count: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [photoStatus, setPhotoStatus] = useState('all');
  const [shopStatus, setShopStatus] = useState('all');
  const [lightbox, setLightbox] = useState(null); // { shop, idx }
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(() => {
    api.admin.getAllGallery().then(({ data }) => setData(data)).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (shopId, photo, status) => {
    tapLight();
    setData((d) => ({ ...d, shops: d.shops.map((s) => s.shop_id === shopId ? { ...s, gallery: s.gallery.map((p) => p.id === photo.id ? { ...p, status } : p) } : s) }));
    setLightbox((lb) => (lb && lb.photo?.id === photo.id ? { ...lb, photo: { ...lb.photo, status } } : lb));
    try { await api.admin.setGalleryPhotoStatus(shopId, photo.id, status); notifySuccess(); } catch (_) { load(); }
  };
  const del = (shopId, photo) => Alert.alert('Delete photo', 'Remove this photo from the shop\'s gallery? This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { setDeletingId(photo.id); setLightbox(null); setTimeout(async () => { try { await api.admin.deleteShopGalleryPhoto(shopId, photo.id); } catch (_) {} setDeletingId(null); load(); }, 340); } },
  ]);

  const filtered = useMemo(() => (data.shops || [])
    .map((s) => { let g = s.gallery; if (photoStatus !== 'all') g = (s.gallery || []).filter((p) => (p.status || 'pending') === photoStatus); return { ...s, gallery: g, photo_count: g.length }; })
    .filter((s) => { if (shopStatus !== 'all' && s.shop_status !== shopStatus) return false; if (photoStatus !== 'all' && s.photo_count === 0) return false; if (!search.trim()) return true; return (s.shop_name || '').toLowerCase().includes(search.toLowerCase()); }),
    [data, search, photoStatus, shopStatus]);

  const tileSize = (SCREEN_W - 28 - 28 - 16) / 3; // screen - screen padding - card padding - gaps

  return (
    <AdminScreen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      {/* hero */}
      <LinearGradient colors={['#db2777', '#e11d48', '#f06a92']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={[styles.blob, { top: -20, right: -20 }]} />
        <View style={styles.heroTag}><Ionicons name="images" size={12} color={colors.white} /><Text style={styles.heroTagText}>Gallery Moderation</Text></View>
        <Text style={styles.heroTitle}>All Shops Gallery</Text>
        <Text style={styles.heroSub}>{data.total_shops} shops · {data.total_photos} photos</Text>
        <View style={styles.heroChips}>
          <View style={styles.hChip}><Ionicons name="checkmark-circle" size={11} color={colors.white} /><Text style={styles.hChipText}>{data.approved_count || 0} approved</Text></View>
          <View style={styles.hChip}><Ionicons name="time" size={11} color={colors.white} /><Text style={styles.hChipText}>{data.pending_count || 0} pending</Text></View>
          <View style={styles.hChip}><Ionicons name="ban" size={11} color={colors.white} /><Text style={styles.hChipText}>{data.suspended_count || 0} suspended</Text></View>
        </View>
      </LinearGradient>

      {/* filters */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={15} color={colors.textMuted} />
        <TextInput style={styles.searchInput} placeholder="Search shops by name" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
      </View>
      <Text style={styles.filterLabel}>PHOTO STATUS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {['all', 'approved', 'pending', 'suspended'].map((k) => {
          const active = photoStatus === k; const m = k === 'all' ? null : sb(k);
          return <TouchableOpacity key={k} onPress={() => setPhotoStatus(k)} style={[styles.fChip, active && { backgroundColor: m ? m.fg : '#334155' }]}><Text style={[styles.fChipText, active && { color: colors.white }]}>{k[0].toUpperCase() + k.slice(1)}</Text></TouchableOpacity>;
        })}
      </ScrollView>
      <Text style={styles.filterLabel}>SHOP STATUS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {['all', 'approved', 'pending', 'suspended'].map((k) => {
          const active = shopStatus === k;
          return <TouchableOpacity key={k} onPress={() => setShopStatus(k)} style={[styles.fChip, active && { backgroundColor: '#db2777' }]}><Text style={[styles.fChipText, active && { color: colors.white }]}>{k[0].toUpperCase() + k.slice(1)}</Text></TouchableOpacity>;
        })}
      </ScrollView>

      {loading ? [0, 1].map((i) => <Shimmer key={i} height={160} radius={radius.lg} style={{ marginTop: 12 }} />)
        : filtered.length === 0 ? <View style={styles.empty}><Ionicons name="images-outline" size={38} color={colors.textMuted} /><Text style={styles.emptyText}>No galleries to show</Text></View>
        : filtered.map((shop) => (
          <View key={shop.shop_id} style={styles.shopCard}>
            <View style={styles.shopHead}>
              {shop.shop_logo ? <Image source={{ uri: img(shop.shop_logo) }} style={styles.shopLogo} /> : <View style={styles.shopLogoFallback}><Text style={styles.shopLogoText}>{(shop.shop_name || '?').charAt(0)}</Text></View>}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.shopName} numberOfLines={1}>{shop.shop_name}</Text>
                <Text style={styles.shopMeta}>{shop.photo_count} photo{shop.photo_count !== 1 ? 's' : ''}</Text>
              </View>
              <View style={[styles.shopStatusChip, { backgroundColor: shop.shop_status === 'approved' ? colors.sellerSoft : shop.shop_status === 'pending' ? '#fef3c7' : colors.bgAlt }]}><Text style={[styles.shopStatusText, { color: shop.shop_status === 'approved' ? '#047857' : shop.shop_status === 'pending' ? '#b45309' : colors.textSecondary }]}>{shop.shop_status}</Text></View>
            </View>
            <View style={styles.photoGrid}>
              {shop.gallery.map((photo) => <PhotoTile key={photo.id} photo={photo} size={tileSize} deleting={deletingId === photo.id} onPress={() => setLightbox({ shop, photo, idx: shop.gallery.indexOf(photo) })} />)}
            </View>
          </View>
        ))}

      <Lightbox lightbox={lightbox} onClose={() => setLightbox(null)} onNav={(dir) => setLightbox((lb) => { const g = lb.shop.gallery; const idx = (lb.idx + dir + g.length) % g.length; return { ...lb, photo: g[idx], idx }; })} onStatus={setStatus} onDelete={del} />
    </AdminScreen>
  );
}

function Lightbox({ lightbox, onClose, onNav, onStatus, onDelete }) {
  if (!lightbox) return null;
  const { shop, photo, idx } = lightbox;
  const meta = sb(photo?.status);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.lbBackdrop}>
        <View style={styles.lbBar}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.lbShop} numberOfLines={1}>{shop.shop_name}</Text>
            <Text style={styles.lbCount}>Photo {idx + 1} / {shop.gallery.length}</Text>
          </View>
          <View style={[styles.lbStatus, { backgroundColor: meta.bg }]}><Ionicons name={meta.icon} size={11} color={meta.fg} /><Text style={[styles.lbStatusText, { color: meta.fg }]}>{meta.label}</Text></View>
          <TouchableOpacity onPress={onClose} style={styles.lbClose}><Ionicons name="close" size={22} color={colors.white} /></TouchableOpacity>
        </View>
        {/* pinch-zoom via ScrollView */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.lbImgWrap} maximumZoomScale={4} minimumZoomScale={1} centerContent bouncesZoom>
          <Image source={{ uri: img(photo.url) }} style={styles.lbImg} resizeMode="contain" />
        </ScrollView>
        {shop.gallery.length > 1 ? (
          <>
            <TouchableOpacity onPress={() => onNav(-1)} style={[styles.lbNav, { left: 8 }]}><Ionicons name="chevron-back" size={24} color={colors.white} /></TouchableOpacity>
            <TouchableOpacity onPress={() => onNav(1)} style={[styles.lbNav, { right: 8 }]}><Ionicons name="chevron-forward" size={24} color={colors.white} /></TouchableOpacity>
          </>
        ) : null}
        <View style={styles.lbActions}>
          <TouchableOpacity onPress={() => onStatus(shop.shop_id, photo, 'approved')} style={[styles.lbAct, { backgroundColor: 'rgba(16,185,129,0.2)' }]}><Ionicons name="checkmark-circle" size={16} color="#6ee7b7" /><Text style={[styles.lbActText, { color: '#6ee7b7' }]}>Approve</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => onStatus(shop.shop_id, photo, 'suspended')} style={[styles.lbAct, { backgroundColor: 'rgba(245,158,11,0.2)' }]}><Ionicons name="ban" size={16} color="#fcd34d" /><Text style={[styles.lbActText, { color: '#fcd34d' }]}>Suspend</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(shop.shop_id, photo)} style={[styles.lbAct, { backgroundColor: 'rgba(239,68,68,0.2)' }]}><Ionicons name="trash" size={16} color="#fca5a5" /><Text style={[styles.lbActText, { color: '#fca5a5' }]}>Delete</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xxl, padding: 20, overflow: 'hidden', marginBottom: 14, ...shadow.card },
  blob: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.1)' },
  heroTag: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  heroTagText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10 },
  heroTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  hChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  hChipText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 12, height: 42, marginBottom: 10 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink, paddingVertical: 0 },
  filterLabel: { fontFamily: fonts.bold, fontSize: 9, color: colors.textMuted, letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  chipRow: { gap: 8, paddingBottom: 8 },
  fChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.bgAlt },
  fChipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  shopCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 14, marginTop: 12, ...shadow.card },
  shopHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  shopLogo: { width: 40, height: 40, borderRadius: 12 },
  shopLogoFallback: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f472b6', alignItems: 'center', justifyContent: 'center' },
  shopLogoText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 16 },
  shopName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  shopMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  shopStatusChip: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  shopStatusText: { fontFamily: fonts.bold, fontSize: 9, textTransform: 'capitalize' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.bgAlt },
  tileImg: { width: '100%', height: '100%' },
  tileBadge: { position: 'absolute', top: 5, left: 5, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  lbBackdrop: { flex: 1, backgroundColor: '#020617' },
  lbBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 50, paddingHorizontal: 14, paddingBottom: 10 },
  lbShop: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 },
  lbCount: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.body, fontSize: 11, marginTop: 1 },
  lbStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  lbStatusText: { fontFamily: fonts.bold, fontSize: 9 },
  lbClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  lbImgWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  lbImg: { width: SCREEN_W, height: SCREEN_W * 1.2 },
  lbNav: { position: 'absolute', top: '50%', width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  lbActions: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 34 },
  lbAct: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 44, borderRadius: radius.md },
  lbActText: { fontFamily: fonts.bold, fontSize: 12 },
});
