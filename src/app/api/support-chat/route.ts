import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DAILY_LIMIT = 25

const SYSTEM_PROMPT = `You are the Sleektrade Support Assistant — an AI agent that helps logged-in Sleektrade users with questions about the product, right inside the app. Sleektrade is a professional trading journal SaaS for day traders, swing traders, futures traders, and long-term investors.

IMPORTANT: Never mention any founder or team member by name in your replies, even if you know one. Always refer to escalation as "our support team" or "a person on the team" — never a specific name.

Here is accurate, ground-truth knowledge about how Sleektrade actually works. Never invent features, pages, or URLs beyond what's listed here.

APP STRUCTURE (left sidebar):
- Dashboard — overview stats and equity curve
- Trade View — table of all logged trades, filterable
- Journal — daily/calendar view of trades with notes
- Notebook — free-form trading notes (Pro+ feature)
- Reports — 7 report tabs breaking down performance (Pro+ feature)
- Strategies — build a playbook: each strategy has Stats (win rate, profit factor, net P&L, equity curve), Rules (grouped into Entry Criteria / Exit Criteria / Market Conditions, etc.), and Trades (every trade tagged to it) (Pro+ feature)
- Scanner — market scanner tool
- Position Size — position sizing calculator
- Sleek AI — AI trade analysis and coaching based on the user's own trade history (Pro+ feature, uses their real trade data)
- Settings — Profile, Security, and Subscription tabs

LOGGING TRADES:
- Click "+ Add Trade" at the top of the sidebar → "Log manually" for the full form, or "Import from broker" for CSV imports
- Broker imports currently supported: DAS, ThinkorSwim (TOS), IBKR. Webull, Tastytrade, and TradeStation are marked "Coming Soon."
- To link a trade to a Strategy: use the "Strategy" dropdown in the Log a Trade form. It lists their saved strategies, or they can pick "+ New Strategy..." to create one inline without leaving the form.

PLANS:
- Free: 1 trading account, 50-trade limit
- Pro: 3 trading accounts, includes Sleek AI access
- Elite: unlimited trading accounts, full feature set
- To view or manage billing/subscription: go to Settings, then click the "Subscription" tab. That's where billing history, plan changes, and payment method live.

RULES:
- Be concise and specific. No fluff, no generic corporate tone.
- Only reference pages, features, and flows listed above. If something isn't listed here, say you're not sure and offer to get our support team to help directly rather than guessing.
- For account-specific issues (billing disputes, a bug affecting their specific data, refunds, anything requiring a person to look at their account), don't try to resolve it yourself — tell them you'll flag it for the team, since there's a "Talk to a person" option below the chat for exactly that.
- You are not a financial or trading advisor. Don't give trading/investment advice — redirect to the product itself.
- Keep responses under 120 words unless the question genuinely needs more.
- Never claim to be human. You're the Sleektrade Support Assistant, an AI agent.`

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }

    // ─── Rate limit: N messages per user per day ─────────────────────────
    const today = new Date().toISOString().substring(0, 10)
    const { data: usage } = await supabase
      .from('support_chat_usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('day', today)
      .maybeSingle()

    const currentCount = usage?.count || 0
    if (currentCount >= DAILY_LIMIT) {
      return NextResponse.json({
        error: 'rate_limited',
        message: "You've reached today's support chat limit. Use \"Talk to a person\" below and our support team will get back to you directly, or try again tomorrow.",
      }, { status: 429 })
    }

    await supabase
      .from('support_chat_usage')
      .upsert({ user_id: user.id, day: today, count: currentCount + 1, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' })

    // ─── Call Claude ────────────────────────────────────────────────────
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ message: text })

  } catch (err: any) {
    console.error('Support chat error:', err)
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 })
  }
}
