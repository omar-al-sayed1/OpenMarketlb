import React from 'react';
import SponsoredRow from './SponsoredRow';
import RecommendedWithSponsoredSection from './RecommendedWithSponsoredSection';

/**
 * Reusable end-of-page promotional block used across content pages
 * (Become a Seller, Contact, All Shops, About, Wishlist, Map).
 *
 * It renders TWO sections, matching the experiences requested:
 *   1. "Sponsored add-ons" — identical to the Cart page: a compact, curated
 *      subset of sponsored products (NOT every sponsored product), cheapest-first.
 *   2. "Recommended Products" — identical to the Products/Search page: a grid of
 *      recommended products with "Sponsored picks" carousels interleaved between
 *      blocks of products.
 *
 * Both are laptop-only (>= 1280px), full page width.
 */
const EndOfPagePromos = ({
  excludeProductIds = [],
  excludeShopId = null,
  recommendedTitle = 'Recommended Products',
  recommendedSubtitle = 'Handpicked picks just for you',
}) => {
  const exclude = (excludeProductIds || []).filter(Boolean);

  return (
    <>
      {/* 1) "Sponsored add-ons" — full page width, responsive grid, curated subset */}
      <div className="block w-full px-3 sm:px-6 lg:px-10 mt-8">
        <SponsoredRow
          surface="cart_checkout"
          title="Sponsored add-ons"
          subtitle="Popular extras you might want"
          variant="grid"
          gridColsClass="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
          limit={6}
          lowPriceFirst={true}
          excludeProductIds={exclude}
          excludeShopId={excludeShopId}
          data-testid="end-promos-sponsored-addons"
        />
      </div>

      {/* 2) "Recommended Products" with interleaved Sponsored carousels (Products page style) */}
      <RecommendedWithSponsoredSection
        title={recommendedTitle}
        subtitle={recommendedSubtitle}
        excludeProductIds={exclude}
        excludeShopId={excludeShopId}
      />
    </>
  );
};

export default EndOfPagePromos;
