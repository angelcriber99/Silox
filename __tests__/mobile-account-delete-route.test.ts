import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireMobileUser: vi.fn(),
  deleteUserAccount: vi.fn(),
}))

vi.mock('@/lib/mobile/auth', () => ({ requireMobileUser: mocks.requireMobileUser }))
vi.mock('@/lib/server/delete-account', () => ({ deleteUserAccount: mocks.deleteUserAccount }))

import { DELETE } from '@/app/api/mobile/v1/me/route'

function request(confirmation = 'BORRAR') {
  return new Request('https://silox.test/api/mobile/v1/me', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
    body: JSON.stringify({ confirmation }),
  })
}

describe('DELETE /api/mobile/v1/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireMobileUser.mockResolvedValue({ user: { id: 'mobile-user' }, method: 'bearer' })
    mocks.deleteUserAccount.mockResolvedValue(undefined)
  })

  it('deletes the authenticated account after explicit confirmation', async () => {
    const response = await DELETE(request())
    expect(response.status).toBe(204)
    expect(mocks.deleteUserAccount).toHaveBeenCalledWith('mobile-user')
  })

  it('rejects an invalid confirmation without deleting data', async () => {
    const response = await DELETE(request('NO'))
    expect(response.status).toBe(400)
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled()
  })
})
