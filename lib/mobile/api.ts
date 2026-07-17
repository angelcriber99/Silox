import 'server-only'

import { ZodError } from 'zod'

export interface MobileApiErrorEnvelope {
  error: {
    code: string
    message: string
    details?: unknown
  }
  requestId: string
}

export class MobileApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
  }
}

function requestIdFor(request: Request): string {
  const supplied = request.headers.get('x-request-id')?.trim()
  return supplied && supplied.length <= 128 ? supplied : crypto.randomUUID()
}

export function mobileJson(data: unknown, requestId: string, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('x-request-id', requestId)
  headers.set('cache-control', 'private, no-store')
  return Response.json({ data }, { ...init, headers })
}

export function mobileNoContent(requestId: string) {
  return new Response(null, {
    status: 204,
    headers: {
      'x-request-id': requestId,
      'cache-control': 'private, no-store',
    },
  })
}

export function mobileError(
  requestId: string,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const body: MobileApiErrorEnvelope = {
    error: { code, message, ...(details === undefined ? {} : { details }) },
    requestId,
  }
  return Response.json(body, {
    status,
    headers: {
      'x-request-id': requestId,
      'cache-control': 'private, no-store',
    },
  })
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new MobileApiError(400, 'invalid_json', 'El cuerpo debe ser JSON válido')
  }
}

export async function mobileHandler(
  request: Request,
  action: (requestId: string) => Promise<Response>,
): Promise<Response> {
  const requestId = requestIdFor(request)
  try {
    return await action(requestId)
  } catch (error) {
    if (error instanceof MobileApiError) {
      return mobileError(requestId, error.status, error.code, error.message, error.details)
    }
    if (error instanceof ZodError) {
      return mobileError(requestId, 400, 'validation_error', 'Datos de entrada inválidos', error.flatten())
    }

    console.error(`[mobile-api:${requestId}]`, error)
    return mobileError(requestId, 500, 'internal_error', 'Error interno del servidor')
  }
}
