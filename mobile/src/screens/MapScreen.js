import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet, Platform, Modal, ScrollView, Linking } from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { img } from '../lib/media';
import { tapMedium } from '../lib/haptics';
import { toast, Spinner } from '../components/shop/ShopKit';
import BottomSheet from '../components/BottomSheet';
import { colors, gradients, radius, fonts, shadow } from '../theme/theme';

// Teardrop pin (website look: gradient + white house) baked to the admin's brand colors.
// Image markers render reliably under the New Architecture; regenerate if the palette changes.
const PIN_SHOP = require('../../assets/pin-shop.png');

const DEFAULT = { latitude: 33.8938, longitude: 35.5018, latitudeDelta: 1.6, longitudeDelta: 1.6 };
const num = (v) => (typeof v === 'number' ? v : parseFloat(v));
const hasLoc = (s) => !isNaN(num(s.latitude)) && !isNaN(num(s.longitude));
const shopLogo = (s) => s?.logo || s?.logo_url || s?.image_url || s?.image || null;
const PROVIDERS = [['google', 'Google'], ['satellite', 'Satellite']];
const RADIUS_OPTS = [5, 10, 25, 50, 100]; // km — matches the web radius selector (default 10)
const havKm = (aLat, aLng, bLat, bLng) => {
  const R = 6371, r = (d) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat), dLng = r(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

function clusterize(points, region) {
  const size = (region?.latitudeDelta || 1.6) / 9;
  if (!size || size <= 0) return points.map((p) => ({ type: 'point', shop: p }));
  const cells = {};
  points.forEach((p) => { const k = `${Math.round(p._lat / size)}_${Math.round(p._lng / size)}`; (cells[k] || (cells[k] = [])).push(p); });
  return Object.entries(cells).map(([k, g]) => g.length === 1 ? { type: 'point', shop: g[0] } : { type: 'cluster', key: k, count: g.length, lat: g.reduce((s, p) => s + p._lat, 0) / g.length, lng: g.reduce((s, p) => s + p._lng, 0) / g.length });
}

export default function MapScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState(true); // let custom markers paint before snapshotting
  const [region, setRegion] = useState(DEFAULT);
  const [provider, setProvider] = useState('google');
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [stateOpen, setStateOpen] = useState(false);
  const [nearMe, setNearMe] = useState(false);
  const [nearRadius, setNearRadius] = useState(10); // default 10 km (like the web)
  const [userLoc, setUserLoc] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routing, setRouting] = useState(false);

  useEffect(() => {
    api.shops.getMap()
      .then(({ data }) => setShops((Array.isArray(data) ? data : data?.shops || []).filter(hasLoc).map((s) => ({ ...s, _lat: num(s.latitude), _lng: num(s.longitude) }))))
      .catch(() => setShops([]))
      .finally(() => setLoading(false));
  }, []);

  // Keep markers "tracking" briefly whenever shops/region change so the gradient
  // pins actually paint before react-native-maps snapshots them (else: blank pins).
  useEffect(() => {
    setTracks(true);
    const t = setTimeout(() => setTracks(false), 1600);
    return () => clearTimeout(t);
  }, [shops, region]);

  const stateOpts = useMemo(() => [['all', 'All Regions'], ...Array.from(new Set(shops.map((s) => s.state).filter(Boolean))).sort().map((s) => [s, s])], [shops]);

  const filtered = useMemo(() => {
    let f = shops;
    if (stateFilter !== 'all') f = f.filter((s) => s.state === stateFilter);
    if (nearMe && userLoc) f = f.filter((s) => havKm(userLoc.latitude, userLoc.longitude, s._lat, s._lng) <= nearRadius);
    return f;
  }, [shops, stateFilter, nearMe, userLoc, nearRadius]);

  const clusters = useMemo(() => clusterize(filtered, region), [filtered, region]);

  const flyTo = (lat, lng, span = 14) => { const d = span >= 14 ? 0.04 : 0.4; mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: d, longitudeDelta: d }, 550); };
  // Fit the map to a radius (km) around the user — ~111 km per latitude degree.
  const fitRadius = (r, loc) => { const l = loc || userLoc; if (!l) return; const d = Math.max(0.02, (r * 2.6) / 111); mapRef.current?.animateToRegion({ latitude: l.latitude, longitude: l.longitude, latitudeDelta: d, longitudeDelta: d }, 550); };
  const selectShop = (s) => { setSel(s); flyTo(s._lat, s._lng, 14); };
  const onCluster = (c) => mapRef.current?.animateToRegion({ latitude: c.lat, longitude: c.lng, latitudeDelta: region.latitudeDelta / 2.6, longitudeDelta: region.longitudeDelta / 2.6 }, 500);

  const getUserLocation = useCallback(async (silent = false) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { if (!silent) toast.error('Location permission denied'); return null; }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
    const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    setUserLoc(loc); return loc;
  }, []);

  // On open, get the precise position so the native "you are here" dot shows the exact spot.
  useEffect(() => { getUserLocation(true).catch(() => {}); }, [getUserLocation]);

  const myLocation = async () => { try { const loc = await getUserLocation(); if (loc) { tapMedium(); flyTo(loc.latitude, loc.longitude, 14); } } catch { toast.error('Could not get your location'); } };

  const toggleNearMe = async () => {
    if (nearMe) { setNearMe(false); return; }
    try { const loc = userLoc || await getUserLocation(); if (loc) { setNearMe(true); fitRadius(nearRadius, loc); toast.success(`Shops within ${nearRadius} km`); } }
    catch { toast.error('Could not get your location'); }
  };
  const pickRadius = (r) => { setNearRadius(r); fitRadius(r); };

  const runSearch = async () => {
    const q = search.trim();
    if (!q) return;
    const s = filtered.find((x) => (x.name || '').toLowerCase().includes(q.toLowerCase()));
    if (s) { selectShop(s); return; }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`, { headers: { 'User-Agent': 'OpenMarketlb' } });
      const data = await res.json();
      if (data?.length) flyTo(parseFloat(data[0].lat), parseFloat(data[0].lon), 14);
      else toast.error('Location not found');
    } catch { toast.error('Search failed'); }
  };

  const drawRoute = async (shop) => {
    setRouting(true); setRouteInfo(null); setRouteCoords(null);
    try {
      const from = userLoc || await getUserLocation();
      if (!from) { setRouteInfo({ error: 'Allow location access to get directions' }); setRouting(false); return; }
      const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${shop._lng},${shop._lat}?overview=full&geometries=geojson`;
      const { routes } = await (await fetch(url)).json();
      const rt = routes && routes[0];
      if (!rt) { setRouteInfo({ error: 'Could not build a route' }); setRouting(false); return; }
      const coords = rt.geometry.coordinates.map(([x, y]) => ({ latitude: y, longitude: x }));
      setRouteCoords(coords);
      setRouteInfo({ label: shop.name, distanceKm: (rt.distance / 1000).toFixed(1), durationMin: Math.round(rt.duration / 60), dest: { lat: shop._lat, lng: shop._lng } });
      setTimeout(() => mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 90, right: 60, bottom: 280, left: 60 }, animated: true }), 120);
    } catch { setRouteInfo({ error: 'Could not build a route' }); }
    finally { setRouting(false); }
  };
  const getDirections = (shop) => Linking.openURL(userLoc ? `https://www.google.com/maps/dir/${userLoc.latitude},${userLoc.longitude}/${shop._lat},${shop._lng}` : `https://www.google.com/maps/dir/?api=1&destination=${shop._lat},${shop._lng}&travelmode=driving`);

  const mapType = provider === 'satellite' ? 'satellite' : 'standard';
  const anyFilter = stateFilter !== 'all' || nearMe;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <MapView ref={mapRef} style={StyleSheet.absoluteFill} provider={PROVIDER_DEFAULT} mapType={mapType} initialRegion={DEFAULT} showsUserLocation onRegionChangeComplete={setRegion}>
        {/* Native markers tinted with the LIVE admin brand colors (pinColor is the only
            marker option that's both reliable under the New Architecture AND theme-reactive):
            regular shops = primary, shops on sale = secondary. Both follow the admin palette. */}
        {filtered.map((shop) => (
          <Marker
            key={shop.id}
            coordinate={{ latitude: shop._lat, longitude: shop._lng }}
            onPress={() => setSel(shop)}
            image={PIN_SHOP}
            anchor={{ x: 0.5, y: 1 }}
            title={shop.name}
            description={shop.location_address || shop.state || ''}
          />
        ))}
        {nearMe && userLoc ? <Circle center={{ latitude: userLoc.latitude, longitude: userLoc.longitude }} radius={nearRadius * 1000} strokeColor={colors.s600} strokeWidth={1.5} fillColor="rgba(6,148,148,0.08)" /> : null}
        {routeCoords && <Polyline coordinates={routeCoords} strokeColor={colors.s500} strokeWidth={5} />}
      </MapView>

      {/* Header: back + search + list (compact, at the very top) */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Home')} activeOpacity={0.85}><Ionicons name="chevron-back" size={18} color={colors.violet} /></TouchableOpacity>
        <View style={styles.search}>
          <Ionicons name="search" size={15} color={colors.textMuted} />
          <TextInput style={styles.searchInput} placeholder="Search a shop or place…" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} onSubmitEditing={runSearch} returnKeyType="search" />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={15} color={colors.textMuted} /></TouchableOpacity> : null}
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setListOpen(true)} activeOpacity={0.85}><Ionicons name="list" size={17} color={colors.violet} /></TouchableOpacity>
      </View>

      {/* Controls row: provider toggle + state filter + near me */}
      <View style={[styles.controls, { top: insets.top + 46 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          <View style={styles.provToggle}>
            {PROVIDERS.map(([k, l]) => <TouchableOpacity key={k} onPress={() => setProvider(k)} style={[styles.provPill, provider === k && styles.provPillOn]}><Text style={[styles.provText, provider === k && { color: colors.violet, fontFamily: fonts.bold }]}>{l}</Text></TouchableOpacity>)}
          </View>
          <TouchableOpacity style={[styles.ctrlChip, stateFilter !== 'all' && styles.ctrlChipOn]} onPress={() => setStateOpen(true)}>
            <Ionicons name="location-outline" size={13} color={stateFilter !== 'all' ? colors.violet : colors.textSecondary} />
            <Text style={[styles.ctrlChipText, stateFilter !== 'all' && { color: colors.violet }]} numberOfLines={1}>{stateFilter === 'all' ? 'Region' : stateFilter}</Text>
            <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ctrlChip, nearMe && styles.ctrlChipOn]} onPress={toggleNearMe}>
            <Ionicons name="compass-outline" size={13} color={nearMe ? colors.violet : colors.textSecondary} />
            <Text style={[styles.ctrlChipText, nearMe && { color: colors.violet }]}>Near Me</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Near-Me radius selector (default 10 km, like the web) */}
      {nearMe && (
        <Animated.View entering={FadeIn} style={[styles.radiusBar, { top: insets.top + 84 }]}>
          <Ionicons name="resize" size={13} color={colors.s700} />
          <Text style={styles.radiusLabel}>Within</Text>
          {RADIUS_OPTS.map((r) => (
            <TouchableOpacity key={r} onPress={() => pickRadius(r)} style={[styles.radiusPill, nearRadius === r && styles.radiusPillOn]}>
              <Text style={[styles.radiusText, nearRadius === r && { color: colors.violet, fontFamily: fonts.bold }]}>{r} km</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      {/* counter */}
      <View style={[styles.counter, { top: insets.top + (nearMe ? 120 : 82) }]}><Ionicons name="storefront" size={11} color={colors.white} /><Text style={styles.counterText}>{filtered.length} shop{filtered.length !== 1 ? 's' : ''}{anyFilter ? ' · filtered' : ''}</Text></View>

      {/* route info */}
      {(routing || routeInfo) && (
        <Animated.View entering={FadeIn} style={[styles.routeInfo, { top: insets.top + (nearMe ? 150 : 112) }]}>
          {routing ? <View style={styles.routeRow}><Spinner size={14} color={colors.s700} /><Text style={styles.routeText}>Building route from your location…</Text></View>
            : routeInfo?.error ? <Text style={[styles.routeText, { color: '#b45309' }]}>{routeInfo.error}</Text>
              : <View style={styles.routeRow}><Ionicons name="navigate" size={14} color={colors.s700} /><Text style={styles.routeText} numberOfLines={1}><Text style={{ fontFamily: fonts.bold }}>Route to {routeInfo.label}</Text> — {routeInfo.distanceKm} km · ~{routeInfo.durationMin} min</Text><TouchableOpacity onPress={() => { setRouteCoords(null); setRouteInfo(null); }}><Ionicons name="close" size={16} color={colors.s700} /></TouchableOpacity></View>}
        </Animated.View>
      )}

      {/* my location FAB */}
      <TouchableOpacity style={[styles.fab, { bottom: (sel ? 240 : 30) + insets.bottom }]} onPress={myLocation} activeOpacity={0.85}><Ionicons name="locate" size={20} color={colors.s500} /></TouchableOpacity>

      {sel && <SelectedPanel shop={sel} insets={insets} onClose={() => { setSel(null); setRouteCoords(null); setRouteInfo(null); }} onDirections={() => drawRoute(sel)} onGetDirections={() => getDirections(sel)} onView={() => { const s = sel; setSel(null); navigation.navigate('ShopPublic', { id: s.id, name: s.name }); }} />}

      {/* state picker */}
      <BottomSheet visible={stateOpen} onClose={() => setStateOpen(false)} maxHeight="70%">
        <Text style={styles.sheetTitle}>Filter by region</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {stateOpts.map(([v, l]) => <TouchableOpacity key={String(v)} style={styles.opt} onPress={() => { setStateFilter(v); setStateOpen(false); }}><Text style={[styles.optText, v === stateFilter && { color: colors.violet, fontFamily: fonts.bold }]}>{l}</Text>{v === stateFilter && <Ionicons name="checkmark" size={17} color={colors.violet} />}</TouchableOpacity>)}
        </ScrollView>
      </BottomSheet>

      {/* shop list sheet */}
      <BottomSheet visible={listOpen} onClose={() => setListOpen(false)} maxHeight="80%">
        <Text style={styles.sheetTitle}>All shop locations ({filtered.length})</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
          {filtered.map((s) => (
            <TouchableOpacity key={s.id} style={styles.listRow} onPress={() => { setListOpen(false); selectShop(s); }}>
              <View style={styles.listLogo}>{shopLogo(s) ? <Image source={{ uri: img(shopLogo(s)) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Ionicons name="storefront" size={18} color={colors.violet} />}</View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={styles.listName} numberOfLines={1}>{s.name}</Text>{s.is_verified && <Ionicons name="checkmark-circle" size={12} color={colors.seller} />}</View>
                <Text style={styles.listAddr} numberOfLines={1}>{s.address || s.state || 'Lebanon'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.violet} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>

      {loading && <View style={styles.loadingOverlay}><Spinner size={34} color={colors.violet} /></View>}
    </View>
  );
}

function SelectedPanel({ shop, insets, onClose, onDirections, onGetDirections, onView }) {
  const y = useSharedValue(300);
  useEffect(() => { y.value = withSpring(0, { damping: 24, stiffness: 200, mass: 0.9 }); }, []); // eslint-disable-line
  const aStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={[styles.panel, { paddingBottom: (insets.bottom || 12) + 12 }, aStyle]}>
      <View style={styles.panelHead}>
        <View style={styles.panelLogo}>{shopLogo(shop) ? <Image source={{ uri: img(shopLogo(shop)) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <LinearGradient colors={gradients.primary} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="storefront" size={22} color={colors.white} /></LinearGradient>}</View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Text style={styles.panelName} numberOfLines={1}>{shop.name}</Text>{shop.is_verified && <Ionicons name="checkmark-circle" size={14} color={colors.seller} />}</View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}><Ionicons name="location" size={12} color={colors.violet} /><Text style={styles.panelAddr} numberOfLines={1}>{shop.address || shop.state || 'Lebanon'}</Text></View>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={8}><Ionicons name="close" size={20} color={colors.textMuted} /></TouchableOpacity>
      </View>
      <View style={styles.panelBtns}>
        <TouchableOpacity style={styles.dirBtn} onPress={onDirections}><Ionicons name="navigate" size={15} color={colors.s700} /><Text style={styles.dirText}>Directions on map</Text></TouchableOpacity>
        <TouchableOpacity style={styles.getDirBtn} onPress={onGetDirections}><Ionicons name="open-outline" size={15} color="#059669" /><Text style={styles.getDirText}>Get Directions</Text></TouchableOpacity>
      </View>
      <TouchableOpacity activeOpacity={0.9} onPress={onView}><LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.viewBtn}><Text style={styles.viewText}>View Shop</Text><Ionicons name="arrow-forward" size={15} color={colors.white} /></LinearGradient></TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 11, height: 36, ...shadow.card },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.ink },
  controls: { position: 'absolute', left: 12, right: 12 },
  radiusBar: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', ...shadow.card },
  radiusLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary, marginRight: 2 },
  radiusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  radiusPillOn: { backgroundColor: colors.primarySoft },
  radiusText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted },
  provToggle: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 2.5, ...shadow.card },
  provPill: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: radius.pill },
  provPillOn: { backgroundColor: colors.primarySoft },
  provText: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.textMuted },
  ctrlChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 140, ...shadow.card },
  ctrlChipOn: { backgroundColor: colors.primarySoft },
  ctrlChipText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary, flexShrink: 1 },
  counter: { position: 'absolute', right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(79,70,229,0.92)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill },
  counterText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10 },
  routeInfo: { position: 'absolute', left: 12, right: 12, backgroundColor: colors.s50, borderWidth: 1, borderColor: colors.s200, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.s900 },
  pinWrap: { alignItems: 'center', justifyContent: 'flex-start', width: 46, height: 50 },
  pinRing: { position: 'absolute', top: 2, width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: colors.amber },
  teardrop: { transform: [{ rotate: '-45deg' }], marginTop: 5 },
  teardropFill: { width: 36, height: 36, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 18, borderBottomLeftRadius: 0, borderWidth: 3, borderColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.violetGlow },
  pinIcon: { transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center' },
  pinLogo: { width: 22, height: 22, borderRadius: 6 },
  cluster: { minWidth: 40, height: 40, borderRadius: 20, paddingHorizontal: 6, backgroundColor: 'rgba(99,102,241,0.95)', borderWidth: 3, borderColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.violetGlow },
  clusterText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 14 },
  fab: { position: 'absolute', right: 16, width: 50, height: 50, borderRadius: 25, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.dropdown },
  panel: { position: 'absolute', left: 12, right: 12, bottom: 0, backgroundColor: colors.surface, borderRadius: 22, padding: 16, marginBottom: 12, ...shadow.dropdown },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  panelLogo: { width: 48, height: 48, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.primarySoft },
  panelName: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink, flexShrink: 1 },
  panelAddr: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, flex: 1 },
  panelBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  dirBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.s50, borderRadius: radius.md, paddingVertical: 10 },
  dirText: { fontFamily: fonts.bold, fontSize: 12, color: colors.s700 },
  getDirBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#ecfdf5', borderRadius: radius.md, paddingVertical: 10 },
  getDirText: { fontFamily: fonts.bold, fontSize: 12, color: '#059669' },
  viewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md, paddingVertical: 12, marginTop: 10 },
  viewText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink },
  opt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  optText: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  listLogo: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  listName: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink, flexShrink: 1 },
  listAddr: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
});
