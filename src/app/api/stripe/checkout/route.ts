import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// Price ID map lives SERVER-SIDE only — no need for NEXT_PUBLIC_ vars
const PRICE_IDS: Record<string, string | undefined> = {
  pro_monthly:    process.env.STRIPE_PRO_PRICE_ID        || process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
  pro_yearly:     process.env.STRIPE_PRO_YEARLY_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID,
  elite_monthly:  process.env.STRIPE_ELITE_PRICE_ID      || process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID,
  elite_yearly:   process.env.STRIPE_ELITE_YEARLY_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_ELITE_YEARLY_PRICE_ID,
}

export async function POST(req: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    // Support both old way (priceId directly) and new way (tier + cycle)
    let priceId: string | undefined = body.priceId

    if (!priceId && body.tier) {
      const cycle = body.cycle === 'yearly' ? 'yearly' : 'monthly'
      const key = `${body.tier}_${cycle}`
      priceId = PRICE_IDS[key]
    }

    if (!priceId) {
      console.error('No price ID found. PRICE_IDS:', PRICE_IDS, 'body:', body)
      return NextResponse.json({ error: 'Price ID not configured. Please contact support.' }, { status: 400 })
    }

    // Check if customer already exists
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

      await supabase
        .from('profiles')
        .upsert({ id: user.id, stripe_customer_id: customerId })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
