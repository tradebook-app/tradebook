'use client'

import { useEffect, useRef } from 'react'
import {
  Chart, LineElement, PointElement, LinearScale, CategoryScale,
  Filler, Tooltip, type ChartConfiguration,
} from 'chart.js'

Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

type Props = {
  labels: string[]
  data: number[]
}

export function DrawdownChart({ labels, data }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!ref.current || !data.length) return
    chartRef.current?.destroy()

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: '#EF4444',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: true,
          backgroundColor: 'rgba(239,68,68,.08)',
          tension: 0.3,
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
              label: ctx => ` $${ctx.parsed.y.toFixed(2)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#606070', font: { size: 9 }, maxTicksLimit: 8 },
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
  }, [labels, data])

  if (!data.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--txt3)', fontSize: '11px' }}>
        No data yet
      </div>
    )
  }

  return <canvas ref={ref} style={{ width: '100%', height: '120px' }} />
}
