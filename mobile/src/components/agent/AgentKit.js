import React, { useRef, createContext, useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, agent, radius, fonts, shadow } from '../../theme/theme';
import { TAB_SPACE } from '../ui';

/* the AgentLayout api.agent.me hydration — screens read the profile from here */
export const AgentContext = createContext({ agent: null, refresh: () => {} });
export const useAgent = () => useContext(AgentContext);

/* ---------- Screen wrapper: slate wash + violet pull-to-refresh ---------- */
export function AgentScreenWrap({ children, refreshing, onRefresh, contentStyle, ...rest }) {
  return (
    <View style={{ flex: 1, backgroundColor: agent.bg }} {...rest}>
      <LinearGradient colors={['#f8fafc', '#ffffff', colors.p50]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[{ padding: 14, paddingBottom: TAB_SPACE + 20 }, contentStyle]}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.violet} colors={[colors.violet]} /> : undefined}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/* ---------- per-page neon hero: rounded-3xl gradient with blobs + pill tag ---------- */
export function AgentHero({ grad, tag, tagIcon = 'sparkles', title, sub, children }) {
  return (
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={hs.hero}>
      <View style={[hs.blob, { top: -48, right: -48 }]} />
      <View style={[hs.blob, { bottom: -64, left: -64, width: 224, height: 224, backgroundColor: 'rgba(255,255,255,0.05)' }]} />
      {tag ? (
        <View style={hs.tag}>
          <Ionicons name={tagIcon} size={12} color={colors.white} />
          <Text style={hs.tagText}>{tag}</Text>
        </View>
      ) : null}
      {title ? <Text style={hs.title}>{title}</Text> : null}
      {sub ? <Text style={hs.sub}>{sub}</Text> : null}
      {children}
    </LinearGradient>
  );
}
const hs = StyleSheet.create({
  hero: { borderRadius: radius.xxl, padding: 20, overflow: 'hidden', ...shadow.emphasis },
  blob: { position: 'absolute', width: 192, height: 192, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.1)' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5, marginBottom: 10 },
  tagText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 11.5 },
  title: { color: colors.white, fontFamily: fonts.heading, fontSize: 24, letterSpacing: -0.5 },
  sub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 12.5, marginTop: 4, lineHeight: 18 },
});

/* ---------- quick-nav card that tilts slightly on press ---------- */
export function TiltCard({ icon, label, sub = 'Open', grad, onPress }) {
  const tilt = useRef(new Animated.Value(0)).current;
  const to = (v) => Animated.spring(tilt, { toValue: v, useNativeDriver: true, speed: 40 }).start();
  return (
    <Animated.View style={{ flex: 1, transform: [
      { rotate: tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-1.6deg'] }) },
      { scale: tilt.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) },
    ] }}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} onPressIn={() => to(1)} onPressOut={() => to(0)} style={ts.card}>
        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={ts.tile}>
          <Ionicons name={icon} size={18} color={colors.white} />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={ts.label} numberOfLines={1}>{label}</Text>
          <Text style={ts.sub}>{sub}</Text>
        </View>
        <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}
const ts = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 13, ...shadow.card },
  tile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  label: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 1 },
});
