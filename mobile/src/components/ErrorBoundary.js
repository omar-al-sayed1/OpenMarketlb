import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme/theme';

/**
 * Catches render/runtime errors in the wrapped subtree so a crash shows a recoverable
 * message (with the actual error) instead of a blank white screen. Wrap screens with it
 * in the navigator: `component={guarded(SomeScreen)}`.
 */
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surfaces in Metro/device logs; also visible on-screen below.
    console.error('[ErrorBoundary]', error?.message || error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const nav = this.props.navigation;
    return (
      <View style={styles.wrap}>
        <View style={styles.iconRing}><Ionicons name="alert-circle-outline" size={40} color={colors.sale} /></View>
        <Text style={styles.title}>This screen hit a snag</Text>
        <Text style={styles.sub}>You can go back and try again. Details:</Text>
        <ScrollView style={styles.errBox} contentContainerStyle={{ padding: 12 }}>
          <Text style={styles.errText} selectable>{String(error?.message || error)}</Text>
        </ScrollView>
        <View style={styles.row}>
          {nav?.goBack ? (
            <TouchableOpacity onPress={() => nav.goBack()} style={[styles.btn, styles.btnGhost]} activeOpacity={0.85}>
              <Text style={styles.btnGhostText}>Go back</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={this.reset} style={[styles.btn, styles.btnPrimary]} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 26 },
  iconRing: { width: 74, height: 74, borderRadius: 37, backgroundColor: colors.saleSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
  errBox: { maxHeight: 160, alignSelf: 'stretch', marginTop: 14, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  errText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  row: { flexDirection: 'row', gap: 10, marginTop: 18 },
  btn: { paddingHorizontal: 22, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { fontFamily: fonts.bold, fontSize: 14, color: colors.onPrimary || colors.white },
});
