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
