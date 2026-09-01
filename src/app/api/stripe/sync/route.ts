import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/referrals'
import { stripe, planForPriceId } from '@/lib/stripe'

export async function POST() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, plan, plan_override')
      .eq('id', user.id)
      .single()

    // Manual/founder-comp accounts (see supabase/migrations/006_add_plan_override.sql)
    // are managed outside Stripe entirely -- never let a sync (even one
    // triggered by this same account going through checkout) touch plan for
    // it. Checked before the Stripe lookup so this never makes a Stripe call
    // for an override account either.
    if (profile?.plan_override) {
      return NextResponse.json({ plan: profile.plan ?? 'free', synced: false, override: true })
    }

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ plan: 'free', synced: false })
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'active',
      limit: 1,
    })

    if (subscriptions.data.length === 0) {
      return NextResponse.json({ plan: 'free', synced: false })
    }

    const sub = subscriptions.data[0]
    const priceId = sub.items.data[0]?.price?.id
    const plan = planForPriceId(priceId)

    // Service-role: subscription_status/plan are no longer client-column-
    // writable (see supabase/migrations/004_lock_profiles_privilege_columns.sql)
    // -- these values are only trustworthy here because Stripe itself was
    // just queried above to confirm an active subscription, so the write
    // goes via the service-role client instead of the caller's own session,
    // matching the webhook's existing pattern.
    const { error: syncErr } = await adminClient().from('profiles').upsert({
      id: user.id,
      stripe_subscription_id: sub.id,
      subscription_status: 'active',
      plan,
    })
    if (syncErr) {
      console.error('sync: failed to save subscription for user', user.id, syncErr)
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({ plan, synced: true })
  } catch (err: any) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}