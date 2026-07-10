// Generates a short, URL-friendly referral code from a name or email,
// falling back to a random code, and retrying on collision.

import { createClient } from '@supabase/supabase-js'

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 20)
}

function randomSuffix(len = 4): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789' // no ambiguous chars
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

// Ensures the given user has a referral_code on their profile row, generating
// one if missing. Returns the code. `supabase` should be a client with
// permission to read/write this user's profile row (service-role or session).
export async function ensureReferralCode(supabase: any, userId: string, seed: string): Promise<string> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', userId)
    .maybeSingle()

  if (existing?.referral_code) return existing.referral_code

  const base = slugify(seed) || 'user'
  let code = base
  let attempt = 0

  while (attempt < 8) {
    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .eq('referral_code', code)
      .maybeSingle()

    if (!taken) {
      const { error } = await supabase.from('profiles').upsert({ id: userId, referral_code: code })
      if (!error) return code
    }
    code = `${base}-${randomSuffix()}`
    attempt++
  }

  // Extremely unlikely fallback: fully random code
  const fallback = randomSuffix(10)
  await supabase.from('profiles').upsert({ id: userId, referral_code: fallback })
  return fallback
}

// Service-role client — needed because attribution can run before the user
// has a confirmed session (e.g. immediately after signUp(), or server-side
// during the OAuth callback before any RLS-scoped client is available).
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type AttributeReferralResult = { ok: boolean; reason?: string }

// Shared attribution logic used by both /api/referrals/attribute (client-driven,
// email/password signups) and /auth/callback (server-driven, Google OAuth
// signups, where localStorage isn't reachable). Safe to call more than once
// for the same user — it no-ops if the user is already attributed.
export async function attributeReferral(userId: string, code: string): Promise<AttributeReferralResult> {
  const supabase = adminClient()

  const { data: referrer } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', code)
    .maybeSingle()

  if (!referrer) return { ok: false, reason: 'Unknown referral code' }
  if (referrer.id === userId) return { ok: false, reason: 'Cannot refer yourself' }

  // Only set referred_by if not already set (don't overwrite an earlier attribution)
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('referred_by')
    .eq('id', userId)
    .maybeSingle()

  if (existingProfile?.referred_by) {
    return { ok: false, reason: 'User already attributed' }
  }

  await supabase.from('profiles').upsert({ id: userId, referred_by: referrer.id })
  return { ok: true }
}
