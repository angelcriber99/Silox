export function getErrorMessage(error: unknown, fallback = 'Error inesperado'): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

