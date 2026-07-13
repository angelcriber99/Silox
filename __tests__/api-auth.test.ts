import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}))

import { requireApiUser } from '@/lib/server/api-auth'

describe('API authentication', () => {
  beforeEach(() => {
    getUser.mockReset()
  })

  it('returns a 401 response when there is no authenticated user', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })

    const result = await requireApiUser()

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected an authentication failure')
    expect(result.response.status).toBe(401)
    await expect(result.response.json()).resolves.toEqual({ error: 'No autorizado' })
  })

  it('returns the verified Supabase user', async () => {
    const user = { id: 'user-123' }
    getUser.mockResolvedValue({ data: { user }, error: null })

    const result = await requireApiUser()

    expect(result).toEqual({ ok: true, user })
  })
})
