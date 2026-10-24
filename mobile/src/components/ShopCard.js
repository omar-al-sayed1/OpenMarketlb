import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image'; // native caching/decode for smooth shop lists
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { img } from '../lib/media';
import { colors, gradients, radius, fonts, shadow } from '../theme/theme';

// Cover gradient fallbacks that rotate by index (mirrors web).
const COVERS = [
  [colors.p450, colors.p400, '#ffc0cb'],
  ['#10b981', '#14b8a6', '#06b6d4'],
  ['#f43f5e', '#ec4899', '#ffc0cb'],
  ['#f59e0b', '#f97316', '#ef4444'],
  ['#3b82f6', colors.s600, colors.p450],
];

export default function ShopCard({ shop, index = 0, style }) {
  const navigation = useNavigation();
  const cover = COVERS[index % COVERS.length];
  const go = () => navigation.navigate('ShopPublic', { id: shop.id, name: shop.name });

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={go} style={[styles.card, style]}>
      {/* Cover */}
      <View style={styles.cover}>
        {shop.banner ? (
          <Image source={{ uri: img(shop.banner) }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={120} recyclingKey={shop.id} />
        ) : (
          <LinearGradient colors={cover} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient colors={['transparent', 'rgba(15,23,42,0.3)', 'rgba(15,23,42,0.85)']} style={StyleSheet.absoluteFill} />

        {/* State pill */}
        {shop.state ? (
          <View style={styles.statePill}>
            <Ionicons name="location" size={9} color={colors.white} />
            <Text style={styles.stateText}>{shop.state}</Text>
          </View>
        ) : null}

        {/* Sale badge */}
        {shop.has_active_sale && shop.active_sale_percent ? (
          <LinearGradient colors={['#fbbf24', '#f97316', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saleBadge}>
            <Text style={styles.saleLabel}>SALE</Text>
            <Text style={styles.salePct}>-{shop.active_sale_percent}%</Text>
          </LinearGradient>
        ) : null}

        {/* accent bar */}
        <LinearGradient colors={gradients.seller} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accent} />
      </View>

      {/* Avatar + content */}
      <View style={styles.body}>
        <View style={styles.avatarRow}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              {shop.logo ? (
                <Image source={{ uri: img(shop.logo) }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" recyclingKey={shop.id} />
              ) : (
                <LinearGradient colors={gradients.seller} style={styles.avatarFallback}>
                  <Text style={styles.avatarLetter}>{(shop.name || 'S').charAt(0).toUpperCase()}</Text>
                </LinearGradient>
              )}
            </View>
            <View style={styles.check}><Ionicons name="checkmark" size={10} color={colors.white} /></View>
          </View>
          <Text style={styles.name} numberOfLines={1}>{shop.name}</Text>
        </View>

        <Text style={styles.desc} numberOfLines={2}>{shop.description || 'Quality products & fast delivery across Lebanon.'}</Text>

        <View style={styles.footer}>
          <View style={styles.trusted}>
            <Ionicons name="shield-checkmark" size={11} color={colors.sellerSoftText} />
            <Text style={styles.trustedText}>Trusted</Text>
          </View>
          <View style={styles.visit}>
            <Text style={styles.visitText}>Visit Shop</Text>
            <Ionicons name="arrow-forward" size={12} color={colors.text} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { width: 230, backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderLight, ...shadow.emphasis },
  cover: { height: 106, position: 'relative' },
  statePill: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  stateText: { color: colors.white, fontFamily: fonts.bold, fontSize: 9 },
  saleBadge: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  saleLabel: { color: colors.white, fontFamily: fonts.bold, fontSize: 9, opacity: 0.9 },
  salePct: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 13 },
  accent: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2 },
  body: { paddingHorizontal: 13, paddingBottom: 13 },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: -28 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 54, height: 54, borderRadius: radius.md, borderWidth: 2.5, borderColor: colors.white, overflow: 'hidden', backgroundColor: colors.white, ...shadow.card },
  avatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 18 },
  check: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.seller, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink, letterSpacing: -0.4, marginTop: 32 },
  desc: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, lineHeight: 15, marginTop: 8, marginBottom: 10, minHeight: 28 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderLight },
  trusted: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.sellerSoft, borderWidth: 1, borderColor: '#a7f3d0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  trustedText: { fontFamily: fonts.bold, fontSize: 9, color: colors.sellerSoftText, textTransform: 'uppercase', letterSpacing: 0.5 },
  visit: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  visitText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text },
});
