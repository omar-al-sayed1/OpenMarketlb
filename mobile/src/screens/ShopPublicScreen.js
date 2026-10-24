import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, FlatList, TouchableOpacity, StyleSheet, Share, Modal, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInDown, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { img } from '../lib/media';
import { tapLight } from '../lib/haptics';
import ProductCard from '../components/ProductCard';
import { Loading, Empty, SkeletonGrid } from '../components/ui';
import { colors, gradients, radius, fonts, shadow } from '../theme/theme';
import { useReveal } from '../lib/useReveal';

/* Compact hero action pill (small, mirrors the web shop actions). */
function ActionPill({ icon, label, onPress, accent, gradient, count }) {
  const body = (
    <>
      <Ionicons name={icon} size={12} color={gradient ? colors.onPrimary : accent || colors.textSecondary} />
      <Text style={[styles.pillText, { color: gradient ? colors.onPrimary : accent || colors.text }]}>{label}</Text>
      {count != null ? <View style={styles.pillCount}><Text style={styles.pillCountText}>{count}</Text></View> : null}
    </>
  );
  if (gradient) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.pill, styles.pillGradient]}>{body}</LinearGradient>
      </TouchableOpacity>
    );
  }
  return <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.pill, styles.pillGhost, accent && { borderColor: `${accent}55` }]}>{body}</TouchableOpacity>;
}

/* Sponsored products rail — gradient header + "Ad" badge + snap carousel. */
function SponsoredRail({ title, subtitle, products, testID }) {
  if (!products.length) return null;
  return (
    <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.railWrap} testID={testID}>
      <View style={styles.railHead}>
        <LinearGradient colors={[colors.p500, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.railTile}><Ionicons name="megaphone" size={14} color={colors.white} /></LinearGradient>
        <View style={{ flex: 1 }}>
          <View style={styles.railTitleRow}>
            <Text style={styles.railTitle} numberOfLines={1}>{title}</Text>
            <View style={styles.adBadge}><Ionicons name="megaphone" size={8} color="#b45309" /><Text style={styles.adText}>Ad</Text></View>
          </View>
          {subtitle ? <Text style={styles.railSub}>{subtitle}</Text> : null}
        </View>
      </View>
      <FlatList
        data={products}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p, i) => p.id || String(i)}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 9 }}
        snapToInterval={150}
        snapToAlignment="start"
        decelerationRate="fast"
        renderItem={({ item }) => <ProductCard product={item} isSponsored showShopName style={{ width: 142 }} />}
      />
    </Animated.View>
  );
}

