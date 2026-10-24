import { useState, useEffect } from 'react';

/**
 * Responsive device-tier hook used to drive the sponsored "Sponsored picks"
 * placement rules on the Products page.
 *
 * Breakpoints (aligned with the products grid columns):
 *   - phone : width < 640px   (2-col grid)
 *   - tablet: 640px – 1279px  (3–4 col grid)
 *   - laptop: width >= 1280px (5-col grid)
 *
 * For each tier we expose:
 *   - blockSize          : how many organic products between sponsored carousels
 *   - cardsPerCarousel   : how many sponsored cards each carousel shows
 *   - threshold          : minimum loaded products required before any carousel
 */
const computeTier = (width) => {
  if (width < 640) {
    return { tier: 'phone', blockSize: 8, cardsPerCarousel: 4, threshold: 8 };
  }
  if (width < 1280) {
    return { tier: 'tablet', blockSize: 9, cardsPerCarousel: 5, threshold: 9 };
  }
  return { tier: 'laptop', blockSize: 10, cardsPerCarousel: 6, threshold: 10 };
};

export const useDeviceTier = () => {
  const getWidth = () => (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const [state, setState] = useState(() => ({ width: getWidth(), ...computeTier(getWidth()) }));

  useEffect(() => {
    let frame = null;
    const handleResize = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const w = getWidth();
        setState((prev) => {
          const next = computeTier(w);
          // Only update when the tier actually changes to avoid re-renders.
          if (prev.tier === next.tier) return { ...prev, width: w };
          return { width: w, ...next };
        });
      });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return state;
};

export default useDeviceTier;
