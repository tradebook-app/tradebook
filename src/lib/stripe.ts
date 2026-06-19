import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'placeholder', {
  apiVersion: '2024-04-10',
})

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
