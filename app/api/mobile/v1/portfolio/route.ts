import { mobileHandler, mobileJson } from '@/lib/mobile/api'
import { requireMobileUser } from '@/lib/mobile/auth'
import { portfolio } from '@/lib/mobile/services'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    return mobileJson(await portfolio(context), requestId)
  })
}
