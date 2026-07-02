'use client'

import { useEffect, useRef } from 'react'
import {
  Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale,
  Filler, Tooltip, type ChartConfiguration,
} from 'chart.js'
import { getChartColors, useThemeVersion } from '@/lib/chartTheme'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

type Props = {
  labels: string[]
  data: number[]
}

export function DrawdownChart({ labels, data }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const themeVersion = useThemeVersion()

  useEffect(() => {
    if (!ref.current || !data.length) return
    chartRef.current?.destroy()
    const tc = getChartColors()

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
          backgroundColor: tc.redFill,
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
            callbacks: {
              label: ctx => ` $${ctx.parsed.y.toFixed(2)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tc.tick, font: { size: 9 }, maxTicksLimit: 8 },
          },
          y: {
            grid: { color: tc.grid },
            ticks: {
              color: tc.tick, font: { size: 9 },
              callback: v => `$${Number(v).toFixed(0)}`,
            },
          },
        },
      },
    }

    chartRef.current = new Chart(ref.current, config)
    return () => chartRef.current?.destroy()
  }, [labels, data, themeVersion])

  if (!data.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '140px', color: 'var(--txt3)', fontSize: '11px' }}>
        No data yet
      </div>
    )
  }

  return <canvas ref={ref} style={{ width: '100%', height: '100%', minHeight: '140px' }} />
}
