import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = (await createClient()) as any
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'No autorizado. Debes iniciar sesión primero en la app.' }, { status: 401 })
  }

  const { error } = await supabase
    .from('portfolio_history')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Historial borrado con éxito. Cierra esta ventana y vuelve a la app.' })
}
