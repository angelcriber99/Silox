import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cookieGetUser: vi.fn(),
  bearerGetUser: vi.fn(),
  createBearerClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.cookieGetUser } })),
}))

vi.mock('@supabase/supabase-js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@supabase/supabase-js')>()
  return {
    ...actual,
    createClient: mocks.createBearerClient,
  }
})

import { MobileApiError, mobileHandler, mobileJson } from '@/lib/mobile/api'
import { requireMobileUser } from '@/lib/mobile/auth'

describe('mobile API authentication and contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    mocks.createBearerClient.mockReturnValue({ auth: { getUser: mocks.bearerGetUser } })
  })

  it('uses a verified bearer token for native requests', async () => {
    const user = { id: 'user-native', created_at: '2026-07-17T00:00:00Z' }
    mocks.bearerGetUser.mockResolvedValue({ data: { user }, error: null })

    const result = await requireMobileUser(new Request('http://localhost/api/mobile/v1/me', {
      headers: { Authorization: 'Bearer native-jwt' },
    }))

    expect(mocks.bearerGetUser).toHaveBeenCalledWith('native-jwt')
    expect(result).toMatchObject({ user, method: 'bearer' })
  })

  it('falls back to the verified cookie session for web requests', async () => {
    const user = { id: 'user-web', created_at: '2026-07-17T00:00:00Z' }
    mocks.cookieGetUser.mockResolvedValue({ data: { user }, error: null })

    const result = await requireMobileUser(new Request('http://localhost/api/mobile/v1/me'))

    expect(result).toMatchObject({ user, method: 'cookie' })
    expect(mocks.createBearerClient).not.toHaveBeenCalled()
  })

  it('rejects malformed authorization instead of falling back to cookies', async () => {
    await expect(requireMobileUser(new Request('http://localhost/api/mobile/v1/me', {
      headers: { Authorization: 'Basic credentials' },
    }))).rejects.toMatchObject({ status: 401, code: 'invalid_authorization' })
    expect(mocks.cookieGetUser).not.toHaveBeenCalled()
  })

  it('returns the uniform error envelope and request id', async () => {
    const request = new Request('http://localhost/api/mobile/v1/test', {
      headers: { 'x-request-id': 'request-123' },
    })
    const response = await mobileHandler(request, async () => {
      throw new MobileApiError(404, 'not_found', 'No existe', { resource: 'test' })
    })

    expect(response.status).toBe(404)
    expect(response.headers.get('x-request-id')).toBe('request-123')
    await expect(response.json()).resolves.toEqual({
      error: { code: 'not_found', message: 'No existe', details: { resource: 'test' } },
      requestId: 'request-123',
    })
  })

  it('wraps successful payloads in data and disables private caching', async () => {
    const response = mobileJson({ id: 'user-1' }, 'request-1')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    await expect(response.json()).resolves.toEqual({ data: { id: 'user-1' } })
  })
})
