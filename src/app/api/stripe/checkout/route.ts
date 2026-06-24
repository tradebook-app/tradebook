import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createClientBrowser } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

const PRICE_IDS: Record<string, string | undefined> = {
  pro_monthly:   process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
  pro_yearly:    process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID,
  elite_monthly: process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID,
  elite_yearly:  process.env.NEXT_PUBLIC_STRIPE_ELITE_YEARLY_PRICE_ID,
}

export async function POST(req: Request) {
  try {
    let user: any = null

    // Try cookie-based auth first (app shell)
    const supabase = createClient()
    const { data: { user: cookieUser } } = await supabase.auth.getUser()
    user = cookieUser

    // Fall back to Bearer token auth (standalone billing page)
    if (!user) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '')
        const adminClient = createClientBrowser(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: { user: tokenUser } } = await adminClient.auth.getUser(token)
        user = tokenUser
      }
    }

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    let priceId: string | undefined = body.priceId

    if (!priceId && body.tier) {
      const cycle = body.cycle === 'yearly' ? 'yearly' : 'monthly'
      priceId = PRICE_IDS[`${body.tier}_${cycle}`]
    }

    if (!priceId) {
      return NextResponse.json({ error: 'Price not configured. Contact support.' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await supabase.from('profiles').upsert({ id: user.id, stripe_customer_id: customerId })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
      subscription_data: { metadata: { supabase_user_id: user.id } },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
