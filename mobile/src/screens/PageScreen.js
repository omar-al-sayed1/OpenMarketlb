import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackHeader, GradientButton } from '../components/ui';
import { colors, radius, font, shadow } from '../theme/theme';

/**
 * Generic themed screen for sections that route here from the drawer / other
 * screens before they get a dedicated mobile implementation. Keeps navigation
 * consistent and on-brand instead of dead links.
 */
export default function PageScreen({ navigation, route }) {
  const title = route.params?.title || 'Page';
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StackHeader navigation={navigation} title={title} />
      <View style={styles.body}>
        <View style={styles.icon}><Ionicons name="construct-outline" size={40} color={colors.primaryDark} /></View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>This section is on its way to mobile. The full experience is available now in the OpenMarket web app, and it'll land here soon.</Text>
        <View style={{ width: '100%', marginTop: 20, gap: 10 }}>
          <GradientButton label="Back to Home" icon="home" onPress={() => navigation.navigate('Root', { screen: 'Tabs', params: { screen: 'Home' } })} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  icon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 18, ...shadow.sm },
  title: { fontSize: font.h2, fontWeight: font.weightBold, color: colors.ink, textAlign: 'center' },
  sub: { fontSize: font.small, color: colors.textMuted, textAlign: 'center', lineHeight: 21, marginTop: 10, paddingHorizontal: 10 },
});
