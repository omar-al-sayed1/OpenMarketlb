import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet, Platform, Modal, ScrollView } from 'react-native';
import MapView, { Marker, Polyline, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { notifySuccess, notifyError, tapMedium } from '../../lib/haptics';
import { toast, Spinner } from '../../components/shop/ShopKit';
import { StatusPill } from '../../components/admin/AdminKit';
import { colors, radius, fonts, shadow } from '../../theme/theme';

const DEFAULT = { latitude: 33.8938, longitude: 35.5018, latitudeDelta: 1.6, longitudeDelta: 1.6 };
const num = (v) => (typeof v === 'number' ? v : parseFloat(v));
const hasLoc = (s) => !isNaN(num(s.latitude)) && !isNaN(num(s.longitude));
const PROVIDERS = [['street', 'Street'], ['google', 'Google'], ['satellite', 'Satellite']];
const STATUS_META = { active: 'emerald', trial: 'blue', pending: 'amber', expired: 'red', suspended: 'slate', rejected: 'red' };
const statusVariant = (s) => STATUS_META[s] || 'amber';

/* grid clustering keyed to the current zoom */
function clusterize(points, region) {
  const size = (region?.latitudeDelta || 1.6) / 9;
  if (!size || size <= 0) return points.map((p) => ({ type: 'point', shop: p }));
  const cells = {};
  points.forEach((p) => { const k = `${Math.round(p._lat / size)}_${Math.round(p._lng / size)}`; (cells[k] || (cells[k] = [])).push(p); });
  return Object.entries(cells).map(([k, group]) => {
    if (group.length === 1) return { type: 'point', shop: group[0] };
    const lat = group.reduce((s, p) => s + p._lat, 0) / group.length;
    const lng = group.reduce((s, p) => s + p._lng, 0) / group.length;
    return { type: 'cluster', key: k, count: group.length, lat, lng };
  });
}

export default function AdminMapScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const mapRef = useRef(null);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState(DEFAULT);
  const [provider, setProvider] = useState('street');
  const [search, setSearch] = useState('');
  const [listOpen, setListOpen] = useState(false);

  const [sel, setSel] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editCoord, setEditCoord] = useState(null);
  const [saving, setSaving] = useState(false);

  const [routeCoords, setRouteCoords] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routing, setRouting] = useState(false);

  const focusId = route?.params?.focusShopId;

  const fetchShops = useCallback(async (selectAfter) => {
    try {
      const { data } = await api.admin.getShops();
      const arr = (Array.isArray(data) ? data : data?.shops || []).map((s) => ({ ...s, _lat: num(s.latitude), _lng: num(s.longitude) }));
      setShops(arr);
      if (selectAfter) { const upd = arr.find((s) => s.id === selectAfter.id); if (upd) setSel(upd); }
    } catch { setShops([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchShops(); }, [fetchShops]);

  // Deep-link focus from SM2 "View on map"
  useEffect(() => {
    if (!focusId || !shops.length) return;
    const s = shops.find((x) => x.id === focusId);
    if (s && hasLoc(s)) { setSel(s); flyTo(s._lat, s._lng, 14); }
  }, [focusId, shops]); // eslint-disable-line

  const withLoc = useMemo(() => shops.filter(hasLoc), [shops]);
  const noLoc = useMemo(() => shops.filter((s) => !hasLoc(s)), [shops]);
  const clusters = useMemo(() => clusterize(withLoc, region), [withLoc, region]);

  const flyTo = (latitude, longitude, span = 14) => {
    const d = span >= 14 ? 0.04 : 0.4;
    mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: d, longitudeDelta: d }, 600);
  };

  const selectShop = (s) => { setSel(s); setEditMode(false); setEditCoord(null); if (hasLoc(s)) flyTo(s._lat, s._lng, 14); };
  const onClusterPress = (c) => mapRef.current?.animateToRegion({ latitude: c.lat, longitude: c.lng, latitudeDelta: region.latitudeDelta / 2.6, longitudeDelta: region.longitudeDelta / 2.6 }, 500);

  const runSearch = () => {
    const q = search.trim().toLowerCase();
    if (!q) return;
    const s = withLoc.find((x) => (x.name || '').toLowerCase().includes(q));
    if (s) { selectShop(s); } else { toast.error('No shop matches that name'); }
  };

  const myLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { toast.error('Location permission denied'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      tapMedium(); flyTo(pos.coords.latitude, pos.coords.longitude, 14);
    } catch { toast.error('Could not get your location'); }
  };

  /* ===== OSRM directions ===== */
  const drawRoute = async (shop) => {
    if (!hasLoc(shop)) return;
    setRouting(true); setRouteInfo(null); setRouteCoords(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setRouteInfo({ error: 'Allow location access to get directions' }); setRouting(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const from = pos.coords;
      const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${shop._lng},${shop._lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      const rt = data.routes && data.routes[0];
      if (!rt) { setRouteInfo({ error: 'Could not build a route' }); setRouting(false); return; }
      const coords = rt.geometry.coordinates.map(([x, y]) => ({ latitude: y, longitude: x }));
      setRouteCoords(coords);
      setRouteInfo({ label: shop.name, distanceKm: (rt.distance / 1000).toFixed(1), durationMin: Math.round(rt.duration / 60), dest: { lat: shop._lat, lng: shop._lng } });
      setTimeout(() => mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 80, right: 60, bottom: 260, left: 60 }, animated: true }), 120);
    } catch { setRouteInfo({ error: 'Could not build a route' }); }
    finally { setRouting(false); }
  };
  const clearRoute = () => { setRouteCoords(null); setRouteInfo(null); };

  /* ===== edit location ===== */
  const startEdit = () => { setEditMode(true); const lat = sel?._lat || DEFAULT.latitude; const lng = sel?._lng || DEFAULT.longitude; setEditCoord({ latitude: lat, longitude: lng }); flyTo(lat, lng, 15); };
  const useCurrentForEdit = async () => {
    if (!editMode) startEdit();
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { toast.error('Location permission denied'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      tapMedium(); setEditCoord({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); flyTo(pos.coords.latitude, pos.coords.longitude, 15);
      toast.success('Location set to your current position');
    } catch { toast.error('Could not get your location'); }
  };
  const saveLocation = async () => {
    if (!sel || !editCoord) return;
    setSaving(true);
    try {
      await api.admin.updateShop(sel.id, { latitude: editCoord.latitude, longitude: editCoord.longitude });
      notifySuccess(); toast.success(`Location updated for ${sel.name}`);
      setEditMode(false);
      await fetchShops({ id: sel.id });
      setSel((p) => (p ? { ...p, latitude: editCoord.latitude, longitude: editCoord.longitude, _lat: editCoord.latitude, _lng: editCoord.longitude } : p));
    } catch (e) { notifyError(); toast.error(e?.response?.data?.detail || 'Failed to save location'); }
    finally { setSaving(false); }
  };
  const cancelEdit = () => { setEditMode(false); setEditCoord(null); };

  const openDetails = () => { const s = sel; setSel(null); navigation.navigate('AdminShops', { openShopId: s.id }); };

  // Never hide the base map (mapType 'none' + no API key = blank). "Street" overlays OSM tiles on top of the default base.
  const mapType = provider === 'satellite' ? 'satellite' : 'standard';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="admin-map-page">
      <MapView
        ref={mapRef} style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        mapType={mapType} initialRegion={DEFAULT}
        onRegionChangeComplete={setRegion}
        onPress={(e) => { if (editMode) setEditCoord(e.nativeEvent.coordinate); }}
        testID="admin-map"
      >
        {provider === 'street' && <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} zIndex={-1} flipY={false} />}

        {clusters.map((c) => c.type === 'cluster' ? (
          <Marker key={`c_${c.key}`} coordinate={{ latitude: c.lat, longitude: c.lng }} onPress={() => onClusterPress(c)} anchor={{ x: 0.5, y: 0.5 }}>
            <Animated.View entering={FadeIn.duration(200)} style={styles.cluster}><Text style={styles.clusterText}>{c.count}</Text></Animated.View>
          </Marker>
        ) : (
          <Marker key={c.shop.id} coordinate={{ latitude: c.shop._lat, longitude: c.shop._lng }} onPress={() => selectShop(c.shop)} tracksViewChanges={false} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.pinWrap}>
              <LinearGradient colors={c.shop.is_verified ? ['#10b981', '#059669'] : [colors.p450, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pin}><Ionicons name="storefront" size={14} color={colors.white} /></LinearGradient>
              <View style={[styles.pinTip, c.shop.is_verified && { borderTopColor: '#059669' }]} />
            </View>
          </Marker>
        ))}

        {editMode && editCoord && (
          <Marker coordinate={editCoord} draggable onDragEnd={(e) => setEditCoord(e.nativeEvent.coordinate)} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.editPinWrap}><View style={styles.editPin}><Ionicons name="location" size={18} color={colors.white} /></View><View style={styles.editTip} /></View>
          </Marker>
        )}

        {routeCoords && <Polyline coordinates={routeCoords} strokeColor={colors.s500} strokeWidth={5} />}
      </MapView>

      {/* ===== Header ===== */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <LinearGradient colors={['#3b82f6', colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerTile}><Ionicons name="location" size={18} color={colors.white} /></LinearGradient>
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput style={styles.searchInput} placeholder="Search a shop…" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} onSubmitEditing={runSearch} returnKeyType="search" testID="admin-map-search" />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={colors.textMuted} /></TouchableOpacity> : null}
        </View>
        <TouchableOpacity style={styles.listBtn} onPress={() => setListOpen(true)}><Ionicons name="list" size={18} color={colors.violet} /></TouchableOpacity>
      </View>

      {/* Provider toggle */}
      <View style={[styles.provToggle, { top: insets.top + 58 }]}>
        {PROVIDERS.map(([k, l]) => (
          <TouchableOpacity key={k} onPress={() => setProvider(k)} style={[styles.provPill, provider === k && styles.provPillOn]}>
            <Text style={[styles.provText, provider === k && { color: colors.violet, fontFamily: fonts.bold }]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Counter */}
      <View style={[styles.counter, { top: insets.top + 58 }]}><Ionicons name="location" size={12} color={colors.white} /><Text style={styles.counterText}>{withLoc.length} on map{noLoc.length ? ` · ${noLoc.length} without` : ''}</Text></View>

      {/* Route info */}
      {(routing || routeInfo) && (
        <Animated.View entering={FadeIn} style={[styles.routeInfo, { top: insets.top + 92 }]} testID="admin-map-route-info">
          {routing ? <View style={styles.routeRow}><Spinner size={14} color={colors.s700} /><Text style={styles.routeText}>Building route from your location…</Text></View>
            : routeInfo?.error ? <Text style={[styles.routeText, { color: '#b45309' }]}>{routeInfo.error}</Text>
              : (
                <View style={styles.routeRow}>
                  <Ionicons name="navigate" size={14} color={colors.s700} />
                  <Text style={styles.routeText} numberOfLines={1}><Text style={{ fontFamily: fonts.bold }}>Route to {routeInfo.label}</Text> — {routeInfo.distanceKm} km · ~{routeInfo.durationMin} min</Text>
                  <TouchableOpacity onPress={clearRoute}><Ionicons name="close" size={16} color={colors.s700} /></TouchableOpacity>
                </View>
              )}
        </Animated.View>
      )}

      {/* My-location FAB */}
      <TouchableOpacity style={[styles.fab, { bottom: (sel ? 250 : 30) + insets.bottom }]} onPress={myLocation} activeOpacity={0.85}>
        <Ionicons name="locate" size={20} color={colors.s500} />
      </TouchableOpacity>

      {/* ===== Selected shop panel ===== */}
      {sel && <SelectedPanel shop={sel} editMode={editMode} editCoord={editCoord} saving={saving} insets={insets}
        onClose={() => { setSel(null); cancelEdit(); clearRoute(); }}
        onDirections={() => drawRoute(sel)} onDetails={openDetails}
        onStartEdit={startEdit} onUseCurrent={useCurrentForEdit} onSave={saveLocation} onCancelEdit={cancelEdit} />}

      {/* ===== Shops list sheet ===== */}
      <ShopListSheet open={listOpen} withLoc={withLoc} noLoc={noLoc} selId={sel?.id} onClose={() => setListOpen(false)}
        onPick={(s) => { setListOpen(false); selectShop(s); }}
        onPickNoLoc={(s) => { setListOpen(false); setSel(s); setTimeout(startEdit, 150); }} />

      {loading && <View style={styles.loadingOverlay}><Spinner size={34} color={colors.violet} /></View>}
    </View>
  );
}

/* ---------- selected shop swipe-up panel ---------- */
function SelectedPanel({ shop, editMode, editCoord, saving, insets, onClose, onDirections, onDetails, onStartEdit, onUseCurrent, onSave, onCancelEdit }) {
  const y = useSharedValue(320);
  const bounce = useSharedValue(1);
  useEffect(() => { y.value = withSpring(0, { damping: 18 }); }, []); // eslint-disable-line
  useEffect(() => { if (!saving && editCoord) { bounce.value = withSequence(withTiming(1.12, { duration: 120 }), withSpring(1)); } }, [shop.latitude]); // eslint-disable-line
  const aStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: bounce.value }] }));
  const lat = editMode ? editCoord?.latitude : shop._lat;
  const lng = editMode ? editCoord?.longitude : shop._lng;
  return (
    <Animated.View style={[styles.panel, { paddingBottom: (insets.bottom || 12) + 12 }, aStyle]} testID="selected-shop-panel">
      <View style={styles.panelHead}>
        <Animated.View style={[styles.panelLogo, logoStyle]}>{shop.logo ? <Image source={{ uri: img(shop.logo) }} style={{ width: '100%', height: '100%' }} /> : <LinearGradient colors={[colors.p450, colors.s600]} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="storefront" size={20} color={colors.white} /></LinearGradient>}</Animated.View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Text style={styles.panelName} numberOfLines={1}>{shop.name}</Text>{shop.is_verified && <Ionicons name="shield-checkmark" size={14} color={colors.seller} />}</View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}><StatusPill label={shop.subscription_status || 'pending'} variant={statusVariant(shop.subscription_status)} /><Text style={styles.panelAddr} numberOfLines={1}>{shop.address || shop.state || '—'}</Text></View>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={8}><Ionicons name="close" size={20} color={colors.textMuted} /></TouchableOpacity>
      </View>

      {!editMode && hasLoc(shop) && (
        <View style={styles.panelActions}>
          <TouchableOpacity style={styles.dirBtn} onPress={onDirections} testID="admin-shop-directions-btn"><Ionicons name="navigate" size={15} color={colors.s700} /><Text style={styles.dirText}>Directions on map</Text></TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} style={{ flex: 1 }} onPress={onDetails}><LinearGradient colors={[colors.p450, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.detBtn}><Text style={styles.detText}>Open shop details</Text><Ionicons name="arrow-forward" size={14} color={colors.white} /></LinearGradient></TouchableOpacity>
        </View>
      )}

      <View style={styles.coordRow}>
        <Text style={styles.coordLabel}>Lat</Text><Text style={styles.coordVal}>{typeof lat === 'number' ? lat.toFixed(6) : '—'}</Text>
        <Text style={[styles.coordLabel, { marginLeft: 14 }]}>Lng</Text><Text style={styles.coordVal}>{typeof lng === 'number' ? lng.toFixed(6) : '—'}</Text>
      </View>

      {!editMode ? (
        <View style={styles.editActions}>
          <TouchableOpacity activeOpacity={0.9} style={{ flex: 1 }} onPress={onStartEdit} testID="edit-shop-location-btn"><LinearGradient colors={['#3b82f6', colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.editBtn}><Ionicons name="location" size={15} color={colors.white} /><Text style={styles.editBtnText}>Change Location</Text></LinearGradient></TouchableOpacity>
          <TouchableOpacity style={styles.gpsBtn} onPress={onUseCurrent} testID="use-current-location-btn"><Ionicons name="navigate-circle-outline" size={16} color="#059669" /><Text style={styles.gpsText}>Current</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={{ gap: 8, marginTop: 10 }}>
          <Text style={styles.editHint}>Drag the red marker, tap the map, or use your current location</Text>
          <TouchableOpacity style={styles.gpsBtnFull} onPress={onUseCurrent} testID="use-current-location-edit-btn"><Ionicons name="navigate-circle-outline" size={16} color="#059669" /><Text style={styles.gpsText}>Use My Current Location</Text></TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity activeOpacity={0.9} style={{ flex: 1 }} onPress={onSave} disabled={saving} testID="save-shop-location-btn"><LinearGradient colors={['#10b981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>{saving ? <Spinner size={16} color={colors.white} /> : <><Ionicons name="save" size={15} color={colors.white} /><Text style={styles.saveText}>Save</Text></>}</LinearGradient></TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancelEdit}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

/* ---------- shops list sheet ---------- */
function ShopListSheet({ open, withLoc, noLoc, selId, onClose, onPick, onPickNoLoc }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb, maxHeight: '80%' }]}>
        <View style={styles.grabber} />
        <ScrollView showsVerticalScrollIndicator={false}>
          {noLoc.length > 0 && (
            <>
              <Text style={styles.listHead}>Shops without location ({noLoc.length})</Text>
              {noLoc.map((s) => (
                <TouchableOpacity key={s.id} style={styles.listRow} onPress={() => onPickNoLoc(s)} testID={`admin-map-noloc-shop-${s.id}`}>
                  <Ionicons name="alert-circle" size={16} color="#d97706" /><Text style={styles.listName} numberOfLines={1}>{s.name}</Text><Ionicons name="location-outline" size={15} color="#d97706" />
                </TouchableOpacity>
              ))}
            </>
          )}
          <Text style={[styles.listHead, { marginTop: noLoc.length ? 14 : 0 }]}>All shops on map ({withLoc.length})</Text>
          {withLoc.map((s) => (
            <TouchableOpacity key={s.id} style={[styles.listRow, selId === s.id && styles.listRowOn]} onPress={() => onPick(s)} testID={`admin-map-shop-${s.id}`}>
              <View style={[styles.listDot, { backgroundColor: s.is_verified ? '#10b981' : colors.p450 }]} /><Text style={styles.listName} numberOfLines={1}>{s.name}</Text><Text style={styles.listTier}>{s.tier || 'starter'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  headerTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 12, height: 42, ...shadow.card },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  listBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  provToggle: { position: 'absolute', left: 12, flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 3, ...shadow.card },
  provPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill },
  provPillOn: { backgroundColor: colors.primarySoft },
  provText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted },
  counter: { position: 'absolute', right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(79,70,229,0.92)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  counterText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10.5 },
  routeInfo: { position: 'absolute', left: 12, right: 12, backgroundColor: colors.s50, borderWidth: 1, borderColor: colors.s200, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.s900 },

  pinWrap: { alignItems: 'center', width: 36, height: 42 },
  pin: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white, ...shadow.violetGlow },
  pinTip: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.s600, marginTop: -2 },
  cluster: { minWidth: 40, height: 40, borderRadius: 20, paddingHorizontal: 6, backgroundColor: 'rgba(99,102,241,0.95)', borderWidth: 3, borderColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.violetGlow },
  clusterText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 14 },
  editPinWrap: { alignItems: 'center', width: 40, height: 46 },
  editPin: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white, ...shadow.emphasis },
  editTip: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#ef4444', marginTop: -2 },

  fab: { position: 'absolute', right: 16, width: 50, height: 50, borderRadius: 25, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.dropdown },

  panel: { position: 'absolute', left: 12, right: 12, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, padding: 16, marginBottom: 12, ...shadow.dropdown },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  panelLogo: { width: 48, height: 48, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.primarySoft },
  panelName: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink, flexShrink: 1 },
  panelAddr: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, flex: 1 },
  panelActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  dirBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.s50, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  dirText: { fontFamily: fonts.bold, fontSize: 12, color: colors.s700 },
  detBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: radius.md, paddingVertical: 11 },
  detText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  coordRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  coordLabel: { fontFamily: fonts.bold, fontSize: 10, color: colors.textMuted, marginRight: 6 },
  coordVal: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md, paddingVertical: 12 },
  editBtnText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: '#a7f3d0', borderRadius: radius.md, paddingHorizontal: 14 },
  gpsBtnFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#a7f3d0', borderRadius: radius.md, paddingVertical: 11 },
  gpsText: { fontFamily: fonts.bold, fontSize: 12.5, color: '#059669' },
  editHint: { fontFamily: fonts.body, fontSize: 11, color: '#d97706' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md, paddingVertical: 12 },
  saveText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12 },
  cancelText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  listHead: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent' },
  listRowOn: { backgroundColor: colors.primarySoft, borderColor: colors.p200 },
  listDot: { width: 9, height: 9, borderRadius: 5 },
  listName: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  listTier: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, textTransform: 'capitalize' },
});
