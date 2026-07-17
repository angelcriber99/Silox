import { mobileHandler, mobileJson } from '@/lib/mobile/api'
import { requireMobileUser } from '@/lib/mobile/auth'
import { searchMarket } from '@/lib/mobile/services'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return mobileHandler(request, async (requestId) => {
    await requireMobileUser(request)
    const query = new URL(request.url).searchParams.get('q') ?? ''
    return mobileJson(await searchMarket(query), requestId)
  })
}
