import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/server/api-auth'
import { deleteUserAccount } from '@/lib/server/delete-account'

export const runtime = 'nodejs'

export async function DELETE(request: Request) {
  try {
    const auth = await requireApiUser()
    if (!auth.ok) return auth.response

    const body = await request.json().catch(() => ({}))
    if (body?.confirmation !== 'BORRAR') {
      return NextResponse.json({ error: 'Confirmación inválida' }, { status: 400 })
    }

    await deleteUserAccount(auth.user.id)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al borrar la cuenta'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
