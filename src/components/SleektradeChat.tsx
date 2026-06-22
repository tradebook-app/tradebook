'use client'

import { useState, useRef, useEffect } from 'react'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

export function SleektradeChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm Sleek, your trading assistant. Ask me anything about Sleektrade or trading in general 📈" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const allMessages = [...messages, userMsg]
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await response.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.text }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    }
    setLoading(false)
  }

  return (
    <>
      <div style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 1000 }}>
        {open && (
          <div style={{
            position: 'absolute', bottom: '64px', left: 0,
            width: '360px', height: '500px',
            background: '#0d0d11', border: '1px solid rgba(16,185,129,.25)',
            borderRadius: '16px', display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 64px rgba(0,0,0,.6)', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.06)',
              display: 'flex', alignItems: 'center', gap: '10px',
              background: 'rgba(16,185,129,.06)',
            }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #10B981, #062e21)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
              }}>📈</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Sleek AI</div>
                <div style={{ fontSize: '10px', color: '#10B981' }}>● Online · Trading Assistant</div>
              </div>
              <button onClick={() => setOpen(false)} style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: '18px', lineHeight: 1,
              }}>×</button>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '16px',
              display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '85%', padding: '10px 14px',
                    borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: m.role === 'user' ? '#10B981' : 'rgba(255,255,255,.06)',
                    color: m.role === 'user' ? '#000' : '#e0e0e0',
                    fontSize: '12px', lineHeight: 1.6, fontWeight: m.role === 'user' ? 600 : 400,
                  }}>
                    <span dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
                    background: 'rgba(255,255,255,.06)', fontSize: '12px', color: 'rgba(255,255,255,.4)',
                  }}>Thinking...</div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Suggested questions */}
            {messages.length === 1 && (
              <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['What is Sleektrade?', 'How much does Pro cost?', 'What is profit factor?', 'How to size positions?'].map(q => (
                  <button key={q} onClick={() => setInput(q)} style={{
                    fontSize: '10px', padding: '4px 10px', borderRadius: '20px',
                    background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)',
                    color: '#10B981', cursor: 'pointer', fontFamily: 'inherit',
                  }}>{q}</button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{
              padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.06)',
              display: 'flex', gap: '8px',
            }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask me anything..."
                style={{
                  flex: 1, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
                  borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '12px',
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button onClick={sendMessage} disabled={loading || !input.trim()} style={{
                background: '#10B981', border: 'none', borderRadius: '8px',
                width: '36px', height: '36px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: loading || !input.trim() ? 0.5 : 1,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
                  <path d="m22 2-7 20-4-9-9-4 20-7z"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        <button onClick={() => setOpen(!open)} style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: open ? 'rgba(255,255,255,.1)' : 'linear-gradient(135deg, #10B981, #062e21)',
          border: '1px solid rgba(16,185,129,.3)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(16,185,129,.3)', fontSize: '22px', transition: '.2s',
        }}>
          {open ? '×' : '💬'}
        </button>
      </div>
    </>
  )
}
