'use client'

import type { TradeRow } from '@/lib/types'
import { TradovateImport } from './TradovateImport'

type Props = {
  userId: string
  existingTrades: TradeRow[]
  onImported: (trades: TradeRow[]) => void
}

// NinjaTrader Web's Orders CSV export is byte-for-byte the same column schema as
// Tradovate's own export (confirmed against a real NinjaTrader Web file on
// 2026-07-17 — same account ID format, same columns down to spreadDefinitionId,
// decimalLimit, Notional Value). NinjaTrader Web runs on Tradovate's platform
// underneath, so this just reuses that already-validated parser with NinjaTrader-
// specific copy instead of duplicating any logic.
//
// This does NOT cover NinjaTrader Desktop (NinjaTrader 8) — that's a different
// product with its own native export format and would need its own parser built
// against a real sample file if that's ever needed.
export function NinjaTraderImport({ userId, existingTrades, onImported }: Props) {
  return (
    <TradovateImport
      userId={userId}
      existingTrades={existingTrades}
      onImported={onImported}
      brokerLabel="NinjaTrader Web"
      fileHint="Orders CSV"
      exportSteps={[
        'Open NinjaTrader Web and go to the Orders panel',
        'Set your date range',
        'Right-click inside the Orders grid and choose Export (or use the download icon)',
        'Upload the CSV file above',
      ]}
    />
  )
}
