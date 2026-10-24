import React, { useEffect, useState } from 'react';
import { View, FlatList } from 'react-native';
import { api } from '../lib/api';
import ShopCard from '../components/ShopCard';
import { StackHeader, Loading, Empty, SkeletonBlock, SkeletonRows, TAB_SPACE } from '../components/ui';
import { colors, radius } from '../theme/theme';
import { useReveal, listPerfProps } from '../lib/useReveal';

export default function ShopsScreen({ navigation }) {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const { visible, hasMore, revealing, revealMore } = useReveal(shops, 6);

  useEffect(() => {
    api.shops.getAll()
      .then(({ data }) => setShops(Array.isArray(data) ? data : data?.shops || []))
      .catch(() => setShops([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StackHeader navigation={navigation} title="All Shops" subtitle={`${shops.length} trusted sellers`} />
      {loading ? (
        <View style={{ padding: 16, gap: 14 }}>
          {[...Array(4)].map((_, i) => <SkeletonBlock key={i} height={240} radius={radius.lg} />)}
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(s, i) => s.id || String(i)}
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => <ShopCard shop={item} index={index} style={{ width: '100%' }} />}
          ListEmptyComponent={<Empty icon="storefront-outline" title="No shops yet" />}
          onEndReachedThreshold={0.5}
          onEndReached={() => hasMore && revealMore()}
          ListFooterComponent={revealing ? <SkeletonRows count={2} height={240} radius={radius.lg} style={{ paddingHorizontal: 0, paddingTop: 14 }} /> : null}
          {...listPerfProps}
        />
      )}
    </View>
  );
}