export default function ShopPublicScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useAuth();
  const id = route.params?.id;
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [sale, setSale] = useState(null);
  const [sponsored, setSponsored] = useState([]);
  const [tab, setTab] = useState('products');
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState(null); // fullscreen image preview (uri) or null
  const { visible: shownProducts, hasMore: moreProducts, revealing: revealingProducts, revealMore: revealProducts } = useReveal(products, 8);

  useEffect(() => {
    Promise.allSettled([
      api.shops.getById(id),
      api.shops.getProducts(id),
      api.shops.getActiveSale(id),
      api.shops.getGallery(id),
      api.promotions.getActive({ limit: 40 }),
    ]).then(([s, p, sa, g, sp]) => {
      if (s.status === 'fulfilled') setShop(s.value.data?.shop || s.value.data);
      if (p.status === 'fulfilled') setProducts(Array.isArray(p.value.data) ? p.value.data : p.value.data?.products || []);
      if (sa.status === 'fulfilled') setSale(sa.value.data?.sale || sa.value.data || null);
      if (g.status === 'fulfilled') { const gd = g.value.data; setGallery(Array.isArray(gd) ? gd : (gd?.gallery || gd?.photos || [])); }
      if (sp.status === 'fulfilled') setSponsored(sp.value.data?.products || []);
      setLoading(false);
    });
  }, [id]);

  // Swipe left/right over the tab content to switch Products ⇄ Gallery. Horizontal-only
  // (failOffsetY) so it never fights the vertical page scroll.
  // NOTE: this hook MUST stay above the `if (loading) return` early exit — otherwise the number
  // of hooks changes between renders ("Rendered more hooks than during the previous render").
  const swipeTabs = React.useMemo(() => Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-16, 16])
    .onEnd((e) => {
      'worklet';
      if (e.translationX < -45) runOnJS(setTab)('gallery');
      else if (e.translationX > 45) runOnJS(setTab)('products');
    }), []);

  if (loading) return <Loading />;
  const s = shop || { name: route.params?.name || 'Shop' };
  const salePct = sale?.percent || sale?.discount_percent || sale?.active_sale_percent;
  const hasSale = sale && salePct;

  // Sponsored BY this shop (top) · sponsored by OTHER shops (end)
  const shopSponsored = sponsored.filter((p) => p.shop_id === id).slice(0, 10);
  const otherSponsored = sponsored.filter((p) => p.shop_id !== id).slice(0, 10);

  const doShare = () => Share.share({ message: `${s.name} on OpenMarketlb`, title: s.name }).catch(() => {});
  const goMap = () => navigation.navigate('Root', { screen: 'Tabs', params: { screen: 'Map' } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="shop-public-page">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent: e }) => {
          if (tab !== 'products' || !moreProducts) return;
          const nearBottom = e.layoutMeasurement.height + e.contentOffset.y >= e.contentSize.height - 600;
          if (nearBottom) revealProducts();
        }}
      >
        {/* Cover — tap to preview the cover photo full-screen */}
        <TouchableOpacity activeOpacity={s.banner ? 0.92 : 1} onPress={() => s.banner && setViewer(img(s.banner))} style={styles.cover}>
          {s.banner ? <Image source={{ uri: img(s.banner) }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <LinearGradient colors={[colors.p450, colors.s500, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
          <LinearGradient colors={['rgba(0,0,0,0.28)', 'transparent', 'rgba(0,0,0,0.45)']} style={StyleSheet.absoluteFill} />
          {s.banner ? <View style={styles.coverHint}><Ionicons name="expand" size={12} color={colors.white} /><Text style={styles.coverHintText}>View cover</Text></View> : null}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.back, { top: insets.top + 6 }]} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={22} color={colors.white} /></TouchableOpacity>

        {/* Header card (unchanged structure, slightly smaller type) */}
        <View style={styles.headWrap}>
          <TouchableOpacity activeOpacity={s.logo ? 0.85 : 1} onPress={() => { if (s.logo) { tapLight(); setViewer(img(s.logo)); } }} style={styles.avatar}>
            {s.logo ? <Image source={{ uri: img(s.logo) }} style={{ width: '100%', height: '100%', borderRadius: 20 }} /> : (
              <LinearGradient colors={[colors.p450, colors.s500]} style={styles.avatarFallback}><Text style={styles.avatarLetter}>{(s.name || 'S').charAt(0).toUpperCase()}</Text></LinearGradient>
            )}
            {s.logo ? <View style={styles.avatarExpand}><Ionicons name="expand" size={10} color={colors.white} /></View> : null}
          </TouchableOpacity>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
            {s.is_verified && <Ionicons name="checkmark-circle" size={16} color={colors.seller} />}
          </View>
          <View style={styles.metaRow}>
            {s.tier || s.subscription_status === 'active' ? (
              <View style={styles.tierBadge}><Ionicons name="star" size={10} color="#ca8a04" /><Text style={styles.tierText}>{s.tier ? String(s.tier).toUpperCase() : 'PRO'}</Text></View>
            ) : null}
            {s.state ? <View style={styles.stateChip}><Ionicons name="location" size={11} color={colors.seller} /><Text style={styles.stateChipText}>{s.state}</Text></View> : null}
          </View>
          {s.description ? <Text style={styles.desc} numberOfLines={3}>{s.description}</Text> : null}

          {/* Stats */}
          <View style={styles.stats}>
            {[[products.length, 'Products'], [s.state || '—', 'Location'], [s.rating ? Number(s.rating).toFixed(1) : '—', 'Rating']].map(([v, l]) => (
              <View key={l} style={styles.stat}><Text style={styles.statValue}>{v}</Text><Text style={styles.statLabel}>{l}</Text></View>
            ))}
          </View>

          {/* Compact action pills — small so Message / Call / Email / Share / Location fit */}
          <View style={styles.actions}>
            <ActionPill icon="chatbubble-ellipses" label="Message" gradient onPress={() => { tapLight(); navigation.navigate(isLoggedIn ? 'Messages' : 'Auth'); }} />
            {s.phone ? <ActionPill icon="call" label="Call" accent={colors.seller} onPress={() => { tapLight(); Linking.openURL(`tel:${s.phone}`); }} /> : null}
            {s.email ? <ActionPill icon="mail" label="Email" accent="#2563eb" onPress={() => { tapLight(); Linking.openURL(`mailto:${s.email}`); }} /> : null}
            <ActionPill icon="share-social-outline" label="Share" onPress={doShare} />
            <ActionPill icon="location-outline" label="Location" accent={colors.seller} onPress={goMap} />
            {gallery.length > 0 ? <ActionPill icon="images-outline" label="Gallery" count={gallery.length} onPress={() => { setTab('gallery'); }} /> : null}
          </View>
        </View>

        {/* Sale banner */}
        {hasSale ? (
          <LinearGradient colors={['#f59e0b', '#f97316', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saleBanner}>
            <Ionicons name="flame" size={18} color={colors.white} />
            <View style={{ flex: 1 }}><Text style={styles.saleTitle}>Shop Sale — up to {salePct}% off</Text><Text style={styles.saleSub}>Limited time across this shop's products</Text></View>
          </LinearGradient>
        ) : null}

        {/* ⭐ Boosted by this shop (top) */}
        <SponsoredRail title="Boosted by this shop" subtitle="Featured picks from this shop" products={shopSponsored} testID="shop-boosted-row" />

        {/* Tabs */}
        <View style={styles.tabs}>
          {[['products', 'Products'], ['gallery', 'Gallery']].map(([k, l]) => (
            <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabOn]} onPress={() => setTab(k)}>
              <Text style={[styles.tabText, tab === k && { color: colors.violet }]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content — swipe horizontally to switch tabs */}
        <GestureDetector gesture={swipeTabs}>
          <View style={{ minHeight: 220 }}>
            {tab === 'products' ? (
              products.length ? (
                <>
                  <View style={styles.grid}>{shownProducts.map((p) => <View key={p.id} style={styles.gridItem}><ProductCard product={p} /></View>)}</View>
                  {revealingProducts ? <SkeletonGrid count={2} /> : null}
                </>
              ) : <Empty icon="cube-outline" title="No products yet" />
            ) : (
              gallery.length ? (
                <View style={styles.galleryGrid}>{gallery.map((g, i) => <Image key={g.id || i} source={{ uri: img(g.url || g.image_url || g) }} style={styles.galleryImg} resizeMode="cover" />)}</View>
              ) : <Empty icon="images-outline" title="No gallery photos" />
            )}
          </View>
        </GestureDetector>

        {/* 🛍️ Sponsored from other shops (end) */}
        <View style={{ marginTop: 18 }}>
          <SponsoredRail title="Sponsored from other shops" subtitle="Discover more across the marketplace" products={otherSponsored} testID="shop-other-sponsored" />
        </View>
      </ScrollView>

      {/* Full-screen image preview (cover / logo) */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewerBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setViewer(null)} />
          {viewer ? <Image source={{ uri: viewer }} style={styles.viewerImg} resizeMode="contain" /> : null}
          <TouchableOpacity style={[styles.viewerClose, { top: insets.top + 10 }]} onPress={() => setViewer(null)}>
            <Ionicons name="close" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { height: 208, backgroundColor: colors.surfaceMuted },
  coverHint: { position: 'absolute', right: 12, bottom: 52, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill },
  coverHintText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 10.5 },
  back: { position: 'absolute', left: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  avatarExpand: { position: 'absolute', right: 2, bottom: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.white },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '80%' },
  viewerClose: { position: 'absolute', right: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  headWrap: { backgroundColor: colors.surface, marginHorizontal: 12, marginTop: -16, borderRadius: radius.lg, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight, ...shadow.emphasis },
  avatar: { width: 78, height: 78, borderRadius: 22, borderWidth: 4, borderColor: colors.white, overflow: 'hidden', marginTop: -56, backgroundColor: colors.white, ...shadow.card },
  avatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 30 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 11 },
  name: { fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.5, color: colors.ink, maxWidth: 240 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6, backgroundColor: colors.goldBg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  tierText: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.goldText, letterSpacing: 0.5 },
  desc: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 9, lineHeight: 18 },
  stats: { flexDirection: 'row', marginTop: 14, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, paddingVertical: 11, width: '100%' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
  statLabel: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 14 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: 9, borderRadius: radius.pill },
  pillGradient: { ...shadow.violetGlow },
  pillGhost: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  pillText: { fontFamily: fonts.bold, fontSize: 10.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  stateChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.sellerSoft, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  stateChipText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.sellerSoftText },
  pillCount: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 1 },
  pillCountText: { fontFamily: fonts.extrabold, fontSize: 9, color: colors.violet },
  saleBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 12, marginBottom: 0, padding: 13, borderRadius: radius.md, ...shadow.amberGlow },
  saleTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 13, letterSpacing: -0.2 },
  saleSub: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.body, fontSize: 10.5, marginTop: 1 },
  railWrap: { marginTop: 16 },
  railHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginBottom: 11 },
  railTile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  railTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  railTitle: { fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.p700 },
  railSub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  adBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  adText: { fontFamily: fonts.bold, fontSize: 9, color: '#b45309' },
  tabs: { flexDirection: 'row', marginHorizontal: 12, marginTop: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.violet },
  tabText: { fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 9, paddingTop: 10 },
  gridItem: { width: '50%', paddingHorizontal: 1, marginBottom: 4 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingTop: 12, gap: 6 },
  galleryImg: { width: '31.8%', aspectRatio: 1, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
});
