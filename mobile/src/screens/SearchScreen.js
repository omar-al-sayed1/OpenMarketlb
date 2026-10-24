import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { api } from '../lib/api';
import { img } from '../lib/media';
import { Input } from '../components/ui';
import { colors, radius, font, fonts, shadow } from '../theme/theme';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const norm = (s) => String(s || '').toLowerCase();

/**
 * Search — an as-you-type suggestion list, NOT a results grid. Recommendations
 * (categories / shops / products) are shown the moment it opens; typing filters
 * them live across all three. Every hit is a compact row — no product cards — so
 * the whole thing reads like a dropdown that expands with the query.
 */
export default function SearchScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [cats, setCats] = useState([]);
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pull a pool once, then filter on-device — instant recommendations + instant typing.
  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      api.categories.getAll(true),
      api.shops.getAll(),
      api.products.getAll({ limit: 60 }),
    ]).then(([c, s, p]) => {
      if (!alive) return;
      const list = (r, key) => (r.status === 'fulfilled' ? (Array.isArray(r.value.data) ? r.value.data : r.value.data?.[key] || []) : []);
      setCats(list(c, 'categories'));
      setShops(list(s, 'shops'));
      setProducts(list(p, 'products'));
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const query = q.trim();
  const filtered = useMemo(() => {
    if (!query) {
      // Recommendations: a handful of each, most useful first.
      return {
        cats: cats.slice(0, 6),
        shops: shops.slice(0, 4),
        products: products.slice(0, 6),
      };
    }
    const n = norm(query);
    const match = (v) => norm(v).includes(n);
    return {
      cats: cats.filter((c) => match(c.name)).slice(0, 6),
      shops: shops.filter((s) => match(s.name) || match(s.state) || match(s.address)).slice(0, 6),
      products: products.filter((p) => match(p.name) || match(p.shop_name) || match(p.description)).slice(0, 12),
    };
  }, [query, cats, shops, products]);

  const total = filtered.cats.length + filtered.shops.length + filtered.products.length;

  const openCat = useCallback((c) => { Keyboard.dismiss(); navigation.navigate('Root', { screen: 'Tabs', params: { screen: 'Shop', params: { categoryId: c.id, categoryName: c.name } } }); }, [navigation]);
  const openShop = useCallback((s) => { Keyboard.dismiss(); navigation.navigate('ShopPublic', { id: s.id, name: s.name }); }, [navigation]);
  const openProduct = useCallback((p) => { Keyboard.dismiss(); navigation.navigate('ProductDetail', { product: p, id: p.id }); }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Search bar */}
      <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </TouchableOpacity>
        <Input
          containerStyle={{ flex: 1 }}
          icon="search"
          autoFocus
          value={q}
          onChangeText={setQ}
          placeholder="Search products, shops, categories…"
          returnKeyType="search"
          right={q ? (
            <TouchableOpacity onPress={() => setQ('')}>
              <Ionicons name="close-circle" size={18} color={colors.textFaint} />
            </TouchableOpacity>
          ) : null}
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
          {query && total === 0 ? (
            <Animated.View entering={FadeIn} style={styles.empty}>
              <Ionicons name="search-outline" size={30} color={colors.textFaint} />
              <Text style={styles.emptyText}>No matches for “{query}”</Text>
            </Animated.View>
          ) : null}

          {filtered.cats.length > 0 && (
            <Section title={query ? 'Categories' : 'Browse categories'} icon="grid-outline">
              {filtered.cats.map((c, i) => (
                <Row key={c.id} i={i} onPress={() => openCat(c)}
                  leading={<View style={[styles.chip, { backgroundColor: colors.primarySoft }]}>{c.image ? <Image source={{ uri: img(c.image) }} style={styles.chipImg} /> : <Ionicons name="pricetag" size={16} color={colors.primaryDarker} />}</View>}
                  title={c.name} subtitle="Category" />
              ))}
            </Section>
          )}

          {filtered.shops.length > 0 && (
            <Section title={query ? 'Shops' : 'Popular shops'} icon="storefront-outline">
              {filtered.shops.map((s, i) => (
                <Row key={s.id} i={i} onPress={() => openShop(s)}
                  leading={<View style={[styles.chip, styles.chipRound]}>{s.logo ? <Image source={{ uri: img(s.logo) }} style={[styles.chipImg, styles.chipRound]} /> : <Ionicons name="storefront" size={16} color={colors.textMuted} />}</View>}
                  title={s.name} subtitle={s.state || s.address || 'Shop'} />
              ))}
            </Section>
          )}

          {filtered.products.length > 0 && (
            <Section title={query ? 'Products' : 'Recommended for you'} icon="cube-outline">
              {filtered.products.map((p, i) => {
                const image = (p.images && p.images[0]) || p.image;
                const price = p.discount_price || p.price;
                return (
                  <Row key={p.id} i={i} onPress={() => openProduct(p)}
                    leading={<View style={styles.chip}>{image ? <Image source={{ uri: img(image) }} style={styles.chipImg} /> : <Ionicons name="cube" size={16} color={colors.textMuted} />}</View>}
                    title={p.name} subtitle={p.shop_name || 'Product'}
                    trailing={<Text style={styles.price}>{money(price)}</Text>} />
                );
              })}
            </Section>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Section({ title, icon, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={13} color={colors.textMuted} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Row({ leading, title, subtitle, trailing, onPress, i }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(i, 6) * 22).duration(220)}>
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.row}>
        {leading}
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>{subtitle}</Text>
        </View>
        {trailing}
        <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 12, backgroundColor: colors.surface, ...shadow.sm },
  back: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, marginBottom: 4 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 9 },
  chip: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.bgAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chipRound: { borderRadius: 20 },
  chipImg: { width: '100%', height: '100%', borderRadius: radius.md },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  rowSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  price: { fontFamily: fonts.bold, fontSize: 13, color: colors.primaryDarker },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textMuted },
});
