import 'server-only'

type LogContext = Record<string, unknown>

function errorDetails(error: unknown): LogContext | undefined {
  if (!(error instanceof Error)) return error === undefined ? undefined : { value: String(error) }
  return {
    name: error.name,
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && error.stack ? { stack: error.stack } : {}),
  }
}

function write(level: 'info' | 'warn' | 'error', event: string, context: LogContext = {}, error?: unknown) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...context,
    ...(error === undefined ? {} : { error: errorDetails(error) }),
  }
  console[level](JSON.stringify(entry))
}

export const serverLogger = {
  info: (event: string, context?: LogContext) => write('info', event, context),
  warn: (event: string, context?: LogContext, error?: unknown) => write('warn', event, context, error),
  error: (event: string, error: unknown, context?: LogContext) => write('error', event, context, error),
}

