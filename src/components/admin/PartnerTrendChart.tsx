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
          x: { grid: { color: COLORS.grid }, ticks: { color: COLORS.tick, font: { size: 9 }, maxTicksLimit: 10 } },
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
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', marginBottom: '2px' }}>Commission earnings over time</div>
      <div style={{ fontSize: '10px', color: '#666', marginBottom: '10px' }}>Includes partners since removed</div>
      <canvas ref={ref} style={{ width: '100%', height: '200px' }} />
    </div>
  )
}
