'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import type { DateRangeFilter } from '@/lib/types'

type Props = {
  children: React.ReactNode
  title: string
  userEmail?: string
  topbarActions?: React.ReactNode
  filter: DateRangeFilter
  onFilterChange: (f: DateRangeFilter) => void
  onAddTrade: () => void
}

export function AppShell({
  children,
  title,
  userEmail,
  topbarActions,
  filter,
  onFilterChange,
  onAddTrade,
}: Props) {
  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      <Sidebar onAddTrade={onAddTrade} userEmail={userEmail} />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100vh',
      }}>
        <Topbar
          title={title}
          filter={filter}
          onFilterChange={onFilterChange}
          actions={topbarActions}
        />

        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '18px 18px 60px',
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}
