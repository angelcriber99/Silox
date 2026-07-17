import { z } from 'zod'
import { mobileHandler, mobileJson } from '@/lib/mobile/api'
import { requireMobileUser } from '@/lib/mobile/auth'
import { portfolioHistory } from '@/lib/mobile/services'

const DateQuery = z.string().date().nullish()
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    const query = new URL(request.url).searchParams
    const from = DateQuery.parse(query.get('from'))
    const to = DateQuery.parse(query.get('to'))
    return mobileJson(await portfolioHistory(context, from, to), requestId)
  })
}
