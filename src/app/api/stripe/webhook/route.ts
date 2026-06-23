import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

function detectPlan(priceId: string | undefined): 'elite' | 'pro' | 'free' {
  if (!priceId) return 'free'
  const eliteMonthly = process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID
  const eliteYearly = process.env.NEXT_PUBLIC_STRIPE_ELITE_YEARLY_PRICE_ID
  if (priceId === eliteMonthly || priceId === eliteYearly) return 'elite'
  return 'pro'
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature error:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.CheckoutSession

      // userId lives on the subscription metadata, not session.subscription_data
      let userId = session.metadata?.supabase_user_id

      if (!userId && session.subscription) {
        // Fetch the subscription to get metadata set via subscription_data.metadata
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        userId = subscription.metadata?.supabase_user_id
      }

      if (!userId && session.customer) {
        // Fallback: look up via customer metadata
        const customer = await stripe.customers.retrieve(session.customer as string) as Stripe.Customer
        userId = customer.metadata?.supabase_user_id
      }

      if (userId && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        const priceId = subscription.items?.data[0]?.price?.id
        const plan = detectPlan(priceId)
        await supabase.from('profiles').upsert({
          id: userId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          subscription_status: 'active',
          plan,
        })
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id
      if (userId) {
        const isActive = sub.status === 'active' || sub.status === 'trialing'
        const priceId = sub.items?.data[0]?.price?.id
        const plan = !isActive ? 'free' : detectPlan(priceId)
        await supabase.from('profiles').upsert({
          id: userId,
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          plan,
        })
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id
      if (userId) {
        await supabase.from('profiles').upsert({
          id: userId,
          stripe_subscription_id: null,
          subscription_status: 'canceled',
          plan: 'free',
        })
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
