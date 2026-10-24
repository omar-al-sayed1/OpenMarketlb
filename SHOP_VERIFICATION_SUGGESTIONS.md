# Shop Verification — Additional Methods (Written Suggestions)

You already verify shops via **Email**, **Location**, and **Passport/ID**.
Below are additional, practical methods you can add to raise trust and reduce fraud,
grouped from easiest/highest-impact to advanced. Each item includes *what it is*,
*why it helps*, and *how you could implement it later*.

## 1. Phone / SMS Verification (Quick win)
- **What:** Send a One-Time Password (OTP) by SMS or WhatsApp to the shop's phone.
- **Why:** Confirms a reachable, real Lebanese number; blocks throwaway signups.
- **How:** Twilio / Vonage / a local Lebanese SMS gateway. Store `phone_verified_at`.
  WhatsApp OTP is very effective in Lebanon where WhatsApp usage is near-universal.

## 2. Business / Commercial Registration ("Sijill Tijari")
- **What:** Upload the official commercial registration certificate / business license number.
- **Why:** Proves the shop is a registered legal entity, not just an individual.
- **How:** Document upload + admin manual review, or validate the registration number format.
  Award a distinct **"Registered Business"** badge separate from "Verified".

## 3. Bank Account / Wallet Ownership Check (Micro-deposit / OMT/Whish)
- **What:** Verify the payout account belongs to the shop (small micro-deposit they must confirm,
  or matching the OMT/Whish/bank account holder name to the shop owner).
- **Why:** Ensures money is paid to the legitimate owner; strong anti-fraud signal.
- **How:** Manual name-match at first; later automate via payment-provider name lookup.

## 4. Social Media / Online Presence Verification
- **What:** Ask for the shop's Instagram/Facebook/TikTok page or website, then confirm ownership
  (e.g., the shop temporarily posts a code, or adds the marketplace link in their bio).
- **Why:** Active, established social pages with followers/reviews are hard to fake quickly.
- **How:** Store the handle; admin checks follower count, age of account, and the ownership code.

## 5. Physical Address Proof (Utility Bill / Storefront Photo)
- **What:** Upload a recent utility bill (EDL/water/internet) or a geotagged photo of the storefront
  with today's date / a written code on paper.
- **Why:** Confirms a real operating location beyond GPS coordinates.
- **How:** Document/photo upload + admin review; optionally cross-check against the map pin.

## 6. Live Video / Selfie Verification (Liveness)
- **What:** A short live video call or a selfie holding their ID next to their face.
- **Why:** Defeats stolen-ID fraud by proving the person matches the submitted ID (liveness).
- **How:** Scheduled video call with an admin/agent, or a liveness-check SDK (e.g., Onfido/Veriff).

## 7. Tax / VAT (TVA) Number
- **What:** Collect and validate the shop's VAT/TVA number where applicable.
- **Why:** Adds a layer of formal/financial legitimacy for larger sellers.
- **How:** Field + format validation + manual confirmation.

## 8. Trusted Referral / Agent Vouching
- **What:** A shop referred and vouched for by one of your verified agents gets a head start
  ("Agent-Vouched") and a lighter manual review.
- **Why:** Leverages your existing agent network — agents have reputation at stake.
- **How:** You already capture `referred_by_agent_id`; surface an "Agent Vouched" sub-badge and let
  agents formally confirm they met the owner in person.

## 9. Behaviour & Track-Record Verification (Earned over time)
- **What:** Auto-upgrade trust based on real activity: N successful delivered orders,
  low cancellation/refund rate, positive customer ratings, account age.
- **Why:** Performance is the strongest, hardest-to-fake trust signal.
- **How:** A scoring rule (e.g., "10+ delivered orders, < 5% cancellations, 4.5★+ → Trusted Seller").

## 10. Two-Factor Authentication (2FA) on the Shop Account
- **What:** Require 2FA (authenticator app / SMS) for shop logins and payout changes.
- **Why:** Protects an already-verified shop from account takeover.
- **How:** TOTP (Google Authenticator) on login + step-up auth for withdrawals.

---

### Recommended rollout order
1. **Phone/SMS (WhatsApp) OTP** — fastest, biggest fraud reduction.
2. **Commercial Registration upload** — strong legitimacy for a "Registered Business" badge.
3. **Behaviour/track-record auto-trust** — rewards good sellers automatically.
4. **Bank/payout name-match** — protects the money flow.
5. **Live video / selfie-with-ID** — reserve for high-value or flagged shops.

### Suggested badge tiers (visual trust ladder)
`Email Verified` → `Phone Verified` → `Registered Business` → `Verified Seller (ID + Location)`
→ `Trusted Seller (track record)`. Showing tiers motivates shops to complete more steps.

