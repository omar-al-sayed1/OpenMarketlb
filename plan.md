# Plan — OpenMarket Lebanon (Brownfield Enhancements): Finance Filtering + Profit Selector + Referral Bonuses + UX Badges + Agent Refer Form + Admin Shop Filters

## Objectives
- ✅ Add **month/year filtering** to Admin **Finance Center** (held money + profit) and append **modern analytics + graphs**.
- ✅ Add **month/year selectors** to Admin Dashboard **Monthly Profit** card (and remove Gallery/Agents/Events buttons).
- ✅ Update **welcome bonus** logic:
  - **Non‑referred**: **$2 wallet + 1 free product sponsor**
  - **Referred**: **$3 wallet + 2 free product sponsors**
  - Update all “On approval…” copy to reflect actual rewards; Become‑Seller must **not** mention sponsored product names.
- ✅ Add **Free Sponsor badge** on Shop **Boost a Product** entry points when credits are available (sidebar + advertising + boost page).
- ✅ Make **Agent → Refer a Shop** page match the **Become‑Seller** full application form (logo + categories + description) with agent attribution.
- ✅ In **Admin Shops**, add **Referred** badge + agent details + useful filters.
- ✅ Provide **written** suggestions for additional shop verification methods (no code).
- ⛔ Free theme task skipped per user (already done; no changes needed).

---

## Phase 1 — Core Data/Filter Validation (No external integrations)
> Core risk here = correct month/year calculations + bonus branching without breaking accounting.

### User stories
1. ✅ As an admin, I can select a month/year and see Finance Center totals recomputed for that period.
2. ✅ As an admin, I can select a month/year and see Monthly Profit update immediately.
3. ✅ As an admin, I can confirm referred vs non‑referred approvals grant the correct bonus amounts.
4. ✅ As a shop owner, I can clearly see what I will receive upon approval before submitting.
5. ✅ As a shop, I can see an obvious “Free Sponsor” indicator when I have credits.

### Implementation steps
1. ✅ **Project setup + data**
   - Migrated uploaded project into `/app` while preserving `.env`.
   - Set stable `JWT_SECRET`.
   - Started services and ran seed endpoints:
     - `POST /api/seed-public`
     - `POST /api/seed-sponsored`
     - `POST /api/seed-extra`

2. ✅ **Backend: time filtering support**
   - Added `year` + `month` query params to:
     - `GET /api/admin/finance-center`
   - Implemented period filtering across time-based flows:
     - `admin_ledger` (subscriptions, platform_services, monthly_credits, loyalty_points_deduction, agent_payouts)
     - `subscription_payments`
     - `revenue_adjustments`
     - `orders` (paid orders for commissions + pending wallet/card held)
     - `held_delivery_fees`
   - Added response metadata:
     - `period: { active, year, month, label, range }`

3. ✅ **Backend: finance time series for charts**
   - Added `GET /api/admin/finance-center/timeseries`:
     - Returns per-month series for the latest 12 months, or 12 months for a requested year.
     - Includes `profit`, components, and held-money flows (`pending_held`, `delivery_held`).

4. ✅ **Backend: welcome bonus branching**
   - Added shared helper: `get_welcome_bonus()` in `backend/services/helpers.py`.
   - Updated:
     - `approve_guest_application` (guest apps):
       - Referred: `$3` wallet + `2` sponsors
       - Non‑referred: `$2` wallet + `1` sponsor
       - Updated wallet transaction note, notification, email HTML, and admin_ledger subtype.
     - `approve_shop` (logged-in shop approvals):
       - Uses same branching on `referred_by_agent_id`.

5. ✅ **Quick regression checks (local)**
   - Verified referred/non‑referred approval values and ledger side effects.

### Exit criteria
- ✅ Finance endpoint returns correct totals for at least two different months.
- ✅ Referred/non‑referred approvals grant correct rewards, and ledger reflects them.

---

## Phase 2 — V1 App Development (UI/UX)

### User stories
1. ✅ As an admin, I can filter Finance Center by month and year and the entire page updates.
2. ✅ As an admin, I can view modern charts (profit trend, held-money breakdown, revenue streams, outflows) at the bottom.
3. ✅ As an admin, I can change month/year in Monthly Profit card without navigating away.
4. ✅ As a shop applicant, I see a simple note “On approval you’ll receive …” (no sponsor product naming).
5. ✅ As a shop, I see a badge on Boost/Advertising entry points when free sponsor credits exist.
6. ✅ As an agent, I can submit the full shop application (logo + categories + description) and it is tracked as my referral.
7. ✅ As an admin, I can filter shops by referred status / agent and see agent attribution on cards/rows.

### Implementation steps
1. ✅ **Admin Finance Center (frontend)** `frontend/src/pages/admin/AdminFinanceCenter.js`
   - Added Year + Month selects (includes All time + Whole year options).
   - Calls `/api/admin/finance-center?year=YYYY&month=MM`.
   - Added modern analytics section at bottom:
     - KPI cards: latest profit, 12-month/year profit, best month, total outflows.
     - Charts (Recharts):
       - Profit Trend (Area)
       - Money Held Breakdown (Donut)
       - Revenue Streams (Stacked Bars)
       - Outflows Over Time (Lines)
   - Uses backend timeseries endpoint `/api/admin/finance-center/timeseries`.

