// Web-only stub for react-native-maps (which has no web implementation). Aliased in
// metro.config.js ONLY when platform === 'web', so native builds are unaffected. It just
// keeps the web bundle building so non-map screens can be previewed in a browser.
import React from 'react';
import { View, Text } from 'react-native';

const MapView = ({ children, style }) => (
  <View style={[{ alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e7eb', minHeight: 160 }, style]}>
    <Text style={{ color: '#6b7280', fontSize: 12 }}>Map preview unavailable on web</Text>
    {children}
  </View>
);

export const Marker = () => null;
export const Polyline = () => null;
export const Circle = () => null;
export const UrlTile = () => null;
export const Callout = () => null;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = 'default';

export default MapView;
