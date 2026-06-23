'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const TOUR_KEY = 'sleek_tour_done'

type Step = {
  title: string
  description: string
  icon: string
  href?: string
  selector?: string
}

const STEPS: Step[] = [
  {
    title: 'Welcome to Sleektrade 👋',
    description: 'Your professional trading journal. Let us show you around — it only takes a minute.',
    icon: '🎯',
  },
  {
    title: 'Dashboard',
    description: 'Your home base. See your P&L, win rate, cumulative chart, calendar, and drawdown all in one place.',
    icon: '▣',
    href: '/dashboard',
    selector: 'a[href="/dashboard"]',
  },
  {
    title: 'Add a Trade',
    description: 'Click "+ Add Trade" to log a trade manually, or import directly from your broker (DAS, TOS, IBKR & more).',
    icon: '✚',
    selector: 'button',
  },
  {
    title: 'Trade View',
    description: 'See every trade in a clean table. Filter by Long/Short, Winners/Losers, grade, and more. Click any trade to see details.',
    icon: '⫐',
    href: '/trades',
    selector: 'a[href="/trades"]',
  },
  {
    title: 'Journal',
    description: 'Review your trading day or week. See your P&L chart, stats, and every trade grouped by day or week.',
    icon: '◫',
    href: '/journal',
    selector: 'a[href="/journal"]',
  },
  {
    title: 'Notebook',
    description: 'Write your trading rules, ideas, and notes. Keep everything in one place so you never forget your edge.',
    icon: '☰',
    href: '/notebook',
    selector: 'a[href="/notebook"]',
  },
  {
    title: 'Reports',
    description: '7 report tabs with 25+ metrics. Analyze your performance by day, time, symbol, setup, R-multiple, and more.',
    icon: '◩',
    href: '/reports',
    selector: 'a[href="/reports"]',
  },
  {
    title: 'Position Size Calculator',
    description: 'Enter your account size, risk %, entry and stop — Sleektrade tells you exactly how many shares to buy.',
    icon: '⊞',
    href: '/position-size',
    selector: 'a[href="/position-size"]',
  },
  {
    title: "You're all set! 🚀",
    description: 'Start by adding your first trade or importing from your broker. Your edge is waiting to be discovered.',
    icon: '✓',
  },
]

export function WelcomeTour() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [highlight, setHighlight] = useState<DOMRect | null>(null)
  const router = useRouter()

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY)
    if (!done) {
      setTimeout(() => setVisible(true), 800)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    const current = STEPS[step]
    if (current.selector) {
      const el = document.querySelector(current.selector)
      if (el) {
        const rect = el.getBoundingClientRect()
        setHighlight(rect)
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        setHighlight(null)
      }
    } else {
      setHighlight(null)
    }
  }, [step, visible])

  function next() {
    const current = STEPS[step]
    if (current.href) router.push(current.href)
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  function prev() {
    if (step > 0) setStep(s => s - 1)
  }

  function dismiss() {
    setVisible(false)
    localStorage.setItem(TOUR_KEY, '1')
  }

  if (!visible) return null

  const current = STEPS[step]
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <>
      {/* Dark overlay */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(2px)',
          transition: 'opacity 0.3s',
        }}
        onClick={dismiss}
      />

      {/* Spotlight highlight */}
      {highlight && (
        <div
          style={{
            position: 'fixed',
            top: highlight.top - 6,
            left: highlight.left - 6,
            width: highlight.width + 12,
            height: highlight.height + 12,
            borderRadius: '10px',
            boxShadow: '0 0 0 4px #10B981, 0 0 0 8px rgba(16,185,129,0.3)',
            zIndex: 9999,
            pointerEvents: 'none',
            transition: 'all 0.4s cubic-bezier(.4,0,.2,1)',
            background: 'rgba(16,185,129,0.08)',
          }}
        />
      )}

      {/* Tour card */}
      <div
        style={{
          position: 'fixed',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '420px',
          zIndex: 10000,
          background: 'var(--bg2, #16161e)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: '16px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(16,185,129,0.1)',
          overflow: 'hidden',
          margin: '0 16px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div style={{ height: '3px', background: 'var(--bg4, #1a1a24)' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#10B981', transition: 'width 0.4s ease', borderRadius: '2px' }} />
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', flexShrink: 0,
            }}>
              {current.icon}
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--txt, #f1f1f3)', marginBottom: '6px', lineHeight: 1.2 }}>
                {current.title}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--txt2, #a8a8b8)', lineHeight: 1.6 }}>
                {current.description}
              </div>
            </div>
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: '5px', marginBottom: '18px' }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  height: '3px', flex: 1, borderRadius: '2px',
                  background: i <= step ? '#10B981' : 'var(--bg4, #252530)',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <button
              onClick={dismiss}
              style={{
                fontSize: '11px', fontWeight: 600, color: 'var(--txt3, #666)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--sans)', padding: '6px 0', textDecoration: 'underline',
              }}
            >
              Don't show again
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              {!isFirst && (
                <button
                  onClick={prev}
                  style={{
                    fontSize: '12px', fontWeight: 600, padding: '8px 16px',
                    background: 'var(--bg4, #1a1a24)', border: '1px solid var(--brd, #252530)',
                    borderRadius: '8px', color: 'var(--txt2)', cursor: 'pointer',
                    fontFamily: 'var(--sans)',
                  }}
                >
                  ← Back
                </button>
              )}
              <button
                onClick={next}
                style={{
                  fontSize: '12px', fontWeight: 700, padding: '8px 20px',
                  background: '#10B981', border: 'none',
                  borderRadius: '8px', color: '#000', cursor: 'pointer',
                  fontFamily: 'var(--sans)',
                }}
              >
                {isLast ? 'Get started →' : 'Next →'}
              </button>
            </div>
          </div>
        </div>

        {/* Step counter */}
        <div style={{
          padding: '8px 24px', borderTop: '1px solid var(--brd, #252530)',
          fontSize: '10px', color: 'var(--txt3)', fontWeight: 600,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>Step {step + 1} of {STEPS.length}</span>
          <span style={{ color: '#10B981' }}>Sleektrade Tour</span>
        </div>
      </div>
    </>
  )
}
