import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { toast } from '../../components/shop/ShopKit';
import ProductFormSheet from '../../components/shop/ProductFormSheet';
import { EMPTY_FORM, buildProductPayload, productToForm } from '../../lib/productForm';

/**
 * Admin create/edit product — the SAME ProductFormSheet UI the shop dashboard uses,
 * but wired to the admin endpoints (require_admin) and targeted at a specific shop
 * via shop_id. `editingProduct` null → create; set → edit.
 */
export default function AdminProductForm({ shop, editingProduct, platformSettings, open, onClose, onSaved }) {
  const [categoryTree, setCategoryTree] = useState([]);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  // ProductFormSheet's category picker needs the TREE (admin screens carry a flat list).
  useEffect(() => {
    let alive = true;
    api.categories.getTree(true).then(({ data }) => { if (alive) setCategoryTree(data || []); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Reset the form each time the sheet opens (prefill when editing).
  useEffect(() => {
    if (open) setFormData(editingProduct ? productToForm(editingProduct) : { ...EMPTY_FORM, images: [''] });
  }, [open, editingProduct]);

  const commissionRate = shop?.commission_percentage ?? platformSettings?.commission_percentage ?? 10;
  const commissionType = shop?.commission_type ?? platformSettings?.commission_type ?? 'on_customer';

  const variantToggles = useMemo(() => ({
    variant_color_enabled: platformSettings?.variant_color_enabled !== false,
    variant_size_enabled: platformSettings?.variant_size_enabled !== false,
    variant_shape_enabled: platformSettings?.variant_shape_enabled !== false,
    variant_type_enabled: platformSettings?.variant_type_enabled !== false,
  }), [platformSettings]);

  const calculateCustomerPrice = (price) => {
    if (!price || isNaN(price)) return 0;
    const p = parseFloat(price);
    const rate = commissionRate / 100;
    if (commissionType === 'on_shop') return p.toFixed(2);
    if (commissionType === 'half_half') return (p * (1 + rate / 2)).toFixed(2);
    return (p * (1 + rate)).toFixed(2);
  };
  const calculateShopRevenue = (price) => {
    if (!price || isNaN(price)) return 0;
    const p = parseFloat(price);
    const rate = commissionRate / 100;
    if (commissionType === 'on_customer') return p.toFixed(2);
    if (commissionType === 'half_half') return (p * (1 - rate / 2)).toFixed(2);
    return (p * (1 - rate)).toFixed(2);
  };
  const getCommissionTypeLabel = () => (commissionType === 'on_shop' ? 'On Shop' : commissionType === 'half_half' ? 'Half/Half' : 'On Customer');

  const onSubmit = async () => {
    try {
      const payload = buildProductPayload(formData, { shop_id: shop.id });
      if (editingProduct) {
        await api.admin.updateProduct(editingProduct.id, payload);
        toast.success('Product updated');
      } else {
        await api.admin.createProduct(payload);
        toast.success('Product created');
      }
      onSaved?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to save product');
    }
  };

  return (
    <ProductFormSheet
      open={open}
      editingProduct={editingProduct}
      formData={formData}
      setFormData={setFormData}
      categories={categoryTree}
      variantToggles={variantToggles}
      commissionRate={commissionRate}
      commissionType={commissionType}
      calculateCustomerPrice={calculateCustomerPrice}
      calculateShopRevenue={calculateShopRevenue}
      getCommissionTypeLabel={getCommissionTypeLabel}
      onSubmit={onSubmit}
      onCancel={onClose}
    />
  );
}
