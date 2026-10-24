import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Image, Modal, ScrollView, Animated, Easing, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { tapLight, notifySuccess } from '../../lib/haptics';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { TAB_SPACE, Input } from '../../components/ui';
import { ShopScreenWrap, Rise, PressScale, Spinner, Shimmer, toast } from '../../components/shop/ShopKit';

/* success confetti — 20 falling colored dots */
function Confetti() {
  const pieces = useRef(Array.from({ length: 20 }, (_, i) => ({
    a: new Animated.Value(0),
    left: Math.random() * 100,
    color: ['#10b981', '#14b8a6', '#f59e0b', '#3b82f6', colors.p450, '#ec4899'][i % 6],
    dur: 1400 + Math.random() * 1800,
    delay: Math.random() * 400,
  }))).current;
  useEffect(() => {
    pieces.forEach(p => Animated.timing(p.a, { toValue: 1, duration: p.dur, delay: p.delay, easing: Easing.in(Easing.quad), useNativeDriver: true }).start());
  }, [pieces]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', top: -8, left: `${p.left}%`, width: 8, height: 8, borderRadius: 4, backgroundColor: p.color,
          opacity: p.a.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateY: p.a.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }) },
            { rotate: p.a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '680deg'] }) },
          ],
        }} />
      ))}
    </View>
  );
}

const EMPTY_PICKER = { open: false, product: null, color: null, size: null, shape: null };

/* module-scope so TextInputs keep focus across re-renders */
const Field = ({ label, value, onChangeText, placeholder, keyboardType, testID, required }) => (
  <Input containerStyle={{ flex: 1 }} label={`${label}${required ? ' *' : ''}`} value={value}
    onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} testID={testID} />
);

