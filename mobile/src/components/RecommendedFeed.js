import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList } from 'react-native';
import { api } from '../lib/api';
import ProductCard from './ProductCard';
import { ProductCardSkeleton, TAB_SPACE } from './ui';
import { SponsoredAddOns, RecommendedHeader } from './EndOfPagePromos';
import { listPerfProps } from '../lib/useReveal';

const PAGE = 12;

/**
 * A page that ends in an INFINITE-SCROLL "Recommended Products" grid with skeleton
 * loading — the same pattern as the Home feed. The screen's own content (hero, grids,
 * etc.) is passed as `header` and rendered above the sponsored add-ons + recommended
 * grid, so the whole screen scrolls as one list and loads more picks as you reach the end.
 */
export default function RecommendedFeed({ header, refreshControl, bottomInset = TAB_SPACE }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (p) => {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    try {
      const { data } = await api.products.getAll({ is_active: true, page: p, limit: PAGE, sort_by: 'popular' });
      const list = data?.products || (Array.isArray(data) ? data : []);
      setItems((prev) => (p === 1 ? list : [...prev, ...list]));
      setMore(!(list.length < PAGE || data?.has_more === false));
      setPage(p + 1);
    } catch (_) { setMore(false); }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const Header = (
    <>
      {header}
      <SponsoredAddOns />
      {(loading || items.length > 0) ? <RecommendedHeader /> : null}
    </>
  );

  const Skeletons = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6, marginTop: 4 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: '50%', paddingHorizontal: 5, marginBottom: 10 }}><ProductCardSkeleton /></View>
      ))}
    </View>
  );

  return (
    <FlatList
      data={items}
      numColumns={2}
      keyExtractor={(p, i) => p.id || String(i)}
      ListHeaderComponent={Header}
      columnWrapperStyle={{ paddingHorizontal: 11, gap: 10 }}
      renderItem={({ item }) => <View style={{ flex: 1, marginBottom: 10 }}><ProductCard product={item} showShopName carousel /></View>}
      onEndReachedThreshold={0.5}
      onEndReached={() => more && !loadingMore && load(page)}
      ListFooterComponent={(loading || loadingMore) ? Skeletons : null}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomInset }}
      refreshControl={refreshControl}
      {...listPerfProps}
    />
  );
}
