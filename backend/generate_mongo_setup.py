"""
Generate a MongoDB setup script (mongosh JS) that recreates EVERY collection
("table") used by the OpenMarket Lebanon website, with JSON-Schema validators
(documenting fields + types) and recommended indexes.

Run:  python generate_mongo_setup.py
Output: /app/openmarket_mongodb_setup.js
"""
import asyncio
import os
import re
import json
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# ---- 1. Collect collection names referenced anywhere in the backend code ----
CODE_DIRS = ["routers", "services", "."]
DB_REF_RE = re.compile(r"db\.([a-zA-Z_][a-zA-Z0-9_]+)")
IGNORE = {
    "client", "command", "list_collection_names", "name", "create_collection",
    "drop", "drop_collection", "get_collection", "database", "list_collections",
    "with_options", "watch", "aggregate", "server_info",
    "createCollection", "getCollectionNames", "getName", "runCommand",
    "getCollection", "getCollectionInfos", "createIndex", "dropDatabase",
    "stats", "validate", "getSiblingDB",
}


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


def bson_types(values):
    """Map observed python values -> set of bson type aliases."""
    out = set()
    for v in values:
        if v is None:
            out.add("null")
        elif isinstance(v, bool):
            out.add("bool")
        elif isinstance(v, int):
            out.add("long"); out.add("int")
        elif isinstance(v, float):
            out.add("double")
        elif isinstance(v, str):
            out.add("string")
        elif isinstance(v, list):
            out.add("array")
        elif isinstance(v, dict):
            out.add("object")
    return out


# Index heuristics by field name
FK_FIELDS = {
    "user_id", "shop_id", "product_id", "order_id", "agent_id", "category_id",
    "referred_by_agent_id", "customer_id", "recipient_id", "sender_id",
    "conversation_id", "review_id", "promotion_id", "application_id",
}
STATUS_FIELDS = {"status", "subscription_status", "payment_status", "order_status", "delivery_status"}


async def main():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "openmarket")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    live = set(await db.list_collection_names())
    code = collect_code_collections()
    all_names = sorted((live | code) - {n for n in (live | code) if n.startswith("system.")})

    blocks = []
    index_blocks = []

    for name in all_names:
        fields = {}  # field -> set(bson types)
        sample = []
        if name in live:
            try:
                sample = await db[name].find({}, {"_id": 0}).limit(50).to_list(50)
            except Exception:
                sample = []
        present_in_all = None
        for doc in sample:
            if not isinstance(doc, dict):
                continue
            keys = set(doc.keys()) - {"_id"}
            present_in_all = keys if present_in_all is None else (present_in_all & keys)
            for k, v in doc.items():
                if k == "_id":
                    continue
                fields.setdefault(k, set()).update(bson_types([v]))

        # Build $jsonSchema properties
        props = {}
        for fname, types in sorted(fields.items()):
            # collapse numeric duplicates, keep deterministic order
            t = sorted(types)
            props[fname] = {"bsonType": t if len(t) > 1 else t[0]}

        required = []
        if "id" in fields and present_in_all and "id" in present_in_all:
            required = ["id"]

        validator = {
            "$jsonSchema": {
                "bsonType": "object",
                "required": required,
                "additionalProperties": True,
                "properties": props,
            }
        }
        # When we have no sampled fields (empty/code-only collection), keep a loose validator
        if not props:
            validator = {"$jsonSchema": {"bsonType": "object", "additionalProperties": True}}

        validator_js = json.dumps(validator, indent=2)
        # indent nested for readability inside the block
        validator_js = validator_js.replace("\n", "\n  ")

        block = f"""// ---- {name} ----
if (!existing.includes("{name}")) {{
  db.createCollection("{name}", {{
    validator: {validator_js},
    validationLevel: "moderate",
    validationAction: "warn"
  }});
  print("  + created {name}");
}} else {{
  db.runCommand({{
    collMod: "{name}",
    validator: {validator_js},
    validationLevel: "moderate",
    validationAction: "warn"
  }});
  print("  ~ updated validator for {name}");
}}"""
        blocks.append(block)

        # ---- Indexes ----
        idx = []
        if "id" in fields or name in code:
            idx.append(f'db["{name}"].createIndex({{ id: 1 }}, {{ unique: true, sparse: true, name: "uniq_id" }});')
        if name == "users" and ("email" in fields or True):
            idx.append('db["users"].createIndex({ email: 1 }, { unique: true, sparse: true, name: "uniq_email" });')
        elif "email" in fields:
            idx.append(f'db["{name}"].createIndex({{ email: 1 }}, {{ name: "idx_email" }});')
        if "slug" in fields:
            idx.append(f'db["{name}"].createIndex({{ slug: 1 }}, {{ unique: true, sparse: true, name: "uniq_slug" }});')
        for fk in sorted(FK_FIELDS):
            if fk in fields:
                idx.append(f'db["{name}"].createIndex({{ {fk}: 1 }}, {{ name: "idx_{fk}" }});')
        for sf in sorted(STATUS_FIELDS):
            if sf in fields:
                idx.append(f'db["{name}"].createIndex({{ {sf}: 1 }}, {{ name: "idx_{sf}" }});')
        if "created_at" in fields:
            idx.append(f'db["{name}"].createIndex({{ created_at: -1 }}, {{ name: "idx_created_at" }});')
        if idx:
            index_blocks.append(f"// {name}\n" + "\n".join(idx))

    header = f"""/* ============================================================================
 * OpenMarket Lebanon — MongoDB setup script
 * Creates ALL website collections ("tables") with JSON-Schema validators
 * (documenting fields & types) and recommended indexes.
 *
 * Generated from the live data model. Total collections: {len(all_names)}
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
"""

    indexes_header = """

/* ----------------------------------------------------------------------------
 * 2) INDEXES (recommended)
 * -------------------------------------------------------------------------- */
"""

    footer = """

print("\\nOpenMarket DB setup complete. Collections: " + db.getCollectionNames().length);
"""

    script = header + "\n\n".join(blocks) + indexes_header + "\n\n".join(index_blocks) + footer

    out_path = "/app/openmarket_mongodb_setup.js"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(script)

    print(f"Wrote {out_path}")
    print(f"Total collections: {len(all_names)}")
    print("Collections:", ", ".join(all_names))


if __name__ == "__main__":
    asyncio.run(main())
