import crypto from 'crypto'

// Signs and verifies unsubscribe links so a user ID can't be forged.
// The token is an HMAC of the user's ID keyed by NEWSLETTER_UNSUB_SECRET.
// No DB storage needed — verification is purely cryptographic.

function getSecret(): string {
  const secret = process.env.NEWSLETTER_UNSUB_SECRET
  if (!secret) throw new Error('NEWSLETTER_UNSUB_SECRET is not set')
  return secret
}

export function signUnsubToken(userId: string): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(userId)
    .digest('hex')
}

export function verifyUnsubToken(userId: string, token: string): boolean {
  const expected = signUnsubToken(userId)
  // Constant-time compare to avoid timing attacks. Bail if lengths differ,
  // since timingSafeEqual throws on mismatched buffer lengths.
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function buildUnsubUrl(userId: string): string {
  const token = signUnsubToken(userId)
  return `https://sleektrade.app/api/newsletter/unsubscribe?uid=${userId}&token=${token}`
}
