'use client'

import { useEffect } from 'react'
import { DashboardErrorState } from '@/components/dashboard/dashboard-error-state'

export default function MainError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('Main route error', error)
  }, [error])

  return (
    <DashboardErrorState
      onRetry={unstable_retry}
      title="Se ha producido un error inesperado"
      description="La pantalla no pudo completarse. Puedes reintentar sin perder tus datos."
    />
  )
}
