import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Public, unauthenticated landing-page widget (src/components/SleektradeChat.tsx).
// Unlike /api/support-chat and /api/ai-analysis, there's no signed-in user to
// rate-limit by id, so this limits by IP instead. In-memory only — resets on
// cold start / differs per serverless instance — but that's an acceptable
// tradeoff for a low-stakes marketing widget rather than standing up a DB
// table + RLS policy for anonymous writes.
const REQUESTS_PER_WINDOW = 20
const WINDOW_MS = 60 * 60 * 1000
const hits = new Map<string, { count: number; windowStart: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = hits.get(ip)
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now })
    return false
  }
  entry.count++
  return entry.count > REQUESTS_PER_WINDOW
}

const SYSTEM_PROMPT = `You are Sleek, the AI assistant on Sleektrade's public marketing website — talking to a visitor who has not signed up yet. Sleektrade is a professional trading journal SaaS for day traders, swing traders, futures traders, and long-term investors.

IMPORTANT: Never mention any founder or team member by name in your replies. Refer to the team collectively if needed.

Here is accurate, ground-truth knowledge about Sleektrade. Never invent features, pages, or pricing beyond what's listed here.

WHAT SLEEKTRADE DOES:
- A trading journal: log trades (manually or import from a broker), see win rate/profit factor/P&L breakdowns, review trades in a calendar-style Journal, keep free-form notes, build a Strategies playbook, and get AI-powered analysis of your own trading performance (Sleek AI, Pro+).
- Broker imports currently supported: DAS, ThinkorSwim (TOS), IBKR. Webull, Tastytrade, and TradeStation are marked "Coming Soon."
- Also includes a market scanner and a position-size calculator.

PLANS:
- Free: 1 trading account, 50-trade limit
- Pro: 3 trading accounts, includes Sleek AI access
- Elite: unlimited trading accounts, full feature set
- Exact pricing is shown on the Pricing section of the site — if asked for a specific dollar figure you're not certain of, point them to the Pricing section instead of guessing.

RULES:
- Be concise, friendly, and specific. No fluff, no generic corporate tone.
- You may also answer general trading/finance education questions (e.g. "what is profit factor?"), but you are NOT a financial advisor — never give personalized investment advice or trade recommendations.
- Only reference pages, features, and flows listed above. If asked about something not listed here, say you're not sure and suggest they sign up or reach out via the Contact page.
- Keep responses under 120 words unless the question genuinely needs more.
- Never claim to be human. You're Sleek, an AI assistant.`

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
    if (isRateLimited(ip)) {
      return NextResponse.json({
        error: 'rate_limited',
        message: "I've hit my limit for now — please try again in a bit, or reach out via the Contact page.",
      }, { status: 429 })
    }

    const { messages } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ text })

  } catch (err: any) {
    console.error('Public chat error:', err)
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 })
  }
}
