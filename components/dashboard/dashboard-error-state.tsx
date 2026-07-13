'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DashboardErrorStateProps {
  onRetry: () => void
  title?: string
  description?: string
}

export function DashboardErrorState({
  onRetry,
  title = 'No hemos podido cargar tu cartera',
  description = 'Tus datos siguen seguros. Comprueba la conexión y vuelve a intentarlo.',
}: DashboardErrorStateProps) {
  return (
    <section className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle aria-hidden="true" className="size-6" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        <Button className="mt-6" onClick={onRetry}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Reintentar
        </Button>
      </div>
    </section>
  )
}
