import { mobileHandler, readJson } from '@/lib/mobile/api'
import { requireMobileUser } from '@/lib/mobile/auth'
import { runIdempotent } from '@/lib/mobile/idempotency'
import { createTransfer } from '@/lib/mobile/services'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    const payload = await readJson(request)
    return runIdempotent(context, request, requestId, payload, async () => ({
      data: await createTransfer(context, payload), status: 201,
    }))
  })
}
