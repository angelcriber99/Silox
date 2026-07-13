import { createClient } from '@/lib/supabase/client'
import type { ImportAudit } from '@/lib/types'

export async function fetchImportAudits(limit = 8): Promise<ImportAudit[]> {
  const { data, error } = await (createClient() as any)
    .from('imports')
    .select('id, source, filename, file_size, file_type, status, parsed_count, imported_count, updated_count, ignored_count, removed_internal_movements, error, created_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST116') return []
    throw new Error(`Error cargando importaciones: ${error.message}`)
  }

  return (data ?? []) as ImportAudit[]
}
