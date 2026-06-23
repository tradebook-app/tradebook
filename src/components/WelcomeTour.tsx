'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const TOUR_KEY = 'sleek_tour_done'
const TOUR_STEP_KEY = 'sleek_tour_step'

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
    description: 'Click here to log a trade manually, or import from your broker (DAS, TOS, IBKR & more).',
    icon: '✚',
    selector: 'button',
  },
  {
    title: 'Trade View',
    description: 'See every trade in a clean table. Filter by Long/Short, Winners/Losers, grade, and more.',
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
    description: 'Write your trading rules, ideas, and notes. Keep everything in one place.',
    icon: '☰',
    href: '/notebook',
    selector: 'a[href="/notebook"]',
  },
  {
    title: 'Reports',
    description: '7 report tabs with 25+ metrics. Analyze performance by day, time, symbol, setup, R-multiple, and more.',
    icon: '◩',
    href: '/reports',
    selector: 'a[href="/reports"]',
  },
  {
    title: 'Position Size Calculator',
    description: 'Enter your account size, risk %, entry and stop — get the exact number of shares to buy.',
    icon: '⊞',
    href: '/position-size',
    selector: 'a[href="/position-size"]',
  },
  {
    title: "You're all set! 🚀",
    description: 'Start by adding your first trade or importing from your broker. Your edge is waiting.',
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
      const savedStep = parseInt(localStorage.getItem(TOUR_STEP_KEY) || '0', 10)
      setStep(savedStep || 0)
      setTimeout(() => setVisible(true), 800)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    // Save current step
    localStorage.setItem(TOUR_STEP_KEY, String(step))

    const current = STEPS[step]
    if (current.selector) {
      const tryFind = (attempts = 0) => {
        const el = document.querySelector(current.selector!)
        if (el) {
          const rect = el.getBoundingClientRect()
          setHighlight(rect)
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } else if (attempts < 5) {
          setTimeout(() => tryFind(attempts + 1), 300)
        } else {
          setHighlight(null)
        }
      }
      tryFind()
    } else {
      setHighlight(null)
    }
  }, [step, visible])

  function next() {
    const current = STEPS[step]
    const nextStep = step + 1
    if (nextStep < STEPS.length) {
      setStep(nextStep)
      localStorage.setItem(TOUR_STEP_KEY, String(nextStep))
      if (current.href) router.push(current.href)
    } else {
      dismiss()
    }
  }

  function prev() {
    if (step > 0) {
      const prevStep = step - 1
      setStep(prevStep)
      localStorage.setItem(TOUR_STEP_KEY, String(prevStep))
    }
  }

  function dismiss() {
    setVisible(false)
    localStorage.setItem(TOUR_KEY, '1')
    localStorage.removeItem(TOUR_STEP_KEY)
  }

  if (!visible) return null

  const current = STEPS[step]
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100

  let cardStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '32px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '380px',
    zIndex: 10000,
  }

  let arrowStyle: React.CSSProperties | null = null

  if (highlight) {
    const cardW = 380
    const margin = 16
    const spaceRight = window.innerWidth - highlight.right - margin
    const spaceLeft = highlight.left - margin

    if (spaceRight >= cardW + margin) {
      cardStyle = {
        position: 'fixed',
        top: Math.min(Math.max(highlight.top, 16), window.innerHeight - 300),
        left: highlight.right + margin,
        width: `${cardW}px`,
        zIndex: 10000,
        transform: 'none',
      }
      arrowStyle = {
        position: 'fixed',
        top: highlight.top + highlight.height / 2 - 8,
        left: highlight.right + margin - 10,
        width: 0, height: 0,
        borderTop: '8px solid transparent',
        borderBottom: '8px solid transparent',
        borderRight: '10px solid #10B981',
        zIndex: 10001,
      }
    } else if (spaceLeft >= cardW + margin) {
      cardStyle = {
        position: 'fixed',
        top: Math.min(Math.max(highlight.top, 16), window.innerHeight - 300),
        left: highlight.left - cardW - margin,
        width: `${cardW}px`,
        zIndex: 10000,
        transform: 'none',
      }
      arrowStyle = {
        position: 'fixed',
        top: highlight.top + highlight.height / 2 - 8,
        left: highlight.left - margin + 2,
        width: 0, height: 0,
        borderTop: '8px solid transparent',
        borderBottom: '8px solid transparent',
        borderLeft: '10px solid #10B981',
        zIndex: 10001,
      }
    } else {
      cardStyle = {
        position: 'fixed',
        top: Math.min(highlight.bottom + margin, window.innerHeight - 280),
        left: '50%',
        transform: 'translateX(-50%)',
        width: `${cardW}px`,
        zIndex: 10000,
      }
      arrowStyle = {
        position: 'fixed',
        top: highlight.bottom + margin - 10,
        left: highlight.left + highlight.width / 2 - 8,
        width: 0, height: 0,
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderBottom: '10px solid #10B981',
        zIndex: 10001,
      }
    }
  }

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.45)' }}
        onClick={dismiss}
      />

      {highlight && (
        <div style={{
          position: 'fixed',
          top: highlight.top - 4,
          left: highlight.left - 4,
          width: highlight.width + 8,
          height: highlight.height + 8,
          borderRadius: '10px',
          boxShadow: '0 0 0 3px #10B981, 0 0 0 6px rgba(16,185,129,0.25)',
          zIndex: 9999,
          pointerEvents: 'none',
          background: 'rgba(16,185,129,0.05)',
          transition: 'all 0.35s cubic-bezier(.4,0,.2,1)',
        }} />
      )}

      {arrowStyle && <div style={arrowStyle} />}

      <div style={{ ...cardStyle, transition: 'all 0.35s cubic-bezier(.4,0,.2,1)' }} onClick={e => e.stopPropagation()}>
        <div style={{
          background: '#0f1117',
          border: '1px solid rgba(16,185,129,0.4)',
          borderRadius: '14px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}>
          <div style={{ height: '3px', background: '#1a1a24' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: '#10B981', transition: 'width 0.4s ease' }} />
          </div>

          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
              }}>
                {current.icon}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#f1f1f3', marginBottom: '5px' }}>
                  {current.title}
                </div>
                <div style={{ fontSize: '12px', color: '#a8a8b8', lineHeight: 1.6 }}>
                  {current.description}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{
                  height: '3px', flex: 1, borderRadius: '2px',
                  background: i <= step ? '#10B981' : '#252530',
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button onClick={dismiss} style={{
                fontSize: '11px', fontWeight: 600, color: '#555',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--sans)', textDecoration: 'underline', padding: 0,
              }}>
                Don't show again
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!isFirst && (
                  <button onClick={prev} style={{
                    fontSize: '12px', fontWeight: 600, padding: '7px 14px',
                    background: '#1a1a24', border: '1px solid #252530',
                    borderRadius: '7px', color: '#a8a8b8', cursor: 'pointer', fontFamily: 'var(--sans)',
                  }}>← Back</button>
                )}
                <button onClick={next} style={{
                  fontSize: '12px', fontWeight: 700, padding: '7px 18px',
                  background: '#10B981', border: 'none',
                  borderRadius: '7px', color: '#000', cursor: 'pointer', fontFamily: 'var(--sans)',
                }}>
                  {isLast ? 'Get started →' : 'Next →'}
                </button>
              </div>
            </div>
          </div>

          <div style={{
            padding: '7px 20px', borderTop: '1px solid #1e1e26',
            display: 'flex', justifyContent: 'space-between',
            fontSize: '10px', color: '#555', fontWeight: 600,
          }}>
            <span>Step {step + 1} of {STEPS.length}</span>
            <span style={{ color: '#10B981' }}>Sleektrade Tour</span>
          </div>
        </div>
      </div>
    </>
  )
}
