import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  createClient: vi.fn(),
  from: vi.fn(),
  deleteRows: vi.fn(),
  eq: vi.fn(),
}))

vi.mock('@/lib/server/api-auth', () => ({
  requireApiUser: mocks.requireApiUser,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

import { POST } from '@/app/api/nuke-history/route'

describe('POST /api/nuke-history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createClient.mockResolvedValue({ from: mocks.from })
    mocks.from.mockReturnValue({ delete: mocks.deleteRows })
    mocks.deleteRows.mockReturnValue({ eq: mocks.eq })
    mocks.eq.mockResolvedValue({ error: null })
  })

  it('rejects unauthenticated deletion before opening a database client', async () => {
    mocks.requireApiUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'No autorizado' }, { status: 401 }),
    })

    const response = await POST()

    expect(response.status).toBe(401)
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.deleteRows).not.toHaveBeenCalled()
  })

  it('scopes destructive deletion to the authenticated user', async () => {
    mocks.requireApiUser.mockResolvedValue({
      ok: true,
      user: { id: 'user-safe-scope' },
    })

    const response = await POST()

    expect(response.status).toBe(200)
    expect(mocks.from).toHaveBeenCalledWith('portfolio_history')
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'user-safe-scope')
    await expect(response.json()).resolves.toMatchObject({ success: true })
  })

  it('returns a database failure without reporting a false success', async () => {
    mocks.requireApiUser.mockResolvedValue({
      ok: true,
      user: { id: 'user-safe-scope' },
    })
    mocks.eq.mockResolvedValue({ error: { message: 'delete failed' } })

    const response = await POST()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'delete failed' })
  })
})
