import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

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

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json({ error: 'Faltan credenciales administrativas de Supabase' }, { status: 500 })
    }

    const supabaseAdmin = createSupabaseAdmin(
      supabaseUrl,
      serviceKey,
      { auth: { persistSession: false } }
    )

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
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al borrar la cuenta' }, { status: 500 })
  }
}