2. ✅ **Admin Dashboard Monthly Profit selectors** `frontend/src/pages/admin/AdminDashboard.js`
   - Added year + month selects.
   - Uses `/api/admin/revenue/monthly-analytics` data to render selected month or whole-year aggregate.
   - Removed buttons: **Gallery**, **Agents**, **Events & Banners** from Monthly Profit card.

3. ✅ **Welcome-bonus copy updates**
   - `frontend/src/pages/BecomeSellerPage.js`:
     - Added “What you’ll get when approved” benefits card.
     - Dynamic amounts:
       - Direct/non-referred: $2 + 1 sponsor
       - Referred (when ref code present): $3 + 2 sponsors
     - No sponsor product name displayed.
   - `frontend/src/pages/admin/AdminShops.js`:
     - Updated approval dialogs/notes to reflect referred vs non‑referred bonus.

4. ✅ **Free sponsor badge in shop UX**
   - `frontend/src/components/ShopSidebar.js`:
     - Added badge on “Boost a Product” when free sponsor credits exist.
   - `frontend/src/pages/shop/ShopAdvertising.js`:
     - Added “Free Sponsor available” badge.
     - Added “Use a free credit” toggle.
     - Boost confirmation supports free credits (`use_free_credit` sent to backend when eligible).
   - `frontend/src/pages/shop/ShopBoostProducts.js`:
     - Added header badge when credits exist.

5. ✅ **Agent Refer Shop = full Become‑Seller form** `frontend/src/pages/agent/AgentReferShop.js`
   - Full multi-section form (Owner info, Shop details, categories chips, logo upload, location).
   - Added “What this shop gets on approval” benefits card ($3 + 2 sponsors).
   - Submits via `POST /api/agent/fill-shop` including `category_ids` + `logo`.

6. ✅ **Admin Shops enhancements** `frontend/src/pages/admin/AdminShops.js`
   - Added:
     - Referred badge on shop cards.
     - “Referred by {agent} ({referral_code})” detail row.
   - Added filters:
     - Status, Tier, Referral (referred/direct), Agent, Region, Payment
     - Search includes agent name.
     - Clear filters + result count.

7. ✅ **Seed/demo improvements**
   - Marked `Home Decor Plus` as referred by agent Omar (`agent-omar`, `OMAR-IKL2L`) for demo.
   - Added free sponsor credits to seed shops for demo:
     - TechZone: 1
     - Home Decor Plus: 2

### Conclude Phase 2
- ✅ One full E2E pass (admin + agent + shop) via testing agent: filtering, approvals, badges, agent submission.

---

## Phase 3 — Polish + Written Verification Suggestions

### User stories
1. ✅ As an admin, I can reset filters to “Current month”.
2. ✅ As an admin, charts still match selected period.
3. ✅ As an agent, I get clear feedback on duplicate email (backend already blocks duplicates).
4. ✅ As a shop, I can understand why I have (or don’t have) free sponsor credits.
5. ✅ As a shop owner, I can consider additional verification options beyond ID/email.

### Implementation steps
1. ✅ Added “Reset to current month” control in Finance Center filter bar.
2. ✅ Improved empty/loading handling for timeseries KPIs (uses latest month with activity).
3. ✅ Delivered written verification suggestions:
   - `/app/SHOP_VERIFICATION_SUGGESTIONS.md`
   - Includes 10 methods + rollout order + suggested badge tiers.

### Conclude Phase 3
- ✅ Final regression test sweep: finance filters, approvals, agent refer flow, shop badges.

---

## Next Actions
1. ✅ None — all requested tasks are implemented and verified.
2. Optional future enhancements (not requested):
   - Persist finance/admin dashboard period selection in URL query params.
   - Add export for filtered finance series as CSV.
   - Add dedicated "Agent-Vouched" verification workflow.

---

## Success Criteria
- ✅ Finance Center supports month/year filtering and displays modern analytics/graphs consistent with selected period.
- ✅ Admin Dashboard Monthly Profit updates by selected month/year; Gallery/Agents/Events buttons removed.
- ✅ Approvals grant correct welcome bonuses: non‑referred ($2 + 1 sponsor) vs referred ($3 + 2 sponsors) and copy reflects it everywhere.
- ✅ Shop dashboard and advertising/boost entry points show a clear badge when free sponsor credits > 0.
- ✅ Agent Refer Shop page matches Become‑Seller form and submits full data successfully.
- ✅ Admin Shops page clearly identifies referred shops and supports filtering by referral/agent.
- ✅ Written verification suggestions delivered (no implementation required).

---

## Testing  Results
- ✅ Backend automated testing: **18/18 passed (100%)** — welcome bonus logic, finance filtering/timeseries, agent fill-shop, admin shops referral fields.
- ✅ Frontend automated testing: **45+ cases passed (100%)** — admin dashboard selectors, finance center filters + charts, admin shops badges + filters, agent refer form, shop sponsor badges, become-seller benefits card.
- ✅ Test artifacts cleaned from DB after testing; DB remains with 4 seed shops.
