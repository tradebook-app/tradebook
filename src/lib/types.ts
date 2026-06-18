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

// ─── Insert Types (omit auto-generated fields) ───────────────────────────────

export type TradeInsert = Omit<TradeRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>
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

// ─── Supabase Database type (for typed client) ───────────────────────────────

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
    }
  }
}
