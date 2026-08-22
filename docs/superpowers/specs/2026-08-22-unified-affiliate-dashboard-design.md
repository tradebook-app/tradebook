# Unified Affiliate Dashboard — Design

**Date:** 2026-08-22
**Status:** Approved design, pending implementation plan

## Goal

Replace the current bare list-and-form `/admin/partners` page with a proper dashboard (summary cards, two charts, a unified partner table with inline edit/remove), and upgrade the partner-facing `/referrals` page to visually match it with a card+chart layout scoped strictly to that partner's own data.

## Context: what already exists

- `/admin/partners` (`src/app/admin/partners/page.tsx`): a standalone, hardcoded-dark admin page (own inline styles, `#0D0D11` background, no light/dark theming, not wrapped in the main app shell). Currently: an "Assign partner" form, an active-partner count line, and a flat list of partner rows (click to expand a ledger table), each with an "Edit" button that opens an inline form (rate %, start/end date, Save/Remove) built in the partner edit/cancel feature (merged, PR #4).
- `GET /api/referrals/admin/partners` currently returns `{ partners: [{ id, name, code, rate, months, windowStart, windowEnd, signups, grossTotal, commissionTotal, owed, paid }] }` — one row per `is_partner = true` profile.
- `PATCH /api/referrals/admin/partners/[id]` already handles both "edit terms" (`{commission_rate, commission_window_start, commission_window_end}`) and "remove partner" (`{is_partner: false}`) — unchanged by this feature.
- `/referrals` (component `src/components/ReferralsPage.tsx`, route registered in `AppProvider.tsx`): lives inside the main app shell, themed via CSS custom properties (`var(--bg2)`, etc.) that respond to the app's light/dark toggle. Already has 4 stat cards (referred signups, pending, available, paid) and a commission-history table. Backed by `GET /api/referrals/me`, which is session-scoped (`auth.uid()`) and already returns that user's full `commissions` array plus `isPartner`/`commissionWindowEnd` (added in the edit/cancel feature's final-review fix pass).
- Chart infrastructure already exists and requires no new dependency: `chart.js` + `react-chartjs-2` are installed; `src/lib/chartTheme.ts` exports `getChartColors()` (reads the live `--txt3`/`--bg4`/`--brd2`/`--txt2`/`--txt` CSS custom properties, theme-reactive) and `useThemeVersion()` (re-renders a chart when the `data-theme` attribute changes). Existing chart components (`src/components/dashboard/CumulativeChart.tsx` — line, `DailyPnlChart.tsx` — bar) both follow the same pattern: a `<canvas>` ref, a `useEffect` that builds/destroys a `Chart` instance, `getChartColors()` for all color values, `useThemeVersion()` in the effect's dependency array.
- `referral_commissions` rows are immutable once written, tagged `program: 'friend' | 'partner'`, with `commission_amount` already negative on a refund-reversal row (`reversal_of` set) — summing this column nets out reversals automatically.

## Decisions (locked with owner)

1. **Trend-chart data is server-computed and folded into the existing rollup endpoint** (not a new endpoint, not a client-side bucketing of raw rows shipped to the browser). `GET /api/referrals/admin/partners` gains one new field on its existing response.
2. **Admin dashboard charts/cards use a fixed dark palette**, not `getChartColors()`. The admin page never switches themes (no `data-theme` toggle anywhere in it), so a theme-reactive helper would silently mismatch its hardcoded-dark background if the operator's browser/app-wide theme preference is ever "light." "Match the admin dashboard's style" on the partner-facing page means the same card/chart *layout shape*, not identical color literals — that page must stay theme-reactive since it lives in the main themed app shell.
3. **The existing row-click-to-expand-ledger behavior is preserved** in the new table, as an expandable detail row — not removed, not asked about further (a low-risk default, easy to redirect on if wrong).
4. **"Top partners by revenue" shows only currently-active partners** (`is_partner = true`, i.e. exactly the rows already in the rollup array) — not a separate all-time/historical query including removed partners. Same data source as the table below it.
5. **The growing admin page is split into focused components** (stat cards, trend chart, top-partners chart, table), each in `src/components/admin/`, rather than kept as one large inline file — the existing edit/remove logic moves into the new table component largely as-is.
6. **No backend change for the partner-facing page.** Its new chart buckets the already-returned `commissions` array by month in the browser — that array is per-user and small, unlike the admin rollup which spans all partners.

## Data model

No schema changes. No new tables or columns.

### `GET /api/referrals/admin/partners` — response addition

Adds `monthlyTrend: { month: string, commission: number }[]` to the existing response object, alongside the unchanged `partners` array.

- Computed by querying `referral_commissions` where `program = 'partner'`, grouping by the UTC calendar month of `created_at` (`YYYY-MM`), summing `commission_amount` per group.
- Sorted ascending by month. No row-count limit — this is a low-volume ledger (the whole table has historically had single-digit rows across all verification/testing in this project).
- A month with zero partner-program activity is simply absent from the array (no zero-filled gaps) — the chart component is responsible for deciding how to render sparse data, not the API.
- This query is independent of a profile's *current* `is_partner` flag — it reflects the ledger's own `program` tag at write time, so a partner later reverted to friend status still contributes their historical months to this trend (this is the ledger's existing immutability property, already relied on elsewhere; it is *not* the same scoping as decision 4 above, which only governs the bar chart / table, not this trend line).

## Admin dashboard (`/admin/partners`)

### File structure

- `src/app/admin/partners/page.tsx` — page shell: fetches `GET /api/referrals/admin/partners` once (existing `loadPartners()` pattern, unchanged trigger points), holds the existing "Assign partner" form and its state, renders the four pieces below in order, passes `partners`/`monthlyTrend` down as props.
- `src/components/admin/PartnerStatCards.tsx` — pure presentational component. Props: `partners: Partner[]`. Renders 4 cards: active partners (`partners.length`), total referred signups (`sum of signups`), total owed now (`sum of owed`), total paid out (`sum of paid`). Fixed dark palette matching the page's existing hex values.
- `src/components/admin/PartnerTrendChart.tsx` — props: `monthlyTrend: { month: string, commission: number }[]`. Chart.js line chart (same library/pattern as `CumulativeChart.tsx`, adapted to a fixed dark palette instead of `getChartColors()`). X-axis: month labels. Y-axis: `$` commission amount. Empty-state message when `monthlyTrend` is empty, matching the existing "No closed trades yet" empty-state convention.
- `src/components/admin/TopPartnersChart.tsx` — props: `partners: Partner[]`. Chart.js bar chart, partners sorted by `grossTotal` descending, top 10 (or fewer if fewer exist). Fixed dark palette. Empty-state message when `partners` is empty.
- `src/components/admin/PartnerTable.tsx` — props: `partners: Partner[]`, `onChanged: () => void` (callback to trigger the page shell's `loadPartners()` after a successful edit/remove). Owns the edit-form-open/save/remove state and handlers (ported from the current `page.tsx`'s `openEdit`/`closeEdit`/`saveEdit`/`removePartner`, calling the same unchanged `PATCH` endpoint), and the existing per-row ledger-expand state/fetch (`GET /api/referrals/admin/partners/[id]`, unchanged). Rendered as an actual `<table>`: columns are Partner (name + code), Rate, Date window, Signups, Owed, Actions (Edit/Remove). Clicking a row (outside the Actions cell) expands a detail row showing that partner's ledger, exactly as today.

### Layout order

Heading → existing "Assign partner" form (unchanged position/behavior) → `PartnerStatCards` (4-across row) → `PartnerTrendChart` and `TopPartnersChart` side by side (stacking vertically on narrow viewports) → `PartnerTable`.

## Partner-facing dashboard (`/referrals`, `ReferralsPage.tsx`)

- The existing 4 stat cards are unchanged.
- One new component, `src/components/PartnerEarningsChart.tsx`, rendered between the stat cards and the existing commission-history table — following the codebase's existing convention of factoring canvas/Chart.js logic into its own component file rather than inlining it in the page (matches `CumulativeChart.tsx`, `DailyPnlChart.tsx`). Line chart, same pattern: `getChartColors()`, `useThemeVersion()`, theme-reactive.
- Chart data: the already-fetched `data.commissions` array (from `GET /api/referrals/me`, no backend change), bucketed client-side by UTC calendar month of `created_at`, summing `commission_amount` per month — the same aggregation logic as the admin trend chart, but computed in the browser over one user's already-small row set rather than server-side over the whole ledger.
- No new data isolation work needed: `/api/referrals/me` already scopes every query to `auth.uid()` — this chart cannot see another user's data by construction, same as the rest of the page.
- No payout-marking control is added anywhere on this page — it remains read-only for the partner, exactly as today.

## Testing

- The monthly-bucketing aggregation is extracted as one shared pure function, `bucketMonthlyCommissions(rows: { created_at: string, commission_amount: number }[]): { month: string, commission: number }[]`, added to `src/lib/commission.ts` (the existing home for commission math) and reused by both the server-side trend computation (admin route, filtered to `program = 'partner'` rows before calling it) and the client-side partner-chart bucketing (`ReferralsPage.tsx`, called on the already-fetched `data.commissions` with no pre-filtering needed since that array is already scoped to one user). This avoids duplicating the same grouping/summing logic in two places.
- Gets unit tests in `src/lib/commission.test.ts` following the existing convention: empty input, single month, multiple months in and out of order, sign-preserving sum (a reversal row's negative `commission_amount` nets against its original in the same month).
- No existing automated test coverage exists for either page today (`page.tsx` or `ReferralsPage.tsx`) — this feature does not change that; verification is a manual click-through plus a server-side check of the new `monthlyTrend` field's values against a direct SQL aggregate, consistent with how the edit/cancel feature was verified.

## Out of scope

Self-serve payout marking on the partner page (stays admin-only, unchanged), a dedicated "top partners" view beyond the top-10 bar chart, historical/removed-partner rows appearing in the bar chart or table (only the trend line reflects all-time ledger history), any new chart library or dependency, pagination or date-range filtering on the trend chart, drill-down from the admin trend chart into per-partner detail (the existing per-row ledger expand already covers per-partner detail).
