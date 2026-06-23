import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

function detectPlan(priceId: string | undefined): 'elite' | 'pro' | 'free' {
  if (!priceId) return 'free'
  const eliteMonthly = process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID
  const eliteYearly = process.env.NEXT_PUBLIC_STRIPE_ELITE_YEARLY_PRICE_ID
  if (priceId === eliteMonthly || priceId === eliteYearly) return 'elite'
  return 'pro'
}

export async function POST() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get the profile to find the Stripe customer ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ plan: 'free', synced: false })
    }

    // Fetch active subscriptions from Stripe directly
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'active',
      limit: 1,
    })

    if (subscriptions.data.length === 0) {
      // No active subscription — check for trialing
      const trialing = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'trialing',
        limit: 1,
      })

      if (trialing.data.length === 0) {
        return NextResponse.json({ plan: 'free', synced: false })
      }

      const sub = trialing.data[0]
      const priceId = sub.items.data[0]?.price?.id
      const plan = detectPlan(priceId)

      await supabase.from('profiles').upsert({
        id: user.id,
        stripe_subscription_id: sub.id,
        subscription_status: 'trialing',
        plan,
      })

      return NextResponse.json({ plan, synced: true })
    }

    const sub = subscriptions.data[0]
    const priceId = sub.items.data[0]?.price?.id
    const plan = detectPlan(priceId)

    await supabase.from('profiles').upsert({
      id: user.id,
      stripe_subscription_id: sub.id,
      subscription_status: 'active',
      plan,
    })

    return NextResponse.json({ plan, synced: true })
  } catch (err: any) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
