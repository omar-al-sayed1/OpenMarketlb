"""
Generate a full relational SQL schema (CREATE TABLE ...) representing the ENTIRE
OpenMarket Lebanon website data model — every table, every column, primary keys,
and foreign keys (plus junction tables for array-of-ids many-to-many relations).

Target dialect: MySQL 8 / MariaDB (notes in header for PostgreSQL).

Run:    python generate_sql_schema.py
Output: /app/openmarket_schema.sql
"""
import asyncio
import os
import re
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

CODE_DIRS = ["routers", "services", "."]
DB_REF_RE = re.compile(r"db\.([a-zA-Z_][a-zA-Z0-9_]+)")
IGNORE = {
    "client", "command", "list_collection_names", "name", "create_collection",
    "drop", "drop_collection", "get_collection", "database", "list_collections",
    "with_options", "watch", "aggregate", "server_info", "createCollection",
    "getCollectionNames", "getName", "runCommand", "getCollection",
    "getCollectionInfos", "createIndex", "dropDatabase", "stats", "validate",
    "getSiblingDB",
}

# Explicit foreign-key resolution: base token -> referenced table
FK_BASE_MAP = {
    "user": "users", "customer": "users", "recipient": "users", "sender": "users",
    "reviewer": "users", "owner": "users", "buyer": "users", "seller": "users",
    "agent": "users", "referred_by_agent": "users", "assigned_to": "users",
    "created_by": "users", "approved_by": "users", "blocked_by": "users",
    "shop": "shops", "product": "products", "order": "orders",
    "category": "categories", "parent": "categories", "subcategory": "categories",
    "review": "reviews", "promotion": "promotions", "theme": "storefront_themes",
    "event": "admin_events", "sale": "shop_sales", "application": "guest_shop_applications",
    "gift": "product_gifts", "state": "states",
}

MONEY_HINTS = ("price", "amount", "balance", "total", "fee", "commission", "cost",
               "value", "payout", "revenue", "profit", "subtotal", "discount",
               "credit", "earnings", "spend", "markup", "wallet")
COUNT_HINTS = ("count", "quantity", "qty", "stock", "spins", "points", "views",
               "clicks", "unread", "rating_count", "num_", "_count")
DATE_HINTS_SUFFIX = ("_at", "_date")
DATE_HINTS_EXACT = ("date", "timestamp", "created", "updated", "expires", "expiry",
                     "subscription_start", "subscription_end", "last_seen", "delivered_at")


def collect_code_collections():
    names = set()
    base = os.path.dirname(os.path.abspath(__file__))
    for root_dir in CODE_DIRS:
        d = os.path.join(base, root_dir)
        if not os.path.isdir(d):
            continue
        for dirpath, _, files in os.walk(d):
            if "__pycache__" in dirpath:
                continue
            for f in files:
                if not f.endswith(".py"):
                    continue
                try:
                    txt = open(os.path.join(dirpath, f), encoding="utf-8").read()
                except Exception:
                    continue
                for m in DB_REF_RE.findall(txt):
                    if m not in IGNORE:
                        names.add(m)
    return names


