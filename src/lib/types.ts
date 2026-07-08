// ============================================================
// TRADEBOOK — TypeScript Types
// ============================================================

// ─── Database Row Types (match Supabase schema exactly) ─────────────────────

export type TradeRow = {
  id: string
  user_id: string
  symbol: string
  type: 'Long' | 'Short'
  date: string           // ISO timestamptz
  exit_date: string | null
  entry: number
  exit: number | null
  shares: number
  pnl: number
  risk: number
  commission: number
  setup: string | null
  grade: string | null
  tags: string[]
  notes: string | null
  screenshot_url: string | null
  strategy_id: string | null
  account_id: string | null
  created_at: string
  updated_at: string
}

export type NoteRow = {
  id: string
  user_id: string
  category: 'trade' | 'my'
  title: string
  body: string
  img_url: string | null
  created_at: string
  updated_at: string
}

export type StrategyRow = {
  id: string
  user_id: string
  name: string
  rules: string | null
  img_url: string | null
  created_at: string
  updated_at: string
}

export type StrategyRuleGroupRow = {
  id: string
  strategy_id: string
  name: string
  position: number
  created_at: string
}

export type StrategyRuleRow = {
  id: string
  group_id: string
  text: string
  position: number
  created_at: string
}

// Nested shape used everywhere in the UI: a group with its rules attached
export type StrategyRuleGroupWithRules = StrategyRuleGroupRow & {
  rules: StrategyRuleRow[]
}

// ─── Insert Types (omit auto-generated fields) ───────────────────────────────

export type TradeInsert = Omit<TradeRow, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'strategy_id' | 'account_id'> & {
  strategy_id?: string | null
  account_id?: string | null
}
export type NoteInsert  = Omit<NoteRow,  'id' | 'user_id' | 'created_at' | 'updated_at'>
export type StrategyInsert = Omit<StrategyRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>

// ─── Update Types (all optional) ─────────────────────────────────────────────

export type TradeUpdate    = Partial<TradeInsert>
export type NoteUpdate     = Partial<NoteInsert>
export type StrategyUpdate = Partial<StrategyInsert>

// ─── UI / Form Types ─────────────────────────────────────────────────────────

export type TradeFormData = {
  symbol: string
  type: 'Long' | 'Short'
  date: string
  exitDate: string
  entry: string
  exit: string
  shares: string
  pnl: string          // overridable
  risk: string
  commission: string
  setup: string
  grade: string
  tags: string[]
  notes: string
  screenshotFile: File | null
  screenshotPreview: string | null  // base64 for preview
}

export type NoteFormData = {
  category: 'trade' | 'my'
  title: string
  body: string
  imgFile: File | null
  imgPreview: string | null
}

export type StrategyFormData = {
  name: string
  rules: string
  imgFile: File | null
  imgPreview: string | null
}

// A rule group as edited in the strategy form, before it's saved to the DB
// (no ids yet for new groups/rules — those get assigned on save)
export type StrategyRuleGroupDraft = {
  id?: string        // present if editing an existing group
  name: string
  rules: { id?: string; text: string }[]
}

// ─── Dashboard / Analytics Types ─────────────────────────────────────────────

export type TradeStatus = 'win' | 'loss' | 'be' | 'open'

export type DayStats = {
  date: string       // YYYY-MM-DD
  pnl: number
  trades: number
  wins: number
}

export type WeekStats = {
  week: number
  pnl: number
  days: number
}

export type SymbolStats = {
  symbol: string
  pnl: number
  trades: number
  wins: number
  grossWin: number
  grossLoss: number
}

export type DowStats = {
  day: string
  pnl: number
  trades: number
  wins: number
}

export type KPIData = {
  netPnl: number
  winRate: number
  profitFactor: number
  avgWinLossRatio: number
  avgWin: number
  avgLoss: number
  wins: number
  losses: number
  breakeven: number
  totalTrades: number
}

// Stats for a single strategy, computed from the trades tagged to it
export type StrategyStats = {
  trades: number
  wins: number
  losses: number
  winRate: number
  profitFactor: number
  netPnl: number
  grossWin: number
  grossLoss: number
  avgWin: number
  avgLoss: number
}

// ─── Date Range Filter ───────────────────────────────────────────────────────

export type DateRange = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom'

export type DateRangeFilter = {
  range: DateRange
  from?: string    // YYYY-MM-DD
  to?: string      // YYYY-MM-DD
}

// ─── DAS Import ──────────────────────────────────────────────────────────────

export type DASParsedTrade = {
  sym: string
  date: Date
  side: 'Long' | 'Short'
  entry: number
  exit: number
  shares: number
  pl: number
  open?: boolean
  entryTime?: number
  exitTime?: number
}

export type SupportChatUsageRow = {
  user_id: string
  day: string
  count: number
  updated_at: string
}

// ─── Supabase Database type (for typed client) ───────────────────────────────

export type OpenLegRow = {
  id: string
  user_id: string
  symbol: string
  side: 'Long' | 'Short'
  qty: number
  price: number
  opened_at: string
  commission: number
  broker: string
  created_at: string
}
export type OpenLegInsert = Omit<OpenLegRow, 'id' | 'created_at'>

export type Database = {
  public: {
    Tables: {
      trades: {
        Row: TradeRow
        Insert: TradeInsert & { user_id: string }
        Update: TradeUpdate
      }
      notes: {
        Row: NoteRow
        Insert: NoteInsert & { user_id: string }
        Update: NoteUpdate
      }
      strategies: {
        Row: StrategyRow
        Insert: StrategyInsert & { user_id: string }
        Update: StrategyUpdate
      }
      strategy_rule_groups: {
        Row: StrategyRuleGroupRow
        Insert: Omit<StrategyRuleGroupRow, 'id' | 'created_at'>
        Update: Partial<Omit<StrategyRuleGroupRow, 'id' | 'created_at'>>
      }
      strategy_rules: {
        Row: StrategyRuleRow
        Insert: Omit<StrategyRuleRow, 'id' | 'created_at'>
        Update: Partial<Omit<StrategyRuleRow, 'id' | 'created_at'>>
      }
      support_chat_usage: {
        Row: SupportChatUsageRow
        Insert: SupportChatUsageRow
        Update: Partial<SupportChatUsageRow>
      }
      open_legs: {
        Row: OpenLegRow
        Insert: OpenLegInsert
        Update: Partial<OpenLegInsert>
      }
    }
  }
}
