import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { colors, fonts, radius, shadow } from '../theme/theme';
import EndOfPagePromos from '../components/EndOfPagePromos';

const STORY_IMG = 'https://images.pexels.com/photos/5054951/pexels-photo-5054951.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';

const VALUES = [
  { icon: 'shield-checkmark', title: 'Trust & Security', desc: 'Every transaction is protected with bank-level encryption', bg: '#ecfdf5', ic: '#059669' },
  { icon: 'heart', title: 'Customer First', desc: 'Your satisfaction is our #1 priority, always', bg: '#fff1f2', ic: '#e11d48' },
  { icon: 'flash', title: 'Innovation', desc: 'Constantly evolving to serve you better', bg: '#fffbeb', ic: '#d97706' },
  { icon: 'globe', title: 'Community', desc: 'Building bridges between sellers and buyers', bg: colors.p50, ic: colors.p700 },
];

const FALLBACK_TEAM = [
  { name: 'Sarah Chen', position: 'CEO & Founder' },
  { name: 'Marcus Johnson', position: 'CTO' },
  { name: 'Elena Rodriguez', position: 'Head of Design' },
  { name: 'James Wilson', position: 'Head of Operations' },
];

const FALLBACK_TESTIMONIALS = [
  { text: 'OpenMarketlb transformed my small business into a thriving online store. The support is incredible!', author: 'Maria G.', role: 'Handmade Jewelry Seller', rating: 5 },
  { text: "Best marketplace platform I've used. The analytics help me understand my customers better.", author: 'David K.', role: 'Electronics Retailer', rating: 5 },
  { text: 'From zero to 1000 orders in 6 months. OpenMarketlb made it possible!', author: 'Lisa M.', role: 'Fashion Boutique Owner', rating: 5 },
];

const avatarUrl = (name) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Team')}&background=10b981&color=fff&size=200&bold=true`;

/* Count-up number */
function CountUp({ target = 0, suffix = '', style }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!target) { setN(0); return; }
    let cur = 0; const steps = 40; const inc = target / steps;
    const id = setInterval(() => { cur += inc; if (cur >= target) { setN(target); clearInterval(id); } else setN(Math.floor(cur)); }, 1400 / steps);
    return () => clearInterval(id);
  }, [target]);
  return <Text style={style}>{n.toLocaleString()}{suffix}</Text>;
}

