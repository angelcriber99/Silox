import { mobileHandler, mobileJson, readJson } from '@/lib/mobile/api'
import { requireMobileUser } from '@/lib/mobile/auth'
import { runIdempotent } from '@/lib/mobile/idempotency'
import { TransactionListQuerySchema } from '@/lib/mobile/schemas'
import { createTransaction, listTransactions } from '@/lib/mobile/services'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    const query = new URL(request.url).searchParams
    const options = TransactionListQuerySchema.parse(Object.fromEntries(query.entries()))
    return mobileJson(await listTransactions(context, options), requestId)
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
