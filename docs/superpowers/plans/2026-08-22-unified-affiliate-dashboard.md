# Unified Affiliate Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/admin/partners`'s bare list with a dashboard (stat cards, two charts, a unified table with inline edit/remove), and add a matching earnings chart to the partner-facing `/referrals` page — using the chart.js infrastructure already in this codebase.

**Architecture:** One new pure aggregation function shared by both a server-side route (admin trend) and a client-side component (partner's own trend). The admin page is split into four focused components under `src/components/admin/`, replacing its single-file layout; the existing edit/remove logic is carried over into the new table component unchanged in behavior. The partner-facing page gains one new chart component reusing the app's existing theme-reactive chart pattern.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase, `chart.js` + `react-chartjs-2` (already installed, no new dependency), Vitest.

## Global Constraints

- No new npm dependency — `chart.js`/`react-chartjs-2` are already installed and used elsewhere in this codebase.
- Admin dashboard components use a **fixed dark palette** (literal hex values matching the page's existing `#0D0D11`/`#888`/`#222`/`#10B981`/`#ef4444` convention) — never `src/lib/chartTheme.ts`'s `getChartColors()`, since the admin page never switches themes and that helper reads the *live* app-wide theme.
- The partner-facing page's new chart **does** use `getChartColors()`/`useThemeVersion()` from `src/lib/chartTheme.ts` — that page lives in the theme-reactive main app shell.
- The existing `PATCH /api/referrals/admin/partners/[id]` and `GET /api/referrals/admin/partners/[id]` endpoints are unchanged by this plan — only their calling code moves to a new component.
- "Top partners by revenue" and the 4 summary cards are computed **client-side** from the existing `partners` rollup array — no new fields needed for those two pieces.
- The trend chart's data reflects **all `program = 'partner'` ledger rows regardless of a profile's current `is_partner` flag** — it is not scoped to only currently-active partners (unlike the bar chart and table, which are).
- Month buckets use the UTC calendar month of `created_at`; a month with no rows is simply absent from the array (no zero-filled gaps).

---

## File Structure

| File | Change |
|---|---|
| `src/lib/commission.ts` | Modify — add `bucketMonthlyCommissions` |
| `src/lib/commission.test.ts` | Modify — tests for it |
| `src/app/api/referrals/admin/partners/route.ts` | Modify — `GET` gains `monthlyTrend` |
| `src/app/admin/partners/types.ts` | Create — shared `Partner`/`LedgerRow`/`MonthlyBucket` types |
| `src/components/admin/PartnerStatCards.tsx` | Create |
| `src/components/admin/PartnerTrendChart.tsx` | Create |
| `src/components/admin/TopPartnersChart.tsx` | Create |
| `src/components/admin/PartnerTable.tsx` | Create |
| `src/app/admin/partners/page.tsx` | Modify — replaced with the assembled dashboard |
| `src/components/PartnerEarningsChart.tsx` | Create |
| `src/components/ReferralsPage.tsx` | Modify — renders the new chart |

---

### Task 1: `bucketMonthlyCommissions` pure function

**Files:**
- Modify: `src/lib/commission.ts`
- Test: `src/lib/commission.test.ts`

**Interfaces:**
- Produces: `bucketMonthlyCommissions(rows: { created_at: string, commission_amount: number }[]): { month: string, commission: number }[]`, imported by Task 2 (server) and Task 7 (client).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/commission.test.ts` (new `describe` block, after the existing `isWithinAbsoluteWindow` block), and add `bucketMonthlyCommissions` to the existing import line:

```ts
import { computeCommission, isWithinAbsoluteWindow, isWithinCommissionWindow, bucketMonthlyCommissions } from './commission'
```

```ts
describe('bucketMonthlyCommissions', () => {
  it('returns an empty array for no rows', () => {
    expect(bucketMonthlyCommissions([])).toEqual([])
  })
  it('buckets a single row into its month', () => {
    expect(bucketMonthlyCommissions([
      { created_at: '2026-03-15T10:00:00.000Z', commission_amount: 12.5 },
    ])).toEqual([{ month: '2026-03', commission: 12.5 }])
  })
  it('sums multiple rows in the same month', () => {
    expect(bucketMonthlyCommissions([
      { created_at: '2026-03-01T00:00:00.000Z', commission_amount: 10 },
      { created_at: '2026-03-28T23:59:59.000Z', commission_amount: 5 },
    ])).toEqual([{ month: '2026-03', commission: 15 }])
  })
  it('sorts months ascending regardless of input order', () => {
    expect(bucketMonthlyCommissions([
      { created_at: '2026-05-01T00:00:00.000Z', commission_amount: 1 },
      { created_at: '2026-01-01T00:00:00.000Z', commission_amount: 2 },
      { created_at: '2026-03-01T00:00:00.000Z', commission_amount: 3 },
    ])).toEqual([
      { month: '2026-01', commission: 2 },
      { month: '2026-03', commission: 3 },
      { month: '2026-05', commission: 1 },
    ])
  })
  it('nets a same-month reversal against its original', () => {
    expect(bucketMonthlyCommissions([
      { created_at: '2026-06-01T00:00:00.000Z', commission_amount: 20 },
      { created_at: '2026-06-10T00:00:00.000Z', commission_amount: -20 },
    ])).toEqual([{ month: '2026-06', commission: 0 }])
  })
  it('rounds to the nearest cent', () => {
    expect(bucketMonthlyCommissions([
      { created_at: '2026-07-01T00:00:00.000Z', commission_amount: 1.111 },
      { created_at: '2026-07-02T00:00:00.000Z', commission_amount: 1.111 },
    ])).toEqual([{ month: '2026-07', commission: 2.22 }])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- commission.test.ts`
Expected: FAIL — `bucketMonthlyCommissions is not a function` (or a TypeScript import error).

- [ ] **Step 3: Implement the function**

Add to `src/lib/commission.ts`, after `computeCommission`:

```ts
// Groups commission rows by the UTC calendar month of `created_at`
// (YYYY-MM), summing `commission_amount` per month. A reversal row's
// commission_amount is already negative, so a reversal in the same month
// as its original nets out automatically -- no special-casing needed.
// Sorted ascending by month; a month with no rows is simply absent (no
// zero-filled gaps) -- callers decide how to render sparse data.
export function bucketMonthlyCommissions(
  rows: { created_at: string; commission_amount: number }[]
): { month: string; commission: number }[] {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const d = new Date(row.created_at)
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    totals.set(month, (totals.get(month) || 0) + Number(row.commission_amount))
  }
  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, commission]) => ({ month, commission: round2(commission) }))
}
```

`round2` already exists in this file (used by `computeCommission`) — no new helper needed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- commission.test.ts`
Expected: PASS — all tests including every pre-existing suite in this file.

- [ ] **Step 5: Commit**

```bash
git add src/lib/commission.ts src/lib/commission.test.ts
git commit -m "feat: add bucketMonthlyCommissions for affiliate dashboard trend charts"
```

---

### Task 2: `GET /api/referrals/admin/partners` — add `monthlyTrend`

**Files:**
- Modify: `src/app/api/referrals/admin/partners/route.ts`

**Interfaces:**
- Consumes: `bucketMonthlyCommissions` from Task 1 (`src/lib/commission.ts`).
- Produces: the `GET` response gains `monthlyTrend: { month: string, commission: number }[]`, consumed by Task 6's `page.tsx` and passed to `PartnerTrendChart` (Task 4).

- [ ] **Step 1: Add the import**

At the top of `src/app/api/referrals/admin/partners/route.ts`, change:

```ts
import { adminClient } from '@/lib/referrals'
```

to:

```ts
import { adminClient } from '@/lib/referrals'
import { bucketMonthlyCommissions } from '@/lib/commission'
```

- [ ] **Step 2: Query all partner-program ledger rows and bucket them**

In the `GET` handler, after the existing `referredCounts` query and before `const now = Date.now()`, add:

```ts
  // Independent of partnerIds/is_partner: this trend reflects the ledger's
  // own program tag at write time, so a partner later reverted to friend
  // status still contributes their historical months here.
  const { data: partnerLedger } = await admin
    .from('referral_commissions')
    .select('created_at, commission_amount')
    .eq('program', 'partner')

  const monthlyTrend = bucketMonthlyCommissions(partnerLedger || [])
```

- [ ] **Step 3: Return it**

Change:

```ts
  return NextResponse.json({ partners: result })
```

to:

```ts
  return NextResponse.json({ partners: result, monthlyTrend })
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/referrals/admin/partners/route.ts
git commit -m "feat: add monthly commission trend to admin partners rollup"
```

---

### Task 3: Shared types + `PartnerStatCards`

**Files:**
- Create: `src/app/admin/partners/types.ts`
- Create: `src/components/admin/PartnerStatCards.tsx`

**Interfaces:**
- Produces: `Partner`, `LedgerRow`, `MonthlyBucket` types (imported by Tasks 4, 5, 6); `PartnerStatCards({ partners: Partner[] })` component (imported by Task 6).

- [ ] **Step 1: Create the shared types file**

```ts
// src/app/admin/partners/types.ts
export type Partner = {
  id: string
  name: string
  code: string | null
  rate: number
  months: number
  windowStart: string | null
  windowEnd: string | null
  signups: number
  grossTotal: number
  commissionTotal: number
  owed: number
  paid: number
}

export type LedgerRow = {
  id: string
  stripe_invoice_id: string
  gross_amount: number
  commission_amount: number
  status: string
  program: string
  reversal_of: string | null
  available_at: string
  paid_at: string | null
  created_at: string
}

export type MonthlyBucket = { month: string; commission: number }
```

- [ ] **Step 2: Create `PartnerStatCards`**

```tsx
// src/components/admin/PartnerStatCards.tsx
import type { Partner } from '@/app/admin/partners/types'

const usd = (n: number) => `$${Number(n).toFixed(2)}`

type Props = { partners: Partner[] }

export function PartnerStatCards({ partners }: Props) {
  const totalSignups = partners.reduce((s, p) => s + p.signups, 0)
  const totalOwed = partners.reduce((s, p) => s + p.owed, 0)
  const totalPaid = partners.reduce((s, p) => s + p.paid, 0)

  const card = (label: string, value: string) => (
    <div style={{ background: '#15151a', border: '1px solid #222', borderRadius: '10px', padding: '16px', flex: 1, minWidth: '160px' }}>
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>{value}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
      {card('Active partners', String(partners.length))}
      {card('Total referred signups', String(totalSignups))}
      {card('Total owed now', usd(totalOwed))}
      {card('Total paid out', usd(totalPaid))}
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/partners/types.ts src/components/admin/PartnerStatCards.tsx
git commit -m "feat: add shared partner types and stat cards component"
```

---

### Task 4: `PartnerTrendChart`

**Files:**
- Create: `src/components/admin/PartnerTrendChart.tsx`

**Interfaces:**
- Consumes: `MonthlyBucket` type from Task 3 (`src/app/admin/partners/types.ts`).
- Produces: `PartnerTrendChart({ monthlyTrend: MonthlyBucket[] })` component, imported by Task 6.

- [ ] **Step 1: Create the component**

```tsx
// src/components/admin/PartnerTrendChart.tsx
'use client'
import { useEffect, useRef } from 'react'
import {
  Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale,
  Filler, Tooltip, Legend, type ChartConfiguration,
} from 'chart.js'
import type { MonthlyBucket } from '@/app/admin/partners/types'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

// Fixed dark palette, not chartTheme.ts's getChartColors() -- this admin
// page never switches themes, so a theme-reactive helper would mismatch
// its hardcoded-dark background if the app-wide theme is ever "light".
const COLORS = {
  grid: 'rgba(255,255,255,.06)',
  tick: '#888',
  tooltipBg: '#1a1a1f',
  tooltipBorder: '#333',
  tooltipTitle: '#888',
  tooltipBody: '#fff',
  line: '#10B981',
  fill: 'rgba(16,185,129,.08)',
}

type Props = { monthlyTrend: MonthlyBucket[] }

export function PartnerTrendChart({ monthlyTrend }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!ref.current || monthlyTrend.length === 0) return
    chartRef.current?.destroy()
    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: monthlyTrend.map(m => m.month),
        datasets: [{
          data: monthlyTrend.map(m => m.commission),
          borderColor: COLORS.line,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: COLORS.line,
          fill: true,
          backgroundColor: COLORS.fill,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: COLORS.tooltipBg,
            borderColor: COLORS.tooltipBorder,
            borderWidth: 1,
            titleColor: COLORS.tooltipTitle,
            bodyColor: COLORS.tooltipBody,
            callbacks: { label: ctx => ` $${Number(ctx.parsed.y).toFixed(2)}` },
          },
        },
        scales: {
          x: { grid: { color: COLORS.grid }, ticks: { color: COLORS.tick, font: { size: 9 } } },
          y: {
            grid: { color: COLORS.grid },
            ticks: { color: COLORS.tick, font: { size: 9 }, callback: v => `$${Number(v).toFixed(0)}` },
          },
        },
      },
    }
    chartRef.current = new Chart(ref.current, config)
    return () => chartRef.current?.destroy()
  }, [monthlyTrend])

  if (monthlyTrend.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#888', fontSize: '11px', background: '#15151a', border: '1px solid #222', borderRadius: '10px', flex: 1, minWidth: '280px' }}>
        No partner commissions yet
      </div>
    )
  }

  return (
    <div style={{ background: '#15151a', border: '1px solid #222', borderRadius: '10px', padding: '16px', flex: 1, minWidth: '280px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>Commission earnings over time</div>
      <canvas ref={ref} style={{ width: '100%', height: '200px' }} />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/PartnerTrendChart.tsx
git commit -m "feat: add partner commission trend chart"
```

---

### Task 5: `TopPartnersChart`

**Files:**
- Create: `src/components/admin/TopPartnersChart.tsx`

**Interfaces:**
- Consumes: `Partner` type from Task 3 (`src/app/admin/partners/types.ts`).
- Produces: `TopPartnersChart({ partners: Partner[] })` component, imported by Task 6.

- [ ] **Step 1: Create the component**

```tsx
// src/components/admin/TopPartnersChart.tsx
'use client'
import { useEffect, useRef } from 'react'
import {
  Chart, BarController, BarElement, LinearScale, CategoryScale, Tooltip, type ChartConfiguration,
} from 'chart.js'
import type { Partner } from '@/app/admin/partners/types'

Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip)

const COLORS = {
  grid: 'rgba(255,255,255,.06)',
  tick: '#888',
  tooltipBg: '#1a1a1f',
  tooltipBorder: '#333',
  tooltipTitle: '#888',
  tooltipBody: '#fff',
  bar: 'rgba(16,185,129,.7)',
  barBorder: '#10B981',
}

type Props = { partners: Partner[] }

export function TopPartnersChart({ partners }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    const top = [...partners].sort((a, b) => b.grossTotal - a.grossTotal).slice(0, 10)
    if (!ref.current || top.length === 0) return
    chartRef.current?.destroy()
    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: top.map(p => p.name),
        datasets: [{
          data: top.map(p => p.grossTotal),
          backgroundColor: COLORS.bar,
          borderColor: COLORS.barBorder,
          borderWidth: 1,
          borderRadius: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: COLORS.tooltipBg,
            borderColor: COLORS.tooltipBorder,
            borderWidth: 1,
            titleColor: COLORS.tooltipTitle,
            bodyColor: COLORS.tooltipBody,
            callbacks: { label: ctx => ` $${Number(ctx.parsed.y).toFixed(2)}` },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: COLORS.tick, font: { size: 9 } } },
          y: {
            grid: { color: COLORS.grid },
            ticks: { color: COLORS.tick, font: { size: 9 }, callback: v => `$${Number(v).toFixed(0)}` },
          },
        },
      },
    }
    chartRef.current = new Chart(ref.current, config)
    return () => chartRef.current?.destroy()
  }, [partners])

  const top = [...partners].sort((a, b) => b.grossTotal - a.grossTotal).slice(0, 10)
  if (top.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#888', fontSize: '11px', background: '#15151a', border: '1px solid #222', borderRadius: '10px', flex: 1, minWidth: '280px' }}>
        No partners yet
      </div>
    )
  }

  return (
    <div style={{ background: '#15151a', border: '1px solid #222', borderRadius: '10px', padding: '16px', flex: 1, minWidth: '280px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>Top partners by revenue generated</div>
      <canvas ref={ref} style={{ width: '100%', height: '200px' }} />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/TopPartnersChart.tsx
git commit -m "feat: add top-partners-by-revenue bar chart"
```

---

### Task 6: `PartnerTable` + assemble the dashboard page

**Files:**
- Create: `src/components/admin/PartnerTable.tsx`
- Modify: `src/app/admin/partners/page.tsx` (full replacement)

**Interfaces:**
- Consumes: `Partner`, `LedgerRow`, `MonthlyBucket` types from Task 3; `PartnerStatCards` from Task 3; `PartnerTrendChart` from Task 4; `TopPartnersChart` from Task 5.
- Produces: `PartnerTable({ partners: Partner[], onChanged: () => void })` component.

- [ ] **Step 1: Create `PartnerTable`**

```tsx
// src/components/admin/PartnerTable.tsx
'use client'
import { useState, Fragment } from 'react'
import type { Partner, LedgerRow } from '@/app/admin/partners/types'

function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

const usd = (n: number) => `$${Number(n).toFixed(2)}`

type Props = { partners: Partner[]; onChanged: () => void }

export function PartnerTable({ partners, onChanged }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRate, setEditRate] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  function toggleSelected(id: string) {
    const next = id === selected ? null : id
    setSelected(next)
    if (!next) { setLedger(null); return }
    fetch(`/api/referrals/admin/partners/${next}`)
      .then(r => r.json())
      .then(json => setLedger(json.ledger))
  }

  function openEdit(p: Partner, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingId(p.id)
    setEditRate(String(Math.round(p.rate * 100)))
    setEditStart(toDateInputValue(p.windowStart))
    setEditEnd(toDateInputValue(p.windowEnd))
    setEditError(null)
  }

  function closeEdit(e?: React.MouseEvent) {
    e?.stopPropagation()
    setEditingId(null)
    setEditError(null)
  }

  async function saveEdit(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setEditError(null)
    const ratePct = Number(editRate)
    if (!editStart || !editEnd || Number.isNaN(ratePct) || ratePct <= 0 || ratePct > 100) {
      setEditError('Enter a rate between 1-100 and both dates.')
      return
    }
    setEditSaving(true)
    const res = await fetch(`/api/referrals/admin/partners/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commission_rate: ratePct / 100,
        commission_window_start: `${editStart}T00:00:00.000Z`,
        commission_window_end: `${editEnd}T23:59:59.999Z`,
      }),
    })
    setEditSaving(false)
    if (!res.ok) {
      let json: { error?: string } = {}
      try { json = await res.json() } catch { /* non-JSON error response */ }
      setEditError(json.error || 'Failed to save changes')
      return
    }
    setEditingId(null)
    onChanged()
  }

  async function removePartner(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Remove this partner? They revert to standard friend terms (20% for 6 months on future referrals). Their vanity code and past commissions are kept.')) {
      return
    }
    setEditSaving(true)
    const res = await fetch(`/api/referrals/admin/partners/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_partner: false }),
    })
    setEditSaving(false)
    if (!res.ok) {
      let json: { error?: string } = {}
      try { json = await res.json() } catch { /* non-JSON error response */ }
      setEditError(json.error || 'Failed to remove partner')
      return
    }
    setEditingId(null)
    if (selected === id) setSelected(null)
    onChanged()
  }

  if (partners.length === 0) {
    return <div style={{ color: '#888', fontSize: '13px' }}>No partners yet.</div>
  }

  return (
    <div style={{ border: '1px solid #222', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '640px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #222' }}>
              <th style={{ textAlign: 'left', padding: '12px 16px', color: '#888', fontWeight: 600 }}>Partner</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', color: '#888', fontWeight: 600 }}>Rate</th>
              <th style={{ textAlign: 'left', padding: '12px 16px', color: '#888', fontWeight: 600 }}>Date window</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', color: '#888', fontWeight: 600 }}>Signups</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', color: '#888', fontWeight: 600 }}>Owed</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', color: '#888', fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {partners.map(p => (
              <Fragment key={p.id}>
                <tr
                  onClick={() => toggleSelected(p.id)}
                  style={{ borderBottom: '1px solid #222', cursor: 'pointer', background: selected === p.id ? '#15151a' : 'transparent' }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>{p.name} — {p.code}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>{(p.rate * 100).toFixed(0)}%</td>
                  <td style={{ padding: '12px 16px', color: '#888' }}>
                    {p.windowStart && p.windowEnd
                      ? `${new Date(p.windowStart).toLocaleDateString('en-US', { timeZone: 'UTC' })} – ${new Date(p.windowEnd).toLocaleDateString('en-US', { timeZone: 'UTC' })}`
                      : 'No window set'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>{p.signups}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{usd(p.owed)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={e => openEdit(p, e)}
                      style={{ background: '#1a1a1f', color: '#fff', border: '1px solid #333', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>

                {editingId === p.id && (
                  <tr>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ padding: '14px 16px', background: '#0a0a0d', borderBottom: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '10px' }}
                      >
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <label style={{ fontSize: '11px', color: '#888' }}>
                            Rate %
                            <input
                              type="number" min={1} max={100} step={1}
                              value={editRate} onChange={e => setEditRate(e.target.value)}
                              style={{ display: 'block', width: '80px', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
                            />
                          </label>
                          <label style={{ fontSize: '11px', color: '#888' }}>
                            Start date
                            <input
                              type="date" value={editStart} onChange={e => setEditStart(e.target.value)}
                              style={{ display: 'block', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
                            />
                          </label>
                          <label style={{ fontSize: '11px', color: '#888' }}>
                            End date
                            <input
                              type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                              style={{ display: 'block', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
                            />
                          </label>
                        </div>
                        {editError && <div style={{ color: '#ef4444', fontSize: '12px' }}>{editError}</div>}
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button disabled={editSaving} onClick={e => saveEdit(p.id, e)} style={{ background: '#10B981', color: '#000', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                            Save changes
                          </button>
                          <button onClick={closeEdit} style={{ background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
                            Cancel
                          </button>
                          <button disabled={editSaving} onClick={e => removePartner(p.id, e)} style={{ marginLeft: 'auto', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
                            Remove partner
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {selected === p.id && ledger && (
                  <tr>
                    <td colSpan={6} style={{ padding: '14px 16px', background: '#0a0a0d', borderBottom: '1px solid #222' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #222' }}>
                            <th style={{ textAlign: 'left', padding: '8px', color: '#888' }}>Date</th>
                            <th style={{ textAlign: 'left', padding: '8px', color: '#888' }}>Program</th>
                            <th style={{ textAlign: 'right', padding: '8px', color: '#888' }}>Gross</th>
                            <th style={{ textAlign: 'right', padding: '8px', color: '#888' }}>Commission</th>
                            <th style={{ textAlign: 'right', padding: '8px', color: '#888' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledger.map(row => (
                            <tr key={row.id} style={{ borderBottom: '1px solid #1a1a1f' }}>
                              <td style={{ padding: '8px' }}>{new Date(row.created_at).toLocaleDateString()}</td>
                              <td style={{ padding: '8px' }}>{row.program}{row.reversal_of ? ' (refund)' : ''}</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>{usd(row.gross_amount)}</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>{usd(row.commission_amount)}</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>{row.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `page.tsx`**

Replace the entire contents of `src/app/admin/partners/page.tsx` with:

```tsx
'use client'

import { useState, useEffect } from 'react'
import type { Partner, MonthlyBucket } from './types'
import { PartnerStatCards } from '@/components/admin/PartnerStatCards'
import { PartnerTrendChart } from '@/components/admin/PartnerTrendChart'
import { TopPartnersChart } from '@/components/admin/TopPartnersChart'
import { PartnerTable } from '@/components/admin/PartnerTable'

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[] | null>(null)
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyBucket[]>([])
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [formMessage, setFormMessage] = useState<string | null>(null)

  function loadPartners() {
    setError(null)
    fetch('/api/referrals/admin/partners')
      .then(async r => {
        if (!r.ok) { const j = await r.json(); throw new Error(j.error || 'Failed to load') }
        return r.json()
      })
      .then(json => {
        setPartners(json.partners)
        setMonthlyTrend(json.monthlyTrend || [])
      })
      .catch(err => setError(err.message))
  }

  useEffect(() => { loadPartners() }, [])

  async function createPartner(e: React.FormEvent) {
    e.preventDefault()
    setFormMessage(null)
    const res = await fetch('/api/referrals/admin/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    const json = await res.json()
    if (!res.ok) {
      setFormMessage(json.error || 'Failed to create partner')
      return
    }
    setFormMessage(`${email} is now a partner with code "${json.code}".`)
    setEmail('')
    setCode('')
    loadPartners()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D11', color: '#fff', padding: '40px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>Affiliate Partners</h1>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>
          Partners earn a custom rate for a custom date range, set per-partner below (vs. the standard 20%/6-month friend program).
        </p>

        <form onSubmit={createPartner} style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <input
            placeholder="Partner's account email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ flex: 1, minWidth: '220px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
          />
          <input
            placeholder="vanity-code"
            value={code}
            onChange={e => setCode(e.target.value)}
            style={{ width: '160px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #333', background: '#1a1a1f', color: '#fff' }}
          />
          <button type="submit" style={{ background: '#10B981', color: '#000', border: 'none', borderRadius: '6px', padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}>
            Assign partner
          </button>
        </form>
        {formMessage && <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '24px' }}>{formMessage}</div>}

        {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>Error: {error}</div>}

        {!partners ? (
          <div style={{ color: '#888', fontSize: '13px' }}>Loading...</div>
        ) : (
          <>
            <PartnerStatCards partners={partners} />
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
              <PartnerTrendChart monthlyTrend={monthlyTrend} />
              <TopPartnersChart partners={partners} />
            </div>
            <PartnerTable partners={partners} onChanged={loadPartners} />
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/PartnerTable.tsx src/app/admin/partners/page.tsx
git commit -m "feat: assemble unified affiliate admin dashboard"
```

---

### Task 7: Partner-facing earnings chart

**Files:**
- Create: `src/components/PartnerEarningsChart.tsx`
- Modify: `src/components/ReferralsPage.tsx`

**Interfaces:**
- Consumes: `bucketMonthlyCommissions` from Task 1 (`src/lib/commission.ts`); `getChartColors`/`useThemeVersion` from `src/lib/chartTheme.ts` (pre-existing).
- Produces: `PartnerEarningsChart({ commissions: { created_at: string, commission_amount: number }[] })`.

- [ ] **Step 1: Create the component**

```tsx
// src/components/PartnerEarningsChart.tsx
'use client'
import { useEffect, useRef } from 'react'
import {
  Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale,
  Filler, Tooltip, Legend, type ChartConfiguration,
} from 'chart.js'
import { getChartColors, useThemeVersion } from '@/lib/chartTheme'
import { bucketMonthlyCommissions } from '@/lib/commission'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

type Props = { commissions: { created_at: string; commission_amount: number }[] }

export function PartnerEarningsChart({ commissions }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const themeVersion = useThemeVersion()

  useEffect(() => {
    const monthlyTrend = bucketMonthlyCommissions(commissions)
    if (!ref.current || monthlyTrend.length === 0) return
    chartRef.current?.destroy()
    const tc = getChartColors()
    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: monthlyTrend.map(m => m.month),
        datasets: [{
          data: monthlyTrend.map(m => m.commission),
          borderColor: '#10B981',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#10B981',
          fill: true,
          backgroundColor: 'rgba(16,185,129,.08)',
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tc.tooltipBg,
            borderColor: tc.tooltipBorder,
            borderWidth: 1,
            titleColor: tc.tooltipTitle,
            bodyColor: tc.tooltipBody,
            callbacks: { label: ctx => ` $${Number(ctx.parsed.y).toFixed(2)}` },
          },
        },
        scales: {
          x: { grid: { color: tc.grid }, ticks: { color: tc.tick, font: { size: 9 } } },
          y: {
            grid: { color: tc.grid },
            ticks: { color: tc.tick, font: { size: 9 }, callback: v => `$${Number(v).toFixed(0)}` },
          },
        },
      },
    }
    chartRef.current = new Chart(ref.current, config)
    return () => chartRef.current?.destroy()
  }, [commissions, themeVersion])

  const monthlyTrend = bucketMonthlyCommissions(commissions)
  if (monthlyTrend.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', color: 'var(--txt3)', fontSize: '11px' }}>
        No commissions yet
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '16px', marginBottom: '20px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px' }}>Earnings over time</div>
      <canvas ref={ref} style={{ width: '100%', height: '160px' }} />
    </div>
  )
}
```

- [ ] **Step 2: Wire it into `ReferralsPage.tsx`**

Add the import at the top of `src/components/ReferralsPage.tsx`:

```tsx
import { PartnerEarningsChart } from '@/components/PartnerEarningsChart'
```

Insert the chart between the existing stat-cards block and the "Commission history" block. Change:

```tsx
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {statCard('Referred signups', String(data.stats.referredCount))}
        {statCard('Pending (30-day hold)', `$${data.stats.pendingAmount.toFixed(2)}`)}
        {statCard('Available for payout', `$${data.stats.availableAmount.toFixed(2)}`, 'var(--ac2)')}
        {statCard('Total paid out', `$${data.stats.paidAmount.toFixed(2)}`)}
      </div>

      {data.commissions.length > 0 && (
```

to:

```tsx
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {statCard('Referred signups', String(data.stats.referredCount))}
        {statCard('Pending (30-day hold)', `$${data.stats.pendingAmount.toFixed(2)}`)}
        {statCard('Available for payout', `$${data.stats.availableAmount.toFixed(2)}`, 'var(--ac2)')}
        {statCard('Total paid out', `$${data.stats.paidAmount.toFixed(2)}`)}
      </div>

      <PartnerEarningsChart commissions={data.commissions} />

      {data.commissions.length > 0 && (
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/PartnerEarningsChart.tsx src/components/ReferralsPage.tsx
git commit -m "feat: add earnings-over-time chart to partner-facing referrals page"
```

---

### Task 8: Manual verification

**Files:** none (verification only — no code changes)

**Interfaces:**
- Consumes: everything from Tasks 1-7.

This feature changes no eligibility/webhook logic and writes no new data — it only reads and displays existing ledger data through a new aggregation. No live Stripe events are needed (unlike the prior partner edit/cancel feature's Task 6). Verification is a database cross-check plus a browser click-through.

- [ ] **Step 1: Cross-check `monthlyTrend` against a direct SQL aggregate**

Via Supabase MCP `execute_sql`:

```sql
select to_char(created_at, 'YYYY-MM') as month, sum(commission_amount) as commission
from referral_commissions
where program = 'partner'
group by 1
order by 1;
```

Compare this result row-for-row against the `monthlyTrend` array returned by `GET /api/referrals/admin/partners` (call it directly, e.g. via the browser while signed in as an admin, or `curl` with an authenticated session cookie). Every `{month, commission}` pair must match exactly (allow for floating-point display rounding to 2 decimals only).

- [ ] **Step 2: Admin dashboard click-through**

Sign in as an `ADMIN_EMAILS` account, visit `/admin/partners`. Confirm:
- The 4 stat cards render with values consistent with the partner list below them (active-partner count matches the table's row count; total signups/owed/paid match the sum of each column).
- Both charts render without console errors. If there is at least one partner-program commission row in the database, `PartnerTrendChart` shows a line; otherwise it shows "No partner commissions yet". If there is at least one active partner, `TopPartnersChart` shows bars; otherwise "No partners yet".
- The table shows one row per active partner with the correct rate/window/signups/owed values.
- Click "Edit" on a row, change the rate and dates, click "Save changes" — confirm the row updates and the stat cards/charts refresh (since `onChanged` triggers `loadPartners()`).
- Click "Edit" again, click "Remove partner", confirm — confirm the row disappears and the active-partner count decreases by one.
- Click a row (outside the Edit button) to confirm the ledger still expands as before.

- [ ] **Step 3: Partner-facing page click-through**

Using a profile with at least one `referral_commissions` row (seed temporarily via SQL if none exists, then revert), sign in as that user and visit `/referrals`. Confirm the new "Earnings over time" chart renders between the stat cards and the commission-history table, with data consistent with the visible commission history table below it. Toggle the app's light/dark theme (if accessible) and confirm the chart's colors update (theme-reactive, per `useThemeVersion`).

- [ ] **Step 4: Full test suite**

Run: `npm test`
Expected: all tests pass (the full `commission.test.ts` suite, unchanged plus Task 1's additions).

Run: `npx tsc --noEmit`
Expected: no new errors versus the pre-existing baseline.

No commit for this task (verification only).

---

## Self-Review

**Spec coverage:** Server-computed `monthlyTrend` extension (Task 2) ✓. Fixed dark palette for admin charts/cards vs. theme-reactive palette for the partner chart (Tasks 3-7, called out per-task) ✓. Client-side computation of the 4 stat cards and the top-10-by-revenue chart from the existing rollup (Tasks 3, 5) ✓. Row-click-to-expand-ledger preserved (Task 6) ✓. Unified table with Edit/Remove reusing unchanged PATCH logic (Task 6) ✓. Partner-facing chart scoped to `/api/referrals/me`'s already-`auth.uid()`-scoped data, no new isolation work (Task 7) ✓. Shared `bucketMonthlyCommissions` pure function reused by both server and client (Tasks 1, 2, 7) ✓. No new dependency (confirmed throughout — `chart.js`/`react-chartjs-2` only) ✓.

**Placeholder scan:** none found — every step has literal code, exact SQL, or exact commands.

**Type consistency:** `bucketMonthlyCommissions(rows: { created_at: string, commission_amount: number }[]): { month: string, commission: number }[]` — identical signature in Task 1's implementation, Task 1's tests, Task 2's server call site, and Task 7's client call site. `Partner`/`LedgerRow`/`MonthlyBucket` types defined once in Task 3's `types.ts` and imported (never redefined) by Tasks 4, 5, and 6. `PartnerTable`'s props (`partners`, `onChanged`) match exactly how Task 6's `page.tsx` calls it (`<PartnerTable partners={partners} onChanged={loadPartners} />`).
