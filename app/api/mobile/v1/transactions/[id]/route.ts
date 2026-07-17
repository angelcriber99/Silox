import { IdSchema } from '@/lib/mobile/schemas'
import { mobileHandler, readJson } from '@/lib/mobile/api'
import { requireMobileUser } from '@/lib/mobile/auth'
import { runIdempotent } from '@/lib/mobile/idempotency'
import { deleteTransaction, updateTransaction } from '@/lib/mobile/services'

type Context = { params: Promise<{ id: string }> }
export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, route: Context) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    const id = IdSchema.parse((await route.params).id)
    const payload = await readJson(request)
    return runIdempotent(context, request, requestId, payload, async () => ({
      data: await updateTransaction(context, id, payload),
    }))
  })
}

export async function DELETE(request: Request, route: Context) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    const id = IdSchema.parse((await route.params).id)
    return runIdempotent(context, request, requestId, { id }, async () => {
      await deleteTransaction(context, id)
      return { data: { deleted: true } }
    })
  })
}
