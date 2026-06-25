import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

const PRICE_IDS: Record<string, string> = {
  'pro-monthly':   'price_1TmAfF9nrVYxaG6HQ5fUZu10',
  'pro-yearly':    'price_1TmAfd9nrVYxaG6HpLuJiSoj',
  'elite-monthly': 'price_1TmAdF9nrVYxaG6H0kGCwAZA',
  'elite-yearly':  'price_1TmAeO9nrVYxaG6H3EiqB7Xw',
}

export async function POST(req: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    let priceId: string | undefined = body.priceId

    if (!priceId && body.tier) {
      const cycle = body.cycle === 'yearly' ? 'yearly' : 'monthly'
      priceId = PRICE_IDS[`${body.tier}_${cycle}`]
    }

    if (!priceId) {
      return NextResponse.json({ error: 'Price not configured.' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId)
      } catch {
        customerId = null
      }
    }

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