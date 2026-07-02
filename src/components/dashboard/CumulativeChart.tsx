'use client'
import { useEffect, useRef } from 'react'
import {
  Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale,
  Filler, Tooltip, Legend, type ChartConfiguration,
} from 'chart.js'
import { getChartColors, useThemeVersion } from '@/lib/chartTheme'
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)
type Props = {
  labels: string[]
  data: number[]
  unit?: '$' | '%'
  color?: string
  colorFade?: string
}
export function CumulativeChart({ labels, data, unit = '$', color = '#10B981', colorFade = 'rgba(16,185,129,.08)' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const themeVersion = useThemeVersion()
  const fmt = (v: number) =>
    unit === '%'
      ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
      : `${v >= 0 ? '+' : ''}$${v.toFixed(2)}`
  useEffect(() => {
    if (!ref.current) return
    chartRef.current?.destroy()
    const tc = getChartColors()
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
            backgroundColor: tc.tooltipBg,
            borderColor: tc.tooltipBorder,
            borderWidth: 1,
            titleColor: tc.tooltipTitle,
            bodyColor: tc.tooltipBody,
            callbacks: {
              label: ctx => ` ${fmt(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: tc.grid },
            ticks: { color: tc.tick, font: { size: 9 }, maxTicksLimit: 10 },
          },
          y: {
            grid: { color: tc.grid },
            ticks: {
              color: tc.tick, font: { size: 9 },
              callback: v => unit === '%' ? `${Number(v).toFixed(0)}%` : `$${Number(v).toFixed(0)}`,
            },
          },
        },
      },
    }
    chartRef.current = new Chart(ref.current, config)
    return () => chartRef.current?.destroy()
  }, [labels, data, unit, color, colorFade, themeVersion])
  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--txt3)', fontSize: '11px' }}>
        No closed trades yet
      </div>
    )
  }
  return <canvas ref={ref} style={{ width: '100%', height: '200px' }} />
}
