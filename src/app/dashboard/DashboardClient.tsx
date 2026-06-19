'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import type { DateRangeFilter } from '@/lib/types'

type Props = {
  userEmail?: string
}

export function DashboardClient({ userEmail }: Props) {
  const [filter, setFilter] = useState<DateRangeFilter>({ range: 'all' })

  return (
    <AppShell
      title="Dashboard"
      userEmail={userEmail}
      filter={filter}
      onFilterChange={setFilter}
      onAddTrade={() => {}}
    >
      {/* ── Phase 2 will wire in real dashboard content ── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        gap: '12px',
      }}>
        <div style={{ fontSize: '32px' }}>✅</div>
        <div style={{ fontSize: '18px', fontWeight: 700 }}>
          Sleektrade is live!
        </div>
        <div style={{ fontSize: '12px', color: 'var(--txt2)', textAlign: 'center', maxWidth: '360px', lineHeight: 1.6 }}>
          Phase 1 complete — auth, DB schema, and app shell are all wired up.
          Phase 2 will bring the full dashboard with charts, calendar, and trade logging.
        </div>
      </div>
    </AppShell>
  )
}
