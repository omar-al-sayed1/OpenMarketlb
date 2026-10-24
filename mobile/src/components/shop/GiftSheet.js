import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { pickImage } from '../../lib/imagePick';
import { api } from '../../lib/api';
import { img, MEDIA_BASE_URL } from '../../lib/media';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { Input } from '../ui';
import { PressScale, Spinner, toast } from './ShopKit';

/**
 * Native port of components/GiftDialog.js — attach a free gift to a product.
 * Tabs: Create Gift Item / Choose Existing. Product picker when opened without a product.
 */
export default function GiftSheet({ open, onOpenChange, productId, productName, products: externalProducts, onGiftSaved }) {
  const [tab, setTab] = useState('gift_only'); // 'existing_product' | 'gift_only'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [giftName, setGiftName] = useState('');
  const [giftImage, setGiftImage] = useState('');
  const [giftStock, setGiftStock] = useState('');
  const [existingGift, setExistingGift] = useState(null);
  const [pickedProductId, setPickedProductId] = useState(productId);
  const [pickedProductName, setPickedProductName] = useState(productName);
  const [showProductPicker, setShowProductPicker] = useState(!productId);
  const [productSearchTerm, setProductSearchTerm] = useState('');

  useEffect(() => {
    if (open) {
      setPickedProductId(productId);
      setPickedProductName(productName);
      setShowProductPicker(!productId);
      if (productId) fetchExistingGift(productId);
      else {
        setExistingGift(null); setGiftName(''); setGiftImage(''); setGiftStock('');
        setSelectedProduct(null); setTab('gift_only');
      }
      fetchProducts();
    }
  }, [open, productId]); // eslint-disable-line

  const fetchExistingGift = async (pid) => {
    try {
      const { data } = await api.shopGifts.getProductGift(pid);
      if (data.gift) {
        setExistingGift(data.gift);
        setTab(data.gift.gift_type);
        setGiftStock(data.gift.gift_stock !== null && data.gift.gift_stock !== undefined ? String(data.gift.gift_stock) : '');
        if (data.gift.gift_type === 'gift_only') {
          setGiftName(data.gift.gift_name || '');
          setGiftImage(data.gift.gift_image || '');
        } else {
          setSelectedProduct({ id: data.gift.gift_product_id, name: data.gift.gift_name });
        }
      } else {
        setExistingGift(null); setGiftName(''); setGiftImage(''); setGiftStock(''); setSelectedProduct(null);
      }
    } catch (e) { /* no existing gift */ }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.shop.getProducts();
      setProducts((data.products || data || []).filter(p => p.id !== pickedProductId));
    } catch (e) {} finally { setLoading(false); }
  };

  const handlePickProduct = (prod) => {
    setPickedProductId(prod.id);
    setPickedProductName(prod.name);
    setShowProductPicker(false);
    fetchExistingGift(prod.id);
  };

  const pickGiftImage = async () => {
    const res = await pickImage({ mediaTypes: ['images'], quality: 0.85 });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) { toast.error('File too large (max 10MB)'); return; }
    setUploading(true);
    try {
      const resp = await api.shop.uploadFile({ uri: asset.uri, name: asset.fileName || 'gift.jpg', mimeType: asset.mimeType });
      setGiftImage(`${MEDIA_BASE_URL}${resp.data.url}`);
    } catch (e) { toast.error('Upload failed'); } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!pickedProductId) { toast.error('Please select a product first'); return; }
    setSaving(true);
    try {
      const payload = { gift_type: tab };
      if (tab === 'existing_product') {
        if (!selectedProduct) { toast.error('Please select a product as gift'); setSaving(false); return; }
        payload.gift_product_id = selectedProduct.id;
      } else {
        if (!giftName.trim()) { toast.error('Please enter a gift name'); setSaving(false); return; }
        payload.gift_name = giftName;
        payload.gift_image = giftImage;
      }
      payload.gift_stock = giftStock !== '' ? parseInt(giftStock, 10) : null; // null = unlimited
      await api.shopGifts.setGift(pickedProductId, payload);
      toast.success('Gift attached successfully!');
      onOpenChange(false);
      if (onGiftSaved) onGiftSaved();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save gift');
    } finally { setSaving(false); }
  };

  const handleRemoveGift = async () => {
    if (!pickedProductId) return;
    try {
      await api.shopGifts.removeGift(pickedProductId);
      toast.success('Gift removed from this product');
      setExistingGift(null); setGiftName(''); setGiftImage(''); setGiftStock(''); setSelectedProduct(null);
      onOpenChange(false);
      if (onGiftSaved) onGiftSaved();
    } catch (e) { toast.error('Failed to remove gift'); }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const allProducts = externalProducts || products;
  const filteredPickerProducts = allProducts.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()));

  const ProductRow = ({ p, selected, onPress }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}
      style={[styles.prodRow, selected && { backgroundColor: '#fce7f3', borderWidth: 1, borderColor: '#f9a8d4' }]}>
      {p.images?.[0] ? (
        <Image source={{ uri: img(p.images[0]) }} style={styles.prodImg} />
      ) : (
        <View style={[styles.prodImg, styles.prodImgEmpty]}><Ionicons name="cube" size={15} color={colors.textMuted} /></View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.prodName} numberOfLines={1}>{p.name}</Text>
        <Text style={styles.prodPrice}>${Number(p.original_price || p.price || 0).toFixed(2)}</Text>
      </View>
      {selected && <Ionicons name="checkmark" size={16} color="#db2777" />}
    </TouchableOpacity>
  );

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => onOpenChange(false)}>
      <BlurView intensity={26} tint="dark" style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => onOpenChange(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.head}>
              <LinearGradient colors={shop.gift} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headTile}>
                <Ionicons name="gift" size={15} color={colors.white} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.headTitle}>{existingGift ? 'Edit Gift' : 'Add Free Gift'}</Text>
                {pickedProductName && !showProductPicker ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.headFor} numberOfLines={1}>For: <Text style={{ fontFamily: fonts.bold }}>{pickedProductName}</Text></Text>
                    {!productId && (
                      <TouchableOpacity onPress={() => setShowProductPicker(true)}><Text style={styles.change}>Change</Text></TouchableOpacity>
                    )}
                  </View>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => onOpenChange(false)} style={styles.x}><Ionicons name="close" size={18} color={colors.textSecondary} /></TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 480 }} keyboardShouldPersistTaps="handled">
              {showProductPicker ? (
                <View style={{ padding: 16, gap: 10 }}>
                  <Text style={styles.label}>Select a product to attach a gift to:</Text>
                  <View style={styles.search}>
                    <Ionicons name="search" size={15} color={colors.textMuted} />
                    <TextInput value={productSearchTerm} onChangeText={setProductSearchTerm} placeholder="Search your products..."
                      placeholderTextColor={colors.textMuted} style={styles.searchInput} />
                  </View>
                  <View style={styles.list}>
                    {filteredPickerProducts.length === 0 ? (
                      <Text style={styles.emptyText}>No products found</Text>
                    ) : filteredPickerProducts.map(p => <ProductRow key={p.id} p={p} onPress={() => handlePickProduct(p)} />)}
                  </View>
                </View>
              ) : (
                <View style={{ padding: 16, gap: 14 }}>
                  {/* Tabs */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[{ key: 'gift_only', icon: 'add', label: 'Create Gift Item' }, { key: 'existing_product', icon: 'cube', label: 'Choose Existing' }].map(t => (
                      <TouchableOpacity key={t.key} style={{ flex: 1 }} activeOpacity={0.85} onPress={() => setTab(t.key)}>
                        {tab === t.key ? (
                          <LinearGradient colors={shop.gift} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tabOn}>
                            <Ionicons name={t.icon} size={14} color={colors.white} />
                            <Text style={styles.tabOnText}>{t.label}</Text>
                          </LinearGradient>
                        ) : (
                          <View style={styles.tabOff}>
                            <Ionicons name={t.icon} size={14} color={colors.textSecondary} />
                            <Text style={styles.tabOffText}>{t.label}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>

                  {tab === 'gift_only' ? (
                    <>
                      <Input label="Gift Name *" icon="gift-outline" value={giftName} onChangeText={setGiftName}
                        placeholder="e.g., Premium Phone Case, Sample Product" testID="gift-name-input" />
                      <View>
                        <Text style={styles.label}>Gift Image</Text>
                        <TouchableOpacity onPress={pickGiftImage} activeOpacity={0.8} style={styles.uploader}>
                          {uploading ? <Spinner size={18} color={colors.gift} /> : giftImage ? (
                            <Image source={{ uri: img(giftImage) }} style={styles.uploadPreview} />
                          ) : (
                            <>
                              <Ionicons name="cloud-upload-outline" size={22} color={colors.textMuted} />
                              <Text style={styles.uploadText}>Upload gift image</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        {giftImage ? (
                          <TouchableOpacity onPress={() => setGiftImage('')} style={{ marginTop: 6 }}>
                            <Text style={[styles.change, { color: colors.sale }]}>Remove image</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <View>
                        <Input label="Gift Stock (leave empty for unlimited)" icon="cube-outline" value={giftStock} onChangeText={setGiftStock}
                          keyboardType="number-pad" placeholder="Unlimited" testID="gift-stock-input" />
                        <Text style={styles.hint}>How many of this gift do you have in stock?</Text>
                      </View>
                      <View style={styles.mystery}>
                        <Ionicons name="gift" size={13} color="#b45309" />
                        <Text style={styles.mysteryText}>This gift will be a mystery to customers until they purchase the product!</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.search}>
                        <Ionicons name="search" size={15} color={colors.textMuted} />
                        <TextInput value={searchTerm} onChangeText={setSearchTerm} placeholder="Search your products..."
                          placeholderTextColor={colors.textMuted} style={styles.searchInput} testID="gift-search-input" />
                      </View>
                      {selectedProduct && (
                        <View style={styles.selectedRow}>
                          <Ionicons name="checkmark" size={15} color="#db2777" />
                          <Text style={styles.selectedText} numberOfLines={1}>Selected: {selectedProduct.name}</Text>
                          <TouchableOpacity onPress={() => setSelectedProduct(null)}><Ionicons name="close" size={15} color="#db2777" /></TouchableOpacity>
                        </View>
                      )}
                      <View style={styles.list}>
                        {loading ? (
                          <View style={{ alignItems: 'center', padding: 20 }}><Spinner size={18} color={colors.textMuted} /></View>
                        ) : filteredProducts.length === 0 ? (
                          <Text style={styles.emptyText}>No products found</Text>
                        ) : filteredProducts.map(p => (
                          <ProductRow key={p.id} p={p} selected={selectedProduct?.id === p.id} onPress={() => setSelectedProduct(p)} />
                        ))}
                      </View>
                      <Input label="Gift Stock (leave empty for unlimited)" icon="cube-outline" value={giftStock} onChangeText={setGiftStock}
                        keyboardType="number-pad" placeholder="Unlimited" testID="gift-stock-input-existing" />
                    </>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Footer actions */}
            {!showProductPicker && (
              <View style={styles.footer}>
                {existingGift && (
                  <PressScale onPress={handleRemoveGift}>
                    <View style={styles.removeBtn}><Text style={styles.removeText}>Remove Gift</Text></View>
                  </PressScale>
                )}
                <View style={{ flex: 1 }} />
                <PressScale onPress={() => onOpenChange(false)}>
                  <View style={styles.cancelBtn}><Text style={styles.cancelText}>Cancel</Text></View>
                </PressScale>
                <PressScale onPress={handleSave} disabled={saving}>
                  <LinearGradient colors={shop.gift} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn} testID="save-gift-btn">
                    {saving ? <Spinner size={14} /> : <Ionicons name="gift" size={14} color={colors.white} />}
                    <Text style={styles.saveText}>{existingGift ? 'Update Gift' : 'Attach Gift'}</Text>
                  </LinearGradient>
                </PressScale>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', ...shadow.dropdown },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 10 },
  headTile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink },
  headFor: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, maxWidth: 200 },
  change: { fontFamily: fonts.semibold, fontSize: 11, color: colors.violet },
  x: { padding: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13.5, color: colors.text, backgroundColor: colors.surface },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  list: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 6, gap: 2, maxHeight: 230 },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 16 },
  prodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: radius.sm },
  prodImg: { width: 40, height: 40, borderRadius: 10 },
  prodImgEmpty: { backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  prodName: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  prodPrice: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted },
  tabOn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: radius.md, shadowColor: '#ec4899', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  tabOnText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.white },
  tabOff: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: radius.md, backgroundColor: colors.bgAlt },
  tabOffText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  uploader: { height: 96, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 5, overflow: 'hidden' },
  uploadPreview: { width: '100%', height: '100%' },
  uploadText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  mystery: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.md, padding: 11 },
  mysteryText: { flex: 1, fontFamily: fonts.body, fontSize: 11.5, color: '#b45309' },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fdf2f8', borderWidth: 1, borderColor: '#fbcfe8', borderRadius: radius.md, padding: 11 },
  selectedText: { flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: '#9d174d' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, paddingTop: 8 },
  removeBtn: { borderWidth: 1, borderColor: '#fecaca', borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 10 },
  removeText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.saleAlt },
  cancelBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 10 },
  cancelText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.md, paddingHorizontal: 15, paddingVertical: 10 },
  saveText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.white },
});
