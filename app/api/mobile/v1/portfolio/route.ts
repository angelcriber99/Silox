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
  return new Headers({
    'x-request-id': requestId,
    'cache-control': 'private, no-cache',
    etag,
    'x-silox-refresh-after': marketState === 'REGULAR_OPEN' ? '5' : '30',
  })
}

function etagMatches(header: string | null, etag: string): boolean {
  return header?.split(',').some((candidate) => candidate.trim() === '*' || candidate.trim() === etag) ?? false
}

export async function GET(request: Request) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    const data = await portfolio(context)
    const etag = await portfolioEtag(data)
    const headers = responseHeaders(requestId, etag, data.marketState)
    if (etagMatches(request.headers.get('if-none-match'), etag)) {
      return new Response(null, { status: 304, headers })
    }
    const response = mobileJson(data, requestId, { headers })
    response.headers.set('cache-control', 'private, no-cache')
    return response
  })
}
