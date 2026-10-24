import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, FlatList, ScrollView, Image, TouchableOpacity, TextInput, StyleSheet, Animated, RefreshControl, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { pickImage } from '../lib/imagePick';
import { api } from '../lib/api';
import { img } from '../lib/media';
import { listPerfProps } from '../lib/useReveal';
import { useAuth } from '../context/AuthContext';
import ProductCard from '../components/ProductCard';
import ShopCard from '../components/ShopCard';
import HomeBannerCarousel from '../components/HomeBannerCarousel';
import { hiddenRefreshControl, RefreshIndicator } from '../components/CustomRefresh';
import { SectionHeader, GradientButton, SkeletonBlock, ProductCardSkeleton, Pill, TAB_SPACE } from '../components/ui';
import { colors, gradients, radius, font, fonts, shadow, motion } from '../theme/theme';

const W = Dimensions.get('window').width;
const QUICK = ['Under $10', 'New arrivals', 'Top rated', 'Free gifts', 'Big discounts'];
const PERKS = [
  { icon: 'shield-checkmark', label: 'Buyer protection' },
  { icon: 'rocket', label: 'Fast delivery' },
  { icon: 'pricetags', label: 'Best prices' },
  { icon: 'headset', label: '24/7 support' },
];
const TYPES = [
  { key: 'men', label: "Men's", tagline: 'Sharp & Refined', icon: 'man', grad: gradients.men, accent: '#60a5fa',
    img: 'https://images.unsplash.com/photo-1617196701537-7329482cc9fe?w=800&h=1000&fit=crop' },
  { key: 'women', label: "Women's", tagline: 'Elegant & Bold', icon: 'woman', grad: gradients.women, accent: '#f9a8d4',
    img: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=1000&fit=crop' },
  { key: 'kids', label: 'Kids', tagline: 'Fun & Playful', icon: 'happy', grad: gradients.kids, accent: '#fcd34d',
    img: 'https://images.unsplash.com/photo-1622290319146-7b72e4e1ad81?w=800&h=1000&fit=crop' },
];

/* Fade-up entrance wrapper */
function FadeUp({ delay = 0, children, style }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: motion.entrance, delay, useNativeDriver: true }).start();
  }, [a, delay]);
  return (
    <Animated.View style={[{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

const RAIL_CARD_W = 160;
const RAIL_GAP = 12;

function ProductRail({ eyebrow, title, data, onAction, sponsored }) {
  if (!data?.length) return null;
  return (
    <View>
      <SectionHeader eyebrow={eyebrow} title={title} onAction={onAction} />
      <FlatList
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p, i) => p.id || String(i)}
        contentContainerStyle={{ paddingHorizontal: 16, gap: RAIL_GAP }}
        /* fluid, snappy swiping — glides and settles on a card, flings across several */
        snapToInterval={RAIL_CARD_W + RAIL_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        pagingEnabled={false}
        overScrollMode="always"
        bounces
        renderItem={({ item }) => <ProductCard product={item} isSponsored={sponsored} showShopName carousel style={{ width: RAIL_CARD_W }} />}
      />
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const { isLoggedIn, user } = useAuth();
  const [cats, setCats] = useState([]);
  const [shops, setShops] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [sponsored, setSponsored] = useState([]);
  const [trending, setTrending] = useState([]);
  const [typeImages, setTypeImages] = useState({});
  const [feed, setFeed] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTop = useCallback(async () => {
    const results = await Promise.allSettled([
      api.categories.getTopLevelWithPreview(), // preview_image includes a product-photo fallback
      api.shops.getAll(),
      api.products.getWithGifts(),
      api.products.getAll({ limit: 10, sponsored: true }),
      api.products.getAll({ limit: 10, sort: 'trending' }),
      api.typeImages.get(),
    ]);
    const [c, s, g, sp, tr, ti] = results;
    if (c.status === 'fulfilled') setCats((Array.isArray(c.value.data) ? c.value.data : c.value.data?.categories || []).slice(0, 12));
    if (s.status === 'fulfilled') setShops((Array.isArray(s.value.data) ? s.value.data : s.value.data?.shops || []).slice(0, 12));
    if (g.status === 'fulfilled') setGifts((Array.isArray(g.value.data) ? g.value.data : g.value.data?.products || []).slice(0, 10));
    if (sp.status === 'fulfilled') setSponsored((Array.isArray(sp.value.data) ? sp.value.data : sp.value.data?.products || []).slice(0, 10));
    if (tr.status === 'fulfilled') setTrending((Array.isArray(tr.value.data) ? tr.value.data : tr.value.data?.products || []).slice(0, 10));
    if (ti.status === 'fulfilled') setTypeImages(ti.value.data || {});
    setLoading(false);
    setRefreshing(false);
  }, []);

  const loadFeed = useCallback(async (p) => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const { data } = await api.products.getAll({ page: p, limit: 12 });
      const items = Array.isArray(data) ? data : data?.products || [];
      setFeed((prev) => (p === 1 ? items : [...prev, ...items]));
      if (items.length < 12 || data?.has_more === false) setMore(false);
      setPage(p + 1);
    } catch (_) { setMore(false); }
    finally { setLoadingMore(false); }
  }, [loadingMore]);

  useEffect(() => { loadTop(); loadFeed(1); }, []); // eslint-disable-line

  const onRefresh = () => { setRefreshing(true); setPage(1); setMore(true); loadTop(); loadFeed(1); };

  const Header = (
    <View>
      <HomeBannerCarousel />

      {/* ===== HERO SECTION — compact search + quick filters + CTAs ===== */}
      <FadeUp delay={0}>
        {/* Decorative brand background: soft primary→secondary wash + colored blobs. */}
        <View style={styles.webHero}>
          <LinearGradient colors={[colors.primarySoft, colors.surface, colors.secondarySoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroBlob, { top: -70, left: -45, backgroundColor: colors.primary, opacity: 0.14 }]} />
          <View style={[styles.heroBlob, { bottom: -70, right: -45, backgroundColor: colors.secondary, opacity: 0.14 }]} />
          <View style={[styles.heroBlobSm, { top: 16, right: 26, backgroundColor: colors.secondary, opacity: 0.12 }]} />
          <View style={[styles.heroBlobSm, { bottom: 6, left: 36, backgroundColor: colors.primary, opacity: 0.14 }]} />

          <TouchableOpacity style={styles.webSearch} activeOpacity={0.9} onPress={() => navigation.navigate('Search')}>
            <Ionicons name="search" size={14} color={colors.textMuted} />
            <Text style={styles.webSearchText} numberOfLines={1}>Search products, shops…</Text>
            <LinearGradient colors={[colors.p500, colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.webSearchBtn}>
              <Ionicons name="search" size={13} color={colors.white} />
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.quickFilters}>
            {QUICK_CATS.map((name) => {
              const c = cats.find((x) => x.name === name);
              return c ? (
                <TouchableOpacity key={name} style={styles.qfChip} onPress={() => navigation.navigate('Shop', { categoryId: c.id, categoryName: c.name })}>
                  <Text style={styles.qfChipText}>{name}</Text>
                </TouchableOpacity>
              ) : null;
            })}
            <TouchableOpacity onPress={() => navigation.navigate('Shop')}><Text style={styles.browseAll}>Browse all</Text></TouchableOpacity>
          </View>

          <View style={styles.heroCtas}>
            <TouchableOpacity style={{ flex: 1.3 }} activeOpacity={0.9} onPress={() => navigation.navigate('Shop')}>
              <LinearGradient colors={[colors.p500, colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaPrimary}>
                <View style={styles.ctaGloss} pointerEvents="none" />
                <View style={styles.ctaIconTile}><Ionicons name="bag-handle" size={12} color={colors.primarySoftText} /></View>
                <Text style={styles.ctaPrimaryText}>Shop now</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.85} onPress={() => navigation.navigate(isLoggedIn ? 'Sell' : 'Auth')}>
              <View style={styles.ctaOutline}>
                <Ionicons name="storefront-outline" size={13} color={colors.primarySoftText} />
                <Text style={styles.ctaOutlineText}>Sell</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </FadeUp>

      {/* ===== CATEGORIES ===== */}
      {cats.length > 0 && (
        <View style={styles.catsWrap}>
          <SectionHeader eyebrow="Explore" title="Shop by category" onAction={() => navigation.navigate('Shop')} />
          <FlatList
            data={cats}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(c, i) => c.id || String(i)}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            renderItem={({ item }) => {
              const catImg = item.preview_image || item.image_url;
              return (
                <TouchableOpacity activeOpacity={0.9} style={styles.catCard} onPress={() => navigation.navigate('Shop', { categoryId: item.id, categoryName: item.name })}>
                  {catImg ? <Image source={{ uri: img(catImg) }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
                  <LinearGradient colors={['transparent', 'rgba(15,23,42,0.35)', 'rgba(15,23,42,0.88)']} style={StyleSheet.absoluteFill} />
                  {item.product_count > 0 && (
                    <View style={styles.catCount}><Text style={styles.catCountText}>{item.product_count}</Text></View>
                  )}
                  <View style={styles.catFooter}>
                    <Text style={styles.catName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.catArrow}><Ionicons name="arrow-forward" size={13} color={colors.violet} /></View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      <ProductRail eyebrow="Promoted" title="Sponsored picks" data={sponsored} sponsored onAction={() => navigation.navigate('Shop')} />

      {/* ===== FEATURED SHOPS ===== */}
      {shops.length > 0 && (
        <View>
          <SectionHeader eyebrow="Trusted" title="Featured shops" onAction={() => navigation.navigate('Shops')} />
          <FlatList
            data={shops}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(s, i) => s.id || String(i)}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
            renderItem={({ item, index }) => <ShopCard shop={item} index={index} />}
          />
        </View>
      )}

      <ProductRail eyebrow="Free gifts" title="Buy & get a gift" data={gifts} onAction={() => navigation.navigate('Shop')} />

      {/* ===== SHOP BY TYPE (stacked, with photos) ===== */}
      <SectionHeader eyebrow="Curated for you" title="Choose your style" />
      <View style={styles.typeStack}>
        {TYPES.map((tp) => (
          <TouchableOpacity key={tp.key} activeOpacity={0.92} style={styles.typeCard} onPress={() => navigation.navigate('Shop', { type: tp.key })}>
            <Image source={{ uri: img(typeImages[tp.key]) || tp.img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <LinearGradient colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.82)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={[styles.typeAccent, { backgroundColor: tp.accent }]} />
            <View style={styles.typeContent}>
              <View style={styles.typeIcon}><Ionicons name={tp.icon} size={20} color={colors.white} /></View>
              <Text style={[styles.typeTagline, { color: tp.accent }]}>{tp.tagline.toUpperCase()}</Text>
              <Text style={styles.typeLabel}>{tp.label}</Text>
              <View style={styles.typeCta}><Text style={styles.typeCtaText}>Explore</Text><Ionicons name="arrow-forward" size={13} color={colors.white} /></View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <ProductRail eyebrow="Hot right now" title="Trending" data={trending} onAction={() => navigation.navigate('Shop')} />

      {/* ===== PERKS ===== */}
      <View style={styles.perks}>
        {PERKS.map((p) => (
          <View key={p.label} style={styles.perk}>
            <View style={styles.perkIcon}><Ionicons name={p.icon} size={18} color={colors.violet} /></View>
            <Text style={styles.perkText}>{p.label}</Text>
          </View>
        ))}
      </View>

      <SectionHeader eyebrow="Just for you" title="More to explore" />
    </View>
  );

  const Footer = (
    <View>
      {loadingMore && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 10, marginTop: 8 }}>
          {[0, 1, 2, 3].map((i) => <ProductCardSkeleton key={i} style={{ width: (W - 28) / 2 }} />)}
        </View>
      )}
      {!more && feed.length > 0 && <Text style={styles.end}>You've reached the end 🎉</Text>}

      {/* CTA — become a seller (modern + decorative) */}
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaCard}>
        <View style={styles.ctaBlob1} pointerEvents="none" />
        <View style={styles.ctaBlob2} pointerEvents="none" />
        <Ionicons name="storefront" size={116} color="rgba(255,255,255,0.08)" style={styles.ctaWatermark} />

        <View style={styles.ctaEyebrow}><Ionicons name="rocket" size={11} color={colors.white} /><Text style={styles.ctaEyebrowText}>START SELLING</Text></View>
        <Text style={styles.ctaTitle}>Ready to open your own shop?</Text>
        <Text style={styles.ctaSub}>Join OpenMarketlb and start selling to thousands of local buyers.</Text>

        <View style={styles.ctaChips}>
          {['0% to start', 'Local buyers', 'Easy setup'].map((tItem) => (
            <View key={tItem} style={styles.ctaChip}><Ionicons name="checkmark-circle" size={11} color={colors.white} /><Text style={styles.ctaChipText}>{tItem}</Text></View>
          ))}
        </View>

        <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.9} onPress={() => navigation.navigate(isLoggedIn ? 'Sell' : 'Auth')}>
          <View style={styles.ctaBtnIcon}><Ionicons name="storefront" size={12} color={colors.white} /></View>
          <Text style={styles.ctaBtnText}>Become a Seller</Text>
          <Ionicons name="arrow-forward" size={15} color={colors.p700} />
        </TouchableOpacity>
      </LinearGradient>

      <ContactForm />
    </View>
  );

  if (loading) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: TAB_SPACE }} showsVerticalScrollIndicator={false}>
        {/* Banner + dots */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}><SkeletonBlock height={Math.round((W - 32) * 0.56)} radius={radius.lg} /></View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 12 }}>
          {[0, 1, 2].map((i) => <SkeletonBlock key={i} width={i === 0 ? 18 : 6} height={6} radius={3} />)}
        </View>
        {/* Hero card (search + chips + CTAs) */}
        <View style={{ margin: 16, padding: 15, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, gap: 12 }}>
          <SkeletonBlock height={44} radius={radius.pill} />
          <View style={{ flexDirection: 'row', gap: 7, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[54, 66, 48, 60].map((wd, i) => <SkeletonBlock key={i} width={wd} height={24} radius={12} />)}
          </View>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <SkeletonBlock height={44} radius={radius.md} style={{ flex: 1 }} />
            <SkeletonBlock height={44} radius={radius.md} style={{ flex: 1 }} />
          </View>
        </View>
        {/* Categories row */}
        <SkeletonBlock width={150} height={20} radius={6} style={{ marginHorizontal: 16, marginTop: 4 }} />
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 12 }}>
          {[0, 1, 2].map((i) => <SkeletonBlock key={i} width={120} height={140} radius={radius.md} />)}
        </View>
        {/* Product grid */}
        <SkeletonBlock width={140} height={20} radius={6} style={{ marginHorizontal: 16, marginTop: 24 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginTop: 12 }}>
          {[0, 1, 2, 3].map((i) => <View key={i} style={{ width: '50%', paddingHorizontal: 1, marginBottom: 4 }}><ProductCardSkeleton /></View>)}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        style={{ backgroundColor: colors.bg }}
        data={feed}
        keyExtractor={(p, i) => p.id || String(i)}
        numColumns={2}
        ListHeaderComponent={Header}
        ListFooterComponent={Footer}
        columnWrapperStyle={{ gap: 8, paddingHorizontal: 10, marginBottom: 8 }}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.5}
        onEndReached={() => more && !loadingMore && loadFeed(page)}
        refreshControl={hiddenRefreshControl(refreshing, onRefresh)}
        {...listPerfProps}
        removeClippedSubviews={false} // 2-col grid + tall ContactForm footer: clipping snaps scroll at the end
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}><ProductCard product={item} showShopName /></View>
        )}
      />
      <RefreshIndicator refreshing={refreshing} top={6} />
    </View>
  );
}

