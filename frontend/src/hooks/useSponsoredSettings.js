import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Sponsored placement settings hook.
 *
 * Fetches platform settings once (module-level cache) and exposes a helper to
 * decide whether sponsored/boosted products may be shown on a given surface.
 *
 * Surfaces:
 *  - 'products'        -> Products / Search results page
 *  - 'product_detail'  -> Product detail page
 *  - 'cart_checkout'   -> Cart & Checkout pages
 *  - 'category_band'   -> "Featured in {Category}" band on Products page
 *  - 'shop_public'     -> Public shop page
 *
 * Defaults to ALL ON until settings load (so placements don't flash off).
 */

const SURFACE_KEY = {
  products: 'sponsored_placement_products',
  product_detail: 'sponsored_placement_product_detail',
  cart_checkout: 'sponsored_placement_cart_checkout',
  category_band: 'sponsored_placement_category_band',
  shop_public: 'sponsored_placement_shop_public',
};

const DEFAULT_SETTINGS = {
  sponsored_master_enabled: true,
  sponsored_placement_products: true,
  sponsored_placement_product_detail: true,
  sponsored_placement_cart_checkout: true,
  sponsored_placement_category_band: true,
  sponsored_placement_shop_public: true,
};

let _cache = null; // cached settings object
let _inflight = null; // cached in-flight promise

const fetchSettings = () => {
  if (_cache) return Promise.resolve(_cache);
  if (_inflight) return _inflight;
  _inflight = api.admin
    .getPlatformSettings()
    .then(({ data }) => {
      _cache = { ...DEFAULT_SETTINGS, ...(data || {}) };
      return _cache;
    })
    .catch(() => {
      _cache = { ...DEFAULT_SETTINGS };
      return _cache;
    })
    .finally(() => {
      _inflight = null;
    });
  return _inflight;
};

export const isSponsoredEnabled = (settings, surface) => {
  if (!settings) return true; // optimistic default
  if (settings.sponsored_master_enabled === false) return false;
  const key = SURFACE_KEY[surface];
  if (!key) return settings.sponsored_master_enabled !== false;
  return settings[key] !== false;
};

export const useSponsoredSettings = () => {
  const [settings, setSettings] = useState(_cache);
  const [loaded, setLoaded] = useState(!!_cache);

  useEffect(() => {
    let mounted = true;
    fetchSettings().then((s) => {
      if (mounted) {
        setSettings(s);
        setLoaded(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return {
    settings,
    loaded,
    sponsoredEnabledFor: (surface) => isSponsoredEnabled(settings, surface),
  };
};

export default useSponsoredSettings;
