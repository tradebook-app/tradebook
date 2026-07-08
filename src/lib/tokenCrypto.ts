import crypto from 'crypto'

// Requires a 32-byte key in BROKER_TOKEN_ENCRYPTION_KEY (base64-encoded).
// Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
function getKey(): Buffer {
  const raw = process.env.BROKER_TOKEN_ENCRYPTION_KEY
  if (!raw) throw new Error('BROKER_TOKEN_ENCRYPTION_KEY is not set')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('BROKER_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes')
  return key
}

// Format stored in DB: base64(iv) . base64(authTag) . base64(ciphertext)
export function encryptToken(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join('.')
}

export function decryptToken(stored: string): string {
  const key = getKey()
  const [ivB64, tagB64, dataB64] = stored.split('.')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed encrypted token')
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const ciphertext = Buffer.from(dataB64, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}
