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
  { selector: '[data-tour="logo"]',            side: 'right',  highlight: false, title: '1 of 14 · Welcome',              body: 'Let’s get you set up in under 10 minutes.' },
  { selector: '[data-tour="logo"]',            side: 'right',  highlight: false, title: '2 of 14 · Trader type',          body: 'Are you a stocks trader, futures trader, or funded/prop firm trader? This tailors your dashboard.' },
  { selector: '[data-tour="nav-/dashboard"]',  side: 'right',                    title: '3 of 14 · Your dashboard',       body: 'Win rate, profit factor, expectancy, drawdown, broken down by setup, ticker, and time of day.' },
  { selector: '[data-tour="nav-/trades"]',     side: 'right',                    title: '4 of 14 · Connect your broker',  body: 'Connect IBKR or another supported broker to import your trade history automatically, or upload a CSV.' },
  { selector: '[data-tour="nav-/journal"]',    side: 'right',                    title: '5 of 14 · Build your journal',   body: 'Add your strategies and risk rules now, before your next trade. This is what turns a log into a journal.' },
  { selector: '[data-tour="nav-/notebook"]',   side: 'right',                    title: '6 of 14 · Notebook',             body: 'Keep trade ideas, mistakes, and lessons in one place.' },
  { selector: '[data-tour="nav-/reports"]',    side: 'right',                    title: '7 of 14 · Reports',              body: 'Deeper breakdowns: by strategy, symbol, time of day, and more.' },
  { selector: '[data-tour="nav-/strategies"]', side: 'right',                    title: '8 of 14 · Strategies',           body: 'Define your setups and track how each one performs.' },
  { selector: '[data-tour="nav-/position-size"]', side: 'right',                 title: '9 of 14 · Position Size',        body: 'Calculate exact share/contract size based on your risk per trade.' },
  { selector: '[data-tour="nav-/ai-analysis"]', side: 'right',                   title: '10 of 14 · Sleek AI',            body: 'Ask AI to analyze your trades and spot patterns.' },
  { selector: '[data-tour="nav-/prop-tracker"]', side: 'right',                  title: '11 of 14 · Prop Tracker',        body: 'Track funded/prop firm account rules and progress.' },
  { selector: '[data-tour="nav-/referrals"]',  side: 'right',                    title: '12 of 14 · Refer & Earn',        body: 'Invite other traders and earn commission.' },
  { selector: '[data-tour="profile"]',         side: 'bottom',                   title: '13 of 14 · Profile',             body: 'Manage your account, billing, and settings here.' },
  { selector: '[data-tour="add-trade"]',       side: 'right',                    title: '14 of 14 · Log your first trade', body: 'Click here anytime to add a trade manually. Add a screenshot and a note on why you took it.' },
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
  const gap = 14
  const cardWidth = 240
  let cardStyle: React.CSSProperties = {}
  let arrowStyle: React.CSSProperties | null = null

  // Steps 1-2 have no real highlight target (they're general intro content),
  // so they're centered in the viewport instead of anchored to the logo.
  // The logo sits at the very top of a 175px sidebar with the "+ Add Trade"
  // button right underneath it -- there's no width/position near the logo
  // that fits this copy without either spilling into the dashboard content
  // (at the full 240px card width) or covering that button (at any width
  // narrow enough to stay inside the sidebar). `rect` is still measured
  // against the logo purely so the component has a non-null rect to render
  // at all (see the early return above) -- its coordinates aren't used here.
  if (s.highlight === false) {
    cardStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  } else if (s.side === 'right') {
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
          var(--ac) ring would blend straight into a var(--ac) background.
          No dimming anywhere -- the rest of the page (sidebar, stat cards,
          calendar, chat widget) stays fully visible and undimmed through
          every step, including steps 1-2 which have no ring at all. */}
      {s.highlight !== false && (
        <div style={{
          position: 'fixed', zIndex: 998, pointerEvents: 'none',
          top: rect.top - 4, left: rect.left - 4,
          width: rect.width + 8, height: rect.height + 8,
          borderRadius: '8px',
          boxShadow: '0 0 0 2px #fff, 0 0 0 4px var(--ac)',
          transition: 'top .2s, left .2s, width .2s, height .2s',
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
        {arrowStyle && <div style={{ position: 'absolute', width: 0, height: 0, ...arrowStyle }} />}

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
