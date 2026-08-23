'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Step = {
  selector: string
  title: string
  body: string
  // Which side of the target the card should appear on.
  side: 'right' | 'bottom' | 'left'
  // False for steps that anchor to an element only for card positioning
  // (e.g. the logo) but aren't actually introducing that element -- the
  // spotlight ring would be misleading there, so it's suppressed.
  highlight?: boolean
}

const STEPS: Step[] = [
  { selector: '[data-tour="logo"]',           side: 'right', highlight: false, title: '1 of 6 · Welcome',              body: 'Let’s get you set up in under 10 minutes.' },
  { selector: '[data-tour="logo"]',           side: 'right', highlight: false, title: '2 of 6 · Trader type',          body: 'Are you a stocks trader, futures trader, or funded/prop firm trader? This tailors your dashboard.' },
  { selector: '[data-tour="nav-/dashboard"]', side: 'right',                   title: '3 of 6 · Your dashboard',       body: 'Win rate, profit factor, expectancy, drawdown, broken down by setup, ticker, and time of day.' },
  { selector: '[data-tour="nav-/trades"]',    side: 'right',                   title: '4 of 6 · Connect your broker',  body: 'Connect IBKR or another supported broker to import your trade history automatically, or upload a CSV.' },
  { selector: '[data-tour="nav-/journal"]',   side: 'right',                   title: '5 of 6 · Build your journal',   body: 'Add your strategies and risk rules now, before your next trade. This is what turns a log into a journal.' },
  { selector: '[data-tour="add-trade"]',      side: 'right',                   title: '6 of 6 · Log your first trade', body: 'Click here anytime to add a trade manually. Add a screenshot and a note on why you took it.' },
]

type Rect = { top: number; left: number; width: number; height: number }

export function OnboardingTour() {
  const supabase = createClient()
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [skipChecked, setSkipChecked] = useState(false)
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    let cancelled = false
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('has_seen_intro')
        .eq('id', user.id)
        .single()
      if (!cancelled && data && !data.has_seen_intro) setActive(true)
    }
    check()
    return () => { cancelled = true }
  }, [])

  const measure = useCallback(() => {
    if (!active) return
    const el = document.querySelector(STEPS[step].selector)
    if (!el) { setRect(null); return }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [active, step])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [measure])

  async function markSeen() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ has_seen_intro: true }).eq('id', user.id)
  }

  // X button: always just hides the tour for this session. Only writes has_seen_intro
  // if the "Skip intro" box is checked -- otherwise it reappears next login.
  function handleClose() {
    setActive(false)
    if (skipChecked) markSeen()
  }

  // Reaching the end naturally (clicking through every step) also permanently
  // dismisses it -- no reason to show a completed tour again.
  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      setActive(false)
      markSeen()
    }
  }

  if (!active || !rect) return null

  const s = STEPS[step]
  const cardWidth = 240
  const gap = 14
  let cardStyle: React.CSSProperties = {}
  let arrowStyle: React.CSSProperties = {}

  if (s.side === 'right') {
    cardStyle = { top: rect.top + rect.height / 2 - 46, left: rect.left + rect.width + gap }
    arrowStyle = { left: -7, top: 20, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderRight: '7px solid var(--ac)' }
  } else if (s.side === 'bottom') {
    cardStyle = { top: rect.top + rect.height + gap, left: rect.left + rect.width - cardWidth }
    arrowStyle = { right: 16, top: -7, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: '7px solid var(--ac)' }
  } else {
    cardStyle = { top: rect.top + rect.height / 2 - 46, left: rect.left - cardWidth - gap }
    arrowStyle = { right: -7, top: 20, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderLeft: '7px solid var(--ac)' }
  }

  return (
    <>
      {/* Highlight ring around the current target. A white ring is sandwiched
          between the target and the accent-colored ring so the highlight
          still reads clearly against a target that's itself accent-colored
          (e.g. the solid-green "+ Add Trade" button) -- a plain single
          var(--ac) ring would blend straight into a var(--ac) background. */}
      {s.highlight !== false && (
        <div style={{
          position: 'fixed', zIndex: 998, pointerEvents: 'none',
          top: rect.top - 4, left: rect.left - 4,
          width: rect.width + 8, height: rect.height + 8,
          borderRadius: '8px',
          boxShadow: '0 0 0 2px #fff, 0 0 0 4px var(--ac), 0 0 0 4000px rgba(0,0,0,.35)',
          transition: 'top .2s, left .2s, width .2s, height .2s',
        }} />
      )}
      {s.highlight === false && (
        <div style={{
          position: 'fixed', zIndex: 998, pointerEvents: 'none',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,.35)',
        }} />
      )}

      {/* Tour card */}
      <div style={{
        position: 'fixed', zIndex: 999, width: `${cardWidth}px`,
        background: 'var(--ac)', color: '#000', borderRadius: '10px',
        padding: '12px 14px', boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        transition: 'top .2s, left .2s',
        ...cardStyle,
      }}>
        <div style={{ position: 'absolute', width: 0, height: 0, ...arrowStyle }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700 }}>{s.title}</div>
          <button
            onClick={handleClose}
            aria-label="Close tour"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,.55)', fontSize: '13px', padding: 0, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: '11px', lineHeight: 1.5, marginTop: '6px' }}>{s.body}</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={skipChecked}
              onChange={e => setSkipChecked(e.target.checked)}
              style={{ margin: 0 }}
            />
            Skip intro
          </label>
          <button
            onClick={handleNext}
            style={{
              background: '#000', color: 'var(--ac)', border: 'none', borderRadius: '6px',
              padding: '5px 10px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {step < STEPS.length - 1 ? 'Next' : 'Finish'}
          </button>
        </div>
      </div>
    </>
  )
}
