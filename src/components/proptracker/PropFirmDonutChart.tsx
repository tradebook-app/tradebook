'use client'
import { useEffect, useRef } from 'react'
import {
  Chart, DoughnutController, ArcElement, Tooltip, type ChartConfiguration,
} from 'chart.js'
import { getChartColors, useThemeVersion } from '@/lib/chartTheme'
Chart.register(DoughnutController, ArcElement, Tooltip)

type Props = {
  labels: string[]
  data: number[]
  colors: string[]
}

export function PropFirmDonutChart({ labels, data, colors }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const themeVersion = useThemeVersion()

  useEffect(() => {
    if (!ref.current) return
    chartRef.current?.destroy()
    const tc = getChartColors()
    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: labels.map((_, i) => colors[i % colors.length]),
          borderColor: tc.tooltipBg,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tc.tooltipBg,
            borderColor: tc.tooltipBorder,
            borderWidth: 1,
            titleColor: tc.tooltipTitle,
            bodyColor: tc.tooltipBody,
            callbacks: {
              label: ctx => ` ${ctx.label}: $${Number(ctx.parsed).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
            },
          },
        },
      },
    }
    chartRef.current = new Chart(ref.current, config)
    return () => chartRef.current?.destroy()
  }, [labels, data, colors, themeVersion])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ width: '110px', height: '110px', flexShrink: 0 }}>
        <canvas ref={ref} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
        {labels.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[i % colors.length], flexShrink: 0 }} />
              <span style={{ color: 'var(--txt2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--txt)', flexShrink: 0 }}>
              ${data[i].toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
