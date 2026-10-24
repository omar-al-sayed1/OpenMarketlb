import React from 'react';
import { Text } from 'react-native';
import { colors, fonts } from '../theme/theme';

/**
 * OpenMarketlb wordmark. Kept in its own module (no module-level StyleSheet) so it can
 * be imported by App.js for the splash WITHOUT eagerly pulling in components/ui.js —
 * whose StyleSheet.create would otherwise bake brand colors before applyBrandColors runs.
 * Colors are read at render time, so they always reflect the applied admin palette.
 */
export function Wordmark({ size = 20, style }) {
  return (
    <Text style={[{ fontFamily: fonts.extrabold, fontSize: size, letterSpacing: -0.5 }, style]}>
      <Text style={{ color: colors.logoOpen }}>Open</Text>
      <Text style={{ color: colors.logoMarket }}>Market</Text>
      <Text style={{ color: colors.logoMarket, fontSize: size * 0.5 }}>lb</Text>
    </Text>
  );
}
