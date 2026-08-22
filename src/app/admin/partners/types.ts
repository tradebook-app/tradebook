export type Partner = {
  id: string
  name: string
  code: string | null
  rate: number
  months: number
  windowStart: string | null
  windowEnd: string | null
  signups: number
  grossTotal: number
  commissionTotal: number
  owed: number
  paid: number
}

export type LedgerRow = {
  id: string
  stripe_invoice_id: string
  gross_amount: number
  commission_amount: number
  status: string
  program: string
  reversal_of: string | null
  available_at: string
  paid_at: string | null
  created_at: string
}

export type MonthlyBucket = { month: string; commission: number }
