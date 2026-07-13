import { describe, expect, it } from 'vitest'
import { authorizeCronRequest } from '@/lib/server/cron-auth'

describe('cron authorization', () => {
  it('fails closed when CRON_SECRET is not configured', () => {
    const request = new Request('https://silox.test/api/cron/snapshot')

    expect(authorizeCronRequest(request, undefined)).toEqual({
      authorized: false,
      status: 500,
      error: 'CRON_SECRET not configured',
    })
  })

  it('rejects a missing or invalid bearer token', () => {
    const request = new Request('https://silox.test/api/cron/snapshot', {
      headers: { authorization: 'Bearer wrong-secret' },
    })

    expect(authorizeCronRequest(request, 'expected-secret')).toEqual({
      authorized: false,
      status: 401,
      error: 'Unauthorized',
    })
  })

  it('accepts the configured bearer token', () => {
    const request = new Request('https://silox.test/api/cron/snapshot', {
      headers: { authorization: 'Bearer expected-secret' },
    })

    expect(authorizeCronRequest(request, 'expected-secret')).toEqual({
      authorized: true,
    })
  })
})
