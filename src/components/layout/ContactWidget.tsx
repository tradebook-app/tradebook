'use client'

import { useState, useRef, useEffect } from 'react'

type Message = { role: 'assistant' | 'user'; text: string }

type Props = {
  userEmail?: string
  displayName: string
}

const WELCOME: Message = {
  role: 'assistant',
  text: "👋 Hi! Got a question, found a bug, or just want to say hi? Type it below — Ahmad reads every message personally and replies within 24 hours.",
}

export function ContactWidget({ userEmail, displayName }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
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

    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: displayName,
          email: userEmail || 'unknown@sleektrade.app',
          subject: 'In-app message',
          message: text,
        }),
      })
      if (!res.ok) throw new Error('failed')
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Got it — thanks! I'll reply to ${userEmail || 'your email'} within 24 hours.`,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: "Hmm, that didn't send. Please email support@sleektrade.app directly and I'll get it.",
      }])
    }

    setSending(false)
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
            position: 'fixed', bottom: '76px', left: '12px', width: '320px', maxWidth: 'calc(100vw - 24px)',
            height: '440px', background: 'var(--bg3)', border: '1px solid var(--brd2)',
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
              }}>💬</div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt)' }}>Contact Sleektrade</div>
                <div style={{ fontSize: '9px', color: 'var(--txt3)' }}>Usually replies within 24h</div>
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
                  color: m.role === 'user' ? 'var(--ac2)' : 'var(--txt2)',
                }}
              >
                {m.text}
              </div>
            ))}
            {sending && (
              <div style={{ alignSelf: 'flex-start', fontSize: '10px', color: 'var(--txt4)', padding: '0 4px' }}>Sending...</div>
            )}
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
            {!userEmail && (
              <div style={{ fontSize: '9px', color: 'var(--txt4)', marginTop: '6px' }}>
                Replies go to your account email.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
