'use client'

import { useState, useRef, useEffect } from 'react'

type ChatMessage = { role: 'assistant' | 'user'; content: string; isWelcome?: boolean }

type Props = {
  userEmail?: string
  displayName: string
}

const WELCOME: ChatMessage = {
  role: 'assistant',
  isWelcome: true,
  content: "👋 Hi! Ask me anything about Sleektrade — plans, features, importing trades, strategies. If I can't help, use \"Talk to a person\" below and Ahmad will reply directly.",
}

// Fixed light palette — this widget is intentionally white/light regardless
// of the app's dark/light theme, matching a familiar chat-widget convention.
const C = {
  bg: '#FFFFFF',
  bg2: '#F7F8FA',
  border: '#E4E6EB',
  text: '#15161A',
  text2: '#5B5F6B',
  text3: '#9AA0AC',
  accent: '#10B981',
  accentText: '#065F46',
  accentBg: '#ECFDF5',
  accentBorder: '#A7F3D0',
  shadow: '0 20px 48px rgba(15,17,23,.22), 0 2px 8px rgba(15,17,23,.08)',
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.substring(0, 2).toUpperCase()
}

export function ContactWidget({ userEmail, displayName }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const [escalated, setEscalated] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return

    const nextMessages = [...messages, { role: 'user' as const, content: text }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.filter(m => !m.isWelcome).map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()

      if (res.status === 429) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
      } else if (!res.ok) {
        throw new Error(data.error || 'failed')
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Something went wrong on my end. Try again, or use \"Talk to a person\" below.",
      }])
    }

    setSending(false)
  }

  async function handleEscalate() {
    if (escalating || escalated) return
    setEscalating(true)

    const transcript = messages
      .filter(m => !m.isWelcome)
      .map(m => `${m.role === 'user' ? displayName : 'Support Assistant'}: ${m.content}`)
      .join('\n\n')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: displayName,
          email: userEmail || 'unknown@sleektrade.app',
          subject: 'Escalated support chat',
          message: transcript || "(No messages yet — user requested to talk to a person directly.)",
        }),
      })
      if (!res.ok) throw new Error('failed')
      setEscalated(true)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sent to Ahmad — he'll reply to ${userEmail || 'your email'} within 24 hours.`,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Couldn't send that. Please email support@sleektrade.app directly.",
      }])
    }

    setEscalating(false)
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating trigger — detached from the sidebar nav flow, sits low in the corner */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Contact us"
        style={{
          position: 'fixed', bottom: '16px', left: '16px', width: '42px', height: '42px',
          borderRadius: '50%', background: open ? '#0B8A63' : C.accent, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          boxShadow: '0 6px 18px rgba(16,185,129,.4)', zIndex: 490, transition: '.15s',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.transform = 'scale(1.06)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        ) : (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed', bottom: '68px', left: '16px', width: '340px', maxWidth: 'calc(100vw - 32px)',
            height: '480px', background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: '16px', boxShadow: C.shadow,
            zIndex: 490, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, background: C.bg,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%', background: C.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>AY</div>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: C.text }}>Ahmad · Sleektrade Support</div>
                <div style={{ fontSize: '9px', color: C.text3, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.accent, display: 'inline-block' }} />
                  Instant answers, replies within 24h
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontSize: '18px', padding: '2px 4px', lineHeight: 1 }}
            >×</button>
          </div>

          {/* Messages */}
          <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', background: C.bg }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: m.role === 'user' ? C.accentBg : C.bg2,
                  border: `1px solid ${m.role === 'user' ? C.accentBorder : C.border}`,
                  borderRadius: '12px',
                  padding: '9px 12px',
                  fontSize: '12px',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  color: m.role === 'user' ? C.accentText : C.text2,
                }}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div style={{ alignSelf: 'flex-start', fontSize: '10px', color: C.text3, padding: '0 4px' }}>Thinking...</div>
            )}
          </div>

          {/* Escalate link */}
          <div style={{ padding: '0 16px 8px', flexShrink: 0, background: C.bg }}>
            <button
              onClick={handleEscalate}
              disabled={escalating || escalated}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: escalated ? 'default' : 'pointer',
                fontSize: '10.5px', color: escalated ? C.accentText : C.text3, textDecoration: escalated ? 'none' : 'underline',
                fontFamily: 'inherit',
              }}
            >
              {escalated ? '✓ Sent to Ahmad' : escalating ? 'Sending to Ahmad...' : 'Talk to a person instead'}
            </button>
          </div>

          {/* Input */}
          <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px', flexShrink: 0, background: C.bg }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask a question..."
                rows={2}
                style={{
                  fontSize: '11.5px', resize: 'none', flex: 1, fontFamily: 'inherit',
                  background: C.bg2, border: `1px solid ${C.border}`, borderRadius: '8px',
                  padding: '8px 10px', color: C.text, outline: 'none',
                }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                style={{
                  padding: '8px 11px', flexShrink: 0, background: C.accent, color: '#fff',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                  opacity: sending || !input.trim() ? 0.5 : 1, fontSize: '12px', fontWeight: 700,
                }}
              >➤</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
