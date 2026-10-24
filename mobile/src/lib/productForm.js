/**
 * Shared product-form logic — the single source of truth for the create/edit
 * product form used by BOTH the shop dashboard (ShopProductsScreen) and the admin
 * shop detail (AdminProductForm). Extracted verbatim from ShopProductsScreen so the
 * two stay identical: same EMPTY_FORM, same payload shape, same product→form mapping.
 */

export const EMPTY_FORM = {
  name: '', description: '', category_ids: [], gender: 'none', price: '', discount_price: '', stock: '', images: [''],
  colors: [], sizes: [], shapes: [], types: [], is_active: true,
  has_color_variants: false, has_size_variants: false, has_shape_variants: false, has_type_variants: false,
  use_same_price_colors: false, use_same_price_sizes: false, use_same_price_shapes: false, use_same_price_types: false,
  color_shared_price: '', color_shared_discount: '', size_shared_price: '', size_shared_discount: '',
  shape_shared_price: '', shape_shared_discount: '', type_shared_price: '', type_shared_discount: '',
  use_same_photo_sizes: false, size_variant_image: '',
  use_same_photo_types: false, type_variant_image: '',
  variant_selection_mode: 'single',
};

/**
 * Build the API payload from form state. Pure — no side effects. The optional
 * `extra` is merged in last (admin passes { shop_id } here to target a shop).
 */
export function buildProductPayload(formData, extra = {}) {
  const hasAnyVariants = formData.has_color_variants || formData.has_size_variants || formData.has_shape_variants || formData.has_type_variants;
  const validColors = formData.colors.filter((c) => c.color_name && c.image_url);
  const validSizes = formData.sizes.filter((s) => s.size_name);
  const validShapes = formData.shapes.filter((s) => s.shape_name && s.image_url);
  const validTypes = formData.types.filter((t) => t.type_name);

  let totalStock = 0;
  if (hasAnyVariants) {
    totalStock += validColors.reduce((sum, c) => sum + (parseInt(c.stock, 10) || 0), 0);
    totalStock += validSizes.reduce((sum, s) => sum + (parseInt(s.stock, 10) || 0), 0);
    totalStock += validShapes.reduce((sum, s) => sum + (parseInt(s.stock, 10) || 0), 0);
    totalStock += validTypes.reduce((sum, t) => sum + (parseInt(t.stock, 10) || 0), 0);
  } else {
    totalStock = parseInt(formData.stock, 10);
  }

  let processedColors = validColors, processedSizes = validSizes, processedShapes = validShapes, processedTypes = validTypes;
  if (formData.use_same_price_colors && formData.has_color_variants) {
    const bp = parseFloat(formData.color_shared_price) || 0;
    const bd = formData.color_shared_discount ? parseFloat(formData.color_shared_discount) : null;
    processedColors = validColors.map((c) => ({ ...c, price: bp, discount_price: bd }));
  }
  if (formData.use_same_price_sizes && formData.has_size_variants) {
    const bp = parseFloat(formData.size_shared_price) || 0;
    const bd = formData.size_shared_discount ? parseFloat(formData.size_shared_discount) : null;
    processedSizes = validSizes.map((s) => ({ ...s, price: bp, discount_price: bd }));
  }
  if (formData.use_same_price_shapes && formData.has_shape_variants) {
    const bp = parseFloat(formData.shape_shared_price) || 0;
    const bd = formData.shape_shared_discount ? parseFloat(formData.shape_shared_discount) : null;
    processedShapes = validShapes.map((s) => ({ ...s, price: bp, discount_price: bd }));
  }
  if (formData.use_same_price_types && formData.has_type_variants) {
    const bp = parseFloat(formData.type_shared_price) || 0;
    const bd = formData.type_shared_discount ? parseFloat(formData.type_shared_discount) : null;
    processedTypes = validTypes.map((t) => ({ ...t, price: bp, discount_price: bd }));
  }

  const basePrice = hasAnyVariants
    ? (processedColors[0]?.price || processedSizes[0]?.price || processedShapes[0]?.price || processedTypes[0]?.price || parseFloat(formData.price) || 0)
    : parseFloat(formData.price);
  const baseDiscount = hasAnyVariants
    ? (processedColors[0]?.discount_price || processedSizes[0]?.discount_price || processedShapes[0]?.discount_price || processedTypes[0]?.discount_price || (formData.discount_price ? parseFloat(formData.discount_price) : undefined))
    : (formData.discount_price ? parseFloat(formData.discount_price) : undefined);

  let imgs = formData.images.filter((url) => url && url.trim() !== '');
  if (formData.has_color_variants && processedColors.length > 0 && processedColors[0].image_url) {
    const firstImg = processedColors[0].image_url;
    imgs = [firstImg, ...imgs.filter((u) => u !== firstImg)];
  }

  return {
    name: formData.name,
    description: formData.description,
    category_ids: formData.category_ids,
    category_id: formData.category_ids[0] || null,
    type: formData.gender || 'none',
    price: basePrice,
    discount_price: baseDiscount,
    stock: totalStock,
    images: imgs,
    colors: formData.has_color_variants ? processedColors : [],
    sizes: formData.has_size_variants ? processedSizes : [],
    shapes: formData.has_shape_variants ? processedShapes : [],
    types: formData.has_type_variants ? processedTypes : [],
    has_color_variants: formData.has_color_variants,
    has_size_variants: formData.has_size_variants,
    has_shape_variants: formData.has_shape_variants,
    has_type_variants: formData.has_type_variants,
    use_same_price: formData.use_same_price_colors || formData.use_same_price_sizes || formData.use_same_price_shapes || formData.use_same_price_types,
    use_same_photo_sizes: formData.use_same_photo_sizes,
    size_variant_image: formData.size_variant_image || null,
    use_same_photo_types: formData.use_same_photo_types,
    type_variant_image: formData.type_variant_image || null,
    variant_selection_mode: formData.variant_selection_mode || 'single',
    is_active: formData.is_active,
    ...extra,
  };
}

/** Populate form state from an existing product (for editing). Pure. */
export function productToForm(product) {
  const originalPrice = product.original_price || product.price;
  const originalDiscount = product.original_discount_price || product.discount_price;
  return {
    ...EMPTY_FORM,
    name: product.name,
    description: product.description,
    category_ids: product.category_ids || (product.category_id ? [product.category_id] : []),
    gender: product.gender || product.type || 'none',
    price: originalPrice.toString(),
    discount_price: originalDiscount ? originalDiscount.toString() : '',
    stock: (product.has_color_variants || product.has_size_variants || product.has_shape_variants || product.has_type_variants || (product.colors?.length > 0)) ? '' : product.stock.toString(),
    images: product.images.length > 0 ? product.images : [''],
    colors: product.colors || [],
    sizes: product.sizes || [],
    shapes: product.shapes || [],
    types: product.types || [],
    is_active: product.is_active,
    has_color_variants: product.has_color_variants || (product.colors?.length > 0),
    has_size_variants: product.has_size_variants || false,
    has_shape_variants: product.has_shape_variants || false,
    has_type_variants: product.has_type_variants || (product.types?.length > 0) || false,
    use_same_price_colors: product.use_same_price || false,
    use_same_price_sizes: product.use_same_price || false,
    use_same_price_shapes: product.use_same_price || false,
    use_same_price_types: product.use_same_price || false,
    use_same_photo_sizes: product.use_same_photo_sizes || false,
    size_variant_image: product.size_variant_image || '',
    use_same_photo_types: product.use_same_photo_types || false,
    type_variant_image: product.type_variant_image || '',
    variant_selection_mode: product.variant_selection_mode || 'single',
  };
}
