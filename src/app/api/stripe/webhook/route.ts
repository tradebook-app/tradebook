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
          const { data: p, error: lookupErr } = await supabase
            .from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle()
          if (lookupErr) {
            console.error('checkout.session.completed: failed to look up profile for customer', customerId, lookupErr)
            return NextResponse.json({ error: 'Failed to look up profile' }, { status: 500 })
          }
          userId = p?.id
        }

        if (!userId || !subscriptionId) {
          console.error('checkout.session.completed: could not resolve user for customer', customerId)
          break
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0]?.price.id
        const plan = planForPriceId(priceId)

        const { error: upsertErr } = await supabase.from('profiles').upsert({
          id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: 'active',
          plan,
        })
        if (upsertErr) {
          console.error('checkout.session.completed: failed to upsert profile for user', userId, upsertErr)
          return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any
        const userId = subscription.metadata?.supabase_user_id
        if (!userId) break

        const priceId = subscription.items.data[0]?.price.id
        const plan = planForPriceId(priceId)
        const status = subscription.status

        const { error: upsertErr } = await supabase.from('profiles').upsert({
          id: userId,
          stripe_subscription_id: subscription.id,
          subscription_status: status,
          plan: status === 'active' ? plan : 'free',
        })
        if (upsertErr) {
          console.error('customer.subscription.updated: failed to upsert profile for user', userId, upsertErr)
          return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any
        const userId = subscription.metadata?.supabase_user_id
        if (!userId) break

        const { error: upsertErr } = await supabase.from('profiles').upsert({
          id: userId,
          stripe_subscription_id: null,
          subscription_status: 'canceled',
          plan: 'free',
        })
        if (upsertErr) {
          console.error('customer.subscription.deleted: failed to upsert profile for user', userId, upsertErr)
          return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any
        const customerId = invoice.customer

        const { data: profile, error: lookupErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        // .single() reports "no rows" (PGRST116) as an error even though it's
        // an expected outcome (customer not linked to a profile) -- only
        // treat other codes as a genuine failure worth retrying.
        if (lookupErr && lookupErr.code !== 'PGRST116') {
          console.error('invoice.payment_failed: failed to look up profile for customer', customerId, lookupErr)
          return NextResponse.json({ error: 'Failed to look up profile' }, { status: 500 })
        }

        if (profile) {
          const { error: upsertErr } = await supabase.from('profiles').upsert({
            id: profile.id,
            subscription_status: 'past_due',
          })
          if (upsertErr) {
            console.error('invoice.payment_failed: failed to upsert profile for user', profile.id, upsertErr)
            return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
          }
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
        const { error: ledgerErr } = await supabase.from('referral_commissions').upsert({
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
        if (ledgerErr) {
          console.error('invoice.paid: failed to upsert referral_commissions for invoice', invoiceId, ledgerErr)
          return NextResponse.json({ error: 'Failed to record commission' }, { status: 500 })
        }
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as any
        if (!charge.invoice) break // not an invoice payment -- nothing to claw back
        if ((charge.amount_refunded || 0) < charge.amount) break // partial refund: out of scope for v1

        const { data: original, error: lookupErr } = await supabase
          .from('referral_commissions')
          .select('id, referrer_id, referred_user_id, gross_amount, commission_amount, program')
          .eq('stripe_invoice_id', charge.invoice)
          .maybeSingle()

        if (lookupErr) {
          console.error('charge.refunded: failed to look up referral_commissions for invoice', charge.invoice, lookupErr)
          return NextResponse.json({ error: 'Failed to look up commission' }, { status: 500 })
        }

        if (!original) break // this invoice was never commissioned

        // stripe_invoice_id is unique, so the reversal needs its own key.
        // charge.id is stable across webhook redeliveries for the same
        // refund, so upserting on it is idempotent, exactly like the
        // invoice.paid handler above.
        const { error: reversalErr } = await supabase.from('referral_commissions').upsert({
          referrer_id: original.referrer_id,
          referred_user_id: original.referred_user_id,
          stripe_invoice_id: `refund_${charge.id}`,
          gross_amount: -Number(original.gross_amount),
          commission_amount: -Number(original.commission_amount),
          status: 'pending',
          // No 30-day hold on a reversal -- it should net against the next
          // payout run immediately, even if the original commission was
          // already paid out (that case produces a negative balance for
          // the admin to resolve manually; cash already wired can't be
          // un-sent by this system).
          available_at: new Date().toISOString(),
          program: original.program,
          reversal_of: original.id,
          paid_at: null,
        }, { onConflict: 'stripe_invoice_id' })
        if (reversalErr) {
          console.error('charge.refunded: failed to upsert reversal for charge', charge.id, reversalErr)
          return NextResponse.json({ error: 'Failed to record reversal' }, { status: 500 })
        }
        break
      }
    }
  } catch (err: any) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
