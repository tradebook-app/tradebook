'use client'

import { fmtPnl } from '@/lib/analytics'

type Item = { label: string; value: number; sub?: string }

export function VerticalBars({ items, zone = 95 }: { items: Item[]; zone?: number }) {
  const maxAbs = Math.max(...items.map(i => Math.abs(i.value)), 1)

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
      {items.map((it, i) => {
        const pos  = it.value >= 0
        const barH = (Math.abs(it.value) / maxAbs) * zone
        return (
          <div key={i} style={{ flex: '1 0 56px', minWidth: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* up zone. pos is true for it.value === 0 too (0 >= 0) — drawn
                here as a flat neutral tick rather than the old `&& it.value
                !== 0` guard, which excluded zero from BOTH zones (the down
                zone only ever renders when !pos) and left an exact-$0 item
                with no bar and no value label at all, just a blank column. */}
            <div style={{ height: `${zone + 22}px`, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
              {pos && (
                <>
                  <span style={{ fontSize: '10px', fontWeight: 800, fontFamily: 'var(--mono)', color: it.value === 0 ? 'var(--txt3)' : 'var(--ac)', marginBottom: '3px', whiteSpace: 'nowrap' }}>{fmtPnl(it.value, true)}</span>
                  <div style={{ width: '64%', maxWidth: '44px', height: `${barH}px`, minHeight: '3px', background: it.value === 0 ? 'var(--brd2, #2a2a35)' : 'linear-gradient(180deg, var(--bar-green-1), var(--bar-green-2))', borderRadius: '4px 4px 0 0' }} />
                </>
              )}
            </div>
            {/* zero line */}
            <div style={{ width: '100%', height: '1px', background: 'var(--brd2, #2a2a35)' }} />
            {/* down zone */}
            <div style={{ height: `${zone + 22}px`, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center' }}>
              {!pos && (
                <>
                  <div style={{ width: '64%', maxWidth: '44px', height: `${barH}px`, minHeight: '3px', background: 'linear-gradient(0deg, var(--bar-red-1), var(--bar-red-2))', borderRadius: '0 0 4px 4px' }} />
                  <span style={{ fontSize: '10px', fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--red)', marginTop: '3px', whiteSpace: 'nowrap' }}>{fmtPnl(it.value, true)}</span>
                </>
              )}
            </div>
            {/* label — underline style (2px var(--ac) bottom border) */}
            <div style={{ fontSize: '11px', fontWeight: 500, fontFamily: 'var(--mono)', color: 'var(--txt)', marginTop: '6px', paddingBottom: '3px', borderBottom: '2px solid var(--ac)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{it.label}</div>
            {it.sub && <div style={{ fontSize: '9px', color: 'var(--txt2, #9aa)', marginTop: '2px', textAlign: 'center', whiteSpace: 'nowrap' }}>{it.sub}</div>}
          </div>
        )
      })}
    </div>
  )
}
