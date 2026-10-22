import { expect, test } from 'vitest'
import { hashToken } from '../lib/auth'
import { checkRateLimit } from '../lib/rate-limit'

test('hashToken produces consistent SHA-256 hex digest', () => {
  const token = 'my-secret-token-123'
  const h1 = hashToken(token)
  const h2 = hashToken(token)
  expect(h1).toBe(h2)
  expect(h1.length).toBe(64)
})

test('checkRateLimit allows up to maxAttempts and blocks excess', () => {
  const key = 'test-ip:test@test.com'
  for (let i = 0; i < 5; i++) {
    expect(checkRateLimit(key, 5, 60000)).toBe(true)
  }
  expect(checkRateLimit(key, 5, 60000)).toBe(false)
})