---

# Part 2 — Even More Verification Methods

## 11. Brand Authorization / Authorized-Reseller Letter (anti-counterfeit)
- **What:** For branded goods, require an authorization letter or distributor invoice proving they can legally sell the brand.
- **Why:** Stops counterfeit/grey-market sellers — a major trust and legal risk.
- **How:** Document upload + admin review; grant an **"Authorized Reseller"** badge per brand.

## 12. Refundable Security Deposit / Bond
- **What:** New shops place a small refundable deposit held in escrow, returned after N clean orders.
- **Why:** Financial skin-in-the-game strongly deters scammers (they won't risk their own money).
- **How:** Charge via wallet/Stripe, hold as `security_deposit`, auto-refund on good standing.

## 13. Escrow / Delayed Payout on First Orders
- **What:** Hold a new shop's payouts until the customer confirms delivery, for the first ~5–10 orders.
- **Why:** Guarantees the shop actually ships before getting paid; kills "take money and disappear" fraud.
- **How:** You already have wallet + payout logic — add a `payout_hold_until_delivered` flag for new shops.

## 14. National ID / Civil Registry Cross-Check
- **What:** Validate the submitted ID number + name against an official source (where an API or manual lookup exists).
- **Why:** Confirms the ID is real and belongs to the applicant, beyond "a document was uploaded."
- **How:** Manual check first; automate later if a Lebanese registry lookup becomes available.

## 15. Third-Party KYC / Identity Provider (automated)
- **What:** Use Stripe Identity, Onfido, Veriff, or Sumsub to run automated ID scan + face liveness.
- **Why:** Bank-grade verification with no manual admin effort; scales as you grow.
- **How:** Redirect the shop to the provider's flow, store the pass/fail result + reference.

## 16. Business Email-Domain Ownership
- **What:** If the shop has a custom email (e.g., `owner@theirshop.com`), verify they control that domain.
- **Why:** A real business domain is far more credible than a free Gmail address.
- **How:** Send a verification link to the domain email, or ask for a DNS TXT record → **"Business Email Verified"** badge.

## 17. Device Fingerprint & Duplicate-Account Detection
- **What:** Fingerprint the device/browser at signup and flag when one person runs many "shops."
- **Why:** Catches serial fraudsters who spin up dozens of fake stores.
- **How:** Use a fingerprinting library (e.g., FingerprintJS); flag shared fingerprints for review.

## 18. Signup IP / Location & VPN Consistency
- **What:** Compare the signup IP geolocation with the claimed shop location; flag VPN/proxy or country mismatches.
- **Why:** A "Beirut" shop signing up from abroad via VPN is a red flag.
- **How:** IP-geo lookup at signup; surface mismatches to admin (flag, don't auto-block).

## 19. Disposable-Email & Fraud-List Screening
- **What:** Reject temp/disposable email domains and screen email/phone against known fraud/breach lists.
- **Why:** Blocks throwaway identities before they ever reach manual review.
- **How:** Maintain a disposable-domain blocklist; optionally use an email-reputation API.

## 20. In-Person Agent Store Visit (physical audit)
- **What:** An agent physically visits the shop, photographs the storefront + real inventory, and signs off.
- **Why:** The strongest possible proof the business physically exists with real stock.
- **How:** Add a "Store Visit" report to the agent flow (photos + GPS + signature) → **"Physically Verified"** badge.

## 21. Anti-Stock-Photo: Timestamped Watermark on Product Photos
- **What:** Require some product photos to include a handwritten slip with the marketplace name + today's date.
- **Why:** Prevents sellers from stealing catalog/stock images for products they don't actually have.
- **How:** Admin spot-checks the slip, or require it for a shop's first batch of listings.

## 22. Periodic Re-Verification & Expiry
- **What:** Verification expires after 6–12 months and must be renewed.
- **Why:** Prevents stale, abandoned, or later-hijacked accounts from keeping a trusted badge forever.
- **How:** Store `verified_until`; prompt re-verification and downgrade the badge if it lapses.

## 23. Tiered Limits + Step-Up Verification
- **What:** Unverified/low-tier shops are capped on order value, daily orders, or payout amount until they complete more checks.
- **Why:** Limits the damage a fraudulent shop can do while letting honest shops start quickly.
- **How:** Gate limits on the verification tier; unlock more as each method is completed.

### Where these fit
- **Cheap + high impact (do early):** #16 business email, #18 IP/VPN flag, #19 disposable-email screening, #23 tiered limits.
- **Strongest anti-fraud (money/identity):** #12 deposit, #13 escrow payout, #15 KYC provider, #20 agent store visit.
- **Keeps the system honest over time:** #22 periodic re-verification.
