import { mobileHandler, mobileJson } from '@/lib/mobile/api'
import { requireMobileUser } from '@/lib/mobile/auth'
import { portfolio } from '@/lib/mobile/services'

export const dynamic = 'force-dynamic'

async function portfolioEtag(data: Record<string, unknown>): Promise<string> {
  const financialRepresentation = { ...data }
  delete financialRepresentation.asOf
  const bytes = new TextEncoder().encode(JSON.stringify(financialRepresentation))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `W/"${hash}"`
}

function responseHeaders(requestId: string, etag: string, marketState: unknown) {
  const isActiveMarket = ['PRE', 'REGULAR', 'POST', 'OPEN', 'REGULAR_OPEN'].includes(String(marketState))
  return new Headers({
    'x-request-id': requestId,
    'cache-control': 'private, no-cache',
    etag,
    'x-silox-refresh-after': isActiveMarket ? '5' : '30',
  })
}

export async function GET(request: Request) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    const data = await portfolio(context)
    const etag = await portfolioEtag(data)
    const headers = responseHeaders(requestId, etag, data.marketState)
    const response = mobileJson(data, requestId, { headers })
    // The native client owns its read-through cache. Always return a decodable
    // JSON body: a bare 304 can leave a freshly installed app without a body to
    // replace an incomplete cached portfolio.
    response.headers.set('cache-control', 'private, no-store')
    return response
  })
}
