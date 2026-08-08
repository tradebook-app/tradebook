# Pre-launch fixes: Stripe plan grant, plan detection, Sleek AI gate, subscription error handling

## Summary

Fixes four launch-blocking issues found in the pre-launch audit — all in the billing / entitlement path. No behavior changes for correctly-configured happy paths; these close reliability and revenue gaps.

**8 files, +94 / −31. No schema changes. No new dependencies.**

## Why

- A successful Stripe checkout could **fail to grant the plan** because the webhook couldn't identify the user (session metadata was never set).
- Three separate price→plan mappings could **disagree**, recording Elite buyers as Pro.
- `/api/ai-analysis` (Sleek AI) had **no plan check** — any logged-in user, including free, could call it and run up the AI bill.
- `/api/subscription` **silently returned a free plan on any error**, invisibly downgrading paying users.

## Changes

### 1. Reliable checkout → plan grant
- **`stripe/checkout/route.ts`** — set `client_reference_id` and top-level `metadata.supabase_user_id` on the Checkout Session, so `checkout.session.completed` can map the payment to a user without relying on the browser reaching `/billing`.
- **`stripe/webhook/route.ts`** — `checkout.session.completed` now reads session metadata / `client_reference_id`, and falls back to a lookup by Stripe customer ID if metadata is missing; logs when a user genuinely can't be resolved instead of silently breaking.

### 2. One plan-detection source of truth
- **`lib/stripe.ts`** — new `planForPriceId()` that maps a price ID to `'pro' | 'elite' | 'free'` from the `NEXT_PUBLIC_STRIPE_*` env vars, logging any unrecognized ID.
- **`stripe/webhook/route.ts`** — removed the hardcoded `PRICE_TO_PLAN` / `getPlan()`; both handlers use `planForPriceId()`.
- **`stripe/sync/route.ts`** — removed its separate `detectPlan()` (which had no env fallback and mislabeled Elite as Pro); now uses `planForPriceId()`. Checkout, webhook, and sync can no longer disagree.

### 3. Gate Sleek AI to Pro+ (server-side)
- **`ai-analysis/route.ts`** — after auth, loads the user's plan and returns **403** unless `pro` or `elite`. Matches the tier the in-app support assistant already advertises.

### 4. Stop silent downgrades of paying users
- **`subscription/route.ts`** — error path now logs and returns **500** instead of `{ plan: 'free' }` + 200.
- **`PlanProvider.tsx`** — on a non-OK response, keeps the last-known plan instead of dropping to free on a transient failure.

### Housekeeping
- **`.env.local.example`** — expanded from 3 to all 21 required variables (grouped/commented); replaced the previously-committed real Supabase URL + publishable key with blanks.

## ⚠️ Required before / at merge (config, not code)

- [ ] In **Stripe live mode → Products**, confirm the 4 price IDs (Pro monthly/yearly, Elite monthly/yearly) exactly match the `NEXT_PUBLIC_STRIPE_*` values in **Vercel Production**. The code unifies the mapping; the IDs themselves must be the live ones.
- [ ] Confirm all 21 vars from `.env.local.example` exist in **Vercel Production**. Any `NEXT_PUBLIC_*` change needs a fresh build, not a cached redeploy.

## Test plan

- [ ] Run one real test-mode checkout → `profiles.plan` and `subscription_status` flip to active **without** depending on the `/billing` redirect completing.
- [ ] Complete an Elite checkout → profile records `elite` (not `pro`).
- [ ] Call `/api/ai-analysis` as a free user → **403**; as a Pro user → works.
- [ ] Temporarily force `/api/subscription` to error → paying user's plan is retained in the UI (not downgraded to free), and the error is logged.
- [ ] Cancel a subscription → access downgrades to free.

## Out of scope (follow-ups)

- Optional per-day rate cap on `/api/ai-analysis` (deferred — shipping core fixes first).
- Real-file P&L verification per broker/asset type (Webull options first) — a testing task, tracked separately.
- Other audit nice-to-fixes (silent catches, `handle_new_user` SECURITY DEFINER, duplicate-email signup UX, newsletter settings toggle).
