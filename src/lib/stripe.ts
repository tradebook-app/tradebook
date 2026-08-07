import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'placeholder', {
  apiVersion: '2024-04-10',
})

// Single source of truth for mapping a Stripe price ID to a plan tier.
// Used by checkout, the webhook, and the sync route so they can never disagree.
// Reads the same NEXT_PUBLIC_STRIPE_* env vars the checkout page uses.
export function planForPriceId(priceId?: string | null): 'pro' | 'elite' | 'free' {
  if (!priceId) return 'free'
  const elite = [
    process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_ELITE_YEARLY_PRICE_ID,
  ].filter(Boolean)
  const pro = [
    process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID,
  ].filter(Boolean)
  if (elite.includes(priceId)) return 'elite'
  if (pro.includes(priceId)) return 'pro'
  // Surface drift instead of hiding it, but still grant access on a real purchase.
  console.error('planForPriceId: unrecognized Stripe price id', priceId)
  return 'pro'
}

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    tradeLimit: 50,
    priceId: null,
  },
  pro: {
    name: 'Pro',
    price: 29,
    tradeLimit: Infinity,
    priceId: process.env.STRIPE_PRO_PRICE_ID || null,
  },
}
