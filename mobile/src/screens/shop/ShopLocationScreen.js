import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Animated, Easing, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { api } from '../../lib/api';
import { tapLight, notifySuccess } from '../../lib/haptics';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { ShopScreenWrap, Rise, PressScale, Spinner, toast } from '../../components/shop/ShopKit';

/* map style toggle — native stand-in for the web tile providers */
const MAP_MODES = [
  { key: 'openstreetmap', name: 'Street', mapType: 'standard' },
  { key: 'google_roadmap', name: 'Google', mapType: Platform.OS === 'ios' ? 'mutedStandard' : 'standard' },
  { key: 'google_satellite', name: 'Satellite', mapType: 'hybrid' },
];

export const reverseGeocode = async (lat, lng) => {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
    const data = await response.json();
    return data.display_name || '';
  } catch { return ''; }
};

/* draggable pin that bounces when dropped */
export function BouncyPin({ bounceKey }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (bounceKey) {
      a.setValue(0);
      Animated.sequence([
        Animated.timing(a, { toValue: -14, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(a, { toValue: 0, friction: 3, tension: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [bounceKey, a]);
  return (
    <Animated.View style={{ transform: [{ translateY: a }], alignItems: 'center' }}>
      <LinearGradient colors={['#10b981', '#0d9488']} style={pinSt.head}>
        <Ionicons name="storefront" size={14} color={colors.white} />
      </LinearGradient>
      <View style={pinSt.tip} />
    </Animated.View>
  );
}
const pinSt = StyleSheet.create({
  head: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: colors.white, ...shadow.emphasis },
  tip: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#0d9488', marginTop: -2 },
});

/* GPS button with a pulse ring while locating */
export function GpsButton({ locating, onPress, testID }) {
  const ping = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (locating) {
      const loop = Animated.loop(Animated.timing(ping, { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }));
      loop.start();
      return () => { loop.stop(); ping.setValue(0); };
    }
  }, [locating, ping]);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={gpsSt.wrap} testID={testID}>
      {locating && (
        <Animated.View style={[gpsSt.ping, {
          opacity: ping.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
          transform: [{ scale: ping.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
        }]} />
      )}
      <View style={gpsSt.btn}><Ionicons name="navigate" size={16} color="#2563eb" /></View>
    </TouchableOpacity>
  );
}
const gpsSt = StyleSheet.create({
  wrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  ping: { position: 'absolute', width: 44, height: 44, borderRadius: 13, backgroundColor: '#60a5fa' },
  btn: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
});

export default function ShopLocationScreen() {
  const [latitude, setLatitude] = useState(33.8938);
  const [longitude, setLongitude] = useState(35.5018);
  const [locationAddress, setLocationAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapProvider, setMapProvider] = useState('openstreetmap');
  const [bounceKey, setBounceKey] = useState(0);
  const mapRef = useRef(null);

  const fetchLocation = useCallback(async () => {
    try {
      const { data } = await api.shop.getLocation();
      if (data.latitude && data.longitude) {
        setLatitude(data.latitude);
        setLongitude(data.longitude);
        setLocationAddress(data.location_address || '');
      }
    } catch (e) {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchLocation(); }, [fetchLocation]);

  const moveTo = (lat, lng, zoomDelta = 0.02) => {
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: zoomDelta, longitudeDelta: zoomDelta }, 500);
  };

  const setPoint = async (lat, lng) => {
    setLatitude(lat); setLongitude(lng); setSaved(false);
    setBounceKey(k => k + 1); // the pin drops with a bounce
    tapLight();
    const address = await reverseGeocode(lat, lng);
    if (address) setLocationAddress(address);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const results = await response.json();
      if (results.length > 0) {
        const { lat, lon, display_name } = results[0];
        setLatitude(parseFloat(lat)); setLongitude(parseFloat(lon));
        setLocationAddress(display_name); setSaved(false);
        setBounceKey(k => k + 1);
        moveTo(parseFloat(lat), parseFloat(lon));
      } else {
        toast.error('Location not found. Try a different search.');
      }
    } catch (e) { toast.error('Failed to search location'); }
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { toast.error('Unable to get your location. Please allow access.'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lng } = loc.coords;
      await setPoint(lat, lng);
      moveTo(lat, lng);
      toast.success('Location set to your current position!');
    } catch (e) { toast.error('Unable to get your location. Please allow access.'); }
    finally { setLocating(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.shop.updateLocation({ latitude, longitude, location_address: locationAddress });
      toast.success('Shop location saved!');
      notifySuccess();
      setSaved(true);
    } catch (e) { toast.error('Failed to save location'); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <View style={st.center}><Spinner size={34} color={colors.p450} /></View>;
  }

  const mode = MAP_MODES.find(m => m.key === mapProvider) || MAP_MODES[0];

  return (
    <ShopScreenWrap testID="shop-location-page">
      {/* Header */}
      <Rise duration={500} distance={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <LinearGradient colors={['#10b981', '#0d9488']} style={st.headerIcon}><Ionicons name="location" size={22} color={colors.white} /></LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle} testID="shop-location-title">Shop Location</Text>
            <Text style={st.headerSub}>Set your shop location on the map so customers can find you easily.</Text>
          </View>
        </View>
      </Rise>

      {/* Search + GPS */}
      <Rise delay={80}>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <View style={st.search}>
            <Ionicons name="search" size={15} color={colors.textMuted} />
            <TextInput value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={handleSearch}
              placeholder="Search address (e.g., Beirut, Hamra Street)" placeholderTextColor={colors.textMuted}
              style={st.searchInput} testID="location-search-input" />
          </View>
          <TouchableOpacity onPress={handleSearch} style={st.searchBtn} testID="location-search-btn">
            <Ionicons name="search" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <GpsButton locating={locating} onPress={handleUseCurrentLocation} testID="use-current-location-btn" />
        </View>
      </Rise>

      {/* Map provider toggle */}
      <Rise delay={130}>
        <View style={st.providerToggle} testID="shop-map-provider-toggle">
          {MAP_MODES.map(m => (
            <TouchableOpacity key={m.key} onPress={() => setMapProvider(m.key)}
              style={[st.providerBtn, mapProvider === m.key && st.providerBtnOn]} testID={`shop-provider-${m.key}`}>
              <Text style={[st.providerText, mapProvider === m.key && { color: colors.p800 }]}>{m.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Rise>

      {/* Map — tap or drag the pin */}
      <Rise delay={180}>
        <View style={st.mapWrap} testID="shop-location-map">
          <MapView
            ref={mapRef}
            style={{ height: 340 }}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            mapType={mode.mapType}
            initialRegion={{ latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
            onPress={(e) => { const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate; setPoint(lat, lng); }}
          >
            <Marker
              coordinate={{ latitude, longitude }}
              draggable
              onDragEnd={(e) => { const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate; setPoint(lat, lng); }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <BouncyPin bounceKey={bounceKey} />
            </Marker>
          </MapView>
        </View>
      </Rise>

      {/* Location info */}
      <Rise delay={240}>
        <View style={st.infoCard}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>Latitude</Text>
              <View style={st.readonly}><Text style={st.readonlyText} testID="location-lat">{latitude.toFixed(6)}</Text></View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>Longitude</Text>
              <View style={st.readonly}><Text style={st.readonlyText} testID="location-lng">{longitude.toFixed(6)}</Text></View>
            </View>
          </View>
          <Text style={[st.label, { marginTop: 10 }]}>Address Description</Text>
          <TextInput value={locationAddress} onChangeText={(t) => { setLocationAddress(t); setSaved(false); }}
            placeholder="Enter your shop address..." placeholderTextColor={colors.textMuted} style={st.input} testID="location-address-input" />
        </View>
      </Rise>

      {/* Save — emerald-500 -> teal-600 */}
      <Rise delay={300}>
        <PressScale onPress={handleSave} disabled={saving} style={{ marginTop: 14 }}>
          <LinearGradient colors={['#10b981', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.saveBtn} testID="save-location-btn">
            {saving ? <Spinner size={15} /> : <Ionicons name={saved ? 'checkmark-circle' : 'save'} size={15} color={colors.white} />}
            <Text style={st.saveText}>{saving ? 'Saving...' : saved ? 'Saved!' : 'Save Location'}</Text>
          </LinearGradient>
        </PressScale>
        <Text style={st.hint}>Tap on the map or drag the marker to set your shop's exact location. You can also search by address or use your current location.</Text>
      </Rise>
    </ShopScreenWrap>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: shop.bg },
  headerIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', ...shop.emeraldGlow },
  headerTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, letterSpacing: -0.4 },
  headerSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, ...shadow.card },
  searchInput: { flex: 1, paddingVertical: 11, fontFamily: fonts.body, fontSize: 12.5, color: colors.text },
  searchBtn: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  providerToggle: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: colors.bgAlt, borderRadius: radius.pill, padding: 3, marginTop: 12, gap: 2 },
  providerBtn: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: radius.pill },
  providerBtnOn: { backgroundColor: colors.white, ...shadow.card },
  providerText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted },
  mapWrap: { borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, marginTop: 12, ...shadow.card },
  infoCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, padding: 14, marginTop: 12, ...shadow.card },
  label: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginBottom: 5 },
  readonly: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 11, paddingVertical: 10 },
  readonlyText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 11, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13, color: colors.text },
  saveBtn: { height: 48, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, ...shop.emeraldGlow },
  saveText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 },
  hint: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, marginTop: 10, lineHeight: 15 },
});
