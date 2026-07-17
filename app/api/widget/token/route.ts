import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createWidgetToken, hashWidgetToken } from '@/lib/server/widget-tokens'
import { requireMobileUser } from '@/lib/mobile/auth'
import { MobileApiError } from '@/lib/mobile/api'

export const runtime = 'nodejs'

async function issueToken(userId: string, status: 200 | 201) {
  const token = createWidgetToken()
  const tokenHash = hashWidgetToken(token)
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('widget_access_tokens')
    .insert({ user_id: userId, token_hash: tokenHash })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Ya existe una credencial activa. Rótala para crear una nueva.' },
        { status: 409 },
      )
    }
    throw error
  }

  return NextResponse.json({ token }, { status })
}

async function revokeActiveTokens(userId: string) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('widget_access_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .is('revoked_at', null)
    .eq('user_id', userId)

  if (error) throw error
}

function tokenError(error: unknown, fallback: string) {
  if (error instanceof MobileApiError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }
  return NextResponse.json({ error: fallback }, { status: 500 })
}

export async function POST(request: Request) {
  try {
    const auth = await requireMobileUser(request)
    return await issueToken(auth.user.id, 201)
  } catch (error) {
    return tokenError(error, 'No se pudo emitir la credencial')
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireMobileUser(request)
    await revokeActiveTokens(auth.user.id)
    return await issueToken(auth.user.id, 200)
  } catch (error) {
    return tokenError(error, 'No se pudo rotar la credencial')
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireMobileUser(request)
    await revokeActiveTokens(auth.user.id)
    return NextResponse.json({ revoked: true })
  } catch (error) {
    return tokenError(error, 'No se pudo revocar la credencial')
  }
}
