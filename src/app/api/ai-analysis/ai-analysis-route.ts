import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages, trades } = await req.json()

    // Build trade summary for context
    const closed = trades.filter((t: any) => t.status === 'closed' || !t.status)
    const totalTrades = closed.length
    const wins = closed.filter((t: any) => (t.pnl || 0) > 0)
    const losses = closed.filter((t: any) => (t.pnl || 0) < 0)
    const netPnl = closed.reduce((s: number, t: any) => s + (t.pnl || 0), 0)
    const winRate = totalTrades > 0 ? ((wins.length / totalTrades) * 100).toFixed(1) : 0
    const avgWin = wins.length > 0 ? wins.reduce((s: number, t: any) => s + t.pnl, 0) / wins.length : 0
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s: number, t: any) => s + t.pnl, 0) / losses.length) : 0
    const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : 0

    // Symbol breakdown
    const bySymbol: Record<string, { pnl: number; trades: number }> = {}
    closed.forEach((t: any) => {
      if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { pnl: 0, trades: 0 }
      bySymbol[t.symbol].pnl += t.pnl || 0
      bySymbol[t.symbol].trades++
    })
    const topSymbols = Object.entries(bySymbol)
      .sort((a, b) => b[1].pnl - a[1].pnl)
      .slice(0, 5)
      .map(([s, v]) => `${s}: $${v.pnl.toFixed(2)} (${v.trades} trades)`)
      .join(', ')

    // Setup breakdown
    const bySetup: Record<string, { pnl: number; trades: number; wins: number }> = {}
    closed.forEach((t: any) => {
      const setup = t.setup || 'No Setup'
      if (!bySetup[setup]) bySetup[setup] = { pnl: 0, trades: 0, wins: 0 }
      bySetup[setup].pnl += t.pnl || 0
      bySetup[setup].trades++
      if ((t.pnl || 0) > 0) bySetup[setup].wins++
    })
    const setupSummary = Object.entries(bySetup)
      .sort((a, b) => b[1].pnl - a[1].pnl)
      .slice(0, 5)
      .map(([s, v]) => `${s}: $${v.pnl.toFixed(2)}, ${((v.wins/v.trades)*100).toFixed(0)}% WR, ${v.trades} trades`)
      .join(' | ')

    // Time breakdown
    const byHour: Record<number, { pnl: number; trades: number }> = {}
    closed.forEach((t: any) => {
      if (t.time) {
        const hour = parseInt(t.time.substring(0, 2), 10)
        if (!byHour[hour]) byHour[hour] = { pnl: 0, trades: 0 }
        byHour[hour].pnl += t.pnl || 0
        byHour[hour].trades++
      }
    })
    const timeSummary = Object.entries(byHour)
      .sort((a, b) => b[1].pnl - a[1].pnl)
      .slice(0, 5)
      .map(([h, v]) => `${h}:00: $${v.pnl.toFixed(2)} (${v.trades} trades)`)
      .join(', ')

    // Recent trades
    const recentTrades = closed
      .slice(0, 10)
      .map((t: any) => `${t.symbol} ${t.type || 'Long'} $${(t.pnl || 0).toFixed(2)} ${t.setup || ''}`)
      .join(' | ')

    const systemPrompt = `You are Sleek AI, an expert trading performance analyst for Sleektrade. You analyze the user's real trade data and give personalized, specific, actionable insights like a professional trading coach.

Here is the user's trading data summary:
- Total trades: ${totalTrades}
- Net P&L: $${netPnl.toFixed(2)}
- Win rate: ${winRate}%
- Wins: ${wins.length}, Losses: ${losses.length}
- Avg win: $${avgWin.toFixed(2)}, Avg loss: $${avgLoss.toFixed(2)}
- Profit factor: ${profitFactor.toFixed(2)}
- Top symbols: ${topSymbols || 'N/A'}
- Setup performance: ${setupSummary || 'N/A'}
- Best trading hours: ${timeSummary || 'N/A'}
- Recent trades: ${recentTrades || 'N/A'}

Rules:
- Be specific and reference their actual numbers
- Be direct and concise — no fluff
- Give actionable advice, not generic tips
- Keep responses under 300 words unless asked for more
- Use bullet points for clarity when listing multiple things
- Never say "I don't have access to your data" — you have the summary above
- You are NOT a financial advisor — remind the user if they ask for specific trade recommendations
- Always end with one follow-up question to keep the conversation going`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ message: text })

  } catch (err: any) {
    console.error('AI Analysis error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
