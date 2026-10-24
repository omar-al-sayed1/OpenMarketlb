import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, Image, ScrollView, Switch, Animated, Easing, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { pickImage } from '../../lib/imagePick';
import { api } from '../../lib/api';
import { img, MEDIA_BASE_URL } from '../../lib/media';
import { colors, radius, fonts, shadow } from '../../theme/theme';
import { PressScale, Spinner, toast } from './ShopKit';

/* Presets — ported verbatim from the web ProductFormDialog */
const SHAPE_OPTIONS = ['Round', 'Square', 'Rectangle', 'Oval', 'Heart', 'Star', 'Triangle', 'Hexagon', 'Diamond', 'Cylinder', 'Cone', 'Sphere', 'Cube', 'Custom'];
const SIZE_OPTIONS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Custom'];
const COLOR_SWATCHES = ['#000000', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#3b82f6', colors.s600, colors.p450, '#ec4899', '#78350f', '#64748b'];

const HEADER_GRAD = [colors.p500, '#f06a92', '#f43f5e']; // violet-600 -> fuchsia-600 -> rose-500

/* ---------- pick + upload one image, returns the hosted url ---------- */
async function pickAndUpload() {
  const res = await pickImage({ mediaTypes: ['images'], quality: 0.85 });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) { toast.error('File too large (max 10MB)'); return null; }
  const resp = await api.shop.uploadFile({ uri: asset.uri, name: asset.fileName || 'photo.jpg', mimeType: asset.mimeType });
  return `${MEDIA_BASE_URL}${resp.data.url}`;
}

