import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import ProductCard from '../components/ProductCard';
import { StackHeader, Loading, GradientButton, SkeletonBlock, SkeletonGrid } from '../components/ui';
import { colors, radius, fonts } from '../theme/theme';
import { useReveal, listPerfProps } from '../lib/useReveal';

export default function WishlistScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { visible, hasMore, revealing, revealMore } = useReveal(products, 8);

  const load = useCallback(() => {
    api.wishlist.get()
      .then(({ data }) => setProducts(Array.isArray(data) ? data : data?.products || data?.items || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StackHeader navigation={navigation} title="Wishlist" subtitle={products.length ? `${products.length} saved` : 'Your saved items'} />
      {loading ? (
        <View style={styles.skel}>{[...Array(4)].map((_, i) => <SkeletonBlock key={i} width="48.5%" height={210} radius={radius.md} style={{ marginBottom: 8 }} />)}</View>
      ) : products.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyCircle}><Ionicons name="heart" size={44} color={colors.sale} /></View>
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptySub}>Tap the heart on any product to save it here.</Text>
          <GradientButton label="Explore products" icon="storefront" onPress={() => navigation.navigate('Root', { screen: 'Tabs', params: { screen: 'Shop' } })} style={{ width: 220, marginTop: 18 }} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(p, i) => p.id || String(i)}
          numColumns={2}
          columnWrapperStyle={{ gap: 8, paddingHorizontal: 10, marginBottom: 8 }}
          contentContainerStyle={{ paddingTop: 10, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <View style={{ flex: 1 }}><ProductCard product={item} showShopName compact /></View>}
          onEndReachedThreshold={0.5}
          onEndReached={() => hasMore && revealMore()}
          ListFooterComponent={revealing ? <SkeletonGrid count={2} /> : null}
          {...listPerfProps}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  skel: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 10, paddingTop: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.saleSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink },
  emptySub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
});
