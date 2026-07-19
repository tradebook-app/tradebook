'use client'
import { useEffect, useState } from 'react'
import { Chart } from 'chart.js'

// Chart.js falls back to its own built-in Helvetica/Arial default for every
// tick label, tooltip, and legend unless a font family is set explicitly —
// every chart in the app imports this module, so setting it once here (module
// load, before any chart is constructed) keeps axis/tooltip text on the same
// Inter + JetBrains Mono system as the rest of the UI instead of silently
// falling back to the browser default.
Chart.defaults.font.family = "'JetBrains Mono', monospace"

// Chart.js needs literal color strings — it can't read CSS custom properties
// directly like `var(--txt3)` the way regular DOM styles can. Every chart was
// hardcoding the DARK theme's hex values, so in light mode: grid lines were
// near-invisible (white-on-white), and axis/tooltip colors never matched.
// This reads the *current* theme's actual colors at render time instead.
export function getChartColors() {
  if (typeof window === 'undefined') {
    return {
      grid: 'rgba(255,255,255,.03)',
      tick: '#606070',
      tooltipBg: '#21212E',
      tooltipBorder: '#2E2E3A',
      tooltipTitle: '#9999AA',
      tooltipBody: '#F1F1F3',
      redFill: 'rgba(239,68,68,.08)',
    }
  }
  const isLight = document.documentElement.getAttribute('data-theme') === 'light'
  const s = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback
  return {
    // Faint grid lines need different base colors per theme — a white
    // hairline at low opacity disappears on a light background.
    grid: isLight ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.03)',
    tick: v('--txt3', '#606070'),
    tooltipBg: v('--bg4', '#21212E'),
    tooltipBorder: v('--brd2', '#2E2E3A'),
    tooltipTitle: v('--txt2', '#9999AA'),
    tooltipBody: v('--txt', '#F1F1F3'),
    // Red/green area fills need to be more translucent on a light
    // background, or a jagged line (like drawdown) reads as one solid
    // saturated block instead of a subtle fill.
    redFill: isLight ? 'rgba(220,38,38,.05)' : 'rgba(239,68,68,.08)',
  }
}

// Bumps a counter whenever the `data-theme` attribute on <html> changes, so
// chart components can add it to their effect deps and rebuild with the
// right colors instead of staying stuck on whatever theme was active on
// first mount.
export function useThemeVersion() {
  const [v, setV] = useState(0)
  useEffect(() => {
    const observer = new MutationObserver(() => setV(x => x + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return v
}
