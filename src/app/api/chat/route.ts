import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `You are Sleek, the AI assistant for Sleektrade — a professional trading journal for day traders, swing traders, futures traders, and long-term investors.

About Sleektrade:
- A trading journal SaaS that helps traders and investors track, analyze, and improve their performance
- Features: Dashboard with P&L charts, Trade View (log/filter/grade trades), 7 report tabs with 25+ metrics, Position Size Calculator, Notebook, Strategies, Broker Import (DAS Trader, ThinkOrSwim, Interactive Brokers)
- Pricing: Free ($0 - up to 50 trades/month, 1 trading account), Pro ($19/mo or $15/mo yearly - unlimited trades, unlimited accounts, all features), Elite ($29/mo or $23/mo yearly - everything in Pro + priority support + early access)
- Built by an active trader who trades US stocks, NQ futures, and swing positions

You can also help with general trading questions:
- Trading concepts, strategies, risk management
- How to analyze trade performance
- Position sizing, R-multiple, profit factor explanations
- Day trading, swing trading, futures, investing tips

Keep responses concise, friendly, and helpful. For trading advice, be educational but always note you are not a financial advisor.`

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
        system: SYSTEM_PROMPT,
        messages,
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || 'Sorry, I could not get a response.'
    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ text: 'Sorry, something went wrong. Please try again.' }, { status: 500 })
  }
}
