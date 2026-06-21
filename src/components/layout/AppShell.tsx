'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
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

const BOTTOM_NAV = [
  { href: '/dashboard',    icon: '▣',  label: 'Dashboard' },
  { href: '/trades',       icon: '⫐',  label: 'Trades' },
  { href: '/reports',      icon: '◩',  label: 'Reports' },
  { href: '/notebook',     icon: '☰',  label: 'Notebook' },
  { href: '/settings',     icon: '⚙',  label: 'Settings' },
]

export function AppShell({
  children,
  title,
  userEmail,
  topbarActions,
  filter,
  onFilterChange,
  onAddTrade,
}: Props) {
  const pathname = usePathname()

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      {/* Desktop sidebar — hidden on mobile via CSS class */}
      <div className="desktop-sidebar" style={{ flexShrink: 0 }}>
        <Sidebar onAddTrade={onAddTrade} userEmail={userEmail} />
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100vh',
        minWidth: 0,
      }}>
        <Topbar
          title={title}
          filter={filter}
          onFilterChange={onFilterChange}
          actions={topbarActions}
          onAddTrade={onAddTrade}
        />

        <div
          className="app-main-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '18px 18px 60px',
          }}
        >
          {children}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="mobile-bottom-nav">
        {BOTTOM_NAV.map(({ href, icon, label }) => (
          <Link
            key={href}
            href={href}
            className={pathname === href ? 'active' : ''}
          >
            <span className="nav-icon">{icon}</span>
            {label}
          </Link>
        ))}
        <button onClick={onAddTrade} className={undefined}>
          <span className="nav-icon">＋</span>
          Add
        </button>
      </nav>
    </div>
  )
}
