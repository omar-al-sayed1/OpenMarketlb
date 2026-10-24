-- ============================================================================
-- OpenMarket Lebanon — FULL RELATIONAL SQL SCHEMA (CREATE TABLE)
-- Every table, every column, primary keys & foreign keys for the whole website.
--
-- Dialect: MySQL 8 / MariaDB.  (PostgreSQL: replace TINYINT(1)->BOOLEAN,
--          AUTO_INCREMENT->GENERATED ... AS IDENTITY, `backticks`->"quotes",
--          JSON stays JSON/JSONB, DATETIME->TIMESTAMP.)
--
-- Tables: 62 base tables + 2 junction (M:N) tables.
-- Notes:
--   * The live app runs on MongoDB; this is the equivalent relational model.
--   * `id` (UUID/string) is the natural primary key used across the app.
--   * Array-of-id fields (e.g. category_ids) are normalized into junction tables.
--   * Other arrays/objects are stored as JSON columns.
--   * Money fields -> DECIMAL(14,2); date/*_at fields -> DATETIME.
--   * Foreign keys are added AFTER all tables exist (no ordering constraints).
--   * NEVER store plaintext passwords — the app stores bcrypt hashes in `password`.
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1) BASE TABLES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `about_page` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ad_unsubscribes` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_cashouts` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_events` (
  `id` VARCHAR(255) NOT NULL,
  `banner_accent_color` VARCHAR(255) NULL,
  `banner_order` BIGINT NULL,
  `banner_subtitle` TEXT NULL,
  `banner_text_color` VARCHAR(255) NULL,
  `created_at` DATETIME NULL,
  `cta_link` VARCHAR(255) NULL,
  `cta_text` TEXT NULL,
  `description` TEXT NULL,
  `display_mode` VARCHAR(255) NULL,
  `end_date` DATETIME NULL,
  `filter_category_id` VARCHAR(255) NULL,
  `filter_category_ids` JSON NULL,
  `filter_discount_only` TINYINT(1) NULL,
  `filter_gender` VARCHAR(255) NULL,
  `filter_max_price` DECIMAL(14,2) NULL,
  `filter_min_price` DECIMAL(14,2) NULL,
  `filter_search` VARCHAR(255) NULL,
  `filter_shop_id` VARCHAR(255) NULL,
  `image_url` TEXT NULL,
  `is_active` TINYINT(1) NULL,
  `popup_color` VARCHAR(255) NULL,
  `sponsoring_shops` JSON NULL,
  `sponsorship_enabled` TINYINT(1) NULL,
  `sponsorship_price` DECIMAL(14,2) NULL,
  `start_date` DATETIME NULL,
  `title` VARCHAR(255) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_ledger` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_revenue` (
  `id` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(14,2) NULL,
  `created_at` DATETIME NULL,
  `order_id` VARCHAR(255) NULL,
  `type` VARCHAR(255) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `agent_cashout_requests` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `agent_wallet_transactions` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `badge_reads` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `blocked_ips` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `browsing_history` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cancel_requests` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `carts` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cashout_requests` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `categories` (
  `id` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NULL,
  `is_active` TINYINT(1) NULL,
  `name` VARCHAR(255) NULL,
  `order` BIGINT NULL,
  `parent_id` VARCHAR(255) NULL,
  `slug` VARCHAR(255) NULL,
  `sort_order` BIGINT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `chat_sessions` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contact_messages` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `delivery_tracking` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `email_campaigns` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `email_clicks` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_sponsorships` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `google_pending_signups` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `guest_shop_applications` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `held_delivery_fees` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `login_challenges` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `loyalty_ledger` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `messages` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `messaging_blocks` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NULL,
  `is_read` TINYINT(1) NULL,
  `link` VARCHAR(255) NULL,
  `message` TEXT NULL,
  `recipient_id` VARCHAR(255) NULL,
  `recipient_type` VARCHAR(255) NULL,
  `title` VARCHAR(255) NULL,
  `type` VARCHAR(255) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `oauth_states` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `orders` (
  `id` VARCHAR(255) NOT NULL,
  `commission_amount` DECIMAL(14,2) NULL,
  `commission_rate` DECIMAL(14,2) NULL,
  `commission_type` VARCHAR(255) NULL,
  `created_at` DATETIME NULL,
  `customer_address` TEXT NULL,
  `customer_city` VARCHAR(255) NULL,
  `customer_email` VARCHAR(255) NULL,
  `customer_name` VARCHAR(255) NULL,
  `customer_phone` VARCHAR(255) NULL,
  `customer_state` VARCHAR(255) NULL,
  `delivery_fee` DECIMAL(14,2) NULL,
  `items` JSON NULL,
  `order_status` VARCHAR(255) NULL,
  `original_subtotal` DECIMAL(14,2) NULL,
  `payment_method` VARCHAR(255) NULL,
  `payment_status` VARCHAR(255) NULL,
  `revenue_distributed` TINYINT(1) NULL,
  `revenue_distributed_at` DATETIME NULL,
  `shop_id` VARCHAR(255) NULL,
  `subtotal` DECIMAL(14,2) NULL,
  `total_amount` DECIMAL(14,2) NULL,
  `user_id` VARCHAR(255) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `otp_codes` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_transactions` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pending_shop_payments` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pending_signups` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `platform_settings` (
  `id` VARCHAR(255) NOT NULL,
  `card_subscription_enabled` TINYINT(1) NULL,
  `commission_enabled` TINYINT(1) NULL,
  `commission_percentage` DECIMAL(14,2) NULL,
  `loyalty_enabled` TINYINT(1) NULL,
  `promotion_enabled` TINYINT(1) NULL,
  `subscription_price` DECIMAL(14,2) NULL,
  `tiers` JSON NULL,
  `wallet_monthly_credit_last_run` VARCHAR(255) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `product_gifts` (
  `id` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NULL,
  `gift_image` TEXT NULL,
  `gift_name` VARCHAR(255) NULL,
  `gift_product_id` VARCHAR(255) NULL,
  `gift_type` VARCHAR(255) NULL,
  `is_active` TINYINT(1) NULL,
  `product_id` VARCHAR(255) NULL,
  `shop_id` VARCHAR(255) NULL,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `products` (
  `id` VARCHAR(255) NOT NULL,
  `average_rating` DOUBLE NULL,
  `category_id` VARCHAR(255) NULL,
  `colors` JSON NULL,
  `created_at` DATETIME NULL,
  `description` TEXT NULL,
  `discount_price` DECIMAL(14,2) NULL,
  `gender` VARCHAR(255) NULL,
  `has_color_variants` TINYINT(1) NULL,
  `has_shape_variants` TINYINT(1) NULL,
  `has_size_variants` TINYINT(1) NULL,
  `images` JSON NULL,
  `is_active` TINYINT(1) NULL,
  `is_promoted` TINYINT(1) NULL,
  `name` VARCHAR(255) NULL,
  `price` DECIMAL(14,2) NULL,
  `promotion_end` VARCHAR(255) NULL,
  `review_count` BIGINT NULL,
  `shapes` JSON NULL,
  `shop_id` VARCHAR(255) NULL,
  `shop_name` VARCHAR(255) NULL,
  `sizes` JSON NULL,
  `sold_count` BIGINT NULL,
  `stock` BIGINT NULL,
  `type` VARCHAR(255) NULL,
  `variant_selection_mode` VARCHAR(255) NULL,
  `view_count` BIGINT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `promotions` (
  `id` VARCHAR(255) NOT NULL,
  `clicks` BIGINT NULL,
  `created_at` DATETIME NULL,
  `daily_price` DECIMAL(14,2) NULL,
  `duration_days` BIGINT NULL,
  `end_date` DATETIME NULL,
  `is_free` TINYINT(1) NULL,
  `orders` BIGINT NULL,
  `payment_method` VARCHAR(255) NULL,
  `product_id` VARCHAR(255) NULL,
  `product_name` VARCHAR(255) NULL,
  `shop_id` VARCHAR(255) NULL,
  `shop_name` VARCHAR(255) NULL,
  `start_date` DATETIME NULL,
  `status` VARCHAR(255) NULL,
  `total_cost` DECIMAL(14,2) NULL,
  `total_days` DECIMAL(14,2) NULL,
  `views` BIGINT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `referrals` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `revenue_adjustments` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reviews` (
  `id` VARCHAR(255) NOT NULL,
  `comment` TEXT NULL,
  `created_at` DATETIME NULL,
  `helpful_count` BIGINT NULL,
  `product_id` VARCHAR(255) NULL,
  `rating` BIGINT NULL,
  `user_id` VARCHAR(255) NULL,
  `user_name` VARCHAR(255) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `saved_locations` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shop_commission_promos` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shop_sales` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shop_spin_state` (
  `row_id` BIGINT NOT NULL AUTO_INCREMENT,
  `free_spins_balance` DECIMAL(14,2) NULL,
  `last_monthly_grant_at` DATETIME NULL,
  `shop_id` VARCHAR(255) NULL,
  PRIMARY KEY (`row_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shop_verifications` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shops` (
  `id` VARCHAR(255) NOT NULL,
  `address` TEXT NULL,
  `city` VARCHAR(255) NULL,
  `commission_type` VARCHAR(255) NULL,
  `cover_image` TEXT NULL,
  `created_at` DATETIME NULL,
  `description` TEXT NULL,
  `email` VARCHAR(255) NULL,
  `free_sponsor_credits` DECIMAL(14,2) NULL,
  `is_active` TINYINT(1) NULL,
  `latitude` DOUBLE NULL,
  `location_address` TEXT NULL,
  `logo` TEXT NULL,
  `longitude` DOUBLE NULL,
  `name` VARCHAR(255) NULL,
  `payment_method` VARCHAR(255) NULL,
  `phone` VARCHAR(255) NULL,
  `referral_code` VARCHAR(255) NULL,
  `referred_by_agent_id` VARCHAR(255) NULL,
  `referred_by_agent_name` VARCHAR(255) NULL,
  `state` VARCHAR(255) NULL,
  `status` VARCHAR(255) NULL,
  `submitted_via` VARCHAR(255) NULL,
  `subscription_end` DATETIME NULL,
  `subscription_required` TINYINT(1) NULL,
  `subscription_start` DATETIME NULL,
  `subscription_status` VARCHAR(255) NULL,
  `tier` VARCHAR(255) NULL,
  `total_revenue` DECIMAL(14,2) NULL,
  `user_id` VARCHAR(255) NULL,
  `wallet_balance` DECIMAL(14,2) NULL,
  `welcome_bonus_granted` TINYINT(1) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `site_settings` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `spin_history` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `spin_settings` (
  `id` VARCHAR(255) NOT NULL,
  `enabled` TINYINT(1) NULL,
  `outcomes` JSON NULL,
  `spin_cost_usd` DECIMAL(14,2) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `states` (
  `id` VARCHAR(255) NOT NULL,
  `delivery_fee` DECIMAL(14,2) NULL,
  `is_active` TINYINT(1) NULL,
  `name` VARCHAR(255) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `storefront_themes` (
  `row_id` BIGINT NOT NULL AUTO_INCREMENT,
  `best_for` VARCHAR(255) NULL,
  `created_at` DATETIME NULL,
  `description` TEXT NULL,
  `enabled` TINYINT(1) NULL,
  `is_default` TINYINT(1) NULL,
  `key` VARCHAR(255) NULL,
  `name` VARCHAR(255) NULL,
  `preview_color` VARCHAR(255) NULL,
  `price_usd` DECIMAL(14,2) NULL,
  `pro_only` TINYINT(1) NULL,
  PRIMARY KEY (`row_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `subscription_payments` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `subscription_transactions` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `team_members` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `testimonials` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tier_upgrade_requests` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tos` (
  `id` VARCHAR(255) NOT NULL,
  `content` TEXT NULL,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(255) NOT NULL,
  `address` TEXT NULL,
  `approval_bonus_amount` DECIMAL(14,2) NULL,
  `city` VARCHAR(255) NULL,
  `commission_share_percent` DECIMAL(14,2) NULL,
  `created_at` DATETIME NULL,
  `email` VARCHAR(255) NULL,
  `first_name` VARCHAR(255) NULL,
  `last_name` VARCHAR(255) NULL,
  `last_seen` DATETIME NULL,
  `name` VARCHAR(255) NULL,
  `password` VARCHAR(255) NULL,
  `phone` VARCHAR(255) NULL,
  `referral_code` VARCHAR(255) NULL,
  `role` VARCHAR(255) NULL,
  `shop_id` VARCHAR(255) NULL,
  `state` VARCHAR(255) NULL,
  `wallet_balance` DECIMAL(14,2) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wallet_transactions` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wishlists` (
  `id` VARCHAR(255) NOT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2) JUNCTION TABLES (many-to-many relationships)
-- ----------------------------------------------------------------------------

-- many-to-many: orders.shop_ids -> shops
CREATE TABLE IF NOT EXISTS `orders__shop_ids` (
  `order_id` VARCHAR(255) NOT NULL,
  `shop_id` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`order_id`, `shop_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- many-to-many: products.category_ids -> categories
CREATE TABLE IF NOT EXISTS `products__category_ids` (
  `product_id` VARCHAR(255) NOT NULL,
  `category_id` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`product_id`, `category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3) FOREIGN KEY CONSTRAINTS
-- ----------------------------------------------------------------------------

ALTER TABLE `admin_revenue` ADD CONSTRAINT `fk_admin_revenue_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `categories` ADD CONSTRAINT `fk_categories_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `notifications` ADD CONSTRAINT `fk_notifications_recipient_id` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_shop_id` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `product_gifts` ADD CONSTRAINT `fk_product_gifts_shop_id` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `product_gifts` ADD CONSTRAINT `fk_product_gifts_product_id` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `products` ADD CONSTRAINT `fk_products_shop_id` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `products` ADD CONSTRAINT `fk_products_category_id` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `promotions` ADD CONSTRAINT `fk_promotions_shop_id` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `promotions` ADD CONSTRAINT `fk_promotions_product_id` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `reviews` ADD CONSTRAINT `fk_reviews_product_id` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `reviews` ADD CONSTRAINT `fk_reviews_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `shop_spin_state` ADD CONSTRAINT `fk_shop_spin_state_shop_id` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `shops` ADD CONSTRAINT `fk_shops_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `shops` ADD CONSTRAINT `fk_shops_referred_by_agent_id` FOREIGN KEY (`referred_by_agent_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `users` ADD CONSTRAINT `fk_users_shop_id` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `orders__shop_ids` ADD CONSTRAINT `fk_orders__shop_ids_parent` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `orders__shop_ids` ADD CONSTRAINT `fk_orders__shop_ids_child` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `products__category_ids` ADD CONSTRAINT `fk_products__category_ids_parent` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `products__category_ids` ADD CONSTRAINT `fk_products__category_ids_child` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
