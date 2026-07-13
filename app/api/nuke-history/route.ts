import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api/responses'

export async function POST(request: Request) {
  const supabase = (await createClient()) as any
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return apiError(request, 401, 'unauthorized', 'No autorizado. Debes iniciar sesión primero en la app.')
  }

  const { error } = await supabase
    .from('portfolio_history')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    return apiError(request, 500, 'database_error', error.message)
  }

  return apiSuccess(request, { success: true, message: 'Historial borrado con éxito. Cierra esta ventana y vuelve a la app.' })
}
