import { describe, expect, it } from 'vitest'
import { apiError, apiSuccess } from '@/lib/api/responses'

describe('API response helpers', () => {
  it('returns structured errors with request id', async () => {
    const request = new Request('https://silox.test/api/example', {
      headers: { 'x-request-id': 'req-test-1' },
    })

    const response = apiError(request, 400, 'validation_error', 'Invalid input', { field: 'ticker' })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(response.headers.get('X-Request-ID')).toBe('req-test-1')
    expect(body).toEqual({
      error: 'Invalid input',
      code: 'validation_error',
      requestId: 'req-test-1',
      details: { field: 'ticker' },
    })
  })

  it('adds request id to successful response bodies', async () => {
    const request = new Request('https://silox.test/api/example', {
      headers: { 'x-request-id': 'req-test-2' },
    })

    const response = apiSuccess(request, { success: true })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Request-ID')).toBe('req-test-2')
    expect(body).toEqual({ success: true, requestId: 'req-test-2' })
  })
})
