'use client'

import { useState, useRef, useEffect } from 'react'
import type { TradeRow } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

type Message = { role: 'user' | 'assistant'; content: string }

// Sleektrade brand mark — reused instead of a generic robot icon
function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ flexShrink: 0, borderRadius: size >= 32 ? '12px' : '8px' }}>
      <rect x="0" y="0" width="64" height="64" rx="14" fill="#062e21"/>
      <rect x="11" y="13" width="42" height="4" rx="2" fill="#5DCAA5"/>
      <rect x="11" y="21" width="42" height="4" rx="2" fill="#5DCAA5" opacity={0.5}/>
      <rect x="11" y="29" width="28" height="4" rx="2" fill="#5DCAA5" opacity={0.22}/>
      <polyline points="11,51 22,39 33,45 51,27" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="11" cy="51" r="2.5" fill="#5DCAA5" opacity={0.7}/>
      <circle cx="22" cy="39" r="2.5" fill="#5DCAA5" opacity={0.7}/>
      <circle cx="33" cy="45" r="2.5" fill="#5DCAA5" opacity={0.7}/>
      <circle cx="51" cy="27" r="3.5" fill="#5DCAA5"/>
    </svg>
  )
}

const QUICK_QUESTIONS = [
  'What are my best setups?',
  'When should I stop trading?',
  'What mistakes am I repeating?',
  'Which symbols should I focus on?',
  'How can I improve my win rate?',
  'What is hurting my performance?',
  'Analyze my risk management',
  'Give me a full performance review',
]

type Props = { trades: TradeRow[] }

export function AIAnalysis({ trades }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [firstName, setFirstName] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    async function loadName() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('first_name').eq('id', user.id).single()
      if (data?.first_name) setFirstName(data.first_name)
      else if (user.email) setFirstName(user.email.split('@')[0])
    }
    loadName()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, trades }),
      })
      const data = await res.json()
      if (data.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const hasMessages = messages.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', maxWidth: '800px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ padding: '0 0 16px', borderBottom: '1px solid var(--brd)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', flexShrink: 0,
          }}><Logo size={40} /></div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800 }}>Sleek AI</div>
            <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>Your personal trading performance analyst</div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              style={{
                marginLeft: 'auto', fontSize: '11px', fontWeight: 600,
                color: 'var(--txt3)', background: 'var(--bg3)',
                border: '1px solid var(--brd)', borderRadius: '6px',
                padding: '5px 10px', cursor: 'pointer', fontFamily: 'var(--sans)',
              }}
            >
              New chat
            </button>
          )}
        </div>
      </div>

      {/* Messages or Welcome */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        {!hasMessages ? (
          <div style={{ textAlign: 'center', paddingTop: '20px' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>
              Good {getTimeOfDay()}, {firstName || 'trader'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--txt3)', marginBottom: '32px', lineHeight: 1.6 }}>
              I've analyzed your {trades.length} trades. Ask me anything about your performance.
            </div>

            {/* Quick questions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '600px', margin: '0 auto' }}>
              {QUICK_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  style={{
                    fontSize: '12px', fontWeight: 600, padding: '8px 16px',
                    background: 'var(--bg3)', border: '1px solid var(--brd2)',
                    borderRadius: '20px', cursor: 'pointer', color: 'var(--txt2)',
                    fontFamily: 'var(--sans)', transition: '.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(16,185,129,.4)'
                    e.currentTarget.style.color = 'var(--ac2)'
                    e.currentTarget.style.background = 'var(--ac-d)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--brd2)'
                    e.currentTarget.style.color = 'var(--txt2)'
                    e.currentTarget.style.background = 'var(--bg3)'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                gap: '10px',
                alignItems: 'flex-start',
              }}>
                {m.role === 'assistant' && <Logo size={30} />}
                <div style={{
                  maxWidth: '75%',
                  padding: '12px 16px',
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user' ? '#10B981' : 'var(--bg3)',
                  color: m.role === 'user' ? '#000' : 'var(--txt)',
                  fontSize: '13px',
                  lineHeight: 1.7,
                  border: m.role === 'assistant' ? '1px solid var(--brd)' : 'none',
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <Logo size={30} />
                <div style={{
                  padding: '12px 16px', borderRadius: '14px 14px 14px 4px',
                  background: 'var(--bg3)', border: '1px solid var(--brd)',
                  display: 'flex', gap: '4px', alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: '#10B981', opacity: 0.6,
                      animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ paddingTop: '16px', borderTop: '1px solid var(--brd)', marginTop: '16px' }}>
        <div style={{
          display: 'flex', gap: '10px', alignItems: 'flex-end',
          background: 'var(--bg3)', border: '1px solid var(--brd2)',
          borderRadius: '12px', padding: '10px 14px',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything about your trading performance..."
            rows={1}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--txt)', fontSize: '13px', fontFamily: 'var(--sans)',
              resize: 'none', lineHeight: 1.5, maxHeight: '120px', overflowY: 'auto',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
              background: input.trim() && !loading ? '#10B981' : 'var(--bg4)',
              border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', transition: '.15s',
            }}
          >
            {loading ? '⏳' : '↑'}
          </button>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--txt3)', textAlign: 'center', marginTop: '6px' }}>
          Sleek AI can make mistakes. Not financial advice.
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
