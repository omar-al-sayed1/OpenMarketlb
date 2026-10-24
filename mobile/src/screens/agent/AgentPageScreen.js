import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AgentScreenWrap } from '../../components/agent/AgentKit';
import { colors, radius, fonts, shadow } from '../../theme/theme';

/* Placeholder for agent sections that haven't been ported to mobile yet. */
export default function AgentPageScreen({ route }) {
  const title = route.params?.title || 'Agent';
  return (
    <AgentScreenWrap>
      <View style={styles.body}>
        <View style={styles.icon}><Ionicons name="construct-outline" size={38} color={colors.violet} /></View>
        <Text style={styles.t}>{title}</Text>
        <Text style={styles.s}>This agent section is being ported to mobile. The full tools are available now in the web dashboard and will land here soon.</Text>
      </View>
    </AgentScreenWrap>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', justifyContent: 'center', paddingVertical: 70, paddingHorizontal: 20 },
  icon: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16, ...shadow.card },
  t: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink, textAlign: 'center' },
  s: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
