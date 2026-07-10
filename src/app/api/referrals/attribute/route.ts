import { NextResponse } from 'next/server'
import { attributeReferral } from '@/lib/referrals'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { userId, code } = await request.json()
  if (!userId || !code) return NextResponse.json({ error: 'userId and code are required' }, { status: 400 })

  const result = await attributeReferral(userId, code)
  return NextResponse.json(result)
}
