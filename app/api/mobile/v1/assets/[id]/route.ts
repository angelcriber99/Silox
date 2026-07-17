import { IdSchema } from '@/lib/mobile/schemas'
import { mobileHandler, mobileJson, mobileNoContent, readJson } from '@/lib/mobile/api'
import { requireMobileUser } from '@/lib/mobile/auth'
import { deleteAsset, getAsset, updateAsset } from '@/lib/mobile/services'

type Context = { params: Promise<{ id: string }> }
export const dynamic = 'force-dynamic'

export async function GET(request: Request, route: Context) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    const id = IdSchema.parse((await route.params).id)
    return mobileJson(await getAsset(context, id), requestId)
  })
}

export async function PATCH(request: Request, route: Context) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    const id = IdSchema.parse((await route.params).id)
    return mobileJson(await updateAsset(context, id, await readJson(request)), requestId)
  })
}

export async function DELETE(request: Request, route: Context) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    const id = IdSchema.parse((await route.params).id)
    await deleteAsset(context, id)
    return mobileNoContent(requestId)
  })
}
