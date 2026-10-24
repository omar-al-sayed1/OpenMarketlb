/* ============================================================================
 * OpenMarket Lebanon — MongoDB setup script
 * Creates ALL website collections ("tables") with JSON-Schema validators
 * (documenting fields & types) and recommended indexes.
 *
 * Generated from the live data model. Total collections: 62
 *
 * HOW TO RUN:
 *   mongosh "<your-connection-string>/<your-db-name>" openmarket_mongodb_setup.js
 *   -- or inside mongosh:  load("openmarket_mongodb_setup.js")
 *
 * NOTES:
 *   - Idempotent: safe to run multiple times (creates if missing, else updates validator).
 *   - validationAction is "warn" so the app keeps working even if a document
 *     does not perfectly match the schema. Change to "error" to enforce strictly.
 *   - "additionalProperties: true" lets the application add new fields freely.
 *   - Sensitive fields (e.g. password) are part of the schema but you should
 *     never store plaintext — the app stores bcrypt hashes.
 * ========================================================================== */

print("OpenMarket DB setup starting on db: " + db.getName());
const existing = db.getCollectionNames();

/* ----------------------------------------------------------------------------
 * 1) COLLECTIONS + VALIDATORS
 * -------------------------------------------------------------------------- */
// ---- about_page ----
if (!existing.includes("about_page")) {
  db.createCollection("about_page", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created about_page");
} else {
  db.runCommand({
    collMod: "about_page",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for about_page");
}

// ---- ad_unsubscribes ----
if (!existing.includes("ad_unsubscribes")) {
  db.createCollection("ad_unsubscribes", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created ad_unsubscribes");
} else {
  db.runCommand({
    collMod: "ad_unsubscribes",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for ad_unsubscribes");
}

// ---- admin_cashouts ----
if (!existing.includes("admin_cashouts")) {
  db.createCollection("admin_cashouts", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created admin_cashouts");
} else {
  db.runCommand({
    collMod: "admin_cashouts",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for admin_cashouts");
}

// ---- admin_events ----
if (!existing.includes("admin_events")) {
  db.createCollection("admin_events", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "banner_accent_color": {
          "bsonType": "string"
        },
        "banner_order": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "banner_subtitle": {
          "bsonType": "string"
        },
        "banner_text_color": {
          "bsonType": "string"
        },
        "created_at": {
          "bsonType": "string"
        },
        "cta_link": {
          "bsonType": "string"
        },
        "cta_text": {
          "bsonType": "string"
        },
        "description": {
          "bsonType": "string"
        },
        "display_mode": {
          "bsonType": "string"
        },
        "end_date": {
          "bsonType": "string"
        },
        "filter_category_id": {
          "bsonType": "string"
        },
        "filter_category_ids": {
          "bsonType": "array"
        },
        "filter_discount_only": {
          "bsonType": "bool"
        },
        "filter_gender": {
          "bsonType": "string"
        },
        "filter_max_price": {
          "bsonType": "null"
        },
        "filter_min_price": {
          "bsonType": "null"
        },
        "filter_search": {
          "bsonType": "string"
        },
        "filter_shop_id": {
          "bsonType": "string"
        },
        "id": {
          "bsonType": "string"
        },
        "image_url": {
          "bsonType": "string"
        },
        "is_active": {
          "bsonType": "bool"
        },
        "popup_color": {
          "bsonType": "string"
        },
        "sponsoring_shops": {
          "bsonType": "array"
        },
        "sponsorship_enabled": {
          "bsonType": "bool"
        },
        "sponsorship_price": {
          "bsonType": "double"
        },
        "start_date": {
          "bsonType": "string"
        },
        "title": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created admin_events");
} else {
  db.runCommand({
    collMod: "admin_events",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "banner_accent_color": {
          "bsonType": "string"
        },
        "banner_order": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "banner_subtitle": {
          "bsonType": "string"
        },
        "banner_text_color": {
          "bsonType": "string"
        },
        "created_at": {
          "bsonType": "string"
        },
        "cta_link": {
          "bsonType": "string"
        },
        "cta_text": {
          "bsonType": "string"
        },
        "description": {
          "bsonType": "string"
        },
        "display_mode": {
          "bsonType": "string"
        },
        "end_date": {
          "bsonType": "string"
        },
        "filter_category_id": {
          "bsonType": "string"
        },
        "filter_category_ids": {
          "bsonType": "array"
        },
        "filter_discount_only": {
          "bsonType": "bool"
        },
        "filter_gender": {
          "bsonType": "string"
        },
        "filter_max_price": {
          "bsonType": "null"
        },
        "filter_min_price": {
          "bsonType": "null"
        },
        "filter_search": {
          "bsonType": "string"
        },
        "filter_shop_id": {
          "bsonType": "string"
        },
        "id": {
          "bsonType": "string"
        },
        "image_url": {
          "bsonType": "string"
        },
        "is_active": {
          "bsonType": "bool"
        },
        "popup_color": {
          "bsonType": "string"
        },
        "sponsoring_shops": {
          "bsonType": "array"
        },
        "sponsorship_enabled": {
          "bsonType": "bool"
        },
        "sponsorship_price": {
          "bsonType": "double"
        },
        "start_date": {
          "bsonType": "string"
        },
        "title": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for admin_events");
}

// ---- admin_ledger ----
if (!existing.includes("admin_ledger")) {
  db.createCollection("admin_ledger", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created admin_ledger");
} else {
  db.runCommand({
    collMod: "admin_ledger",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for admin_ledger");
}

// ---- admin_revenue ----
if (!existing.includes("admin_revenue")) {
  db.createCollection("admin_revenue", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "amount": {
          "bsonType": "double"
        },
        "created_at": {
          "bsonType": "string"
        },
        "id": {
          "bsonType": "string"
        },
        "order_id": {
          "bsonType": "string"
        },
        "type": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created admin_revenue");
} else {
  db.runCommand({
    collMod: "admin_revenue",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "amount": {
          "bsonType": "double"
        },
        "created_at": {
          "bsonType": "string"
        },
        "id": {
          "bsonType": "string"
        },
        "order_id": {
          "bsonType": "string"
        },
        "type": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for admin_revenue");
}

// ---- agent_cashout_requests ----
if (!existing.includes("agent_cashout_requests")) {
  db.createCollection("agent_cashout_requests", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created agent_cashout_requests");
} else {
  db.runCommand({
    collMod: "agent_cashout_requests",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for agent_cashout_requests");
}

// ---- agent_wallet_transactions ----
if (!existing.includes("agent_wallet_transactions")) {
  db.createCollection("agent_wallet_transactions", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created agent_wallet_transactions");
} else {
  db.runCommand({
    collMod: "agent_wallet_transactions",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for agent_wallet_transactions");
}

// ---- badge_reads ----
if (!existing.includes("badge_reads")) {
  db.createCollection("badge_reads", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created badge_reads");
} else {
  db.runCommand({
    collMod: "badge_reads",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for badge_reads");
}

// ---- blocked_ips ----
if (!existing.includes("blocked_ips")) {
  db.createCollection("blocked_ips", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created blocked_ips");
} else {
  db.runCommand({
    collMod: "blocked_ips",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for blocked_ips");
}

// ---- browsing_history ----
if (!existing.includes("browsing_history")) {
  db.createCollection("browsing_history", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created browsing_history");
} else {
  db.runCommand({
    collMod: "browsing_history",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for browsing_history");
}

// ---- cancel_requests ----
if (!existing.includes("cancel_requests")) {
  db.createCollection("cancel_requests", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created cancel_requests");
} else {
  db.runCommand({
    collMod: "cancel_requests",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for cancel_requests");
}

// ---- carts ----
if (!existing.includes("carts")) {
  db.createCollection("carts", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created carts");
} else {
  db.runCommand({
    collMod: "carts",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for carts");
}

// ---- cashout_requests ----
if (!existing.includes("cashout_requests")) {
  db.createCollection("cashout_requests", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created cashout_requests");
} else {
  db.runCommand({
    collMod: "cashout_requests",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for cashout_requests");
}

// ---- categories ----
if (!existing.includes("categories")) {
  db.createCollection("categories", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "created_at": {
          "bsonType": "string"
        },
        "id": {
          "bsonType": "string"
        },
        "is_active": {
          "bsonType": "bool"
        },
        "name": {
          "bsonType": "string"
        },
        "order": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "parent_id": {
          "bsonType": [
            "null",
            "string"
          ]
        },
        "slug": {
          "bsonType": "string"
        },
        "sort_order": {
          "bsonType": [
            "int",
            "long"
          ]
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created categories");
} else {
  db.runCommand({
    collMod: "categories",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "created_at": {
          "bsonType": "string"
        },
        "id": {
          "bsonType": "string"
        },
        "is_active": {
          "bsonType": "bool"
        },
        "name": {
          "bsonType": "string"
        },
        "order": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "parent_id": {
          "bsonType": [
            "null",
            "string"
          ]
        },
        "slug": {
          "bsonType": "string"
        },
        "sort_order": {
          "bsonType": [
            "int",
            "long"
          ]
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for categories");
}

// ---- chat_sessions ----
if (!existing.includes("chat_sessions")) {
  db.createCollection("chat_sessions", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created chat_sessions");
} else {
  db.runCommand({
    collMod: "chat_sessions",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for chat_sessions");
}

// ---- contact_messages ----
if (!existing.includes("contact_messages")) {
  db.createCollection("contact_messages", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created contact_messages");
} else {
  db.runCommand({
    collMod: "contact_messages",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for contact_messages");
}

// ---- delivery_tracking ----
if (!existing.includes("delivery_tracking")) {
  db.createCollection("delivery_tracking", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created delivery_tracking");
} else {
  db.runCommand({
    collMod: "delivery_tracking",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for delivery_tracking");
}

// ---- email_campaigns ----
if (!existing.includes("email_campaigns")) {
  db.createCollection("email_campaigns", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created email_campaigns");
} else {
  db.runCommand({
    collMod: "email_campaigns",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for email_campaigns");
}

// ---- email_clicks ----
if (!existing.includes("email_clicks")) {
  db.createCollection("email_clicks", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created email_clicks");
} else {
  db.runCommand({
    collMod: "email_clicks",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for email_clicks");
}

// ---- event_sponsorships ----
if (!existing.includes("event_sponsorships")) {
  db.createCollection("event_sponsorships", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created event_sponsorships");
} else {
  db.runCommand({
    collMod: "event_sponsorships",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for event_sponsorships");
}

// ---- google_pending_signups ----
if (!existing.includes("google_pending_signups")) {
  db.createCollection("google_pending_signups", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created google_pending_signups");
} else {
  db.runCommand({
    collMod: "google_pending_signups",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for google_pending_signups");
}

// ---- guest_shop_applications ----
if (!existing.includes("guest_shop_applications")) {
  db.createCollection("guest_shop_applications", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created guest_shop_applications");
} else {
  db.runCommand({
    collMod: "guest_shop_applications",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for guest_shop_applications");
}

// ---- held_delivery_fees ----
if (!existing.includes("held_delivery_fees")) {
  db.createCollection("held_delivery_fees", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created held_delivery_fees");
} else {
  db.runCommand({
    collMod: "held_delivery_fees",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for held_delivery_fees");
}

// ---- login_challenges ----
if (!existing.includes("login_challenges")) {
  db.createCollection("login_challenges", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created login_challenges");
} else {
  db.runCommand({
    collMod: "login_challenges",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for login_challenges");
}

// ---- loyalty_ledger ----
if (!existing.includes("loyalty_ledger")) {
  db.createCollection("loyalty_ledger", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created loyalty_ledger");
} else {
  db.runCommand({
    collMod: "loyalty_ledger",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for loyalty_ledger");
}

// ---- messages ----
if (!existing.includes("messages")) {
  db.createCollection("messages", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created messages");
} else {
  db.runCommand({
    collMod: "messages",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for messages");
}

// ---- messaging_blocks ----
if (!existing.includes("messaging_blocks")) {
  db.createCollection("messaging_blocks", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created messaging_blocks");
} else {
  db.runCommand({
    collMod: "messaging_blocks",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for messaging_blocks");
}

// ---- notifications ----
if (!existing.includes("notifications")) {
  db.createCollection("notifications", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "created_at": {
          "bsonType": "string"
        },
        "id": {
          "bsonType": "string"
        },
        "is_read": {
          "bsonType": "bool"
        },
        "link": {
          "bsonType": "string"
        },
        "message": {
          "bsonType": "string"
        },
        "recipient_id": {
          "bsonType": "null"
        },
        "recipient_type": {
          "bsonType": "string"
        },
        "title": {
          "bsonType": "string"
        },
        "type": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created notifications");
} else {
  db.runCommand({
    collMod: "notifications",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "created_at": {
          "bsonType": "string"
        },
        "id": {
          "bsonType": "string"
        },
        "is_read": {
          "bsonType": "bool"
        },
        "link": {
          "bsonType": "string"
        },
        "message": {
          "bsonType": "string"
        },
        "recipient_id": {
          "bsonType": "null"
        },
        "recipient_type": {
          "bsonType": "string"
        },
        "title": {
          "bsonType": "string"
        },
        "type": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for notifications");
}

// ---- oauth_states ----
if (!existing.includes("oauth_states")) {
  db.createCollection("oauth_states", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created oauth_states");
} else {
  db.runCommand({
    collMod: "oauth_states",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for oauth_states");
}

// ---- orders ----
if (!existing.includes("orders")) {
  db.createCollection("orders", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "commission_amount": {
          "bsonType": "double"
        },
        "commission_rate": {
          "bsonType": "double"
        },
        "commission_type": {
          "bsonType": "string"
        },
        "created_at": {
          "bsonType": "string"
        },
        "customer_address": {
          "bsonType": "string"
        },
        "customer_city": {
          "bsonType": "string"
        },
        "customer_email": {
          "bsonType": "string"
        },
        "customer_name": {
          "bsonType": "string"
        },
        "customer_phone": {
          "bsonType": "string"
        },
        "customer_state": {
          "bsonType": "string"
        },
        "delivery_fee": {
          "bsonType": "double"
        },
        "id": {
          "bsonType": "string"
        },
        "items": {
          "bsonType": "array"
        },
        "order_status": {
          "bsonType": "string"
        },
        "original_subtotal": {
          "bsonType": "double"
        },
        "payment_method": {
          "bsonType": "string"
        },
        "payment_status": {
          "bsonType": "string"
        },
        "revenue_distributed": {
          "bsonType": "bool"
        },
        "revenue_distributed_at": {
          "bsonType": [
            "null",
            "string"
          ]
        },
        "shop_id": {
          "bsonType": "string"
        },
        "shop_ids": {
          "bsonType": "array"
        },
        "subtotal": {
          "bsonType": "double"
        },
        "total_amount": {
          "bsonType": "double"
        },
        "user_id": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created orders");
} else {
  db.runCommand({
    collMod: "orders",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "commission_amount": {
          "bsonType": "double"
        },
        "commission_rate": {
          "bsonType": "double"
        },
        "commission_type": {
          "bsonType": "string"
        },
        "created_at": {
          "bsonType": "string"
        },
        "customer_address": {
          "bsonType": "string"
        },
        "customer_city": {
          "bsonType": "string"
        },
        "customer_email": {
          "bsonType": "string"
        },
        "customer_name": {
          "bsonType": "string"
        },
        "customer_phone": {
          "bsonType": "string"
        },
        "customer_state": {
          "bsonType": "string"
        },
        "delivery_fee": {
          "bsonType": "double"
        },
        "id": {
          "bsonType": "string"
        },
        "items": {
          "bsonType": "array"
        },
        "order_status": {
          "bsonType": "string"
        },
        "original_subtotal": {
          "bsonType": "double"
        },
        "payment_method": {
          "bsonType": "string"
        },
        "payment_status": {
          "bsonType": "string"
        },
        "revenue_distributed": {
          "bsonType": "bool"
        },
        "revenue_distributed_at": {
          "bsonType": [
            "null",
            "string"
          ]
        },
        "shop_id": {
          "bsonType": "string"
        },
        "shop_ids": {
          "bsonType": "array"
        },
        "subtotal": {
          "bsonType": "double"
        },
        "total_amount": {
          "bsonType": "double"
        },
        "user_id": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for orders");
}

// ---- otp_codes ----
if (!existing.includes("otp_codes")) {
  db.createCollection("otp_codes", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created otp_codes");
} else {
  db.runCommand({
    collMod: "otp_codes",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for otp_codes");
}

// ---- payment_transactions ----
if (!existing.includes("payment_transactions")) {
  db.createCollection("payment_transactions", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created payment_transactions");
} else {
  db.runCommand({
    collMod: "payment_transactions",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for payment_transactions");
}

// ---- pending_shop_payments ----
if (!existing.includes("pending_shop_payments")) {
  db.createCollection("pending_shop_payments", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created pending_shop_payments");
} else {
  db.runCommand({
    collMod: "pending_shop_payments",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for pending_shop_payments");
}

// ---- pending_signups ----
if (!existing.includes("pending_signups")) {
  db.createCollection("pending_signups", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created pending_signups");
} else {
  db.runCommand({
    collMod: "pending_signups",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for pending_signups");
}

// ---- platform_settings ----
if (!existing.includes("platform_settings")) {
  db.createCollection("platform_settings", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "card_subscription_enabled": {
          "bsonType": "bool"
        },
        "commission_enabled": {
          "bsonType": "bool"
        },
        "commission_percentage": {
          "bsonType": "double"
        },
        "id": {
          "bsonType": "string"
        },
        "loyalty_enabled": {
          "bsonType": "bool"
        },
        "promotion_enabled": {
          "bsonType": "bool"
        },
        "subscription_price": {
          "bsonType": "double"
        },
        "tiers": {
          "bsonType": "object"
        },
        "wallet_monthly_credit_last_run": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created platform_settings");
} else {
  db.runCommand({
    collMod: "platform_settings",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "card_subscription_enabled": {
          "bsonType": "bool"
        },
        "commission_enabled": {
          "bsonType": "bool"
        },
        "commission_percentage": {
          "bsonType": "double"
        },
        "id": {
          "bsonType": "string"
        },
        "loyalty_enabled": {
          "bsonType": "bool"
        },
        "promotion_enabled": {
          "bsonType": "bool"
        },
        "subscription_price": {
          "bsonType": "double"
        },
        "tiers": {
          "bsonType": "object"
        },
        "wallet_monthly_credit_last_run": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for platform_settings");
}

// ---- product_gifts ----
if (!existing.includes("product_gifts")) {
  db.createCollection("product_gifts", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "created_at": {
          "bsonType": "string"
        },
        "gift_image": {
          "bsonType": "string"
        },
        "gift_name": {
          "bsonType": "string"
        },
        "gift_product_id": {
          "bsonType": "null"
        },
        "gift_type": {
          "bsonType": "string"
        },
        "id": {
          "bsonType": "string"
        },
        "is_active": {
          "bsonType": "bool"
        },
        "product_id": {
          "bsonType": "string"
        },
        "shop_id": {
          "bsonType": "string"
        },
        "updated_at": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created product_gifts");
} else {
  db.runCommand({
    collMod: "product_gifts",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "created_at": {
          "bsonType": "string"
        },
        "gift_image": {
          "bsonType": "string"
        },
        "gift_name": {
          "bsonType": "string"
        },
        "gift_product_id": {
          "bsonType": "null"
        },
        "gift_type": {
          "bsonType": "string"
        },
        "id": {
          "bsonType": "string"
        },
        "is_active": {
          "bsonType": "bool"
        },
        "product_id": {
          "bsonType": "string"
        },
        "shop_id": {
          "bsonType": "string"
        },
        "updated_at": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for product_gifts");
}

// ---- products ----
if (!existing.includes("products")) {
  db.createCollection("products", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "average_rating": {
          "bsonType": "double"
        },
        "category_id": {
          "bsonType": "string"
        },
        "category_ids": {
          "bsonType": "array"
        },
        "colors": {
          "bsonType": "array"
        },
        "created_at": {
          "bsonType": "string"
        },
        "description": {
          "bsonType": "string"
        },
        "discount_price": {
          "bsonType": [
            "double",
            "null"
          ]
        },
        "gender": {
          "bsonType": "string"
        },
        "has_color_variants": {
          "bsonType": "bool"
        },
        "has_shape_variants": {
          "bsonType": "bool"
        },
        "has_size_variants": {
          "bsonType": "bool"
        },
        "id": {
          "bsonType": "string"
        },
        "images": {
          "bsonType": "array"
        },
        "is_active": {
          "bsonType": "bool"
        },
        "is_promoted": {
          "bsonType": "bool"
        },
        "name": {
          "bsonType": "string"
        },
        "price": {
          "bsonType": "double"
        },
        "promotion_end": {
          "bsonType": "string"
        },
        "review_count": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "shapes": {
          "bsonType": "array"
        },
        "shop_id": {
          "bsonType": "string"
        },
        "shop_name": {
          "bsonType": "string"
        },
        "sizes": {
          "bsonType": "array"
        },
        "sold_count": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "stock": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "type": {
          "bsonType": "string"
        },
        "variant_selection_mode": {
          "bsonType": "string"
        },
        "view_count": {
          "bsonType": [
            "int",
            "long"
          ]
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created products");
} else {
  db.runCommand({
    collMod: "products",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "average_rating": {
          "bsonType": "double"
        },
        "category_id": {
          "bsonType": "string"
        },
        "category_ids": {
          "bsonType": "array"
        },
        "colors": {
          "bsonType": "array"
        },
        "created_at": {
          "bsonType": "string"
        },
        "description": {
          "bsonType": "string"
        },
        "discount_price": {
          "bsonType": [
            "double",
            "null"
          ]
        },
        "gender": {
          "bsonType": "string"
        },
        "has_color_variants": {
          "bsonType": "bool"
        },
        "has_shape_variants": {
          "bsonType": "bool"
        },
        "has_size_variants": {
          "bsonType": "bool"
        },
        "id": {
          "bsonType": "string"
        },
        "images": {
          "bsonType": "array"
        },
        "is_active": {
          "bsonType": "bool"
        },
        "is_promoted": {
          "bsonType": "bool"
        },
        "name": {
          "bsonType": "string"
        },
        "price": {
          "bsonType": "double"
        },
        "promotion_end": {
          "bsonType": "string"
        },
        "review_count": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "shapes": {
          "bsonType": "array"
        },
        "shop_id": {
          "bsonType": "string"
        },
        "shop_name": {
          "bsonType": "string"
        },
        "sizes": {
          "bsonType": "array"
        },
        "sold_count": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "stock": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "type": {
          "bsonType": "string"
        },
        "variant_selection_mode": {
          "bsonType": "string"
        },
        "view_count": {
          "bsonType": [
            "int",
            "long"
          ]
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for products");
}

// ---- promotions ----
if (!existing.includes("promotions")) {
  db.createCollection("promotions", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "clicks": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "created_at": {
          "bsonType": "string"
        },
        "daily_price": {
          "bsonType": "double"
        },
        "duration_days": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "end_date": {
          "bsonType": "string"
        },
        "id": {
          "bsonType": "string"
        },
        "is_free": {
          "bsonType": "bool"
        },
        "orders": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "payment_method": {
          "bsonType": "string"
        },
        "product_id": {
          "bsonType": "string"
        },
        "product_name": {
          "bsonType": "string"
        },
        "shop_id": {
          "bsonType": "string"
        },
        "shop_name": {
          "bsonType": "string"
        },
        "start_date": {
          "bsonType": "string"
        },
        "status": {
          "bsonType": "string"
        },
        "total_cost": {
          "bsonType": "double"
        },
        "total_days": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "views": {
          "bsonType": [
            "int",
            "long"
          ]
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created promotions");
} else {
  db.runCommand({
    collMod: "promotions",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "clicks": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "created_at": {
          "bsonType": "string"
        },
        "daily_price": {
          "bsonType": "double"
        },
        "duration_days": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "end_date": {
          "bsonType": "string"
        },
        "id": {
          "bsonType": "string"
        },
        "is_free": {
          "bsonType": "bool"
        },
        "orders": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "payment_method": {
          "bsonType": "string"
        },
        "product_id": {
          "bsonType": "string"
        },
        "product_name": {
          "bsonType": "string"
        },
        "shop_id": {
          "bsonType": "string"
        },
        "shop_name": {
          "bsonType": "string"
        },
        "start_date": {
          "bsonType": "string"
        },
        "status": {
          "bsonType": "string"
        },
        "total_cost": {
          "bsonType": "double"
        },
        "total_days": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "views": {
          "bsonType": [
            "int",
            "long"
          ]
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for promotions");
}

// ---- referrals ----
if (!existing.includes("referrals")) {
  db.createCollection("referrals", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created referrals");
} else {
  db.runCommand({
    collMod: "referrals",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for referrals");
}

// ---- revenue_adjustments ----
if (!existing.includes("revenue_adjustments")) {
  db.createCollection("revenue_adjustments", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created revenue_adjustments");
} else {
  db.runCommand({
    collMod: "revenue_adjustments",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for revenue_adjustments");
}

// ---- reviews ----
if (!existing.includes("reviews")) {
  db.createCollection("reviews", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "comment": {
          "bsonType": "string"
        },
        "created_at": {
          "bsonType": "string"
        },
        "helpful_count": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "id": {
          "bsonType": "string"
        },
        "product_id": {
          "bsonType": "string"
        },
        "rating": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "user_id": {
          "bsonType": "string"
        },
        "user_name": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created reviews");
} else {
  db.runCommand({
    collMod: "reviews",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "comment": {
          "bsonType": "string"
        },
        "created_at": {
          "bsonType": "string"
        },
        "helpful_count": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "id": {
          "bsonType": "string"
        },
        "product_id": {
          "bsonType": "string"
        },
        "rating": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "user_id": {
          "bsonType": "string"
        },
        "user_name": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for reviews");
}

// ---- saved_locations ----
if (!existing.includes("saved_locations")) {
  db.createCollection("saved_locations", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created saved_locations");
} else {
  db.runCommand({
    collMod: "saved_locations",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for saved_locations");
}

// ---- shop_commission_promos ----
if (!existing.includes("shop_commission_promos")) {
  db.createCollection("shop_commission_promos", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created shop_commission_promos");
} else {
  db.runCommand({
    collMod: "shop_commission_promos",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for shop_commission_promos");
}

// ---- shop_sales ----
if (!existing.includes("shop_sales")) {
  db.createCollection("shop_sales", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created shop_sales");
} else {
  db.runCommand({
    collMod: "shop_sales",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for shop_sales");
}

// ---- shop_spin_state ----
if (!existing.includes("shop_spin_state")) {
  db.createCollection("shop_spin_state", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true,
      "properties": {
        "free_spins_balance": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "last_monthly_grant_at": {
          "bsonType": "string"
        },
        "shop_id": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created shop_spin_state");
} else {
  db.runCommand({
    collMod: "shop_spin_state",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true,
      "properties": {
        "free_spins_balance": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "last_monthly_grant_at": {
          "bsonType": "string"
        },
        "shop_id": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for shop_spin_state");
}

// ---- shop_verifications ----
if (!existing.includes("shop_verifications")) {
  db.createCollection("shop_verifications", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created shop_verifications");
} else {
  db.runCommand({
    collMod: "shop_verifications",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for shop_verifications");
}

// ---- shops ----
if (!existing.includes("shops")) {
  db.createCollection("shops", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "address": {
          "bsonType": "string"
        },
        "city": {
          "bsonType": "string"
        },
        "commission_type": {
          "bsonType": "string"
        },
        "cover_image": {
          "bsonType": "string"
        },
        "created_at": {
          "bsonType": "string"
        },
        "description": {
          "bsonType": "string"
        },
        "email": {
          "bsonType": "string"
        },
        "free_sponsor_credits": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "id": {
          "bsonType": "string"
        },
        "is_active": {
          "bsonType": "bool"
        },
        "latitude": {
          "bsonType": "double"
        },
        "location_address": {
          "bsonType": "string"
        },
        "logo": {
          "bsonType": "string"
        },
        "longitude": {
          "bsonType": "double"
        },
        "name": {
          "bsonType": "string"
        },
        "payment_method": {
          "bsonType": "string"
        },
        "phone": {
          "bsonType": "string"
        },
        "referral_code": {
          "bsonType": "string"
        },
        "referred_by_agent_id": {
          "bsonType": "string"
        },
        "referred_by_agent_name": {
          "bsonType": "string"
        },
        "state": {
          "bsonType": "string"
        },
        "status": {
          "bsonType": "string"
        },
        "submitted_via": {
          "bsonType": "string"
        },
        "subscription_end": {
          "bsonType": [
            "null",
            "string"
          ]
        },
        "subscription_required": {
          "bsonType": "bool"
        },
        "subscription_start": {
          "bsonType": [
            "null",
            "string"
          ]
        },
        "subscription_status": {
          "bsonType": "string"
        },
        "tier": {
          "bsonType": "string"
        },
        "total_revenue": {
          "bsonType": "double"
        },
        "user_id": {
          "bsonType": "string"
        },
        "wallet_balance": {
          "bsonType": [
            "double",
            "int",
            "long"
          ]
        },
        "welcome_bonus_granted": {
          "bsonType": "bool"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created shops");
} else {
  db.runCommand({
    collMod: "shops",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "address": {
          "bsonType": "string"
        },
        "city": {
          "bsonType": "string"
        },
        "commission_type": {
          "bsonType": "string"
        },
        "cover_image": {
          "bsonType": "string"
        },
        "created_at": {
          "bsonType": "string"
        },
        "description": {
          "bsonType": "string"
        },
        "email": {
          "bsonType": "string"
        },
        "free_sponsor_credits": {
          "bsonType": [
            "int",
            "long"
          ]
        },
        "id": {
          "bsonType": "string"
        },
        "is_active": {
          "bsonType": "bool"
        },
        "latitude": {
          "bsonType": "double"
        },
        "location_address": {
          "bsonType": "string"
        },
        "logo": {
          "bsonType": "string"
        },
        "longitude": {
          "bsonType": "double"
        },
        "name": {
          "bsonType": "string"
        },
        "payment_method": {
          "bsonType": "string"
        },
        "phone": {
          "bsonType": "string"
        },
        "referral_code": {
          "bsonType": "string"
        },
        "referred_by_agent_id": {
          "bsonType": "string"
        },
        "referred_by_agent_name": {
          "bsonType": "string"
        },
        "state": {
          "bsonType": "string"
        },
        "status": {
          "bsonType": "string"
        },
        "submitted_via": {
          "bsonType": "string"
        },
        "subscription_end": {
          "bsonType": [
            "null",
            "string"
          ]
        },
        "subscription_required": {
          "bsonType": "bool"
        },
        "subscription_start": {
          "bsonType": [
            "null",
            "string"
          ]
        },
        "subscription_status": {
          "bsonType": "string"
        },
        "tier": {
          "bsonType": "string"
        },
        "total_revenue": {
          "bsonType": "double"
        },
        "user_id": {
          "bsonType": "string"
        },
        "wallet_balance": {
          "bsonType": [
            "double",
            "int",
            "long"
          ]
        },
        "welcome_bonus_granted": {
          "bsonType": "bool"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for shops");
}

// ---- site_settings ----
if (!existing.includes("site_settings")) {
  db.createCollection("site_settings", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created site_settings");
} else {
  db.runCommand({
    collMod: "site_settings",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for site_settings");
}

// ---- spin_history ----
if (!existing.includes("spin_history")) {
  db.createCollection("spin_history", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created spin_history");
} else {
  db.runCommand({
    collMod: "spin_history",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for spin_history");
}

// ---- spin_settings ----
if (!existing.includes("spin_settings")) {
  db.createCollection("spin_settings", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "enabled": {
          "bsonType": "bool"
        },
        "id": {
          "bsonType": "string"
        },
        "outcomes": {
          "bsonType": "array"
        },
        "spin_cost_usd": {
          "bsonType": "double"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created spin_settings");
} else {
  db.runCommand({
    collMod: "spin_settings",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "enabled": {
          "bsonType": "bool"
        },
        "id": {
          "bsonType": "string"
        },
        "outcomes": {
          "bsonType": "array"
        },
        "spin_cost_usd": {
          "bsonType": "double"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for spin_settings");
}

// ---- states ----
if (!existing.includes("states")) {
  db.createCollection("states", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "delivery_fee": {
          "bsonType": "double"
        },
        "id": {
          "bsonType": "string"
        },
        "is_active": {
          "bsonType": "bool"
        },
        "name": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created states");
} else {
  db.runCommand({
    collMod: "states",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "delivery_fee": {
          "bsonType": "double"
        },
        "id": {
          "bsonType": "string"
        },
        "is_active": {
          "bsonType": "bool"
        },
        "name": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for states");
}

// ---- storefront_themes ----
if (!existing.includes("storefront_themes")) {
  db.createCollection("storefront_themes", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true,
      "properties": {
        "best_for": {
          "bsonType": "string"
        },
        "created_at": {
          "bsonType": "string"
        },
        "description": {
          "bsonType": "string"
        },
        "enabled": {
          "bsonType": "bool"
        },
        "is_default": {
          "bsonType": "bool"
        },
        "key": {
          "bsonType": "string"
        },
        "name": {
          "bsonType": "string"
        },
        "preview_color": {
          "bsonType": "string"
        },
        "price_usd": {
          "bsonType": "double"
        },
        "pro_only": {
          "bsonType": "bool"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created storefront_themes");
} else {
  db.runCommand({
    collMod: "storefront_themes",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true,
      "properties": {
        "best_for": {
          "bsonType": "string"
        },
        "created_at": {
          "bsonType": "string"
        },
        "description": {
          "bsonType": "string"
        },
        "enabled": {
          "bsonType": "bool"
        },
        "is_default": {
          "bsonType": "bool"
        },
        "key": {
          "bsonType": "string"
        },
        "name": {
          "bsonType": "string"
        },
        "preview_color": {
          "bsonType": "string"
        },
        "price_usd": {
          "bsonType": "double"
        },
        "pro_only": {
          "bsonType": "bool"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for storefront_themes");
}

// ---- subscription_payments ----
if (!existing.includes("subscription_payments")) {
  db.createCollection("subscription_payments", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created subscription_payments");
} else {
  db.runCommand({
    collMod: "subscription_payments",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for subscription_payments");
}

// ---- subscription_transactions ----
if (!existing.includes("subscription_transactions")) {
  db.createCollection("subscription_transactions", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created subscription_transactions");
} else {
  db.runCommand({
    collMod: "subscription_transactions",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for subscription_transactions");
}

// ---- team_members ----
if (!existing.includes("team_members")) {
  db.createCollection("team_members", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created team_members");
} else {
  db.runCommand({
    collMod: "team_members",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for team_members");
}

// ---- testimonials ----
if (!existing.includes("testimonials")) {
  db.createCollection("testimonials", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created testimonials");
} else {
  db.runCommand({
    collMod: "testimonials",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for testimonials");
}

// ---- tier_upgrade_requests ----
if (!existing.includes("tier_upgrade_requests")) {
  db.createCollection("tier_upgrade_requests", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created tier_upgrade_requests");
} else {
  db.runCommand({
    collMod: "tier_upgrade_requests",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for tier_upgrade_requests");
}

// ---- tos ----
if (!existing.includes("tos")) {
  db.createCollection("tos", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "content": {
          "bsonType": "string"
        },
        "id": {
          "bsonType": "string"
        },
        "updated_at": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created tos");
} else {
  db.runCommand({
    collMod: "tos",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "content": {
          "bsonType": "string"
        },
        "id": {
          "bsonType": "string"
        },
        "updated_at": {
          "bsonType": "string"
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for tos");
}

// ---- users ----
if (!existing.includes("users")) {
  db.createCollection("users", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "address": {
          "bsonType": "string"
        },
        "approval_bonus_amount": {
          "bsonType": "double"
        },
        "city": {
          "bsonType": "string"
        },
        "commission_share_percent": {
          "bsonType": "double"
        },
        "created_at": {
          "bsonType": "string"
        },
        "email": {
          "bsonType": "string"
        },
        "first_name": {
          "bsonType": "string"
        },
        "id": {
          "bsonType": "string"
        },
        "last_name": {
          "bsonType": "string"
        },
        "last_seen": {
          "bsonType": "string"
        },
        "name": {
          "bsonType": "string"
        },
        "password": {
          "bsonType": "string"
        },
        "phone": {
          "bsonType": "string"
        },
        "referral_code": {
          "bsonType": "string"
        },
        "role": {
          "bsonType": "string"
        },
        "shop_id": {
          "bsonType": "string"
        },
        "state": {
          "bsonType": "string"
        },
        "wallet_balance": {
          "bsonType": [
            "int",
            "long"
          ]
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created users");
} else {
  db.runCommand({
    collMod: "users",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "required": [
        "id"
      ],
      "additionalProperties": true,
      "properties": {
        "address": {
          "bsonType": "string"
        },
        "approval_bonus_amount": {
          "bsonType": "double"
        },
        "city": {
          "bsonType": "string"
        },
        "commission_share_percent": {
          "bsonType": "double"
        },
        "created_at": {
          "bsonType": "string"
        },
        "email": {
          "bsonType": "string"
        },
        "first_name": {
          "bsonType": "string"
        },
        "id": {
          "bsonType": "string"
        },
        "last_name": {
          "bsonType": "string"
        },
        "last_seen": {
          "bsonType": "string"
        },
        "name": {
          "bsonType": "string"
        },
        "password": {
          "bsonType": "string"
        },
        "phone": {
          "bsonType": "string"
        },
        "referral_code": {
          "bsonType": "string"
        },
        "role": {
          "bsonType": "string"
        },
        "shop_id": {
          "bsonType": "string"
        },
        "state": {
          "bsonType": "string"
        },
        "wallet_balance": {
          "bsonType": [
            "int",
            "long"
          ]
        }
      }
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for users");
}

// ---- wallet_transactions ----
if (!existing.includes("wallet_transactions")) {
  db.createCollection("wallet_transactions", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created wallet_transactions");
} else {
  db.runCommand({
    collMod: "wallet_transactions",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for wallet_transactions");
}

// ---- wishlists ----
if (!existing.includes("wishlists")) {
  db.createCollection("wishlists", {
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  + created wishlists");
} else {
  db.runCommand({
    collMod: "wishlists",
    validator: {
    "$jsonSchema": {
      "bsonType": "object",
      "additionalProperties": true
    }
  },
    validationLevel: "moderate",
    validationAction: "warn"
  });
  print("  ~ updated validator for wishlists");
}

/* ----------------------------------------------------------------------------
 * 2) INDEXES (recommended)
 * -------------------------------------------------------------------------- */
// about_page
db["about_page"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// ad_unsubscribes
db["ad_unsubscribes"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// admin_cashouts
db["admin_cashouts"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// admin_events
db["admin_events"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });
db["admin_events"].createIndex({ created_at: -1 }, { name: "idx_created_at" });

// admin_ledger
db["admin_ledger"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// admin_revenue
db["admin_revenue"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });
db["admin_revenue"].createIndex({ order_id: 1 }, { name: "idx_order_id" });
db["admin_revenue"].createIndex({ created_at: -1 }, { name: "idx_created_at" });

// agent_cashout_requests
db["agent_cashout_requests"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// agent_wallet_transactions
db["agent_wallet_transactions"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// badge_reads
db["badge_reads"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// blocked_ips
db["blocked_ips"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// browsing_history
db["browsing_history"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// cancel_requests
db["cancel_requests"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// carts
db["carts"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// cashout_requests
db["cashout_requests"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// categories
db["categories"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });
db["categories"].createIndex({ slug: 1 }, { unique: true, sparse: true, name: "uniq_slug" });
db["categories"].createIndex({ created_at: -1 }, { name: "idx_created_at" });

// chat_sessions
db["chat_sessions"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// contact_messages
db["contact_messages"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// delivery_tracking
db["delivery_tracking"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// email_campaigns
db["email_campaigns"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// email_clicks
db["email_clicks"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// event_sponsorships
db["event_sponsorships"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// google_pending_signups
db["google_pending_signups"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// guest_shop_applications
db["guest_shop_applications"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// held_delivery_fees
db["held_delivery_fees"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// login_challenges
db["login_challenges"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// loyalty_ledger
db["loyalty_ledger"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// messages
db["messages"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// messaging_blocks
db["messaging_blocks"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// notifications
db["notifications"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });
db["notifications"].createIndex({ recipient_id: 1 }, { name: "idx_recipient_id" });
db["notifications"].createIndex({ created_at: -1 }, { name: "idx_created_at" });

// oauth_states
db["oauth_states"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// orders
db["orders"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });
db["orders"].createIndex({ shop_id: 1 }, { name: "idx_shop_id" });
db["orders"].createIndex({ user_id: 1 }, { name: "idx_user_id" });
db["orders"].createIndex({ order_status: 1 }, { name: "idx_order_status" });
db["orders"].createIndex({ payment_status: 1 }, { name: "idx_payment_status" });
db["orders"].createIndex({ created_at: -1 }, { name: "idx_created_at" });

// otp_codes
db["otp_codes"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// payment_transactions
db["payment_transactions"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// pending_shop_payments
db["pending_shop_payments"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// pending_signups
db["pending_signups"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// platform_settings
db["platform_settings"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// product_gifts
db["product_gifts"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });
db["product_gifts"].createIndex({ product_id: 1 }, { name: "idx_product_id" });
db["product_gifts"].createIndex({ shop_id: 1 }, { name: "idx_shop_id" });
db["product_gifts"].createIndex({ created_at: -1 }, { name: "idx_created_at" });

// products
db["products"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });
db["products"].createIndex({ category_id: 1 }, { name: "idx_category_id" });
db["products"].createIndex({ shop_id: 1 }, { name: "idx_shop_id" });
db["products"].createIndex({ created_at: -1 }, { name: "idx_created_at" });

// promotions
db["promotions"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });
db["promotions"].createIndex({ product_id: 1 }, { name: "idx_product_id" });
db["promotions"].createIndex({ shop_id: 1 }, { name: "idx_shop_id" });
db["promotions"].createIndex({ status: 1 }, { name: "idx_status" });
db["promotions"].createIndex({ created_at: -1 }, { name: "idx_created_at" });

// referrals
db["referrals"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// revenue_adjustments
db["revenue_adjustments"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// reviews
db["reviews"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });
db["reviews"].createIndex({ product_id: 1 }, { name: "idx_product_id" });
db["reviews"].createIndex({ user_id: 1 }, { name: "idx_user_id" });
db["reviews"].createIndex({ created_at: -1 }, { name: "idx_created_at" });

// saved_locations
db["saved_locations"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// shop_commission_promos
db["shop_commission_promos"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// shop_sales
db["shop_sales"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// shop_spin_state
db["shop_spin_state"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });
db["shop_spin_state"].createIndex({ shop_id: 1 }, { name: "idx_shop_id" });

// shop_verifications
db["shop_verifications"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// shops
db["shops"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });
db["shops"].createIndex({ email: 1 }, { name: "idx_email" });
db["shops"].createIndex({ referred_by_agent_id: 1 }, { name: "idx_referred_by_agent_id" });
db["shops"].createIndex({ user_id: 1 }, { name: "idx_user_id" });
db["shops"].createIndex({ status: 1 }, { name: "idx_status" });
db["shops"].createIndex({ subscription_status: 1 }, { name: "idx_subscription_status" });
db["shops"].createIndex({ created_at: -1 }, { name: "idx_created_at" });

// site_settings
db["site_settings"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// spin_history
db["spin_history"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// spin_settings
db["spin_settings"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// states
db["states"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// storefront_themes
db["storefront_themes"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });
db["storefront_themes"].createIndex({ created_at: -1 }, { name: "idx_created_at" });

// subscription_payments
db["subscription_payments"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// subscription_transactions
db["subscription_transactions"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// team_members
db["team_members"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// testimonials
db["testimonials"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// tier_upgrade_requests
db["tier_upgrade_requests"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// tos
db["tos"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// users
db["users"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });
db["users"].createIndex({ email: 1 }, { unique: true, sparse: true, name: "uniq_email" });
db["users"].createIndex({ shop_id: 1 }, { name: "idx_shop_id" });
db["users"].createIndex({ created_at: -1 }, { name: "idx_created_at" });

// wallet_transactions
db["wallet_transactions"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

// wishlists
db["wishlists"].createIndex({ id: 1 }, { unique: true, sparse: true, name: "uniq_id" });

print("\nOpenMarket DB setup complete. Collections: " + db.getCollectionNames().length);
