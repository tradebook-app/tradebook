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
// one if missing. Returns the code. Always uses a service-role client
// internally: the collision check needs to see every OTHER user's
// referral_code too, which a session-scoped client's RLS-restricted view
// (own row only) can never do -- a session client would silently believe
// every already-taken code is free.
export async function ensureReferralCode(userId: string, seed: string): Promise<string> {
  const supabase = adminClient()

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
      // update, not upsert -- every profiles row already exists (created by
      // the handle_new_user() signup trigger), and the profiles column
      // lockdown (migration 004) only grants UPDATE, not INSERT, to
      // authenticated sessions. .select('id') lets us tell "wrote" apart
      // from "matched nothing" -- a bare update() reports no error either way.
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({ referral_code: code })
        .eq('id', userId)
        .select('id')

      if (error) {
        // The .maybeSingle() check above isn't atomic, so a genuine
        // collision on the unique constraint is possible under a race --
        // retry with a new suffix instead of failing the whole request.
        if (error.code === '23505') {
          code = `${base}-${randomSuffix()}`
          attempt++
          continue
        }
        throw new Error(`Failed to persist referral code: ${error.message}`)
      }
      // Zero rows matched means no profiles row exists for this user at all
      // (e.g. an auth.users row predating the handle_new_user() trigger) --
      // returning `code` here would hand out a link that was never saved.
      if (!updated || updated.length === 0) {
        throw new Error(`No profiles row found for user ${userId} -- cannot persist referral code`)
      }
      return code
    }
    code = `${base}-${randomSuffix()}`
    attempt++
  }

  // Extremely unlikely fallback: fully random code
  const fallback = randomSuffix(10)
  const { data: updated, error } = await supabase
    .from('profiles')
    .update({ referral_code: fallback })
    .eq('id', userId)
    .select('id')
  if (error) throw new Error(`Failed to persist fallback referral code: ${error.message}`)
  if (!updated || updated.length === 0) {
    throw new Error(`No profiles row found for user ${userId} -- cannot persist fallback referral code`)
  }
  return fallback
}

// Service-role client — needed because attribution can run before the user
// has a confirmed session (e.g. immediately after signUp(), or server-side
// during the OAuth callback before any RLS-scoped client is available).
// Exported so other routes writing privilege-bearing profiles columns
// (checkout, sync — see migration 004) can reuse it instead of duplicating.
export function adminClient() {
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
