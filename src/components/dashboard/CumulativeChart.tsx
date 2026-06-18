'use client'

import { useEffect, useRef } from 'react'
import {
  Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale,
  Filler, Tooltip, Legend, type ChartConfiguration,
} from 'chart.js'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

type Props = {
  labels: string[]
  data: number[]
  unit?: '$' | '%'
}

export function CumulativeChart({ labels, data, unit = '$' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  const fmt = (v: number) =>
    unit === '%'
      ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
      : `${v >= 0 ? '+' : ''}$${v.toFixed(2)}`

  useEffect(() => {
    if (!ref.current) return
    chartRef.current?.destroy()

    const color = '#10B981'
    const colorFade = 'rgba(16,185,129,.08)'

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: color,
          borderWidth: 2,
          pointRadius: data.length > 60 ? 0 : 3,
          pointBackgroundColor: color,
          fill: true,
          backgroundColor: colorFade,
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
              label: ctx => ` ${fmt(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,.03)' },
            ticks: { color: '#606070', font: { size: 9 }, maxTicksLimit: 10 },
          },
          y: {
            grid: { color: 'rgba(255,255,255,.03)' },
            ticks: {
              color: '#606070', font: { size: 9 },
              callback: v => unit === '%' ? `${Number(v).toFixed(0)}%` : `$${Number(v).toFixed(0)}`,
            },
          },
        },
      },
    }

    chartRef.current = new Chart(ref.current, config)
    return () => chartRef.current?.destroy()
  }, [labels, data, unit])

  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--txt3)', fontSize: '11px' }}>
        No closed trades yet
      </div>
    )
  }

  return <canvas ref={ref} style={{ width: '100%', height: '200px' }} />
}