export default function ShopCreateOrderScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [states, setStates] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', phone: '' });
  const [shippingAddress, setShippingAddress] = useState({ address: '', city: '', state: '', zip: '' });
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [commissionRate, setCommissionRate] = useState(0);
  const [variantPicker, setVariantPicker] = useState(EMPTY_PICKER);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [availableDelivery, setAvailableDelivery] = useState(true);
  const badgeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchProducts(); fetchStates(); fetchCommissionRate(); fetchWalletBalance();
    api.admin.getPlatformSettings().then(({ data }) => {
      setAvailableDelivery(data?.available_delivery !== false);
    }).catch(() => {});
  }, []); // eslint-disable-line

  const fetchProducts = async () => {
    try {
      const { data } = await api.shop.getProducts();
      setProducts(data.filter(p => p.is_active && p.stock > 0));
    } catch (error) {} finally { setLoading(false); }
  };
  const fetchStates = async () => {
    try { const { data } = await api.states.getAll(); setStates(data); } catch (error) {}
  };
  const fetchCommissionRate = async () => {
    try {
      const { data: tierData } = await api.shopTier.getInfo();
      if (tierData?.commission_rate) { setCommissionRate(tierData.commission_rate); return; }
      const { data } = await api.admin.getPlatformSettings();
      const tier = tierData?.current_tier || 'starter';
      const tierConfig = data.tiers?.[tier];
      setCommissionRate(tierConfig?.commission_rate || data.commission_percentage || 10);
    } catch (error) { setCommissionRate(10); }
  };
  const fetchWalletBalance = async () => {
    try { await api.shopWallet.get(); } catch (error) {}
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
  }, [products, searchQuery]);

  const getCustomerPrice = (price) => {
    if (!price) return 0;
    return Math.round(price * (1 + commissionRate / 100) * 100) / 100;
  };

  /* springy bounce-count on the cart badge for every add */
  const bounceBadge = () => {
    badgeScale.setValue(1);
    Animated.sequence([
      Animated.spring(badgeScale, { toValue: 1.5, friction: 3, tension: 160, useNativeDriver: true }),
      Animated.spring(badgeScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
    ]).start();
  };

  /* ---- addToOrder — ported verbatim ---- */
  const addToOrder = (product, selectedColor = null, selectedSize = null, selectedShape = null) => {
    let maxStock = product.stock;
    let variantImage = product.images?.[0];
    let variantPrice = product.discount_price || product.price;
    const variantLabels = [];

    if (selectedColor) {
      const c = product.colors?.find(x => x.color_name === selectedColor);
      if (c) {
        maxStock = c.stock ?? maxStock;
        variantImage = c.image_url || variantImage;
        if (c.discount_price ?? c.price) variantPrice = c.discount_price ?? c.price;
        variantLabels.push(selectedColor);
      }
    }
    if (selectedSize) {
      const s = product.sizes?.find(x => x.size_name === selectedSize);
      if (s) {
        if (!selectedColor) maxStock = s.stock ?? maxStock;
        if (s.discount_price ?? s.price) variantPrice = s.discount_price ?? s.price;
        variantLabels.push(selectedSize);
      }
    }
    if (selectedShape) {
      const sh = product.shapes?.find(x => x.shape_name === selectedShape);
      if (sh) {
        if (!selectedColor && !selectedSize) maxStock = sh.stock ?? maxStock;
        if (sh.discount_price ?? sh.price) variantPrice = sh.discount_price ?? sh.price;
        variantLabels.push(selectedShape);
      }
    }

    const existingIndex = orderItems.findIndex(
      item => item.product_id === product.id
        && item.selected_color === selectedColor
        && item.selected_size === selectedSize
        && item.selected_shape === selectedShape
    );
    if (existingIndex >= 0) {
      const updated = [...orderItems];
      if (updated[existingIndex].quantity >= maxStock) {
        toast.error(`Only ${maxStock} available in stock`);
        return;
      }
      updated[existingIndex].quantity += 1;
      setOrderItems(updated);
    } else {
      if (maxStock <= 0) { toast.error('This variant is out of stock'); return; }
      setOrderItems([...orderItems, {
        product_id: product.id,
        name: product.name + (variantLabels.length ? ` (${variantLabels.join(' / ')})` : ''),
        image: variantImage,
        price: getCustomerPrice(variantPrice),
        selected_color: selectedColor,
        selected_size: selectedSize,
        selected_shape: selectedShape,
        quantity: 1,
        stock: maxStock,
      }]);
    }
    tapLight();
    bounceBadge();
    toast.success(`${product.name} added`);
  };

  const openVariantPicker = (product) => {
    const hasColor = product.colors?.length > 0;
    const hasSize = product.has_size_variants && product.sizes?.length > 0;
    const hasShape = product.has_shape_variants && product.shapes?.length > 0;
    if (!hasColor && !hasSize && !hasShape) { addToOrder(product); return; }
    setVariantPicker({ open: true, product, color: null, size: null, shape: null });
  };

  const confirmVariantPicker = () => {
    const { product, color, size, shape } = variantPicker;
    if (!color && !size && !shape) { toast.error('Please select at least one variant'); return; }
    addToOrder(product, color, size, shape);
    setVariantPicker(EMPTY_PICKER);
  };

  const updateQuantity = (index, delta) => {
    const updated = [...orderItems];
    const newQty = updated[index].quantity + delta;
    if (newQty < 1) return;
    if (newQty > updated[index].stock) { toast.error(`Only ${updated[index].stock} available`); return; }
    updated[index].quantity = newQty;
    setOrderItems(updated);
    if (delta > 0) bounceBadge();
  };

  const removeItem = (index) => setOrderItems(orderItems.filter((_, i) => i !== index));

  /* ---- totals — ported verbatim ---- */
  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const selectedState = states.find(s => s.name === shippingAddress.state);
  const deliveryFee = (availableDelivery && selectedState) ? selectedState.delivery_fee : 0;
  // Shop ordering gets half commission as discount
  const commissionAmount = subtotal > 0 ? Math.round(subtotal * (commissionRate / 100) / (1 + commissionRate / 100) * 100) / 100 : 0;
  const shopOrderDiscount = commissionAmount > 0 ? Math.round(commissionAmount / 2 * 100) / 100 : 0;
  const total = subtotal + deliveryFee - shopOrderDiscount;
  const totalQty = orderItems.reduce((sum, i) => sum + i.quantity, 0);

  const handleSubmit = async () => {
    if (!customerInfo.name) { toast.error('Customer name is required'); return; }
    if (orderItems.length === 0) { toast.error('Please add at least one product'); return; }
    if (availableDelivery && (!shippingAddress.address || !shippingAddress.city || !shippingAddress.state)) {
      toast.error('Please fill in shipping address');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.shop.createOrder({
        customer_name: customerInfo.name,
        customer_email: customerInfo.email,
        customer_phone: customerInfo.phone,
        shipping_address: shippingAddress,
        items: orderItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          selected_color: item.selected_color,
          selected_size: item.selected_size,
          selected_shape: item.selected_shape,
        })),
        payment_method: paymentMethod,
      });
      setCartModalOpen(false);
      setSuccessOrder(data);
      notifySuccess();
      toast.success('Order created successfully!');
      if (paymentMethod === 'wallet') fetchWalletBalance();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create order');
    } finally { setSubmitting(false); }
  };

  const handleCloseSuccessPopup = () => {
    setSuccessOrder(null);
    setOrderItems([]);
    setCustomerInfo({ name: '', email: '', phone: '' });
    setShippingAddress({ address: '', city: '', state: '', zip: '' });
    setPaymentMethod('cod');
  };

  return (
    <>
    <ShopScreenWrap testID="shop-create-order">
      {/* Header */}
      <Rise duration={500} distance={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={st.headIcon}><Ionicons name="bag-handle" size={22} color="#059669" /></View>
          <View style={{ flex: 1 }}>
            <Text style={st.title}>Create Order for Customer</Text>
            <Text style={st.sub}>Select your products and enter customer details</Text>
          </View>
        </View>
      </Rise>

      {/* Search — instant results */}
      <Rise delay={80}>
        <View style={st.searchCard}>
          <View style={st.search}>
            <Ionicons name="search" size={15} color={colors.textMuted} />
            <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search your products..."
              placeholderTextColor={colors.textMuted} style={st.searchInput} testID="product-search" />
          </View>
        </View>
      </Rise>

      {/* Products grid */}
      <Rise delay={140}>
        <View style={st.gridCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 11 }}>
            <Ionicons name="cube" size={14} color="#059669" />
            <Text style={st.gridTitle}>Your Products ({filteredProducts.length})</Text>
          </View>
          {loading ? (
            <View style={st.grid}>
              {[...Array(6)].map((_, i) => <View key={i} style={st.gridItem}><Shimmer height={170} radius={radius.md} /></View>)}
            </View>
          ) : filteredProducts.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 34 }}>
              <Ionicons name="cube-outline" size={40} color={colors.border} />
              <Text style={st.emptyText}>No products found</Text>
            </View>
          ) : (
            <View style={st.grid}>
              {filteredProducts.map(product => {
                const hasColor = product.colors?.length > 0;
                const hasSize = product.has_size_variants && product.sizes?.length > 0;
                const hasShape = product.has_shape_variants && product.shapes?.length > 0;
                const hasAnyVariant = hasColor || hasSize || hasShape;
                return (
                  <View key={product.id} style={st.gridItem} testID={`shop-product-${product.id}`}>
                    <View style={st.prodCard}>
                      <View style={st.prodImgWrap}>
                        {product.images?.[0] ? (
                          <Image source={{ uri: img(product.images[0]) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                        ) : (
                          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                            <Ionicons name="cube" size={26} color={colors.border} />
                          </View>
                        )}
                        {product.stock > 0 && product.stock < 10 && (
                          <View style={st.lowTag}><Text style={st.lowTagText}>{product.stock} left</Text></View>
                        )}
                      </View>
                      <View style={{ padding: 9 }}>
                        <Text style={st.prodName} numberOfLines={2}>{product.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                          <Text style={st.prodPrice}>${getCustomerPrice(product.discount_price || product.price).toFixed(2)}</Text>
                          <Text style={st.prodStock}>Stock: {product.stock}</Text>
                        </View>
                        <PressScale onPress={() => (hasAnyVariant ? openVariantPicker(product) : addToOrder(product))} disabled={product.stock <= 0} style={{ marginTop: 7 }}>
                          <View style={st.addBtn} testID={hasAnyVariant ? `select-variant-${product.id}` : `add-product-${product.id}`}>
                            <Ionicons name={hasAnyVariant ? 'cube' : 'add'} size={12} color={colors.white} />
                            <Text style={st.addBtnText}>{hasAnyVariant ? 'Select Variant' : 'Add'}</Text>
                          </View>
                        </PressScale>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </Rise>
    </ShopScreenWrap>

    {/* Floating cart FAB — springy badge bounce-count on every add */}
    <View style={st.fabWrap} pointerEvents="box-none">
      <TouchableOpacity onPress={() => { tapLight(); setCartModalOpen(true); }} activeOpacity={0.85} testID="cart-fab">
        <LinearGradient colors={['#059669', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.fab}>
          <Ionicons name="bag-handle" size={26} color={colors.white} />
        </LinearGradient>
        {orderItems.length > 0 && (
          <Animated.View style={[st.fabBadge, { transform: [{ scale: badgeScale }] }]}>
            <Text style={st.fabBadgeText}>{totalQty}</Text>
          </Animated.View>
        )}
      </TouchableOpacity>
    </View>

    {/* Order summary — swipe-up sheet (customer + shipping + payment + place order) */}
    <Modal visible={cartModalOpen} transparent animationType="slide" onRequestClose={() => setCartModalOpen(false)}>
      <View style={st.sheetBackdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setCartModalOpen(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={st.sheet} testID="desktop-order-sidebar">
            <LinearGradient colors={['#059669', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.sheetHead}>
              <View style={st.grabberLight} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="bag-handle" size={17} color={colors.white} />
                <Text style={st.sheetTitle}>Order Summary ({totalQty} items)</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={() => setCartModalOpen(false)} style={st.sheetClose}><Ionicons name="close" size={16} color={colors.white} /></TouchableOpacity>
              </View>
            </LinearGradient>
            <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }}>
              {/* Items */}
              {orderItems.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <Ionicons name="bag-handle-outline" size={38} color={colors.border} />
                  <Text style={st.emptyText}>No items added yet. Select products to get started.</Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {orderItems.map((item, idx) => (
                    <View key={idx} style={st.itemRow} testID={`order-item-${idx}`}>
                      {item.image ? <Image source={{ uri: img(item.image) }} style={st.itemImg} /> : null}
                      <View style={{ flex: 1 }}>
                        <Text style={st.itemName} numberOfLines={1}>{item.name}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                          {item.selected_color && <Text style={[st.itemVar, { color: colors.p500 }]}>Color: {item.selected_color}</Text>}
                          {item.selected_size && <Text style={[st.itemVar, { color: '#2563eb' }]}>Size: {item.selected_size}</Text>}
                          {item.selected_shape && <Text style={[st.itemVar, { color: '#d97706' }]}>Shape: {item.selected_shape}</Text>}
                        </View>
                        <Text style={st.itemPrice}>${item.price.toFixed(2)} x {item.quantity}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <TouchableOpacity onPress={() => updateQuantity(idx, -1)} style={st.qtyBtn}><Ionicons name="remove" size={13} color={colors.text} /></TouchableOpacity>
                        <Text style={st.qtyText}>{item.quantity}</Text>
                        <TouchableOpacity onPress={() => updateQuantity(idx, 1)} style={st.qtyBtn}><Ionicons name="add" size={13} color={colors.text} /></TouchableOpacity>
                        <TouchableOpacity onPress={() => removeItem(idx)} style={[st.qtyBtn, { backgroundColor: '#fef2f2' }]}><Ionicons name="trash" size={13} color={colors.saleAlt} /></TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Totals */}
              {orderItems.length > 0 && (
                <View style={st.totalsBox}>
                  <View style={st.totalRow}><Text style={st.totalKey}>Subtotal</Text><Text style={st.totalVal}>${subtotal.toFixed(2)}</Text></View>
                  {availableDelivery && (
                    <View style={st.totalRow}><Text style={st.totalKey}>Delivery Fee</Text><Text style={st.totalVal}>${deliveryFee.toFixed(2)}</Text></View>
                  )}
                  {shopOrderDiscount > 0 && (
                    <View style={st.totalRow}><Text style={[st.totalKey, { color: '#059669', fontFamily: fonts.semibold }]}>Shop Ordering Discount</Text><Text style={[st.totalVal, { color: '#059669' }]}>-${shopOrderDiscount.toFixed(2)}</Text></View>
                  )}
                  <View style={[st.totalRow, { borderTopWidth: 1, borderTopColor: '#a7f3d0', paddingTop: 8 }]}>
                    <Text style={{ fontFamily: fonts.extrabold, fontSize: 15.5, color: colors.ink }}>Total</Text>
                    <Text style={{ fontFamily: fonts.extrabold, fontSize: 17, color: '#059669' }}>${total.toFixed(2)}</Text>
                  </View>
                  {shopOrderDiscount > 0 && (
                    <Text style={st.saveNote}>You save ${shopOrderDiscount.toFixed(2)} as a shop ordering discount + earn loyalty points!</Text>
                  )}
                </View>
              )}

              {/* Customer Information */}
              <View style={st.section}>
                <View style={st.sectionHead}><Ionicons name="person" size={14} color="#059669" /><Text style={st.sectionTitle}>Customer Information</Text></View>
                <View style={{ gap: 9 }}>
                  <Field label="Name" required value={customerInfo.name} onChangeText={(t) => setCustomerInfo(prev => ({ ...prev, name: t }))} placeholder="Full name" testID="customer-name" />
                  <Field label="Email" value={customerInfo.email} onChangeText={(t) => setCustomerInfo(prev => ({ ...prev, email: t }))} placeholder="customer@email.com" keyboardType="email-address" testID="customer-email" />
                  <Field label="Phone" value={customerInfo.phone} onChangeText={(t) => setCustomerInfo(prev => ({ ...prev, phone: t }))} placeholder="+961 71 234 567" keyboardType="phone-pad" testID="customer-phone" />
                </View>
              </View>

              {/* Shipping (hidden when delivery is disabled platform-wide) */}
              {availableDelivery && (
                <View style={st.section}>
                  <View style={st.sectionHead}><Ionicons name="location" size={14} color="#059669" /><Text style={st.sectionTitle}>Shipping Address</Text></View>
                  <View style={{ gap: 9 }}>
                    <Field label="Address" required value={shippingAddress.address} onChangeText={(t) => setShippingAddress(prev => ({ ...prev, address: t }))} placeholder="Street address" testID="shipping-address" />
                    <View style={{ flexDirection: 'row', gap: 9 }}>
                      <Field label="City" required value={shippingAddress.city} onChangeText={(t) => setShippingAddress(prev => ({ ...prev, city: t }))} placeholder="City" testID="shipping-city" />
                      <Field label="ZIP" value={shippingAddress.zip} onChangeText={(t) => setShippingAddress(prev => ({ ...prev, zip: t }))} placeholder="ZIP" testID="shipping-zip" />
                    </View>
                    <Text style={st.fieldLabel}>State *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {states.map(s => {
                        const on = shippingAddress.state === s.name;
                        return (
                          <TouchableOpacity key={s.id || s.name} onPress={() => setShippingAddress(prev => ({ ...prev, state: s.name }))}
                            style={[st.stateChip, on && { backgroundColor: '#059669', borderColor: '#059669' }]}>
                            <Text style={[st.stateChipText, on && { color: colors.white }]}>{s.name}</Text>
                            <Text style={[st.stateFee, on && { color: 'rgba(255,255,255,0.8)' }]}>${Number(s.delivery_fee || 0).toFixed(2)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              )}

              {/* Payment Method */}
              {orderItems.length > 0 && (
                <View style={st.section}>
                  <View style={st.sectionHead}><Ionicons name="card" size={14} color="#059669" /><Text style={st.sectionTitle}>Payment Method</Text></View>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => setPaymentMethod('cod')} style={[st.payOption, paymentMethod === 'cod' && { borderColor: '#6ee7b7' }]}>
                    <View style={[st.radio, paymentMethod === 'cod' && st.radioOn]}>{paymentMethod === 'cod' && <View style={st.radioDot} />}</View>
                    <Ionicons name="cash" size={16} color="#059669" />
                    <View>
                      <Text style={st.payTitle}>Cash on Delivery</Text>
                      <Text style={st.payDesc}>Customer pays when order arrives</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {/* Place order — full width emerald-600 -> teal-600 */}
              <PressScale onPress={handleSubmit} disabled={submitting || orderItems.length === 0 || !customerInfo.name}>
                <LinearGradient colors={['#059669', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[st.placeBtn, (submitting || orderItems.length === 0 || !customerInfo.name) && { opacity: 0.55 }]} testID="place-order-btn">
                  {submitting ? (<><Spinner size={17} /><Text style={st.placeText}>Creating...</Text></>) : (
                    <><Ionicons name="checkmark-circle" size={18} color={colors.white} /><Text style={st.placeText}>Place Order (${total.toFixed(2)})</Text></>
                  )}
                </LinearGradient>
              </PressScale>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>

    {/* Variant Picker sheet */}
    <Modal visible={variantPicker.open} transparent animationType="fade" onRequestClose={() => setVariantPicker(EMPTY_PICKER)}>
      <BlurView intensity={22} tint="dark" style={st.pickerBackdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setVariantPicker(EMPTY_PICKER)} />
        <View style={st.pickerSheet}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 }}>
            <Ionicons name="cube" size={17} color="#059669" />
            <Text style={st.pickerTitle}>Select Variant</Text>
          </View>
          {variantPicker.product && (
            <ScrollView style={{ maxHeight: 420 }}>
              <View style={st.pickerProd}>
                {variantPicker.product.images?.[0] ? <Image source={{ uri: img(variantPicker.product.images[0]) }} style={st.pickerImg} /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={st.itemName}>{variantPicker.product.name}</Text>
                  <Text style={st.payDesc}>Pick one or more variant options</Text>
                </View>
              </View>

              {variantPicker.product.colors?.length > 0 && (
                <>
                  <Text style={st.fieldLabel}>Color</Text>
                  <View style={st.varWrap}>
                    {variantPicker.product.colors.map((c, idx) => {
                      const disabled = (c.stock ?? 0) <= 0;
                      const selected = variantPicker.color === c.color_name;
                      return (
                        <TouchableOpacity key={idx} disabled={disabled}
                          onPress={() => setVariantPicker({ ...variantPicker, color: selected ? null : c.color_name })}
                          style={[st.varBtn, disabled && { opacity: 0.4 }, selected && { backgroundColor: '#ecfdf5', borderColor: '#10b981' }]}
                          testID={`variant-color-${c.color_name}`}>
                          <Text style={[st.varBtnText, selected && { color: '#047857', fontFamily: fonts.bold }]}>{c.color_name} <Text style={st.varStock}>({c.stock ?? 0})</Text></Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {variantPicker.product.has_size_variants && variantPicker.product.sizes?.length > 0 && (
                <>
                  <Text style={st.fieldLabel}>Size</Text>
                  <View style={st.varWrap}>
                    {variantPicker.product.sizes.map((s, idx) => {
                      const disabled = (s.stock ?? 0) <= 0;
                      const selected = variantPicker.size === s.size_name;
                      return (
                        <TouchableOpacity key={idx} disabled={disabled}
                          onPress={() => setVariantPicker({ ...variantPicker, size: selected ? null : s.size_name })}
                          style={[st.varBtn, { minWidth: 52 }, disabled && { opacity: 0.4 }, selected && { backgroundColor: '#eff6ff', borderColor: '#3b82f6' }]}
                          testID={`variant-size-${s.size_name}`}>
                          <Text style={[st.varBtnText, selected && { color: '#1d4ed8', fontFamily: fonts.bold }]}>{s.size_name} <Text style={st.varStock}>({s.stock ?? 0})</Text></Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {variantPicker.product.has_shape_variants && variantPicker.product.shapes?.length > 0 && (
                <>
                  <Text style={st.fieldLabel}>Shape</Text>
                  <View style={st.varWrap}>
                    {variantPicker.product.shapes.map((sh, idx) => {
                      const disabled = (sh.stock ?? 0) <= 0;
                      const selected = variantPicker.shape === sh.shape_name;
                      return (
                        <TouchableOpacity key={idx} disabled={disabled}
                          onPress={() => setVariantPicker({ ...variantPicker, shape: selected ? null : sh.shape_name })}
                          style={[st.varBtn, disabled && { opacity: 0.4 }, selected && { backgroundColor: '#fffbeb', borderColor: '#f59e0b' }]}
                          testID={`variant-shape-${sh.shape_name}`}>
                          <Text style={[st.varBtnText, selected && { color: '#b45309', fontFamily: fonts.bold }]}>{sh.shape_name} <Text style={st.varStock}>({sh.stock ?? 0})</Text></Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </ScrollView>
          )}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <PressScale style={{ flex: 1 }} onPress={() => setVariantPicker(EMPTY_PICKER)}>
              <View style={st.cancelBtn}><Text style={st.cancelText}>Cancel</Text></View>
            </PressScale>
            <PressScale style={{ flex: 1 }} onPress={confirmVariantPicker}>
              <LinearGradient colors={['#059669', '#047857']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.confirmBtn} testID="variant-confirm-btn">
                <Ionicons name="add" size={15} color={colors.white} />
                <Text style={st.placeText}>Add to Order</Text>
              </LinearGradient>
            </PressScale>
          </View>
        </View>
      </BlurView>
    </Modal>

    {/* Order Success popup — confetti burst */}
    <Modal visible={!!successOrder} transparent animationType="fade" onRequestClose={handleCloseSuccessPopup}>
      <BlurView intensity={26} tint="dark" style={st.pickerBackdrop}>
        <View style={st.successSheet} testID="order-success-popup">
          <Confetti />
          <View style={st.successIcon}><Ionicons name="checkmark-circle" size={44} color="#059669" /></View>
          <Text style={st.successTitle}>Order Completed!</Text>
          <Text style={st.successSub}>Your order has been placed successfully</Text>
          <View style={st.successBox}>
            <View style={st.totalRow}><Text style={st.totalKey}>Order ID</Text><Text style={st.successMono}>#{successOrder?.id?.slice(0, 8)}</Text></View>
            <View style={st.totalRow}><Text style={st.totalKey}>Customer</Text><Text style={st.totalVal}>{successOrder?.customer_name}</Text></View>
            <View style={st.totalRow}><Text style={st.totalKey}>Total Amount</Text><Text style={{ fontFamily: fonts.extrabold, fontSize: 16, color: '#059669' }}>${successOrder?.total_amount?.toFixed(2)}</Text></View>
            <View style={[st.totalRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9 }]}>
              <Text style={st.totalKey}>Payment Method</Text>
              <View style={[st.payBadge, {
                backgroundColor: successOrder?.payment_method === 'wallet' ? colors.p100 : successOrder?.payment_method === 'card' ? '#dbeafe' : '#fef3c7',
              }]}>
                <Ionicons name={successOrder?.payment_method === 'wallet' ? 'wallet' : successOrder?.payment_method === 'card' ? 'card' : 'cash'} size={12}
                  color={successOrder?.payment_method === 'wallet' ? colors.p800 : successOrder?.payment_method === 'card' ? '#1d4ed8' : '#b45309'} />
                <Text style={[st.payBadgeText, {
                  color: successOrder?.payment_method === 'wallet' ? colors.p800 : successOrder?.payment_method === 'card' ? '#1d4ed8' : '#b45309',
                }]}>{successOrder?.payment_method === 'wallet' ? 'Wallet' : successOrder?.payment_method === 'card' ? 'Card' : 'Cash on Delivery'}</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <PressScale style={{ flex: 1 }} onPress={handleCloseSuccessPopup}>
              <LinearGradient colors={['#059669', '#047857']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.confirmBtn} testID="create-another-order-btn">
                <Text style={st.placeText}>Create Another Order</Text>
              </LinearGradient>
            </PressScale>
            <PressScale style={{ flex: 1 }} onPress={() => { handleCloseSuccessPopup(); navigation.navigate('ShopOrders'); }}>
              <View style={st.cancelBtn} testID="view-orders-btn"><Text style={st.cancelText}>View Orders</Text></View>
            </PressScale>
          </View>
        </View>
      </BlurView>
    </Modal>
    </>
  );
}

const st = StyleSheet.create({
  headIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink, letterSpacing: -0.4 },
  sub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  searchCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 11, marginTop: 12, ...shadow.card },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  gridCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 13, marginTop: 12, ...shadow.card },
  gridTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { flexBasis: '47%', flexGrow: 1 },
  prodCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  prodImgWrap: { aspectRatio: 1, backgroundColor: colors.surfaceMuted },
  lowTag: { position: 'absolute', top: 6, right: 6, backgroundColor: '#f59e0b', borderRadius: radius.badge, paddingHorizontal: 6, paddingVertical: 2 },
  lowTagText: { color: colors.white, fontFamily: fonts.bold, fontSize: 8 },
  prodName: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.text, minHeight: 28 },
  prodPrice: { fontFamily: fonts.extrabold, fontSize: 13.5, color: '#059669' },
  prodStock: { fontFamily: fonts.body, fontSize: 9, color: colors.textMuted },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#059669', borderRadius: radius.sm, paddingVertical: 7 },
  addBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10.5 },
  emptyText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 8, textAlign: 'center' },
  fabWrap: { position: 'absolute', right: 16, bottom: TAB_SPACE + 8, zIndex: 40 },
  fab: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', shadowColor: '#059669', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  fabBadge: { position: 'absolute', top: -4, right: -4, minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, backgroundColor: '#ef4444', borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  fabBadgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 11 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, overflow: 'hidden' },
  sheetHead: { paddingHorizontal: 16, paddingBottom: 13, paddingTop: 8 },
  grabberLight: { alignSelf: 'center', width: 40, height: 4.5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)', marginBottom: 9 },
  sheetTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  sheetClose: { width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 10 },
  itemImg: { width: 44, height: 44, borderRadius: 10 },
  itemName: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  itemVar: { fontFamily: fonts.medium, fontSize: 9 },
  itemPrice: { fontFamily: fonts.bold, fontSize: 12.5, color: '#059669', marginTop: 2 },
  qtyBtn: { width: 27, height: 27, borderRadius: 8, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, width: 22, textAlign: 'center' },
  totalsBox: { backgroundColor: '#ecfdf5', borderRadius: radius.md, padding: 13, gap: 7 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalKey: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
  totalVal: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text },
  saveNote: { fontFamily: fonts.medium, fontSize: 10, color: '#059669' },
  section: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 13 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary, marginBottom: 5, marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13, color: colors.text, backgroundColor: colors.surface },
  stateChip: { alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.surface },
  stateChipText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.text },
  stateFee: { fontFamily: fonts.body, fontSize: 9, color: colors.textMuted, marginTop: 1 },
  payOption: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: '#059669' },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#059669' },
  payTitle: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  payDesc: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  placeBtn: { height: 50, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, shadowColor: '#059669', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  placeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  pickerSheet: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 17, ...shadow.dropdown },
  pickerTitle: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink },
  pickerProd: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 10, marginBottom: 6 },
  pickerImg: { width: 50, height: 50, borderRadius: 10 },
  varWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 6 },
  varBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 11, paddingVertical: 7, alignItems: 'center' },
  varBtnText: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.text },
  varStock: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted },
  cancelBtn: { height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  confirmBtn: { height: 46, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  successSheet: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 22, alignItems: 'stretch', overflow: 'hidden', ...shadow.dropdown },
  successIcon: { alignSelf: 'center', width: 76, height: 76, borderRadius: 38, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  successTitle: { fontFamily: fonts.extrabold, fontSize: 21, color: colors.ink, textAlign: 'center' },
  successSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, textAlign: 'center', marginTop: 3, marginBottom: 14 },
  successBox: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 14, gap: 9 },
  successMono: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink, letterSpacing: 0.3 },
  payBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  payBadgeText: { fontFamily: fonts.bold, fontSize: 10.5 },
});
