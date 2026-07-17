import { describe, expect, it, vi } from 'vitest'
import { runIdempotent } from '@/lib/mobile/idempotency'

const requestBody = { assetId: '0df5ee48-bfa1-42a3-bca9-d7894bc18437', quantity: 1 }

function request(key?: string) {
  return new Request('http://localhost/api/mobile/v1/transactions', {
    method: 'POST',
    headers: key ? { 'Idempotency-Key': key } : {},
  })
}

describe('mobile financial idempotency', () => {
  it('requires an idempotency key before writing', async () => {
    const context = { user: { id: 'user-1' }, supabase: { from: vi.fn() } } as never
    await expect(runIdempotent(context, request(), 'req-1', requestBody, vi.fn()))
      .rejects.toMatchObject({ status: 400, code: 'idempotency_key_required' })
  })

  it('replays the stored result and does not execute a duplicate mutation', async () => {
    const reserve = {
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } }),
        })),
      })),
    }
    const lookupMaybeSingle = vi.fn()
    const lookup = {
      select: vi.fn(() => ({
        match: vi.fn(() => ({
          maybeSingle: lookupMaybeSingle,
        })),
      })),
    }
    const from = vi.fn()
      .mockReturnValueOnce(reserve)
      .mockReturnValueOnce(lookup)
    const action = vi.fn()
    const context = { user: { id: 'user-1' }, supabase: { from } } as never

    // Capture the hash generated for this payload, then expose it as the stored hash.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(requestBody)))
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    lookupMaybeSingle.mockResolvedValue({
      data: { request_hash: hash, status: 'completed', response_status: 201, response_body: { id: 'transaction-1' } },
      error: null,
    })

    const response = await runIdempotent(context, request('same-operation'), 'req-2', requestBody, action)

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ data: { id: 'transaction-1' } })
    expect(action).not.toHaveBeenCalled()
  })
})
