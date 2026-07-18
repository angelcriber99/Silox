import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/logo/route'

describe('asset logo proxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects unsafe ticker values before contacting a provider', async () => {
    const externalFetch = vi.fn()
    vi.stubGlobal('fetch', externalFetch)

    const response = await GET(new NextRequest('http://localhost/api/logo?ticker=../../secret'))

    expect(response.status).toBe(400)
    expect(externalFetch).not.toHaveBeenCalled()
  })

  it('returns and caches a valid provider image', async () => {
    const externalFetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([137, 80, 78, 71]), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    }))
    vi.stubGlobal('fetch', externalFetch)

    const response = await GET(new NextRequest('http://localhost/api/logo?ticker=asts'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('cache-control')).toContain('stale-while-revalidate')
    expect(externalFetch).toHaveBeenCalledWith(
      'https://financialmodelingprep.com/image-stock/ASTS.png',
      expect.objectContaining({ next: { revalidate: 86400 } }),
    )
  })
})
