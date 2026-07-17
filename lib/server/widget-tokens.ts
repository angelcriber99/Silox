import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

const WIDGET_TOKEN_PREFIX = 'swx_widget_'
const WIDGET_TOKEN_BYTES = 32
const WIDGET_TOKEN_PATTERN = /^swx_widget_[A-Za-z0-9_-]{43}$/

export function createWidgetToken() {
  return `${WIDGET_TOKEN_PREFIX}${randomBytes(WIDGET_TOKEN_BYTES).toString('base64url')}`
}

export function isOpaqueWidgetToken(token: string) {
  return WIDGET_TOKEN_PATTERN.test(token)
}

export function hashWidgetToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}
