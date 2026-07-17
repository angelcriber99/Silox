import { z } from 'zod'
import { mobileHandler, mobileJson, readJson } from '@/lib/mobile/api'
import { requireMobileUser } from '@/lib/mobile/auth'
import { marketEvents } from '@/lib/mobile/services'

const Input = z.object({ tickers: z.array(z.string().trim().min(1).max(30)).max(100) })
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return mobileHandler(request, async (requestId) => {
    await requireMobileUser(request)
    const { tickers } = Input.parse(await readJson(request))
    return mobileJson(await marketEvents(tickers), requestId)
  })
}
