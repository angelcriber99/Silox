import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  fetchMarketPrices: vi.fn(),
  requireMobileUser: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createSupabaseClient }))
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }))
vi.mock('@/lib/actions/market', () => ({ fetchMarketPrices: mocks.fetchMarketPrices }))
vi.mock('@/lib/mobile/auth', () => ({ requireMobileUser: mocks.requireMobileUser }))

import { GET as getWidgetSummary } from '@/app/api/widget/summary/route'
import { DELETE, POST, PUT } from '@/app/api/widget/token/route'
import { hashWidgetToken, isOpaqueWidgetToken } from '@/lib/server/widget-tokens'

function positionsQuery(data: unknown[] = []) {
  const eq = vi.fn().mockResolvedValue({ data, error: null })
  const select = vi.fn(() => ({ eq }))
  return { client: { from: vi.fn(() => ({ select })) }, eq }
}

describe('widget access tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchMarketPrices.mockResolvedValue({ prices: {} })
  })

  it('rejects the legacy predictable Widget-<userId> credential', async () => {
    const jwtClient = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) } }
    mocks.createSupabaseClient.mockReturnValue(jwtClient)

    const response = await getWidgetSummary(new Request('http://localhost/api/widget/summary', {
      headers: { authorization: 'Bearer Widget-00000000-0000-0000-0000-000000000001' },
    }))

    expect(response.status).toBe(401)
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('accepts an active opaque token, resolves only its stored hash and scopes the read', async () => {
    const rawToken = 'swx_widget_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG'
    const tokenLookup = {
      maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: 'owner-123' }, error: null }),
    }
    const credentialEq = vi.fn(() => ({ is: vi.fn(() => tokenLookup) }))
    const positions = positionsQuery()
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const admin = {
      from: vi.fn((table: string) => table === 'widget_access_tokens'
        ? {
            select: vi.fn(() => ({
              eq: credentialEq,
            })),
            update: vi.fn(() => ({ eq: updateEq })),
          }
        : positions.client.from()),
    }
    mocks.getSupabaseAdmin.mockReturnValue(admin)

    const response = await getWidgetSummary(new Request('http://localhost/api/widget/summary', {
      headers: { authorization: `Bearer ${rawToken}` },
    }))

    expect(response.status).toBe(200)
    expect(admin.from).toHaveBeenCalledWith('widget_access_tokens')
    expect(credentialEq).toHaveBeenCalledWith('token_hash', hashWidgetToken(rawToken))
    expect(positions.eq).toHaveBeenCalledWith('user_id', 'owner-123')
    expect(JSON.stringify(credentialEq.mock.calls)).not.toContain(rawToken)
  })

  it('rejects an unknown or revoked opaque token before reading portfolio data', async () => {
    const rawToken = 'swx_widget_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG'
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const positions = positionsQuery()
    const admin = {
      from: vi.fn((table: string) => table === 'widget_access_tokens'
        ? { select: vi.fn(() => ({ eq: vi.fn(() => ({ is: vi.fn(() => ({ maybeSingle })) })) })) }
        : positions.client.from()),
    }
    mocks.getSupabaseAdmin.mockReturnValue(admin)

    const response = await getWidgetSummary(new Request('http://localhost/api/widget/summary', {
      headers: { authorization: `Bearer ${rawToken}` },
    }))

    expect(response.status).toBe(401)
    expect(positions.client.from).not.toHaveBeenCalled()
  })

  it('preserves standard Supabase JWT access through the RLS client', async () => {
    const positions = positionsQuery()
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'jwt-user' } }, error: null })
    mocks.createSupabaseClient.mockReturnValue({ ...positions.client, auth: { getUser } })

    const response = await getWidgetSummary(new Request('http://localhost/api/widget/summary', {
      headers: { authorization: 'Bearer standard.jwt.token' },
    }))

    expect(response.status).toBe(200)
    expect(positions.eq).toHaveBeenCalledWith('user_id', 'jwt-user')
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('issues a random secret once and stores only its SHA-256 hash', async () => {
    mocks.requireMobileUser.mockResolvedValue({ user: { id: 'owner-123' } })
    const insert = vi.fn().mockResolvedValue({ error: null })
    mocks.getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => ({ insert })) })

    const response = await POST(new Request('http://localhost/api/widget/token', {
      method: 'POST', headers: { authorization: 'Bearer native-jwt' },
    }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(isOpaqueWidgetToken(body.token)).toBe(true)
    expect(body.token).not.toContain('owner-123')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'owner-123',
      token_hash: hashWidgetToken(body.token),
    }))
    expect(JSON.stringify(insert.mock.calls)).not.toContain(body.token)
  })

  it('rotates by revoking the old token before inserting a new one', async () => {
    mocks.requireMobileUser.mockResolvedValue({ user: { id: 'owner-123' } })
    const revokeEq = vi.fn().mockResolvedValue({ error: null })
    const insert = vi.fn().mockResolvedValue({ error: null })
    mocks.getSupabaseAdmin.mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn(() => ({ is: vi.fn(() => ({ eq: revokeEq })) })),
        insert,
      })),
    })

    const response = await PUT(new Request('http://localhost/api/widget/token', {
      method: 'PUT', headers: { authorization: 'Bearer native-jwt' },
    }))

    expect(response.status).toBe(200)
    expect(revokeEq).toHaveBeenCalledWith('user_id', 'owner-123')
    expect(insert).toHaveBeenCalledOnce()
  })

  it('revokes only the authenticated user tokens and blocks unauthenticated management', async () => {
    mocks.requireMobileUser.mockRejectedValueOnce(
      new (await import('@/lib/mobile/api')).MobileApiError(401, 'unauthorized', 'No autorizado'),
    )
    const deleteRequest = () => new Request('http://localhost/api/widget/token', { method: 'DELETE' })
    expect((await DELETE(deleteRequest())).status).toBe(401)
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()

    mocks.requireMobileUser.mockResolvedValueOnce({ user: { id: 'owner-123' } })
    const revokeEq = vi.fn().mockResolvedValue({ error: null })
    mocks.getSupabaseAdmin.mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn(() => ({ is: vi.fn(() => ({ eq: revokeEq })) })),
      })),
    })

    expect((await DELETE(deleteRequest())).status).toBe(200)
    expect(revokeEq).toHaveBeenCalledWith('user_id', 'owner-123')
  })
})
