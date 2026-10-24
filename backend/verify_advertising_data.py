"""
Verify advertising data integrity: wallet deductions, admin_ledger profit, campaign status
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import db
from datetime import datetime, timezone

async def verify_data():
    print("=" * 80)
    print("VERIFYING ADVERTISING DATA INTEGRITY")
    print("=" * 80)
    
    # 1. Check shop wallets
    print("\n### SHOP WALLETS ###")
    shops = await db.shops.find({"id": {"$in": ["shop-techzone", "shop-fashionhub"]}}, {"_id": 0, "id": 1, "name": 1, "wallet_balance": 1}).to_list(10)
    for shop in shops:
        print(f"  {shop.get('name')}: ${shop.get('wallet_balance', 0):.2f}")
    
    # 2. Check email campaigns
    print("\n### EMAIL CAMPAIGNS ###")
    campaigns = await db.email_campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    print(f"  Total campaigns: {len(campaigns)}")
    for c in campaigns:
        print(f"  - {c.get('type')} | {c.get('subject')} | Status: {c.get('status')} | "
              f"Cost: ${c.get('cost_charged', 0):.2f} | Clicks: {c.get('clicks', 0)} | "
              f"Emails sent: {c.get('emails_sent', 0)}")
    
    # 3. Check wallet transactions
    print("\n### WALLET TRANSACTIONS (Last 10) ###")
    txns = await db.wallet_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    print(f"  Total recent transactions: {len(txns)}")
    for t in txns:
        print(f"  - {t.get('type')} | Shop: {t.get('shop_name')} | "
              f"Amount: ${t.get('amount', 0):.2f} | Balance after: ${t.get('balance_after', 0):.2f}")
    
    # 4. Check admin_ledger (profit)
    print("\n### ADMIN LEDGER (PROFIT) ###")
    ledger = await db.admin_ledger.find(
        {"type": "platform_services"}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    print(f"  Total profit entries: {len(ledger)}")
    
    # Calculate totals by subtype
    totals = {}
    for e in ledger:
        subtype = e.get('subtype', 'unknown')
        amount = e.get('amount', 0)
        totals[subtype] = totals.get(subtype, 0) + amount
    
    print("  Profit by type:")
    for subtype, total in totals.items():
        print(f"    - {subtype}: ${total:.2f}")
    
    print(f"  Total profit: ${sum(totals.values()):.2f}")
    
    # Show recent entries
    print("\n  Recent profit entries:")
    for e in ledger[:10]:
        print(f"    - {e.get('subtype')} | ${e.get('amount', 0):.2f} | "
              f"Shop: {e.get('shop_name')} | Note: {e.get('note', '')[:60]}")
    
    # 5. Check event sponsorships
    print("\n### EVENT SPONSORSHIPS ###")
    events = await db.admin_events.find(
        {"display_mode": "home_banner"}, 
        {"_id": 0, "id": 1, "title": 1, "sponsorship_enabled": 1, "sponsorship_price": 1, "sponsoring_shops": 1}
    ).to_list(10)
    for e in events:
        sponsors = e.get('sponsoring_shops', [])
        print(f"  - {e.get('title')} | Sponsorship: {e.get('sponsorship_enabled')} | "
              f"Price: ${e.get('sponsorship_price', 0):.2f} | Sponsors: {len(sponsors)}")
        for s in sponsors:
            print(f"      → {s.get('shop_name')} (${s.get('amount', 0):.2f})")
    
    # 6. Check email clicks
    print("\n### EMAIL CLICKS ###")
    clicks = await db.email_clicks.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    print(f"  Total recent clicks: {len(clicks)}")
    charged_clicks = [c for c in clicks if c.get('charged')]
    print(f"  Charged clicks: {len(charged_clicks)}")
    for c in clicks[:5]:
        print(f"    - Campaign: {c.get('campaign_id')[:8]}... | Type: {c.get('type')} | "
              f"Charged: {c.get('charged')} | Amount: ${c.get('amount', 0):.2f}")
    
    # 7. Verify data consistency
    print("\n### DATA CONSISTENCY CHECKS ###")
    
    # Check if wallet deductions match admin_ledger credits
    total_wallet_deductions = 0
    async for t in db.wallet_transactions.find({"type": {"$in": ["email_campaign", "ppc_click_charge", "event_sponsorship"]}}):
        total_wallet_deductions += abs(t.get('amount', 0))
    
    total_admin_profit = 0
    async for e in db.admin_ledger.find({"type": "platform_services"}):
        total_admin_profit += e.get('amount', 0)
    
    print(f"  Total wallet deductions (ads): ${total_wallet_deductions:.2f}")
    print(f"  Total admin profit (ads): ${total_admin_profit:.2f}")
    
    if abs(total_wallet_deductions - total_admin_profit) < 0.01:
        print("  ✅ Wallet deductions match admin profit")
    else:
        print(f"  ❌ MISMATCH: Difference of ${abs(total_wallet_deductions - total_admin_profit):.2f}")
    
    print("\n" + "=" * 80)
    print("VERIFICATION COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(verify_data())
