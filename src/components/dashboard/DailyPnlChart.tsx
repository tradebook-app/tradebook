'use client'

import { useEffect, useRef } from 'react'
import {
  Chart, BarElement, BarController, LinearScale, CategoryScale,
  Tooltip, type ChartConfiguration,
} from 'chart.js'
import type { DayStats } from '@/lib/types'

Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip)

type Props = { days: DayStats[] }

export function DailyPnlChart({ days }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!ref.current || !days.length) return
    chartRef.current?.destroy()

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: days.map(d => {
          const [, m, day] = d.date.split('-')
          return `${m}/${day}`
        }),
        datasets: [{
          data: days.map(d => d.pnl),
          backgroundColor: days.map(d => d.pnl >= 0 ? 'rgba(16,185,129,.7)' : 'rgba(239,68,68,.7)'),
          borderColor:     days.map(d => d.pnl >= 0 ? '#10B981' : '#EF4444'),
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
            backgroundColor: '#21212E',
            borderColor: '#2E2E3A',
            borderWidth: 1,
            titleColor: '#9999AA',
            bodyColor: '#F1F1F3',
            callbacks: {
              label: ctx => {
                const v = ctx.parsed.y
                return ` ${v >= 0 ? '+' : ''}$${v.toFixed(2)}`
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#606070', font: { size: 9 }, maxTicksLimit: 14 },
          },
          y: {
            grid: { color: 'rgba(255,255,255,.03)' },
            ticks: {
              color: '#606070', font: { size: 9 },
              callback: v => `$${Number(v).toFixed(0)}`,
            },
          },
        },
      },
    }

    chartRef.current = new Chart(ref.current, config)
    return () => chartRef.current?.destroy()
  }, [days])

  if (!days.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', color: 'var(--txt3)', fontSize: '11px' }}>
        No data yet
      </div>
    )
  }

  return <canvas ref={ref} style={{ width: '100%', height: '160px' }} />
}