export default function AboutScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState({ sellers: 0, products: 0, orders: 0, customers: 0 });
  const [team, setTeam] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [nearEnd, setNearEnd] = useState(0); // reveals more recommended cards as the page nears the bottom
  const nearAt = useRef(0);
  // Throttled to ~2×/sec so scrolling near the bottom doesn't re-render on every frame.
  const onPageScroll = (e) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 700) {
      const now = Date.now();
      if (now - nearAt.current > 500) { nearAt.current = now; setNearEnd((n) => n + 1); }
    }
  };

  useEffect(() => {
    api.publicStats.get().then(({ data }) => setStats({ sellers: data.sellers || 0, products: data.products || 0, orders: data.orders || 0, customers: data.customers || 0 })).catch(() => {});
    api.teamMembers.getAll().then(({ data }) => setTeam(Array.isArray(data) ? data : [])).catch(() => {});
    api.testimonials.getAll().then(({ data }) => setTestimonials(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const statsData = [
    { value: stats.sellers, suffix: '+', label: 'Active Sellers', icon: 'people' },
    { value: stats.products, suffix: '+', label: 'Products Listed', icon: 'bag-handle' },
    { value: stats.orders, suffix: '+', label: 'Orders Fulfilled', icon: 'cube' },
    { value: stats.customers, suffix: '+', label: 'Happy Customers', icon: 'star' },
  ];
  const displayTeam = team.length ? team : FALLBACK_TEAM;
  const displayTestimonials = testimonials.length ? testimonials : FALLBACK_TESTIMONIALS;

  const goTab = (screen) => navigation.navigate('Root', { screen: 'Tabs', params: { screen } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 + insets.bottom }} onScroll={onPageScroll} scrollEventThrottle={16}>
        {/* ===== HERO ===== */}
        <LinearGradient colors={[colors.p950, colors.s950, '#020617']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: insets.top + 8 }]}>
          <View style={[s.blob, { top: -60, left: -50, backgroundColor: 'rgba(124,58,237,0.30)' }]} />
          <View style={[s.blob, { top: 120, right: -70, width: 240, height: 240, backgroundColor: 'rgba(16,185,129,0.22)' }]} />
          <View style={[s.blob, { bottom: -40, left: 60, width: 200, height: 200, backgroundColor: 'rgba(217,70,239,0.18)' }]} />

          <TouchableOpacity style={s.back} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </TouchableOpacity>

          <View style={s.eyebrowPill}>
            <View style={s.ping}><View style={s.pingDot} /></View>
            <Text style={s.eyebrowText}>EMPOWERING ENTREPRENEURS</Text>
          </View>

          <Text style={s.h1}>We're Building the{'\n'}<Text style={s.h1Accent}>Future of Commerce</Text></Text>
          <LinearGradient colors={['#34d399', colors.p400]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.h1Underline} />

          <Text style={s.heroPara}>
            <Text style={{ color: '#34d399', fontFamily: fonts.bold }}>Open</Text>
            <Text style={{ color: colors.p300, fontFamily: fonts.bold }}>Market</Text>
            <Text style={{ color: colors.p300 }}>lb</Text> is more than a marketplace. We're a community of dreamers, creators, and entrepreneurs building Lebanon's digital economy.
          </Text>

          <View style={s.heroCtas}>
            <TouchableOpacity onPress={() => goTab('Sell')} activeOpacity={0.9}>
              <View style={s.ctaFill}><Text style={s.ctaFillText}>Start Selling</Text><Ionicons name="arrow-forward" size={15} color={colors.white} /></View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => goTab('Shop')} activeOpacity={0.85} style={s.ctaGhost}>
              <Text style={s.ctaGhostText}>Explore Products</Text>
            </TouchableOpacity>
          </View>

          <View style={s.heroStats}>
            {statsData.map((st) => (
              <View key={st.label} style={s.heroStatPill}>
                <View style={s.heroStatTop}>
                  <Ionicons name={st.icon} size={14} color="#6ee7b7" />
                  <CountUp target={st.value} suffix={st.suffix} style={s.heroStatNum} />
                </View>
                <Text style={s.heroStatLabel}>{st.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* ===== STORY ===== */}
        <View style={s.section}>
          <Text style={s.eyebrow}>OUR STORY</Text>
          <Text style={s.h2}>Born in <Text style={{ color: '#059669' }}>Beirut</Text>,{'\n'}Built for the World</Text>
          <View style={s.storyImgWrap}>
            <Image source={{ uri: STORY_IMG }} style={s.storyImg} resizeMode="cover" />
          </View>
          <Text style={s.para}>We started with a simple idea: give every Lebanese entrepreneur the tools to reach customers online. Today, we power hundreds of shops across the country, helping small businesses thrive in the digital age.</Text>
          <Text style={s.paraMuted}>Our platform provides everything from storefront creation and inventory management to advanced analytics and marketing tools. We believe technology should be accessible to everyone, not just the big players.</Text>
        </View>

        {/* ===== STATS (dark) ===== */}
        <View style={s.statsDark}>
          <Text style={[s.eyebrow, { color: colors.p300, textAlign: 'center' }]}>BY THE NUMBERS</Text>
          <Text style={s.statsHeading}>Growing Every Day</Text>
          <View style={s.statsGrid}>
            {statsData.map((st) => (
              <View key={st.label} style={s.statCard}>
                <View style={s.statIcon}><Ionicons name={st.icon} size={18} color="#34d399" /></View>
                <CountUp target={st.value} suffix={st.suffix} style={s.statNum} />
                <Text style={s.statLabel}>{st.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ===== VALUES ===== */}
        <View style={s.section}>
          <Text style={[s.eyebrow, { textAlign: 'center' }]}>WHAT DRIVES US</Text>
          <Text style={[s.h2, { textAlign: 'center', fontSize: 26 }]}>Our Values</Text>
          <Text style={s.centerSub}>These principles guide everything we do</Text>
          <View style={s.valuesGrid}>
            {VALUES.map((v) => (
              <View key={v.title} style={s.valueCard}>
                <View style={[s.valueIcon, { backgroundColor: v.bg }]}><Ionicons name={v.icon} size={20} color={v.ic} /></View>
                <Text style={s.valueTitle}>{v.title}</Text>
                <Text style={s.valueDesc}>{v.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ===== TEAM ===== */}
        <View style={[s.section, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[s.eyebrow, { textAlign: 'center', color: colors.p700 }]}>THE PEOPLE</Text>
          <Text style={[s.h2, { textAlign: 'center', fontSize: 26 }]}>Meet Our Team</Text>
          <Text style={s.centerSub}>Passionate people building the future of e-commerce</Text>
          <View style={s.teamGrid}>
            {displayTeam.map((m, i) => (
              <View key={m.id || i} style={s.teamCard}>
                <Image source={{ uri: m.photo || m.image || avatarUrl(m.name) }} style={s.teamPhoto} resizeMode="cover" />
                <Text style={s.teamName} numberOfLines={1}>{m.name}</Text>
                <Text style={s.teamRole} numberOfLines={1}>{m.position || m.role}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ===== TESTIMONIALS ===== */}
        <View style={s.section}>
          <Text style={[s.eyebrow, { textAlign: 'center', color: '#d97706' }]}>TESTIMONIALS</Text>
          <Text style={[s.h2, { textAlign: 'center', fontSize: 26 }]}>What Sellers Say</Text>
          <Text style={s.centerSub}>Success stories from our community</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 4, paddingTop: 6 }} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
            {displayTestimonials.map((tm, i) => (
              <View key={i} style={s.tCard}>
                <View style={s.tStars}>
                  {[...Array(tm.rating || 5)].map((_, k) => <Ionicons key={k} name="star" size={14} color="#f59e0b" />)}
                </View>
                <Ionicons name="chatbox-ellipses" size={20} color={colors.borderLight} style={{ marginBottom: 6 }} />
                <Text style={s.tText}>"{tm.text}"</Text>
                <View style={s.tFoot}>
                  <Text style={s.tAuthor}>{tm.author}</Text>
                  <Text style={s.tRole}>{tm.role}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ===== CTA ===== */}
        <LinearGradient colors={['#059669', '#0d9488', colors.p600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
          <Ionicons name="rocket" size={40} color="rgba(255,255,255,0.6)" style={{ alignSelf: 'center', marginBottom: 12 }} />
          <Text style={s.ctaTitle}>Ready to Start Your{'\n'}<Text style={{ color: colors.accentYellow }}>Journey?</Text></Text>
          <Text style={s.ctaSub}>Join thousands of successful sellers who trust OpenMarketlb to grow their business.</Text>
          <View style={s.ctaBtns}>
            <TouchableOpacity onPress={() => goTab('Sell')} activeOpacity={0.9} style={s.ctaWhite}>
              <Text style={s.ctaWhiteText}>Become a Seller</Text><Ionicons name="arrow-forward" size={15} color="#047857" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Contact')} activeOpacity={0.85} style={s.ctaOutline}>
              <Text style={s.ctaOutlineText}>Contact Us</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ===== End-of-page promos ===== */}
        <EndOfPagePromos nearEndSignal={nearEnd} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  // Hero
  hero: { paddingHorizontal: 18, paddingBottom: 34, overflow: 'hidden' },
  blob: { position: 'absolute', width: 220, height: 220, borderRadius: 140 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  eyebrowPill: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7, marginTop: 6 },
  ping: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  pingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34d399' },
  eyebrowText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2 },
  h1: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8, textAlign: 'center', marginTop: 20 },
  h1Accent: { color: '#5eead4' },
  h1Underline: { width: 150, height: 3, borderRadius: 2, alignSelf: 'center', marginTop: 8 },
  heroPara: { color: 'rgba(255,255,255,0.72)', fontFamily: fonts.body, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 18 },
  heroCtas: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 22 },
  ctaFill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10b981', borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 13, ...shadow.sm },
  ctaFillText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 },
  ctaGhost: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 13, justifyContent: 'center' },
  ctaGhostText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 14 },
  heroStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 28 },
  heroStatPill: { width: '47%', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center' },
  heroStatTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroStatNum: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 20 },
  heroStatLabel: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.body, fontSize: 10.5, marginTop: 3 },

  // Generic section
  section: { paddingHorizontal: 16, paddingVertical: 30 },
  eyebrow: { color: '#059669', fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 2, marginBottom: 8 },
  h2: { color: colors.ink, fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  centerSub: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 18 },
  para: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14.5, lineHeight: 22, marginTop: 14 },
  paraMuted: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 20, marginTop: 12 },
  storyImgWrap: { marginTop: 18, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadow.card },
  storyImg: { width: '100%', height: 230 },

  // Stats dark
  statsDark: { backgroundColor: '#0f172a', paddingHorizontal: 16, paddingVertical: 34 },
  statsHeading: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 26, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '47%', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: radius.lg, padding: 18, alignItems: 'center' },
  statIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.2)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statNum: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 30 },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.medium, fontSize: 12, marginTop: 4, textAlign: 'center' },

  // Values
  valuesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  valueCard: { width: '47%', flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 18, ...shadow.card },
  valueIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  valueTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, marginBottom: 5 },
  valueDesc: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, lineHeight: 18 },

  // Team
  teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' },
  teamCard: { width: '44%', alignItems: 'center' },
  teamPhoto: { width: 130, height: 130, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, marginBottom: 10, backgroundColor: colors.surfaceMuted },
  teamName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  teamRole: { fontFamily: fonts.medium, fontSize: 11.5, color: '#059669', marginTop: 2 },

  // Testimonials
  tCard: { width: 300, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 20 },
  tStars: { flexDirection: 'row', gap: 2, marginBottom: 10 },
  tText: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, lineHeight: 21, marginBottom: 16 },
  tFoot: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  tAuthor: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  tRole: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 2 },

  // CTA
  cta: { paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' },
  ctaTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, textAlign: 'center', letterSpacing: -0.5 },
  ctaSub: { color: 'rgba(255,255,255,0.82)', fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 12, marginBottom: 22 },
  ctaBtns: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  ctaWhite: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 13 },
  ctaWhiteText: { color: '#047857', fontFamily: fonts.bold, fontSize: 14 },
  ctaOutline: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 13, justifyContent: 'center' },
  ctaOutlineText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 14 },
});
