'use client'

import { useState } from 'react'
import type { TradeRow, DateRangeFilter } from '@/lib/types'
import { filterByDate } from '@/lib/analytics'
import { PerformanceReport } from './PerformanceReport'
import { DayTimeReport }     from './DayTimeReport'
import { SymbolsReport }     from './SymbolsReport'
import { RiskReport }        from './RiskReport'
import { WinLossReport }     from './WinLossReport'
import { SetupReport }       from './SetupReport'

type Tab = 'performance' | 'daytime' | 'symbols' | 'risk' | 'winloss' | 'setup'

const TABS: { key: Tab; label: string }[] = [
  { key: 'performance', label: 'Performance' },
  { key: 'daytime',     label: 'Day & Time' },
  { key: 'symbols',     label: 'Symbols' },
  { key: 'risk',        label: 'Risk (R)' },
  { key: 'winloss',     label: 'Wins vs Losses' },
  { key: 'setup',       label: 'Setups' },
]

type Props = {
  trades: TradeRow[]
  filter: DateRangeFilter
}

export function Reports({ trades, filter }: Props) {
  const [tab, setTab] = useState<Tab>('performance')
  const filtered = filterByDate(trades, filter)

  return (
    <div>
      {/* Tab nav */}
      <div style={{
        display: 'flex', gap: '0', marginBottom: '18px',
        borderBottom: '1px solid var(--brd)',
      }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '10px 18px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', background: 'none', border: 'none',
              borderBottom: `2px solid ${tab === key ? 'var(--ac)' : 'transparent'}`,
              color: tab === key ? 'var(--ac2)' : 'var(--txt2)',
              fontFamily: 'var(--sans)', transition: '.1s',
              marginBottom: '-1px',
            }}
          >{label}</button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'performance' && <PerformanceReport trades={filtered} />}
      {tab === 'daytime'     && <DayTimeReport     trades={filtered} />}
      {tab === 'symbols'     && <SymbolsReport     trades={filtered} />}
      {tab === 'risk'        && <RiskReport        trades={filtered} />}
      {tab === 'winloss'     && <WinLossReport     trades={filtered} />}
      {tab === 'setup'       && <SetupReport       trades={filtered} />}
    </div>
  )
}
