import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SYSTEM = `You are Sleek, the AI assistant for Sleektrade — a professional trading journal for day traders, swing traders, futures traders, and long-term investors.

About Sleektrade:
- Trading journal SaaS to track, analyze, and improve performance
- Features: Dashboard, Trade View, 7 report tabs with 25+ metrics, Position Size Calculator, Notebook, Strategies, Broker Import (DAS Trader, ThinkOrSwim, Interactive Brokers)
- Free plan: up to 50 trades/month, 1 trading account
- Pro plan: $19/mo or $15/mo yearly — unlimited trades, unlimited accounts, all features
- Elite plan: $29/mo or $23/mo yearly — everything in Pro plus priority support and early access

You also help with general trading questions: strategies, risk management, position sizing, R-multiple, profit factor, win rate, day trading, swing trading, futures, investing. Keep responses concise and friendly. You are not a financial advisor.`

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: SYSTEM,
        messages,
      }),
    })
    const data = await response.json()
    const text = data.content?.[0]?.text || 'Sorry, I could not get a response.'
    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ text: 'Sorry, something went wrong.' }, { status: 500 })
  }
}
