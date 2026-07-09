import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PRICE_TO_PLAN: Record<string, string> = {
  'price_1TmAfF9nrVYxaG6HQ5fUZu10': 'pro',
  'price_1TmAfd9nrVYxaG6HpLuJiSoj': 'pro',
  'price_1TmAdF9nrVYxaG6H0kGCwAZA': 'elite',
  'price_1TmAeO9nrVYxaG6H3EiqB7Xw': 'elite',
}

function getPlan(priceId: string): string {
  return PRICE_TO_PLAN[priceId] || 'pro'
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  const supabase = createClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any
        const customerId = session.customer
        const subscriptionId = session.subscription
        const userId = session.metadata?.supabase_user_id

        if (!userId || !subscriptionId) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0]?.price.id
        const plan = getPlan(priceId)

        await supabase.from('profiles').upsert({
          id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: 'active',
          plan,
        })
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any
        const userId = subscription.metadata?.supabase_user_id
        if (!userId) break

        const priceId = subscription.items.data[0]?.price.id
        const plan = getPlan(priceId)
        const status = subscription.status

        await supabase.from('profiles').upsert({
          id: userId,
          stripe_subscription_id: subscription.id,
          subscription_status: status,
          plan: status === 'active' ? plan : 'free',
        })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any
        const userId = subscription.metadata?.supabase_user_id
        if (!userId) break

        await supabase.from('profiles').upsert({
          id: userId,
          stripe_subscription_id: null,
          subscription_status: 'canceled',
          plan: 'free',
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any
        const customerId = invoice.customer

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile) {
          await supabase.from('profiles').upsert({
            id: profile.id,
            subscription_status: 'past_due',
          })
        }
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as any
        const customerId = invoice.customer
        const invoiceId = invoice.id
        const amountPaid = (invoice.amount_paid || 0) / 100 // cents -> dollars

        if (amountPaid <= 0) break

        const { data: payer } = await supabase
          .from('profiles')
          .select('id, referred_by, created_at')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (!payer || !payer.referred_by) break // this customer wasn't referred

        // Commission window: 6 months from the referred user's signup
        const signupDate = new Date(payer.created_at)
        const sixMonthsLater = new Date(signupDate)
        sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)
        if (new Date() > sixMonthsLater) break // outside the earning window

        const commissionAmount = parseFloat((amountPaid * 0.20).toFixed(2))
        const availableAt = new Date()
        availableAt.setDate(availableAt.getDate() + 30) // 30-day holding period

        // stripe_invoice_id has a unique constraint, so this is safe to call
        // even if Stripe redelivers the same webhook event.
        await supabase.from('referral_commissions').upsert({
          referrer_id: payer.referred_by,
          referred_user_id: payer.id,
          stripe_invoice_id: invoiceId,
          gross_amount: amountPaid,
          commission_amount: commissionAmount,
          status: 'pending',
          available_at: availableAt.toISOString(),
        }, { onConflict: 'stripe_invoice_id' })
        break
      }
    }
  } catch (err: any) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
