import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/server/api-auth'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response

  const supabase = await createClient()

  const { error } = await supabase
    .from('portfolio_history')
    .delete()
    .eq('user_id', auth.user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Historial borrado con éxito. Cierra esta ventana y vuelve a la app.' })
}
