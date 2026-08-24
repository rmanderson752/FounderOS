// src/lib/calendar/crypto.test.ts

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import {
  decryptToken,
  encryptToken,
  isEncryptedToken,
  resetEncryptionKeyCache,
} from './crypto'

const KEY_A = randomBytes(32).toString('base64')
const KEY_B = randomBytes(32).toString('base64')

function useKey(key: string | undefined) {
  if (key === undefined) delete process.env.TOKEN_ENCRYPTION_KEY
  else process.env.TOKEN_ENCRYPTION_KEY = key
  resetEncryptionKeyCache()
}

const original = process.env.TOKEN_ENCRYPTION_KEY

beforeEach(() => useKey(KEY_A))
afterEach(() => useKey(original))

describe('encryptToken / decryptToken', () => {
  it('round-trips a token', () => {
    const token = 'ya29.a0AfH6SMB-not-a-real-token'
    expect(decryptToken(encryptToken(token))).toBe(token)
  })

  it('round-trips unicode and empty strings', () => {
    expect(decryptToken(encryptToken(''))).toBe('')
    expect(decryptToken(encryptToken('refresh—✓—token'))).toBe('refresh—✓—token')
  })

  it('never emits the plaintext', () => {
    const payload = encryptToken('super-secret-refresh-token')
    expect(payload).not.toContain('super-secret')
  })

  it('produces different ciphertext each call, from a fresh IV', () => {
    const a = encryptToken('same-token')
    const b = encryptToken('same-token')
    expect(a).not.toBe(b)
    expect(decryptToken(a)).toBe(decryptToken(b))
  })

  it('accepts a hex key as well as base64', () => {
    const hex = randomBytes(32).toString('hex')
    useKey(hex)
    expect(decryptToken(encryptToken('token'))).toBe('token')
  })
})

describe('tamper resistance', () => {
  it('rejects a modified ciphertext', () => {
    const parts = encryptToken('token').split('.')
    const bytes = Buffer.from(parts[3], 'base64url')
    bytes[0] ^= 0xff
    parts[3] = bytes.toString('base64url')
    expect(() => decryptToken(parts.join('.'))).toThrow()
  })

  it('rejects a modified auth tag', () => {
    const parts = encryptToken('token').split('.')
    const tag = Buffer.from(parts[2], 'base64url')
    tag[0] ^= 0xff
    parts[2] = tag.toString('base64url')
    expect(() => decryptToken(parts.join('.'))).toThrow()
  })

  it('rejects decryption under a different key', () => {
    const payload = encryptToken('token')
    useKey(KEY_B)
    expect(() => decryptToken(payload)).toThrow()
  })

  it('rejects malformed payloads', () => {
    expect(() => decryptToken('nonsense')).toThrow(/Malformed/)
    expect(() => decryptToken('v9.a.b.c')).toThrow(/Unsupported/)
    expect(() => decryptToken('v1.short.tag.cipher')).toThrow(/Malformed|IV/)
  })
})

describe('key configuration', () => {
  it('explains how to generate a key when the env var is missing', () => {
    useKey(undefined)
    expect(() => encryptToken('token')).toThrow(/openssl rand -base64 32/)
  })

  it('rejects a key of the wrong length', () => {
    useKey(randomBytes(16).toString('base64'))
    expect(() => encryptToken('token')).toThrow(/32 bytes/)
  })
})

describe('isEncryptedToken', () => {
  it('recognises its own output and rejects plaintext', () => {
    expect(isEncryptedToken(encryptToken('token'))).toBe(true)
    expect(isEncryptedToken('ya29.plaintext-token')).toBe(false)
    expect(isEncryptedToken('')).toBe(false)
  })
})
