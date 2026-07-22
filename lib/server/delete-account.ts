import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Database } from '@/lib/database.types'

// Tables without a cascading auth.users foreign key are included as well so
// deletion remains complete while legacy installations are being upgraded.
const USER_DATA_TABLES = [
  'widget_access_tokens',
  'notification_preferences',
  'mobile_api_idempotency',
  'alertas',
  'expenses',
  'budget_settings',
  'portfolio_history',
  'portfolio_snapshots',
  'eventos_recurrentes',
  'user_notes',
  'transacciones',
  'activos',
] as const

export async function deleteUserAccount(userId: string): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()

  for (const table of USER_DATA_TABLES) {
    // user_notes predates the generated schema snapshot but exists in all
    // deployed databases; keep the cast local until the next type generation.
    const typedTable = table as keyof Database['public']['Tables']
    const { error } = await supabaseAdmin.from(typedTable).delete().eq('user_id', userId)
    if (error) throw new Error(`No se pudieron borrar los datos de ${table}: ${error.message}`)
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) throw new Error(`Los datos se borraron, pero no se pudo eliminar el usuario: ${error.message}`)
}
