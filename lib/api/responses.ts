import { NextResponse } from 'next/server'

export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'validation_error'
  | 'configuration_error'
  | 'external_service_error'
  | 'database_error'
  | 'internal_error'

export interface ApiErrorBody {
  error: string
  code: ApiErrorCode
  requestId: string
  details?: unknown
}

export function getRequestId(request: Request): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID()
}

export function apiError(
  request: Request,
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown
) {
  const requestId = getRequestId(request)
  const body: ApiErrorBody = { error: message, code, requestId }
  if (details !== undefined) body.details = details

  return NextResponse.json(body, {
    status,
    headers: { 'X-Request-ID': requestId },
  })
}

export function apiSuccess<T extends Record<string, unknown>>(request: Request, body: T, init?: ResponseInit) {
  const requestId = getRequestId(request)
  const headers = new Headers(init?.headers)
  headers.set('X-Request-ID', requestId)

  return NextResponse.json(
    { ...body, requestId },
    {
      ...init,
      headers,
    }
  )
}
