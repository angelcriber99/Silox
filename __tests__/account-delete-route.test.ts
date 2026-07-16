import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  from: vi.fn(),
  deleteRows: vi.fn(),
  eq: vi.fn(),
  deleteUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }))

import { DELETE } from '@/app/api/account/delete/route'

const request = (confirmation = 'BORRAR') => new Request('http://localhost/api/account/delete', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ confirmation }),
})

describe('DELETE /api/account/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } })
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-to-delete' } }, error: null })
    mocks.getSupabaseAdmin.mockReturnValue({ from: mocks.from, auth: { admin: { deleteUser: mocks.deleteUser } } })
    mocks.from.mockReturnValue({ delete: mocks.deleteRows })
    mocks.deleteRows.mockReturnValue({ eq: mocks.eq })
    mocks.eq.mockResolvedValue({ error: null })
    mocks.deleteUser.mockResolvedValue({ error: null })
  })

  it('requires an authenticated user and the explicit confirmation', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    expect((await DELETE(request())).status).toBe(401)
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()

    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-to-delete' } }, error: null })
    expect((await DELETE(request('NO'))).status).toBe(400)
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('removes every user-owned table before deleting the Auth identity', async () => {
    const response = await DELETE(request())

    expect(response.status).toBe(200)
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual([
      'alertas',
      'expenses',
      'budget_settings',
      'portfolio_history',
      'portfolio_snapshots',
      'eventos_recurrentes',
      'transacciones',
      'activos',
    ])
    expect(mocks.eq).toHaveBeenCalledTimes(8)
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'user-to-delete')
    expect(mocks.deleteUser).toHaveBeenCalledWith('user-to-delete')
    await expect(response.json()).resolves.toEqual({ success: true })
  })

  it('does not report success or delete Auth when a data table fails', async () => {
    mocks.eq.mockResolvedValueOnce({ error: { message: 'database failure' } })

    const response = await DELETE(request())

    expect(response.status).toBe(500)
    expect(mocks.deleteUser).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('database failure') })
  })
})
