import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const USER_DATA_TABLES = [
  'alertas',
  'expenses',
  'budget_settings',
  'portfolio_history',
  'portfolio_snapshots',
  'eventos_recurrentes',
  'transacciones',
  'activos',
] as const

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    if (body?.confirmation !== 'BORRAR') {
      return NextResponse.json({ error: 'Confirmación inválida' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    for (const table of USER_DATA_TABLES) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq('user_id', user.id)

      if (error) {
        return NextResponse.json({
          error: `No se pudieron borrar los datos de ${table}: ${error.message}`,
        }, { status: 500 })
      }
    }

    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

    if (deleteUserError) {
      return NextResponse.json({
        error: `Los datos se borraron, pero no se pudo eliminar el usuario: ${deleteUserError.message}`,
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al borrar la cuenta'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
