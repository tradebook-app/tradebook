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
  content: "👋 Hi! I'm the Sleektrade Support Assistant. Ask me anything about the app — plans, features, importing trades, strategies. If I can't help, use \"Talk to a person\" below and Ahmad will reply directly.",
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
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
          padding: '8px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 500,
          background: open ? 'var(--ac-d)' : 'transparent',
          borderLeft: `2px solid ${open ? 'var(--ac)' : 'transparent'}`,
          color: open ? 'var(--ac2)' : 'var(--txt2)',
          border: 'none', borderLeftWidth: '2px', textAlign: 'left',
          fontFamily: 'var(--sans)', transition: '.1s',
        }}
      >
        <span style={{ fontSize: '13px', width: '16px', textAlign: 'center' }}>?</span>
        Contact us
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed', bottom: '76px', left: '12px', width: '340px', maxWidth: 'calc(100vw - 24px)',
            height: '480px', background: 'var(--bg3)', border: '1px solid var(--brd2)',
            borderRadius: 'var(--r2)', boxShadow: '0 16px 40px rgba(0,0,0,.5)',
            zIndex: 500, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderBottom: '1px solid var(--brd)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%', background: 'var(--ac)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0,
              }}>🤖</div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt)' }}>Sleektrade Support</div>
                <div style={{ fontSize: '9px', color: 'var(--txt3)' }}>AI Agent · instant answers</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: '16px', padding: '2px 4px', lineHeight: 1 }}
            >×</button>
          </div>

          {/* Messages */}
          <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: m.role === 'user' ? 'var(--ac-d)' : 'var(--bg4)',
                  border: `1px solid ${m.role === 'user' ? 'rgba(16,185,129,.25)' : 'var(--brd)'}`,
                  borderRadius: '10px',
                  padding: '9px 12px',
                  fontSize: '12px',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  color: m.role === 'user' ? 'var(--ac2)' : 'var(--txt2)',
                }}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div style={{ alignSelf: 'flex-start', fontSize: '10px', color: 'var(--txt4)', padding: '0 4px' }}>Thinking...</div>
            )}
          </div>

          {/* Escalate link */}
          <div style={{ padding: '0 14px 8px', flexShrink: 0 }}>
            <button
              onClick={handleEscalate}
              disabled={escalating || escalated}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: escalated ? 'default' : 'pointer',
                fontSize: '10px', color: escalated ? 'var(--ac)' : 'var(--txt3)', textDecoration: escalated ? 'none' : 'underline',
                fontFamily: 'var(--sans)',
              }}
            >
              {escalated ? '✓ Sent to Ahmad' : escalating ? 'Sending to Ahmad...' : '💬 Talk to a person instead'}
            </button>
          </div>

          {/* Input */}
          <div style={{ borderTop: '1px solid var(--brd)', padding: '10px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
              <textarea
                className="fi"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask a question..."
                rows={2}
                style={{ fontSize: '11px', resize: 'none', flex: 1 }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="btn btn-p"
                style={{ padding: '8px 10px', flexShrink: 0, opacity: sending || !input.trim() ? 0.5 : 1 }}
              >➤</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
