import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { tapLight } from '../lib/haptics';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

export function CartProvider({ children }) {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.cart.get();
      setItems(data?.items || data?.cart?.items || []);
    } catch (_) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh, token]);

  const add = useCallback(async (product, quantity = 1, variant = null) => {
    tapLight();
    await api.cart.add({
      product_id: product.id,
      quantity,
      ...(variant?.color ? { selected_color: variant.color } : {}),
      ...(variant?.size ? { selected_size: variant.size } : {}),
      ...(variant?.shape ? { selected_shape: variant.shape } : {}),
    });
    await refresh();
  }, [refresh]);

  const updateQty = useCallback(async (productId, quantity) => {
    await api.cart.update({ product_id: productId, quantity });
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (productId) => {
    await api.cart.remove(productId);
    await refresh();
  }, [refresh]);

  const count = items.reduce((n, it) => n + (it.quantity || 1), 0);
  const total = items.reduce(
    (s, it) => s + (it.price || it.product?.price || 0) * (it.quantity || 1),
    0
  );

  return (
    <CartContext.Provider value={{ items, count, total, loading, refresh, add, updateQty, remove }}>
      {children}
    </CartContext.Provider>
  );
}