def bson_type(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "bool"
    if isinstance(v, int):
        return "int"
    if isinstance(v, float):
        return "double"
    if isinstance(v, str):
        return "string"
    if isinstance(v, list):
        return "array"
    if isinstance(v, dict):
        return "object"
    return "string"


def singularize(word):
    if word.endswith("ies"):
        return word[:-3] + "y"
    if word.endswith("ses"):
        return word[:-2]
    if word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def pluralize(word):
    if word.endswith("y"):
        return word[:-1] + "ies"
    if word.endswith("s"):
        return word + "es"
    return word + "s"


def resolve_ref_table(base, tables):
    """Given an FK base token (without _id), return referenced table or None."""
    if base in FK_BASE_MAP and FK_BASE_MAP[base] in tables:
        return FK_BASE_MAP[base]
    # substring hints
    if base.endswith("agent") or base.endswith("user") or base in ("created_by", "approved_by"):
        if "users" in tables:
            return "users"
    # try pluralized forms
    for cand in (pluralize(base), base, base + "s"):
        if cand in tables:
            return cand
    return None


def sql_type_for(field, types):
    """Map a field + observed bson types to a MySQL column type."""
    fl = field.lower()
    non_null = {t for t in types if t != "null"}

    # complex -> JSON
    if "array" in non_null or "object" in non_null:
        return "JSON"

    # date-like (stored as ISO strings in app) -> DATETIME
    is_date = fl.endswith(DATE_HINTS_SUFFIX) or fl in DATE_HINTS_EXACT or "_date" in fl
    if is_date and "string" in non_null:
        return "DATETIME"

    # boolean
    if non_null == {"bool"}:
        return "TINYINT(1)"  # MySQL boolean

    # numeric
    numeric = non_null and non_null <= {"int", "double", "bool"}
    if numeric:
        if any(h in fl for h in MONEY_HINTS):
            return "DECIMAL(14,2)"
        if "double" in non_null:
            return "DOUBLE"
        return "BIGINT"

    # money even if stored oddly
    if any(h in fl for h in MONEY_HINTS) and "string" not in non_null:
        return "DECIMAL(14,2)"

    # strings
    KEYISH = ("id", "email", "slug", "status", "role", "phone", "type", "code",
              "currency", "tier", "method", "color", "icon", "key", "sku", "lang")
    if fl == "id" or fl.endswith("_id") or fl in KEYISH or any(fl.endswith("_" + k) for k in KEYISH):
        return "VARCHAR(255)"
    LONGISH = ("description", "content", "body", "html", "address", "note", "notes",
               "message", "bio", "text", "summary", "details", "comment", "reason",
               "logo", "image", "url", "avatar", "banner", "photo", "answer", "question")
    if any(h in fl for h in LONGISH):
        return "TEXT"
    # default
    return "VARCHAR(255)"


async def main():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "openmarket")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    live = set(await db.list_collection_names())
    code = collect_code_collections()
    tables = sorted((live | code) - {n for n in (live | code) if n.startswith("system.")})
    table_set = set(tables)

    # Introspect fields per table
    schema = {}      # table -> {field: set(types)}
    has_id = {}      # table -> bool
    for name in tables:
        fields = {}
        if name in live:
            try:
                sample = await db[name].find({}, {"_id": 0}).limit(80).to_list(80)
            except Exception:
                sample = []
            for doc in sample:
                if isinstance(doc, dict):
                    for k, v in doc.items():
                        if k == "_id":
                            continue
                        fields.setdefault(k, set()).add(bson_type(v))
        schema[name] = fields
        has_id[name] = "id" in fields

    # Build CREATE TABLE statements + collect FK + junction definitions
    create_stmts = []
    fk_alters = []
    junction_stmts = []
    junction_fk_alters = []

    for name in tables:
        fields = schema[name]
        lines = []
        col_defs = {}  # field -> sql type (final)
        array_id_fields = []  # (field, ref_table)

        # Determine PK
        pk_is_id = has_id[name]

        # First pass: decide columns
        for field, types in fields.items():
            # array of ids -> junction table (skip as column)
            if "array" in types and field.lower().endswith("_ids"):
                base = field[:-4]
                ref = resolve_ref_table(base, table_set)
                if ref and has_id.get(ref):
                    array_id_fields.append((field, ref))
                    continue  # handled by junction table
            col_defs[field] = sql_type_for(field, types)

        # Ensure id column exists / surrogate PK
        if pk_is_id:
            col_defs["id"] = "VARCHAR(255)"
        # force FK columns to VARCHAR(255) and record FK
        table_fks = []
        for field in list(col_defs.keys()):
            fl = field.lower()
            if fl != "id" and fl.endswith("_id"):
                base = field[:-3]
                ref = resolve_ref_table(base, table_set)
                if ref and has_id.get(ref):
                    col_defs[field] = "VARCHAR(255)"
                    table_fks.append((field, ref))

        # Emit column lines (id first)
        ordered = sorted(col_defs.keys(), key=lambda c: (c != "id", c))
        if not ordered:
            # empty / unknown collection
            lines.append("  `id` VARCHAR(255) NOT NULL")
            lines.append("  -- (no sample data available; columns added by application at runtime)")
            lines.append("  , `data` JSON NULL")
            lines.append("  , PRIMARY KEY (`id`)")
        else:
            for c in ordered:
                null = "NOT NULL" if c == "id" and pk_is_id else "NULL"
                lines.append(f"  `{c}` {col_defs[c]} {null}")
            if not pk_is_id:
                # surrogate PK
                lines.insert(0, "  `row_id` BIGINT NOT NULL AUTO_INCREMENT")
                lines.append("  , PRIMARY KEY (`row_id`)")
                # re-join below handles commas
            else:
                lines.append("  , PRIMARY KEY (`id`)")

        # Join with commas (first lines need leading commas fixed)
        body = []
        for i, ln in enumerate(lines):
            if ln.strip().startswith(",") or ln.strip().startswith("--"):
                body.append(ln)
            elif i == 0:
                body.append(ln)
            else:
                # add comma to previous non-comment line if needed
                body.append(ln)
        # Simpler: rebuild cleanly
        col_lines = []
        if not ordered:
            col_lines = [
                "  `id` VARCHAR(255) NOT NULL",
                "  `data` JSON NULL",
            ]
            pk_line = "  PRIMARY KEY (`id`)"
        else:
            col_lines = []
            if not pk_is_id:
                col_lines.append("  `row_id` BIGINT NOT NULL AUTO_INCREMENT")
            for c in ordered:
                null = "NOT NULL" if (c == "id" and pk_is_id) else "NULL"
                col_lines.append(f"  `{c}` {col_defs[c]} {null}")
            pk_line = "  PRIMARY KEY (`id`)" if pk_is_id else "  PRIMARY KEY (`row_id`)"

        all_lines = col_lines + [pk_line]
        stmt = (f"CREATE TABLE IF NOT EXISTS `{name}` (\n"
                + ",\n".join(all_lines)
                + "\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;")
        create_stmts.append(stmt)

        # FK ALTERs
        for field, ref in table_fks:
            cname = f"fk_{name}_{field}"[:60]
            fk_alters.append(
                f"ALTER TABLE `{name}` ADD CONSTRAINT `{cname}` "
                f"FOREIGN KEY (`{field}`) REFERENCES `{ref}` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;"
            )

        # Junction tables for array-of-ids
        for field, ref in array_id_fields:
            parent_col = singularize(name) + "_id"
            child_col = singularize(ref) + "_id"
            if parent_col == child_col:
                child_col = singularize(ref) + "_ref_id"
            jname = f"{name}__{field}"
            junction_stmts.append(
                f"-- many-to-many: {name}.{field} -> {ref}\n"
                f"CREATE TABLE IF NOT EXISTS `{jname}` (\n"
                f"  `{parent_col}` VARCHAR(255) NOT NULL,\n"
                f"  `{child_col}` VARCHAR(255) NOT NULL,\n"
                f"  PRIMARY KEY (`{parent_col}`, `{child_col}`)\n"
                f") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
            )
            junction_fk_alters.append(
                f"ALTER TABLE `{jname}` ADD CONSTRAINT `fk_{jname}_p`[:60] "
            )
            # build cleanly (avoid the slice bug above)
            junction_fk_alters[-1] = (
                f"ALTER TABLE `{jname}` ADD CONSTRAINT `fk_{jname}_parent` "
                f"FOREIGN KEY (`{parent_col}`) REFERENCES `{name}` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;"
            )
            junction_fk_alters.append(
                f"ALTER TABLE `{jname}` ADD CONSTRAINT `fk_{jname}_child` "
                f"FOREIGN KEY (`{child_col}`) REFERENCES `{ref}` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;"
            )

    header = f"""-- ============================================================================
-- OpenMarket Lebanon — FULL RELATIONAL SQL SCHEMA (CREATE TABLE)
-- Every table, every column, primary keys & foreign keys for the whole website.
--
-- Dialect: MySQL 8 / MariaDB.  (PostgreSQL: replace TINYINT(1)->BOOLEAN,
--          AUTO_INCREMENT->GENERATED ... AS IDENTITY, `backticks`->\"quotes\",
--          JSON stays JSON/JSONB, DATETIME->TIMESTAMP.)
--
-- Tables: {len(tables)} base tables + {len(junction_stmts)} junction (M:N) tables.
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

"""

    junctions_header = "\n\n-- ----------------------------------------------------------------------------\n-- 2) JUNCTION TABLES (many-to-many relationships)\n-- ----------------------------------------------------------------------------\n\n"
    fk_header = "\n\n-- ----------------------------------------------------------------------------\n-- 3) FOREIGN KEY CONSTRAINTS\n-- ----------------------------------------------------------------------------\n\n"
    footer = "\n\nSET FOREIGN_KEY_CHECKS = 1;\n"

    out = (header
           + "\n\n".join(create_stmts)
           + junctions_header + ("\n\n".join(junction_stmts) if junction_stmts else "-- (none)")
           + fk_header + ("\n".join(fk_alters + junction_fk_alters) if (fk_alters or junction_fk_alters) else "-- (none)")
           + footer)

    out_path = "/app/openmarket_schema.sql"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(out)

    print(f"Wrote {out_path}")
    print(f"Base tables: {len(tables)} | Junction tables: {len(junction_stmts)} | FKs: {len(fk_alters)+len(junction_fk_alters)}")


if __name__ == "__main__":
    asyncio.run(main())
