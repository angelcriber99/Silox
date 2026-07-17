import { mobileHandler, mobileJson, readJson } from '@/lib/mobile/api'
import { requireMobileUser } from '@/lib/mobile/auth'
import { createEvent, listEvents } from '@/lib/mobile/services'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    return mobileJson(await listEvents(context), requestId)
  })
}

export async function POST(request: Request) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    return mobileJson(await createEvent(context, await readJson(request)), requestId, { status: 201 })
  })
}
