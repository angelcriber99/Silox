import 'server-only'

import { createClient as createSupabaseClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { createClient as createCookieClient } from '@/lib/supabase/server'
import { MobileApiError } from './api'

export interface MobileAuthContext {
  user: User
  supabase: SupabaseClient<Database>
  method: 'bearer' | 'cookie'
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  if (!match) throw new MobileApiError(401, 'invalid_authorization', 'Cabecera Authorization inválida')
  return match[1]
}

export async function requireMobileUser(request: Request): Promise<MobileAuthContext> {
  const token = bearerToken(request)
  if (token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      throw new MobileApiError(503, 'auth_unavailable', 'El servicio de autenticación no está configurado')
    }

    const supabase = createSupabaseClient<Database>(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) throw new MobileApiError(401, 'unauthorized', 'Sesión no válida o expirada')
    return { user, supabase, method: 'bearer' }
  }

  const supabase = await createCookieClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new MobileApiError(401, 'unauthorized', 'No autorizado')
  return { user, supabase, method: 'cookie' }
}
