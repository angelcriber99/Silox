import 'server-only'

import type { User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type ApiAuthResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }

export async function requireApiUser(): Promise<ApiAuthResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    }
  }

  return { ok: true, user }
}
