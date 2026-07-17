import 'server-only'

import type { Json } from '@/lib/database.types'
import type { MobileAuthContext } from './auth'
import { MobileApiError, mobileJson } from './api'

async function hashPayload(payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function idempotencyKey(request: Request): string {
  const key = request.headers.get('idempotency-key')?.trim()
  if (!key || key.length > 128) {
    throw new MobileApiError(400, 'idempotency_key_required', 'Idempotency-Key es obligatorio')
  }
  return key
}

export async function runIdempotent(
  context: MobileAuthContext,
  request: Request,
  requestId: string,
  payload: unknown,
  action: () => Promise<{ data: unknown; status?: number }>,
): Promise<Response> {
  const key = idempotencyKey(request)
  const path = new URL(request.url).pathname
  const method = request.method.toUpperCase()
  const requestHash = await hashPayload(payload)
  const identity = {
    user_id: context.user.id,
    idempotency_key: key,
    request_method: method,
    request_path: path,
  }

  const { data: reserved, error: reserveError } = await context.supabase
    .from('mobile_api_idempotency')
    .insert({ ...identity, request_hash: requestHash })
    .select('id')
    .maybeSingle()

  if (reserveError && reserveError.code !== '23505') {
    throw new MobileApiError(503, 'idempotency_unavailable', 'No se pudo reservar la operación')
  }

  if (!reserved) {
    const { data: existing, error } = await context.supabase
      .from('mobile_api_idempotency')
      .select('request_hash, status, response_status, response_body')
      .match(identity)
      .maybeSingle()
    if (error || !existing) {
      throw new MobileApiError(409, 'operation_in_progress', 'La operación ya está en curso')
    }
    if (existing.request_hash !== requestHash) {
      throw new MobileApiError(409, 'idempotency_conflict', 'La clave ya se usó con otros datos')
    }
    if (existing.status === 'completed') {
      return mobileJson(existing.response_body, requestId, { status: existing.response_status ?? 200 })
    }
    throw new MobileApiError(409, 'operation_in_progress', 'La operación ya está en curso')
  }

  try {
    const result = await action()
    const responseStatus = result.status ?? 200
    const { error: finalizeError } = await context.supabase
      .from('mobile_api_idempotency')
      .update({
        status: 'completed',
        response_status: responseStatus,
        response_body: result.data as Json,
        completed_at: new Date().toISOString(),
      })
      .eq('id', reserved.id)
      .eq('user_id', context.user.id)
    if (finalizeError) {
      console.error(`[mobile-api:${requestId}] idempotency finalization failed`, finalizeError)
    }
    return mobileJson(result.data, requestId, { status: responseStatus })
  } catch (error) {
    await context.supabase
      .from('mobile_api_idempotency')
      .delete()
      .eq('id', reserved.id)
      .eq('user_id', context.user.id)
    throw error
  }
}
