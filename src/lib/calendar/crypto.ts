// src/lib/calendar/crypto.ts
//
// AES-256-GCM for Google OAuth tokens at rest.
//
// RLS is not enough on its own: a service-role query, a database dump, or a
// backup restored somewhere less careful would otherwise hand over live
// Google credentials. GCM is authenticated, so tampering fails loudly rather
// than decrypting to garbage.
//
// Server only. Importing this from a client component will not resolve
// node:crypto, which is the intended outcome.

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12 // 96 bits, the value GCM is specified for
const KEY_BYTES = 32
/** Payload version, so the key or algorithm can change without a data migration. */
const VERSION = 'v1'

let cachedKey: Buffer | null = null

/**
 * The 32-byte key from TOKEN_ENCRYPTION_KEY, accepted as base64 or hex.
 *
 * Read lazily rather than at module load so that importing this file in a
 * context without the env var (a build, a test that never encrypts) does not
 * throw.
 */
function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey

  const raw = process.env.TOKEN_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY is not set. Generate one with: ' +
        'openssl rand -base64 32'
    )
  }

  const decoded = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64')

  if (decoded.length !== KEY_BYTES) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${decoded.length}. ` +
        'Generate one with: openssl rand -base64 32'
    )
  }

  cachedKey = decoded
  return decoded
}

/** Test seam: forget the memoised key after changing the env var. */
export function resetEncryptionKeyCache(): void {
  cachedKey = null
}

/**
 * Encrypt a token.
 *
 * Returns `v1.<iv>.<tag>.<ciphertext>`, all base64url. A fresh random IV per
 * call means encrypting the same token twice produces different output, which
 * is required for GCM to stay secure.
 */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

/** Decrypt a payload produced by `encryptToken`. Throws if it was tampered with. */
export function decryptToken(payload: string): string {
  const parts = payload.split('.')
  if (parts.length !== 4) {
    throw new Error('Malformed encrypted token: expected 4 dot-separated parts')
  }

  const [version, ivPart, tagPart, ciphertextPart] = parts
  if (version !== VERSION) {
    throw new Error(`Unsupported encrypted token version: ${version}`)
  }

  const iv = Buffer.from(ivPart, 'base64url')
  const tag = Buffer.from(tagPart, 'base64url')
  const ciphertext = Buffer.from(ciphertextPart, 'base64url')

  if (iv.length !== IV_BYTES) {
    throw new Error(`Malformed encrypted token: IV must be ${IV_BYTES} bytes`)
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv)
  decipher.setAuthTag(tag)

  // decipher.final() throws on a bad tag — that is the integrity check.
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/** True if `value` looks like output of `encryptToken`, without decrypting it. */
export function isEncryptedToken(value: string): boolean {
  const parts = value.split('.')
  if (parts.length !== 4) return false
  const expected = Buffer.from(VERSION)
  const actual = Buffer.from(parts[0])
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
