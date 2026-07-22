import { z } from 'zod'
import { mobileHandler, mobileJson, mobileNoContent, readJson } from '@/lib/mobile/api'
import { requireMobileUser } from '@/lib/mobile/auth'
import { me } from '@/lib/mobile/services'
import { deleteUserAccount } from '@/lib/server/delete-account'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    return mobileJson(me(context), requestId)
  })
}

const DeleteAccountSchema = z.object({ confirmation: z.literal('BORRAR') }).strict()

export async function DELETE(request: Request) {
  return mobileHandler(request, async (requestId) => {
    const context = await requireMobileUser(request)
    DeleteAccountSchema.parse(await readJson(request))
    await deleteUserAccount(context.user.id)
    return mobileNoContent(requestId)
  })
}
