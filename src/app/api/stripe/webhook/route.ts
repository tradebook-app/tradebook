import { NextResponse } from 'next/server'
import { stripe, planForPriceId } from '@/lib/stripe'
import { computeCommission, isWithinCommissionWindow } from '@/lib/commission'
import { adminClient } from '@/lib/referrals'

export const dynamic = 'force-dynamic'

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

  // Service-role: a Stripe webhook has no browser session/cookie at all, and
  // needs to write profiles/referral_commissions rows for users other than
  // any caller. Session-scoped RLS was never the right model here.
  const supabase = adminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any
        const customerId = session.customer
        const subscriptionId = session.subscription

        // Prefer session metadata / client_reference_id; fall back to a lookup by
        // Stripe customer id so a grant still happens even if metadata is absent.
        let userId = session.metadata?.supabase_user_id || session.client_reference_id
        if (!userId && customerId) {
          const { data: p } = await supabase
            .from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle()
          userId = p?.id
        }

        if (!userId || !subscriptionId) {
          console.error('checkout.session.completed: could not resolve user for customer', customerId)
          break
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0]?.price.id
        const plan = planForPriceId(priceId)

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
        const plan = planForPriceId(priceId)
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
        const amountPaidCents = invoice.amount_paid || 0

        const { data: payer } = await supabase
          .from('profiles')
          .select('id, referred_by, created_at')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (!payer || !payer.referred_by) break // this customer wasn't referred

        const { data: referrer } = await supabase
          .from('profiles')
          .select('is_partner, commission_rate, commission_months')
          .eq('id', payer.referred_by)
          .maybeSingle()

        if (!referrer) break // referrer account no longer exists

        if (!isWithinCommissionWindow(payer.created_at, referrer.commission_months, new Date().toISOString())) {
          break // outside this referrer's earning window
        }

        const amounts = computeCommission(amountPaidCents, referrer.commission_rate)
        if (!amounts) break // zero/negative payment -- nothing to commission

        const availableAt = new Date()
        availableAt.setDate(availableAt.getDate() + 30) // 30-day holding period

        // stripe_invoice_id has a unique constraint, so this is safe to call
        // even if Stripe redelivers the same webhook event.
        await supabase.from('referral_commissions').upsert({
          referrer_id: payer.referred_by,
          referred_user_id: payer.id,
          stripe_invoice_id: invoiceId,
          gross_amount: amounts.grossUsd,
          commission_amount: amounts.commissionUsd,
          status: 'pending',
          available_at: availableAt.toISOString(),
          program: referrer.is_partner ? 'partner' : 'friend',
          reversal_of: null,
          paid_at: null,
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
