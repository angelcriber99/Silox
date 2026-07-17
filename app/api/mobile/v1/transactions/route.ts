import { z } from 'zod'
import { mobileHandler, mobileJson, readJson } from '@/lib/mobile/api'
import { requireMobileUser } from '@/lib/mobile/auth'
import { runIdempotent } from '@/lib/mobile/idempotency'
import { createTransaction, listTransactions } from '@/lib/mobile/services'

const PositiveInteger = z.coerce.number().int().positive()
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    const query = new URL(request.url).searchParams
    const page = PositiveInteger.default(1).parse(query.get('page') ?? undefined)
    const pageSize = PositiveInteger.max(100).default(50).parse(query.get('pageSize') ?? undefined)
    return mobileJson(await listTransactions(context, page, pageSize), requestId)
  })
}

export async function POST(request: Request) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    const payload = await readJson(request)
    return runIdempotent(context, request, requestId, payload, async () => ({
      data: await createTransaction(context, payload), status: 201,
    }))
  })
}
