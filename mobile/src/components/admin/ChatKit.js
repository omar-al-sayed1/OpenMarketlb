import React, { useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated, Easing, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { img } from '../../lib/media';
import { colors, radius, fonts } from '../../theme/theme';

/* time formatter — mirrors the web formatTime */
export const chatTime = (d) => {
  if (!d) return '';
  const date = new Date(d); const now = new Date(); const diff = now - date;
  if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
export const clockTime = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

/* three bouncing dots */
export function TypingDots({ color = colors.violet }) {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 150),
      Animated.timing(d, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(d, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.delay((2 - i) * 150),
    ])));
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []); // eslint-disable-line
  return (
    <View style={styles.typing}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={[styles.typingDot, { backgroundColor: color, transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }], opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }]} />
      ))}
    </View>
  );
}

/* bubble mount animation — mine slides from right, theirs from left */
export function Bubble({ mine, children, style }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, []); // eslint-disable-line
  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [mine ? 26 : -26, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/* attachment renderer — image (scale-in), document, product snapshot */
export function MsgAttachment({ msg, mine }) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const isImage = msg.attachment_type === 'image' || (!msg.attachment_type && msg.image_url);
  const imageUrl = msg.attachment_url || msg.image_url;
  useEffect(() => { if (isImage && imageUrl) Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }).start(); }, []); // eslint-disable-line

  if (isImage && imageUrl) {
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={() => Linking.openURL(img(imageUrl)).catch(() => {})}>
        <Animated.Image source={{ uri: img(imageUrl) }} style={[styles.attImg, { transform: [{ scale }] }]} />
      </TouchableOpacity>
    );
  }
  if (msg.attachment_type === 'document' && msg.attachment_url) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => Linking.openURL(img(msg.attachment_url)).catch(() => {})}
        style={[styles.doc, mine ? styles.docMine : styles.docTheirs]}>
        <Ionicons name="document-text" size={18} color={mine ? colors.white : colors.textSecondary} />
        <Text style={[styles.docName, { color: mine ? colors.white : colors.textSecondary }]} numberOfLines={1}>{msg.attachment_name || 'Document'}</Text>
      </TouchableOpacity>
    );
  }
  if (msg.attachment_type === 'product' && msg.product_snapshot) {
    const p = msg.product_snapshot;
    return (
      <View style={[styles.prod, mine ? styles.docMine : styles.docTheirs]}>
        {p.image ? <Image source={{ uri: img(p.image) }} style={styles.prodImg} /> : <Ionicons name="bag" size={20} color={colors.textMuted} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.prodName, { color: mine ? colors.white : colors.ink }]} numberOfLines={1}>{p.name}</Text>
          <Text style={[styles.prodPrice, { color: mine ? 'rgba(255,255,255,0.9)' : colors.violet }]}>${p.price}</Text>
        </View>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  typing: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.surface, borderRadius: 18, borderBottomLeftRadius: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.borderLight },
  typingDot: { width: 7, height: 7, borderRadius: 3.5 },
  attImg: { width: 200, height: 150, borderRadius: 12, marginBottom: 6, backgroundColor: colors.bgAlt },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, marginBottom: 6, borderWidth: 1 },
  docMine: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)' },
  docTheirs: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  docName: { fontFamily: fonts.medium, fontSize: 12, maxWidth: 170 },
  prod: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10, marginBottom: 6, borderWidth: 1 },
  prodImg: { width: 42, height: 42, borderRadius: 8, backgroundColor: colors.bgAlt },
  prodName: { fontFamily: fonts.bold, fontSize: 12 },
  prodPrice: { fontFamily: fonts.extrabold, fontSize: 12, marginTop: 1 },
});