/* ---------- single image uploader (per-variant / shared photos) ---------- */
function ImageBox({ value, onChange, small }) {
  const [busy, setBusy] = useState(false);
  const pick = async () => {
    setBusy(true);
    try { const url = await pickAndUpload(); if (url) onChange(url); }
    catch { toast.error('Upload failed'); }
    finally { setBusy(false); }
  };
  return (
    <TouchableOpacity onPress={pick} activeOpacity={0.8} style={[st.imageBox, small && { height: 72 }]}>
      {busy ? <Spinner size={16} color={colors.textMuted} /> : value ? (
        <>
          <Image source={{ uri: img(value) }} style={StyleSheet.absoluteFill} />
          <TouchableOpacity onPress={() => onChange('')} style={st.imgRemove}><Ionicons name="close" size={11} color={colors.white} /></TouchableOpacity>
        </>
      ) : (
        <>
          <Ionicons name="image-outline" size={18} color={colors.textMuted} />
          <Text style={st.imageBoxText}>Add photo</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/* ---------- multi image uploader with reorder (◀ ▶) ---------- */
function MultiImagePicker({ images, onChange }) {
  const [busy, setBusy] = useState(false);
  const urls = images.filter(u => u && u.trim());
  const add = async () => {
    setBusy(true);
    try { const url = await pickAndUpload(); if (url) onChange([...urls, url]); }
    catch { toast.error('Upload failed'); }
    finally { setBusy(false); }
  };
  const move = (i, dir) => {
    const next = [...urls];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9 }}>
        {urls.map((u, i) => (
          <View key={u + i} style={st.multiImg}>
            <Image source={{ uri: img(u) }} style={StyleSheet.absoluteFill} />
            {i === 0 && <View style={st.mainTag}><Text style={st.mainTagText}>MAIN</Text></View>}
            <TouchableOpacity onPress={() => onChange(urls.filter((_, x) => x !== i))} style={st.imgRemove}><Ionicons name="close" size={11} color={colors.white} /></TouchableOpacity>
            <View style={st.reorderRow}>
              <TouchableOpacity onPress={() => move(i, -1)} style={st.reorderBtn}><Ionicons name="chevron-back" size={12} color={colors.white} /></TouchableOpacity>
              <TouchableOpacity onPress={() => move(i, 1)} style={st.reorderBtn}><Ionicons name="chevron-forward" size={12} color={colors.white} /></TouchableOpacity>
            </View>
          </View>
        ))}
        <TouchableOpacity onPress={add} activeOpacity={0.8} style={[st.multiImg, st.multiAdd]}>
          {busy ? <Spinner size={16} color={colors.textMuted} /> : (
            <>
              <Ionicons name="add" size={22} color={colors.textMuted} />
              <Text style={st.imageBoxText}>Add</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
      <Text style={st.hint}>First photo is the main image — use ◀ ▶ to reorder.</Text>
    </View>
  );
}

/* ---------- category tree select (recursive, checkbox multi-select) ---------- */
function CategoryTree({ tree, selectedIds, onChange, depth = 0 }) {
  return (
    <View>
      {(tree || []).map(node => <CategoryNode key={node.id} node={node} selectedIds={selectedIds} onChange={onChange} depth={depth} />)}
    </View>
  );
}
function CategoryNode({ node, selectedIds, onChange, depth }) {
  const [open, setOpen] = useState(false);
  const sel = selectedIds.includes(node.id);
  const kids = node.children || [];
  return (
    <View>
      <View style={[st.catRow, { paddingLeft: 8 + depth * 18 }]}>
        <TouchableOpacity style={st.catCheckRow} activeOpacity={0.75}
          onPress={() => onChange(sel ? selectedIds.filter(id => id !== node.id) : [...selectedIds, node.id])}>
          <View style={[st.checkbox, sel && st.checkboxOn]}>{sel && <Ionicons name="checkmark" size={11} color={colors.white} />}</View>
          <Text style={[st.catName, sel && { color: colors.p800, fontFamily: fonts.bold }]} numberOfLines={1}>{node.name}</Text>
        </TouchableOpacity>
        {kids.length > 0 && (
          <TouchableOpacity onPress={() => setOpen(!open)} style={{ padding: 6 }}>
            <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={14} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {open && kids.length > 0 && <CategoryTree tree={kids} selectedIds={selectedIds} onChange={onChange} depth={depth + 1} />}
    </View>
  );
}

/* ---------- shared small controls ---------- */
const FieldLabel = ({ children, right }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
    <Text style={st.fieldLabel}>{children}</Text>
    {right}
  </View>
);
const SwitchRow = ({ label, value, onValueChange, tint = '#10b981', style, testID }) => (
  <View style={[st.switchRow, style]}>
    <Text style={st.switchLabel}>{label}</Text>
    <Switch value={!!value} onValueChange={onValueChange} trackColor={{ true: tint, false: colors.border }} thumbColor={colors.white} testID={testID} />
  </View>
);
/* Section wrapper */
const Section = ({ n, title, tint = colors.p100, text = colors.p500, right, children, accent }) => (
  <View style={[st.section, accent && { borderColor: '#f0abfc', shadowColor: '#e879f9', shadowOpacity: 0.3, shadowRadius: 12, elevation: 5 }]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <View style={[st.stepNum, { backgroundColor: tint }]}><Text style={[st.stepNumText, { color: text }]}>{n}</Text></View>
      <Text style={st.stepTitle}>{title}</Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
    {children}
  </View>
);

/* ---------- generic variant builder (color / size / shape / type) ---------- */
const VARIANT_CFG = {
  color: { listKey: 'colors', flagKey: 'has_color_variants', nameKey: 'color_name', label: 'Color variants', desc: 'Different colors with photos', icon: 'color-palette',
    samePriceKey: 'use_same_price_colors', sharedPriceKey: 'color_shared_price', sharedDiscountKey: 'color_shared_discount',
    border: colors.p300, bg: colors.p50, accent: colors.p800, soft: colors.p100, photo: 'always', hasCode: true,
    empty: { color_name: '', color_code: '#000000', image_url: '', stock: 0, price: null, discount_price: null }, addLabel: 'Add Color', testID: 'color-variant-toggle' },
  size: { listKey: 'sizes', flagKey: 'has_size_variants', nameKey: 'size_name', label: 'Size variants', desc: 'XXS, XS, S, M, L, XL... or custom', icon: 'resize',
    samePriceKey: 'use_same_price_sizes', sharedPriceKey: 'size_shared_price', sharedDiscountKey: 'size_shared_discount',
    samePhotoKey: 'use_same_photo_sizes', sharedImageKey: 'size_variant_image', presets: SIZE_OPTIONS,
    border: '#93c5fd', bg: '#eff6ff', accent: '#1d4ed8', soft: '#dbeafe', photo: 'unlessShared',
    empty: { size_name: 'M', stock: 0, price: null, discount_price: null, image_url: '' }, addLabel: 'Add Size', testID: 'size-variant-toggle' },
  shape: { listKey: 'shapes', flagKey: 'has_shape_variants', nameKey: 'shape_name', label: 'Shape variants', desc: 'Round, square, heart, custom... pick from preset', icon: 'cube-outline',
    samePriceKey: 'use_same_price_shapes', sharedPriceKey: 'shape_shared_price', sharedDiscountKey: 'shape_shared_discount', presets: SHAPE_OPTIONS,
    border: '#6ee7b7', bg: '#ecfdf5', accent: '#047857', soft: '#d1fae5', photo: 'always',
    empty: { shape_name: '', image_url: '', stock: 0, price: null, discount_price: null }, addLabel: 'Add Shape', testID: 'shape-variant-toggle' },
  type: { listKey: 'types', flagKey: 'has_type_variants', nameKey: 'type_name', label: 'Type variants', desc: 'e.g. Samsung Galaxy S24, S24 Ultra, S24 FE', icon: 'layers',
    samePriceKey: 'use_same_price_types', sharedPriceKey: 'type_shared_price', sharedDiscountKey: 'type_shared_discount',
    samePhotoKey: 'use_same_photo_types', sharedImageKey: 'type_variant_image',
    border: '#fcd34d', bg: '#fffbeb', accent: '#b45309', soft: '#fef3c7', photo: 'unlessShared',
    empty: { type_name: '', stock: 0, price: null, discount_price: null, image_url: '' }, addLabel: 'Add Type', testID: 'type-variant-toggle' },
};

function VariantBuilder({ kind, formData, setFormData, calculateCustomerPrice }) {
  const c = VARIANT_CFG[kind];
  const on = formData[c.flagKey];
  const list = formData[c.listKey] || [];
  const setList = (next) => setFormData(prev => ({ ...prev, [c.listKey]: next }));
  const patch = (i, obj) => setList(list.map((v, x) => (x === i ? { ...v, ...obj } : v)));
  const samePhotoOn = c.samePhotoKey ? formData[c.samePhotoKey] : false;

  return (
    <View style={[st.variantBox, on && { borderColor: c.border, backgroundColor: c.bg }]}>
      {/* Toggle head */}
      <View style={st.variantHead}>
        <View style={[st.variantIcon, { backgroundColor: on ? c.soft : colors.borderLight }]}>
          <Ionicons name={c.icon} size={16} color={on ? c.accent : colors.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.variantTitle}>{c.label}</Text>
          <Text style={st.variantDesc}>{c.desc}</Text>
        </View>
        <Switch value={!!on} testID={c.testID}
          onValueChange={(checked) => setFormData(prev => ({
            ...prev, [c.flagKey]: checked,
            [c.listKey]: checked && list.length === 0 ? [{ ...c.empty }] : list,
          }))}
          trackColor={{ true: c.accent, false: colors.border }} thumbColor={colors.white} />
      </View>

      {on && (
        <View style={{ padding: 11, paddingTop: 0, gap: 10 }}>
          <SwitchRow label={`Use same price for all ${c.listKey}?`} value={formData[c.samePriceKey]} tint={c.accent}
            onValueChange={(v) => setFormData(prev => ({ ...prev, [c.samePriceKey]: v }))} />
          {c.samePhotoKey && (
            <SwitchRow label={`Same photo for ${c.listKey}?`} value={samePhotoOn} tint={c.accent}
              onValueChange={(v) => setFormData(prev => ({ ...prev, [c.samePhotoKey]: v }))} />
          )}

          {formData[c.samePriceKey] && (
            <View style={[st.sharedBox, { borderColor: c.border }]}>
              <View style={{ flex: 1 }}>
                <FieldLabel>SHARED PRICE *</FieldLabel>
                <TextInput value={String(formData[c.sharedPriceKey] || '')} onChangeText={(t) => setFormData(prev => ({ ...prev, [c.sharedPriceKey]: t }))}
                  keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textMuted} style={st.input} />
                {!!parseFloat(formData[c.sharedPriceKey]) && <Text style={[st.custHint, { color: c.accent }]}>Customer: ${calculateCustomerPrice(formData[c.sharedPriceKey])}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>SHARED SALE</FieldLabel>
                <TextInput value={String(formData[c.sharedDiscountKey] || '')} onChangeText={(t) => setFormData(prev => ({ ...prev, [c.sharedDiscountKey]: t }))}
                  keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textMuted} style={st.input} />
                {!!parseFloat(formData[c.sharedDiscountKey]) && <Text style={[st.custHint, { color: '#047857' }]}>Customer: ${calculateCustomerPrice(formData[c.sharedDiscountKey])}</Text>}
              </View>
            </View>
          )}

          {c.sharedImageKey && samePhotoOn && (
            <View>
              <FieldLabel>SHARED PHOTO</FieldLabel>
              <ImageBox small value={formData[c.sharedImageKey]} onChange={(url) => setFormData(prev => ({ ...prev, [c.sharedImageKey]: url }))} />
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[st.fieldLabel, { color: c.accent }]}>{c.label.toUpperCase()}</Text>
            <TouchableOpacity onPress={() => setList([...list, { ...c.empty }])} style={[st.addVariantBtn, { borderColor: c.border }]} activeOpacity={0.8}
              testID={kind === 'color' ? 'add-color-variant-btn' : kind === 'type' ? 'add-type-variant-btn' : undefined}>
              <Ionicons name="add" size={12} color={c.accent} />
              <Text style={[st.addVariantText, { color: c.accent }]}>{c.addLabel}</Text>
            </TouchableOpacity>
          </View>

          {list.map((v, i) => {
            const name = v[c.nameKey] || '';
            const usesPreset = c.presets && (c.presets.includes(name) || name === '');
            return (
              <View key={i} style={[st.variantCard, { borderColor: c.border }]}>
                <TouchableOpacity onPress={() => setList(list.filter((_, x) => x !== i))} style={st.variantRemove}>
                  <Ionicons name="close" size={12} color="#f87171" />
                </TouchableOpacity>

                {(c.photo === 'always' || (c.photo === 'unlessShared' && !samePhotoOn)) && (
                  <ImageBox small value={v.image_url} onChange={(url) => patch(i, { image_url: url })} />
                )}

                {/* name — preset chips or free text */}
                {c.presets ? (
                  <View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5, paddingVertical: 6 }}>
                      {c.presets.map(opt => {
                        const selected = opt === 'Custom' ? (!c.presets.includes(name) && name !== '') : name === opt;
                        return (
                          <TouchableOpacity key={opt} onPress={() => patch(i, { [c.nameKey]: opt === 'Custom' ? '' : opt })}
                            style={[st.presetChip, selected && { backgroundColor: c.accent, borderColor: c.accent }]}>
                            <Text style={[st.presetChipText, selected && { color: colors.white }]}>{opt}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    {(!c.presets.includes(name)) && (
                      <TextInput value={c.presets.includes(name) ? '' : name} onChangeText={(t) => patch(i, { [c.nameKey]: t })}
                        placeholder={kind === 'size' ? 'Enter custom size (e.g. 42, EU40)' : 'Custom shape name'}
                        placeholderTextColor={colors.textMuted} style={[st.input, { marginTop: 4 }]} />
                    )}
                  </View>
                ) : (
                  <View>
                    <TextInput value={name} onChangeText={(t) => patch(i, { [c.nameKey]: t })}
                      placeholder={kind === 'color' ? 'Color name (e.g. Red)' : 'e.g. Samsung Galaxy S24'}
                      placeholderTextColor={colors.textMuted} style={st.input}
                      testID={kind === 'color' ? `variant-name-${i}` : `type-variant-name-${i}`} />
                  </View>
                )}

                {/* color code swatches */}
                {c.hasCode && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 6 }}>
                    {COLOR_SWATCHES.map(sw => (
                      <TouchableOpacity key={sw} onPress={() => patch(i, { color_code: sw })}
                        style={[st.swatch, { backgroundColor: sw }, v.color_code === sw && st.swatchOn]}>
                        {v.color_code === sw && <Ionicons name="checkmark" size={11} color={sw === '#ffffff' ? '#0f172a' : '#fff'} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Text style={st.miniLabel}>Stock:</Text>
                  <TextInput value={v.stock ? String(v.stock) : ''} onChangeText={(t) => patch(i, { stock: parseInt(t, 10) || 0 })}
                    keyboardType="number-pad" placeholder="Stock qty" placeholderTextColor={colors.textMuted} style={[st.input, { flex: 1 }]}
                    testID={kind === 'color' ? `variant-stock-${i}` : kind === 'size' ? `size-variant-stock-${i}` : kind === 'type' ? `type-variant-stock-${i}` : undefined} />
                </View>

                {!formData[c.samePriceKey] && (
                  <>
                    <View style={{ flexDirection: 'row', gap: 7 }}>
                      <TextInput value={v.price ? String(v.price) : ''} onChangeText={(t) => patch(i, { price: parseFloat(t) || null })}
                        keyboardType="decimal-pad" placeholder="Price" placeholderTextColor={colors.textMuted} style={[st.input, { flex: 1 }]} />
                      <TextInput value={v.discount_price ? String(v.discount_price) : ''} onChangeText={(t) => patch(i, { discount_price: parseFloat(t) || null })}
                        keyboardType="decimal-pad" placeholder="Sale" placeholderTextColor={colors.textMuted} style={[st.input, { flex: 1 }]} />
                    </View>
                    {!!v.price && parseFloat(v.price) > 0 && (
                      <View style={[st.custBadge, { backgroundColor: c.soft }]}>
                        <Text style={[st.custHint, { color: c.accent, marginTop: 0 }]}>
                          Customer: ${calculateCustomerPrice(v.price)}{v.discount_price ? ` (Sale: $${calculateCustomerPrice(v.discount_price)})` : ''}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/**
 * Full-screen native port of components/ProductFormDialog.js.
 * Same prop contract as the web dialog so the products screen mirrors ShopProducts.js.
 */
export default function ProductFormSheet({
  open, editingProduct, formData, setFormData, categories, variantToggles,
  commissionRate, commissionType, calculateCustomerPrice, calculateShopRevenue, getCommissionTypeLabel,
  onSubmit, onCancel,
  enableAI = false, onAiGenerate, aiLoading = false, aiAccent = false,
  suggestedCategoryObjects = [], toggleCategoryQuick,
}) {
  const insets = useSafeAreaInsets();
  const [submitting, setSubmitting] = useState(false);
  const sparkle = useRef(new Animated.Value(0)).current;
  // typing shimmer: reveal the AI-written description progressively
  const [typedDesc, setTypedDesc] = useState(null);
  const typingTimer = useRef(null);

  useEffect(() => {
    if (aiLoading) {
      Animated.loop(Animated.timing(sparkle, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })).start();
    } else { sparkle.stopAnimation(); sparkle.setValue(0); }
  }, [aiLoading, sparkle]);

  // when the AI fills the form (aiAccent pulse), stream the description in
  useEffect(() => {
    if (aiAccent && formData.description) {
      const full = formData.description;
      let i = 0;
      setTypedDesc('');
      if (typingTimer.current) clearInterval(typingTimer.current);
      typingTimer.current = setInterval(() => {
        i += Math.max(2, Math.round(full.length / 60));
        if (i >= full.length) { setTypedDesc(null); clearInterval(typingTimer.current); }
        else setTypedDesc(full.slice(0, i));
      }, 24);
      return () => clearInterval(typingTimer.current);
    }
  }, [aiAccent]); // eslint-disable-line

  const enabledVariantCount = [formData.has_color_variants, formData.has_size_variants, formData.has_shape_variants, formData.has_type_variants].filter(Boolean).length;
  const totalVariantStock = [...(formData.colors || []), ...(formData.sizes || []), ...(formData.shapes || []), ...(formData.types || [])]
    .reduce((sum, v) => sum + (parseInt(v.stock, 10) || 0), 0);

  const submit = async () => {
    setSubmitting(true);
    try { await onSubmit(); } finally { setSubmitting(false); }
  };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: colors.surfaceMuted }}>
        {/* Sticky gradient header */}
        <LinearGradient colors={HEADER_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingTop: insets.top + 8 }}>
          <View style={st.head} testID="product-dialog">
            <View style={st.headIcon}><Ionicons name="sparkles" size={19} color={colors.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={st.headTitle}>{editingProduct ? 'Edit Product' : 'Create New Product'}</Text>
              <Text style={st.headSub}>Fill in the details below{enableAI ? ' — or let AI help' : ''}</Text>
            </View>
            <TouchableOpacity onPress={onCancel} style={st.headClose}><Ionicons name="close" size={20} color={colors.white} /></TouchableOpacity>
          </View>
        </LinearGradient>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
            {/* === STEP 1: BASICS === */}
            <Section n="1" title="PRODUCT BASICS" accent={aiAccent}
              right={enableAI ? (
                <View style={st.aiTag}><Ionicons name="color-wand" size={9} color="#f06a92" /><Text style={st.aiTagText}>AI Assist</Text></View>
              ) : null}>
              {enableAI && (
                <LinearGradient colors={[colors.p50, '#fff0f3', '#fdf2f8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.aiBox}>
                  <LinearGradient colors={[colors.p450, '#ffc0cb']} style={st.aiIcon}><Ionicons name="color-wand" size={19} color={colors.white} /></LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={st.aiTitle}>Smart AI Assistant</Text>
                    <Text style={st.aiDesc}>Type a product name (or upload an image) and let AI write the description and pick categories.</Text>
                  </View>
                  <PressScale onPress={onAiGenerate} disabled={aiLoading}>
                    <LinearGradient colors={[colors.p500, '#f06a92']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.aiBtn} testID="ai-generate-product-btn">
                      {aiLoading ? (
                        <Animated.View style={{ transform: [{ rotate: sparkle.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
                          <Ionicons name="sparkles" size={14} color={colors.white} />
                        </Animated.View>
                      ) : <Ionicons name="sparkles" size={14} color={colors.white} />}
                      <Text style={st.aiBtnText}>{aiLoading ? 'Thinking…' : 'Generate'}</Text>
                    </LinearGradient>
                  </PressScale>
                </LinearGradient>
              )}

              <FieldLabel>PRODUCT NAME *</FieldLabel>
              <TextInput value={formData.name} onChangeText={(t) => setFormData(prev => ({ ...prev, name: t }))}
                placeholder="e.g. Handcrafted Leather Wallet" placeholderTextColor={colors.textMuted} style={st.input} testID="product-name-input" />

              <FieldLabel right={formData.description?.length > 0 ? <Text style={st.charCount}>{formData.description.length} chars</Text> : null}>DESCRIPTION *</FieldLabel>
              <TextInput
                value={typedDesc != null ? typedDesc : formData.description}
                onChangeText={(t) => setFormData(prev => ({ ...prev, description: t }))}
                editable={typedDesc == null}
                multiline numberOfLines={4}
                placeholder="Describe the product features, materials, sizing, etc."
                placeholderTextColor={colors.textMuted}
                style={[st.input, { height: 92, textAlignVertical: 'top' }, typedDesc != null && { borderColor: '#f0abfc', backgroundColor: '#fff0f3' }]}
                testID="product-description-input" />

              <FieldLabel>TARGET AUDIENCE</FieldLabel>
              <View style={{ flexDirection: 'row', gap: 7 }}>
                {[{ v: 'none', l: 'Everyone' }, { v: 'male', l: 'Men' }, { v: 'female', l: 'Women' }, { v: 'kids', l: 'Kids' }].map(o => (
                  <TouchableOpacity key={o.v} onPress={() => setFormData(prev => ({ ...prev, gender: o.v }))}
                    style={[st.genderChip, formData.gender === o.v && st.genderChipOn]} testID={`product-gender-${o.v}`}>
                    <Text style={[st.genderChipText, formData.gender === o.v && { color: colors.white }]}>{o.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* active toggle */}
              <View style={st.activeRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[st.activeDot, { backgroundColor: formData.is_active ? '#10b981' : colors.border }]} />
                  <Text style={st.switchLabel}>{formData.is_active ? 'Active' : 'Inactive'}</Text>
                </View>
                <Switch value={!!formData.is_active} onValueChange={(v) => setFormData(prev => ({ ...prev, is_active: v }))}
                  trackColor={{ true: '#10b981', false: colors.border }} thumbColor={colors.white} testID="product-active-toggle" />
              </View>
            </Section>

            {/* === STEP 2: CATEGORIES === */}
            <Section n="2" title="CATEGORIES" tint="#d1fae5" text="#059669"
              right={formData.category_ids.length > 0 ? (
                <View style={[st.aiTag, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}><Text style={[st.aiTagText, { color: '#047857' }]}>{formData.category_ids.length} selected</Text></View>
              ) : null}>
              {suggestedCategoryObjects.length > 0 && (
                <View style={st.suggestBox} testID="suggested-categories-section">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                    <Ionicons name="sparkles" size={12} color={colors.p450} />
                    <Text style={st.suggestTitle}>SUGGESTED FOR YOUR SHOP</Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {suggestedCategoryObjects.map(cat => {
                      const isSel = formData.category_ids.includes(cat.id);
                      return (
                        <TouchableOpacity key={cat.id} onPress={() => toggleCategoryQuick && toggleCategoryQuick(cat.id)}
                          style={[st.suggestChip, isSel && { backgroundColor: colors.p500, borderColor: colors.p500 }]} testID={`suggested-cat-${cat.id}`}>
                          <Text style={[st.suggestChipText, isSel && { color: colors.white }]}>{cat.name}</Text>
                          {isSel && <Ionicons name="checkmark" size={11} color={colors.white} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
              <Text style={[st.miniLabel, { marginBottom: 6 }]}>All categories</Text>
              <View style={st.catTree}>
                <CategoryTree tree={categories} selectedIds={formData.category_ids} onChange={(ids) => setFormData(prev => ({ ...prev, category_ids: ids }))} />
              </View>
            </Section>

            {/* === STEP 3: VARIANTS === */}
            <Section n="3" title="VARIANTS" tint="#fef3c7" text="#d97706"
              right={enabledVariantCount > 0 ? (
                <View style={[st.aiTag, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}><Text style={[st.aiTagText, { color: '#b45309' }]}>{enabledVariantCount} type{enabledVariantCount > 1 ? 's' : ''} enabled</Text></View>
              ) : null}>
              <Text style={st.variantIntro}>Enable any combination of color, size, shape, or type. Customers will choose variants before adding to cart.</Text>
              <View style={{ gap: 10 }} testID="variant-toggle-section">
                {variantToggles.variant_color_enabled && <VariantBuilder kind="color" formData={formData} setFormData={setFormData} calculateCustomerPrice={calculateCustomerPrice} />}
                {variantToggles.variant_size_enabled && <VariantBuilder kind="size" formData={formData} setFormData={setFormData} calculateCustomerPrice={calculateCustomerPrice} />}
                {variantToggles.variant_shape_enabled && <VariantBuilder kind="shape" formData={formData} setFormData={setFormData} calculateCustomerPrice={calculateCustomerPrice} />}
                {variantToggles.variant_type_enabled && <VariantBuilder kind="type" formData={formData} setFormData={setFormData} calculateCustomerPrice={calculateCustomerPrice} />}

                {enabledVariantCount > 0 && (
                  <View style={st.totalStock}>
                    <Text style={st.totalStockLabel}>TOTAL STOCK</Text>
                    <Text style={st.totalStockValue} testID="variant-total-stock">{totalVariantStock} units</Text>
                  </View>
                )}

                {enabledVariantCount >= 2 && (
                  <View style={st.modeBox} testID="variant-selection-mode">
                    <View style={{ flexDirection: 'row', gap: 7, marginBottom: 10 }}>
                      <Ionicons name="information-circle" size={15} color={colors.p500} style={{ marginTop: 1 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={st.modeTitle}>Variant Selection Mode</Text>
                        <Text style={st.modeDesc}>Decide if customers pick <Text style={{ fontFamily: fonts.bold }}>only one</Text> variant type or <Text style={{ fontFamily: fonts.bold }}>multiple</Text> at once (e.g., color + size for clothes).</Text>
                      </View>
                    </View>
                    <View style={{ gap: 7 }}>
                      {[
                        { v: 'single', t: 'Single variant', d: 'Customer picks ONE type only (e.g., either color or size).' },
                        { v: 'multi', t: 'Multi variant (clothes)', d: 'Customer picks multiple types (e.g., color AND size).' },
                      ].map(m => (
                        <TouchableOpacity key={m.v} onPress={() => setFormData(prev => ({ ...prev, variant_selection_mode: m.v }))}
                          style={[st.modeOption, formData.variant_selection_mode === m.v && { borderColor: colors.p500, backgroundColor: colors.white, ...shadow.card }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {formData.variant_selection_mode === m.v && <Ionicons name="checkmark" size={14} color={colors.p500} />}
                            <Text style={st.modeOptTitle}>{m.t}</Text>
                          </View>
                          <Text style={st.modeDesc}>{m.d}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </Section>

            {/* === STEP 4: PRICING & STOCK (only if no variants) === */}
            {enabledVariantCount === 0 && (
              <Section n="4" title="PRICING & STOCK">
                <View style={st.commRow}>
                  <Ionicons name="pricetag" size={13} color={colors.p500} />
                  <Text style={st.commText}>Commission: {commissionRate}% · {getCommissionTypeLabel()}</Text>
                  <Text style={st.commHint}>
                    {commissionType === 'on_shop' && 'deducted from shop revenue'}
                    {commissionType === 'on_customer' && 'added to customer price'}
                    {commissionType === 'half_half' && 'split with customer'}
                  </Text>
                </View>

                <FieldLabel>YOUR PRICE *</FieldLabel>
                <TextInput value={String(formData.price || '')} onChangeText={(t) => setFormData(prev => ({ ...prev, price: t }))}
                  keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textMuted} style={st.input} testID="product-price-input" />
                {!!parseFloat(formData.price) && (
                  <View style={{ gap: 6, marginTop: 8 }}>
                    <View style={[st.priceBadge, { backgroundColor: colors.p50, borderColor: colors.p200 }]}>
                      <Text style={[st.priceBadgeK, { color: colors.p500 }]}>CUSTOMER PAYS</Text>
                      <Text style={[st.priceBadgeV, { color: colors.p800 }]}>${calculateCustomerPrice(formData.price)}</Text>
                    </View>
                    <View style={[st.priceBadge, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                      <Text style={[st.priceBadgeK, { color: '#059669' }]}>YOU RECEIVE</Text>
                      <Text style={[st.priceBadgeV, { color: '#047857' }]}>${calculateShopRevenue(formData.price)}</Text>
                    </View>
                  </View>
                )}

                <FieldLabel>SALE PRICE (OPTIONAL)</FieldLabel>
                <TextInput value={String(formData.discount_price || '')} onChangeText={(t) => setFormData(prev => ({ ...prev, discount_price: t }))}
                  keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textMuted} style={st.input} />
                {!!parseFloat(formData.discount_price) && (
                  <View style={{ gap: 6, marginTop: 8 }}>
                    <View style={[st.priceBadge, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                      <Text style={[st.priceBadgeK, { color: '#059669' }]}>CUSTOMER PAYS</Text>
                      <Text style={[st.priceBadgeV, { color: '#047857' }]}>${calculateCustomerPrice(formData.discount_price)}</Text>
                    </View>
                    <View style={[st.priceBadge, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                      <Text style={[st.priceBadgeK, { color: '#059669' }]}>YOU RECEIVE</Text>
                      <Text style={[st.priceBadgeV, { color: '#047857' }]}>${calculateShopRevenue(formData.discount_price)}</Text>
                    </View>
                  </View>
                )}

                <FieldLabel>STOCK QUANTITY *</FieldLabel>
                <TextInput value={String(formData.stock || '')} onChangeText={(t) => setFormData(prev => ({ ...prev, stock: t }))}
                  keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textMuted} style={st.input} testID="product-stock-input" />
              </Section>
            )}

            {/* === STEP 5: IMAGES === */}
            <Section n={enabledVariantCount > 0 ? '4' : '5'} title={enabledVariantCount > 0 ? 'ADDITIONAL IMAGES' : 'PRODUCT IMAGES'} tint="#ffe4e6" text="#e11d48">
              <MultiImagePicker images={formData.images || []} onChange={(urls) => setFormData(prev => ({ ...prev, images: urls.length ? urls : [''] }))} />
            </Section>
          </ScrollView>

          {/* Sticky submit row */}
          <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <PressScale onPress={onCancel}>
              <View style={st.cancelBtn}><Text style={st.cancelText}>Cancel</Text></View>
            </PressScale>
            <PressScale onPress={submit} disabled={submitting} style={{ flex: 1 }}>
              <LinearGradient colors={HEADER_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.submitBtn} testID="submit-product-btn">
                {submitting ? <Spinner size={15} /> : null}
                <Text style={st.submitText}>{editingProduct ? 'Update Product' : 'Create Product'}</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.white} />
              </LinearGradient>
            </PressScale>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingBottom: 14 },
  headIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 17, letterSpacing: -0.3 },
  headSub: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.body, fontSize: 10.5, marginTop: 1 },
  headClose: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, padding: 15, marginBottom: 14 },
  stepNum: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: fonts.extrabold, fontSize: 12 },
  stepTitle: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text, letterSpacing: 1 },
  aiTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff0f3', borderWidth: 1, borderColor: '#ffd6de', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  aiTagText: { fontFamily: fonts.bold, fontSize: 9, color: '#f06a92' },
  aiBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#ffd6de', borderRadius: radius.md, padding: 13, marginBottom: 14 },
  aiIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  aiTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  aiDesc: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, marginTop: 2, lineHeight: 14 },
  aiBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, shadowColor: '#ffc0cb', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  aiBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 11.5 },
  fieldLabel: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.textSecondary, letterSpacing: 0.8, marginTop: 4 },
  charCount: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13.5, color: colors.text, backgroundColor: colors.surface, marginBottom: 4 },
  genderChip: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  genderChipOn: { backgroundColor: colors.p500, borderColor: colors.p500 },
  genderChipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderColor: '#d1fae5', backgroundColor: 'rgba(236,253,245,0.5)', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, marginTop: 12 },
  activeDot: { width: 10, height: 10, borderRadius: 5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  switchLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  suggestBox: { backgroundColor: colors.p50, borderWidth: 1, borderColor: colors.p100, borderRadius: radius.md, padding: 12, marginBottom: 12 },
  suggestTitle: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.p800, letterSpacing: 1 },
  suggestChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.p200, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6 },
  suggestChipText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.p800 },
  catTree: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 5, maxHeight: 280 },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  catCheckRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.p500, borderColor: colors.p500 },
  catName: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.text },
  variantIntro: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, lineHeight: 16, marginBottom: 10 },
  variantBox: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  variantHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  variantIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  variantTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  variantDesc: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted, marginTop: 1 },
  sharedBox: { flexDirection: 'row', gap: 8, backgroundColor: colors.white, borderWidth: 1, borderRadius: radius.sm, padding: 10 },
  custHint: { fontFamily: fonts.semibold, fontSize: 9.5, marginTop: 2 },
  custBadge: { borderRadius: radius.badge, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  addVariantBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.white },
  addVariantText: { fontFamily: fonts.bold, fontSize: 10.5 },
  variantCard: { backgroundColor: colors.white, borderWidth: 1, borderRadius: radius.md, padding: 10, gap: 7 },
  variantRemove: { position: 'absolute', top: 5, right: 5, zIndex: 5, padding: 4, borderRadius: radius.pill, backgroundColor: '#fef2f2' },
  presetChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.white },
  presetChipText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  swatchOn: { borderWidth: 2, borderColor: '#0f172a' },
  miniLabel: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.textSecondary },
  totalStock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11 },
  totalStockLabel: { color: colors.white, fontFamily: fonts.semibold, fontSize: 10.5, letterSpacing: 1 },
  totalStockValue: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 15 },
  modeBox: { borderWidth: 2, borderColor: colors.p200, backgroundColor: colors.p50, borderRadius: radius.md, padding: 12 },
  modeTitle: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink },
  modeDesc: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, lineHeight: 14, marginTop: 2 },
  modeOption: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, padding: 11, backgroundColor: 'rgba(255,255,255,0.6)' },
  modeOptTitle: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink },
  commRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.p50, borderWidth: 1, borderColor: colors.p100, borderRadius: radius.md, padding: 10, marginBottom: 12, flexWrap: 'wrap' },
  commText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.ink },
  commHint: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted, marginLeft: 'auto' },
  priceBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 11, paddingVertical: 8 },
  priceBadgeK: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.8 },
  priceBadgeV: { fontFamily: fonts.extrabold, fontSize: 15 },
  imageBox: { height: 90, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  imageBoxText: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.textMuted },
  imgRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(15,23,42,0.65)', borderRadius: radius.pill, padding: 4 },
  multiImg: { width: 96, height: 96, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  multiAdd: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 2 },
  mainTag: { position: 'absolute', top: 4, left: 4, backgroundColor: colors.p500, borderRadius: radius.badge, paddingHorizontal: 5, paddingVertical: 2 },
  mainTagText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 7, letterSpacing: 0.6 },
  reorderRow: { position: 'absolute', bottom: 4, left: 4, right: 4, flexDirection: 'row', justifyContent: 'space-between' },
  reorderBtn: { backgroundColor: 'rgba(15,23,42,0.55)', borderRadius: radius.pill, padding: 4 },
  hint: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 7 },
  footer: { flexDirection: 'row', gap: 9, paddingHorizontal: 14, paddingTop: 11, backgroundColor: 'rgba(255,255,255,0.95)', borderTopWidth: 1, borderTopColor: colors.border },
  cancelBtn: { height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, backgroundColor: colors.surface },
  cancelText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  submitBtn: { height: 48, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, ...shadow.violetGlow },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 },
});
