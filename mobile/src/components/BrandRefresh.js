import React from 'react';
import { RefreshControl } from 'react-native';
import { colors } from './../theme/theme';

/**
 * Branded pull-to-refresh, used in place of a bare <RefreshControl>.
 *
 * Exported as a factory (not a component) because RN's `refreshControl` prop must
 * receive a RefreshControl element directly. Colors are read from `colors` at call
 * time (render), so the spinner tracks the admin's live brand palette and dark mode:
 *   - iOS shows the primary-tinted spinner + a short branded title.
 *   - Android shows a two-tone primary→secondary spinner on a themed surface.
 *
 * Usage:  refreshControl={brandRefresh(refreshing, onRefresh)}
 */
export function brandRefresh(refreshing, onRefresh, title = 'Refreshing…') {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.primary}
      colors={[colors.primary, colors.secondary, colors.p700]}
      progressBackgroundColor={colors.surface}
      title={title}
      titleColor={colors.textMuted}
    />
  );
}
