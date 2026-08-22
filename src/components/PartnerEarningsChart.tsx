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