const MSG_TYPES = [
  { value: 'general', label: 'General Inquiry', icon: 'help-circle', tint: colors.p400, active: colors.p500 },
  { value: 'bug', label: 'Report a Bug', icon: 'bug', tint: '#fca5a5', active: '#dc2626' },
  { value: 'suggestion', label: 'Suggestion', icon: 'bulb', tint: '#fcd34d', active: '#d97706' },
  { value: 'complaint', label: 'Complaint', icon: 'warning', tint: '#fdba74', active: '#ea580c' },
  { value: 'partnership', label: 'Partnership', icon: 'people', tint: '#6ee7b7', active: '#059669' },
];
const PH = '#64748b';

function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', phone_number: '', message: '', message_type: 'general', photo: '' });
  const [photo, setPhoto] = useState(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pickPhoto = async () => {
    try {
      const res = await pickImage({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      if (!res.canceled && res.assets?.length) setPhoto(res.assets[0]);
    } catch (_) {}
  };

  const submit = async () => {
    if (!form.name || !form.email || !form.phone_number || !form.message) return;
    setBusy(true);
    let photoUrl = '';
    if (photo) { try { const { data } = await api.shop.uploadFile({ uri: photo.uri, name: photo.fileName || 'screenshot.jpg', mimeType: photo.mimeType }); photoUrl = data.url; } catch (_) {} }
    try { await api.contact.send({ ...form, photo: photoUrl }); setSent(true); } catch (_) {} finally { setBusy(false); }
  };

  if (sent) {
    return (
      <View style={cx.section}>
        <LinearGradient colors={['transparent', 'rgba(139,92,246,0.4)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cx.topLine} />
        <View style={cx.sentCard}>
          <View style={cx.sentRing}><Ionicons name="checkmark-circle" size={44} color="#34d399" /></View>
          <Text style={cx.sentTitle}>Message Sent!</Text>
          <Text style={cx.sentSub}>Thanks for reaching out. We'll get back to you within 24 hours.</Text>
          <TouchableOpacity style={cx.sentBtn} onPress={() => { setSent(false); setPhoto(null); setForm({ name: '', email: '', phone_number: '', message: '', message_type: 'general', photo: '' }); }}>
            <Text style={cx.sentBtnText}>Send Another Message</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={cx.section}>
      <LinearGradient colors={['transparent', 'rgba(139,92,246,0.4)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cx.topLine} />
      <View style={[cx.glow, { top: -120, right: -60, backgroundColor: 'rgba(16,185,129,0.10)' }]} />
      <View style={[cx.glow, { bottom: -100, left: -70, backgroundColor: 'rgba(124,58,237,0.12)' }]} />

      {/* Left header */}
      <View style={cx.pill}><Ionicons name="chatbubble-ellipses" size={13} color="#34d399" /><Text style={cx.pillText}>We'd love to hear from you</Text></View>
      <Text style={cx.heading}>Get in <Text style={cx.touch}>Touch</Text></Text>
      <LinearGradient colors={['#34d399', '#22d3ee']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cx.underline} />
      <Text style={cx.para}>Have a question, idea, or just want to say hello? Drop us a message and we'll get back to you within 24 hours.</Text>

      <View style={cx.infoPills}>
        <View style={cx.infoRow}>
          <View style={[cx.infoIcon, { backgroundColor: 'rgba(124,58,237,0.15)', borderColor: 'rgba(124,58,237,0.25)' }]}><Ionicons name="mail" size={16} color={colors.p400} /></View>
          <View><Text style={cx.infoLabel}>EMAIL</Text><Text style={cx.infoValue}>contact@openmarketlb.com</Text></View>
        </View>
        <View style={cx.infoRow}>
          <View style={[cx.infoIcon, { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.25)' }]}><Ionicons name="call" size={16} color="#34d399" /></View>
          <View><Text style={cx.infoLabel}>PHONE</Text><Text style={cx.infoValue}>12-345-6789</Text></View>
        </View>
      </View>

      {/* Form card */}
      <View style={cx.card}>
        <View style={cx.cardHead}>
          <LinearGradient colors={['#10b981', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cx.cardHeadTile}><Ionicons name="chatbubble-ellipses" size={18} color={colors.white} /></LinearGradient>
          <View><Text style={cx.cardTitle}>Send us a Message</Text><Text style={cx.cardSub}>Fill in the form and we'll respond as soon as possible</Text></View>
        </View>

        <Text style={cx.fieldLabel}>WHAT'S THIS ABOUT?</Text>
        <View style={cx.typeRow}>
          {MSG_TYPES.map((t) => {
            const on = form.message_type === t.value;
            return (
              <TouchableOpacity key={t.value} onPress={() => set('message_type', t.value)} style={[cx.typePill, on ? { backgroundColor: t.active, borderColor: 'transparent' } : { backgroundColor: `${t.tint}1a`, borderColor: `${t.tint}55` }]}>
                <Ionicons name={t.icon} size={12} color={on ? colors.white : t.tint} />
                <Text style={[cx.typePillText, { color: on ? colors.white : t.tint }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={cx.twoCol}>
          <View style={{ flex: 1 }}><Text style={cx.fieldLabel}>YOUR NAME *</Text><TextInput style={cx.input} placeholder="John Doe" placeholderTextColor={PH} value={form.name} onChangeText={(v) => set('name', v)} /></View>
          <View style={{ flex: 1 }}><Text style={cx.fieldLabel}>YOUR EMAIL *</Text><TextInput style={cx.input} placeholder="john@example.com" placeholderTextColor={PH} keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={(v) => set('email', v)} /></View>
        </View>
        <Text style={cx.fieldLabel}>PHONE NUMBER *</Text>
        <TextInput style={cx.input} placeholder="+961 XX XXX XXX" placeholderTextColor={PH} keyboardType="phone-pad" value={form.phone_number} onChangeText={(v) => set('phone_number', v)} />
        <Text style={cx.fieldLabel}>YOUR MESSAGE *</Text>
        <TextInput style={[cx.input, { height: 96, textAlignVertical: 'top' }]} placeholder="Tell us what's on your mind..." placeholderTextColor={PH} multiline value={form.message} onChangeText={(v) => set('message', v)} />

        <TouchableOpacity style={cx.attach} activeOpacity={0.85} onPress={pickPhoto}>
          {photo ? <Image source={{ uri: photo.uri }} style={cx.attachThumb} /> : <View style={cx.attachIcon}><Ionicons name="image-outline" size={18} color={PH} /></View>}
          <Text style={cx.attachText}>{photo ? 'Screenshot attached · tap to change' : 'Attach a screenshot (optional)'}</Text>
          {photo ? <TouchableOpacity onPress={() => setPhoto(null)}><Ionicons name="close-circle" size={18} color={PH} /></TouchableOpacity> : null}
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.9} onPress={submit} disabled={busy} style={{ marginTop: 6 }}>
          <LinearGradient colors={['#10b981', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cx.submit}>
            {busy ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="send" size={16} color={colors.white} /><Text style={cx.submitText}>Send Message</Text></>}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const cx = StyleSheet.create({
  section: { backgroundColor: '#020617', paddingHorizontal: 18, paddingTop: 34, paddingBottom: TAB_SPACE, overflow: 'hidden' },
  topLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  glow: { position: 'absolute', width: 260, height: 260, borderRadius: 140 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 14 },
  pillText: { color: '#34d399', fontFamily: fonts.semibold, fontSize: 11.5 },
  heading: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 34, letterSpacing: -0.8 },
  touch: { color: '#34d399' },
  underline: { width: 84, height: 3, borderRadius: 2, marginTop: 4 },
  para: { color: '#94a3b8', fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, marginTop: 14 },
  infoPills: { gap: 12, marginTop: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { color: '#64748b', fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1 },
  infoValue: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.semibold, fontSize: 13.5, marginTop: 1 },

  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 26, padding: 18, marginTop: 26 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  cardHeadTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  cardSub: { color: '#64748b', fontFamily: fonts.body, fontSize: 11, marginTop: 1, maxWidth: 210 },
  fieldLabel: { color: '#94a3b8', fontFamily: fonts.bold, fontSize: 9.5, letterSpacing: 0.8, marginBottom: 7, marginTop: 14 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6 },
  typePillText: { fontFamily: fonts.bold, fontSize: 10.5 },
  twoCol: { flexDirection: 'row', gap: 12 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 14, color: colors.white },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderStyle: 'dashed', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, marginTop: 16 },
  attachIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  attachThumb: { width: 34, height: 34, borderRadius: 9 },
  attachText: { flex: 1, color: '#94a3b8', fontFamily: fonts.medium, fontSize: 12 },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.md, marginTop: 16, ...shadow.emphasis },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },

  sentCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 26, padding: 30, alignItems: 'center' },
  sentRing: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  sentTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 22 },
  sentSub: { color: '#94a3b8', fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  sentBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 12, marginTop: 20 },
  sentBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13.5 },
});

const QUICK_CATS = ['Electronics', 'Fashion', 'Home & Living'];

const styles = StyleSheet.create({
  webHero: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, borderBottomLeftRadius: 26, borderBottomRightRadius: 26, overflow: 'hidden' },
  heroBlob: { position: 'absolute', width: 170, height: 170, borderRadius: 999 },
  heroBlobSm: { position: 'absolute', width: 90, height: 90, borderRadius: 999 },
  webSearch: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 40, paddingLeft: 13, paddingRight: 5, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, ...shadow.card },
  webSearchText: { flex: 1, color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  webSearchBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  quickFilters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  qfChip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5 },
  qfChipText: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.textSecondary },
  browseAll: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.primarySoftText, paddingHorizontal: 6, paddingVertical: 5 },
  heroCtas: { flexDirection: 'row', gap: 8, marginTop: 12 },
  ctaPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: radius.pill, overflow: 'hidden', ...shadow.violetGlow },
  ctaPrimaryText: { fontFamily: fonts.extrabold, fontSize: 12.5, color: colors.white, letterSpacing: 0.2 },
  ctaIconTile: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  ctaGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: 'rgba(255,255,255,0.18)' },
  ctaOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primarySoft },
  ctaOutlineText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.primarySoftText },

  hero: { margin: 16, marginTop: 18, padding: 20, borderRadius: radius.xl, overflow: 'hidden', ...shadow.violetGlow },
  blob: { position: 'absolute', borderRadius: 999 },
  spark: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.85)' },
  heroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, marginBottom: 12 },
  heroEyebrowText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.2 },
  heroTitle: { fontFamily: fonts.extrabold, fontSize: 24, letterSpacing: -0.6, color: colors.white, lineHeight: 30, marginBottom: 16 },
  heroTitleHi: { color: '#fce883' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, paddingLeft: 16, paddingRight: 6, borderRadius: radius.pill, backgroundColor: colors.white, ...shadow.card },
  searchText: { flex: 1, color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14 },
  searchGo: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.violet },
  quickChip: { backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 7 },
  quickChipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.white },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  shopBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 48, borderRadius: radius.pill, backgroundColor: colors.white, ...shadow.card },
  shopBtnText: { fontFamily: fonts.bold, fontSize: 14, color: colors.violet },
  sellBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 48, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' },
  sellText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.white },
  catsWrap: { marginTop: 4 },
  catCard: { width: 158, height: 128, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.surfaceMuted, ...shadow.card },
  catCount: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  catCountText: { color: colors.white, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.3 },
  catFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 11 },
  catName: { flex: 1, color: colors.white, fontFamily: fonts.extrabold, fontSize: 14, letterSpacing: -0.3 },
  catArrow: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  shopCard: { width: 130, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, padding: 12, alignItems: 'center', ...shadow.card },
  shopLogo: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  shopName: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textAlign: 'center' },
  shopMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  verify: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 5 },
  verifyText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.sellerSoftText },
  typeStack: { paddingHorizontal: 16, gap: 14, marginTop: 2 },
  typeCard: { height: 232, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.surfaceMuted, ...shadow.emphasis },
  typeAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  typeContent: { padding: 18 },
  typeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  typeTagline: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  typeLabel: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 24, letterSpacing: -0.5 },
  typeCta: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  typeCtaText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 12 },
  perks: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 20 },
  perk: { alignItems: 'center', flex: 1, gap: 6 },
  perkIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  perkText: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.textSecondary, textAlign: 'center' },
  end: { textAlign: 'center', color: colors.textMuted, fontFamily: fonts.medium, marginVertical: 18 },
  ctaCard: { margin: 16, padding: 22, borderRadius: radius.xl, overflow: 'hidden', ...shadow.violetGlow },
  ctaBlob1: { position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)' },
  ctaBlob2: { position: 'absolute', bottom: -60, left: -20, width: 130, height: 130, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' },
  ctaWatermark: { position: 'absolute', bottom: -18, right: -8 },
  ctaEyebrow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3.5, marginBottom: 10 },
  ctaEyebrowText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.8 },
  ctaTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 21, letterSpacing: -0.5 },
  ctaSub: { color: 'rgba(255,255,255,0.92)', fontFamily: fonts.body, fontSize: 12.5, marginTop: 6, lineHeight: 18 },
  ctaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, marginBottom: 16 },
  ctaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  ctaChipText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 10.5 },
  ctaBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.white, paddingLeft: 6, paddingRight: 15, paddingVertical: 6, borderRadius: radius.pill, ...shadow.card },
  ctaBtnIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.p600 },
  ctaBtnText: { color: colors.p700, fontFamily: fonts.bold, fontSize: 13.5 },
  contact: { margin: 16, marginTop: 0, padding: 20, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, ...shadow.card },
  eyebrow: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.violet, marginBottom: 3 },
  contactHeading: { fontFamily: fonts.extrabold, fontSize: 21, letterSpacing: -0.5, color: colors.ink, marginBottom: 14 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 14, color: colors.ink, marginBottom: 10 },
  contactDone: { alignSelf: 'center', marginBottom: 8 },
  contactTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink, textAlign: 'center' },
  contactSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
  sendAnother: { fontFamily: fonts.semibold, color: colors.violet, textAlign: 'center', marginTop: 12 },
});
