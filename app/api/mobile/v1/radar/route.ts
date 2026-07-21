import { mobileHandler, mobileJson } from '@/lib/mobile/api'
import { requireMobileUser } from '@/lib/mobile/auth'
import { buildPortfolioRadar } from '@/lib/server/portfolio-radar'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    const { searchParams } = new URL(request.url)
    const lang = searchParams.get('lang') || 'es'
    return mobileJson(await buildPortfolioRadar(context, new Date(), lang), requestId)
  })
}
