"use client"

import { BellRing, Radio } from "lucide-react"

import { AlertsWorkspace } from "@/components/alerts/alerts-workspace"
import { PageHeading } from "@/components/layout/page-heading"
import { IOSHeader } from "@/components/ui/ios-header"
import { usePortfolio } from "@/lib/hooks/use-portfolio"

export default function AlertasPage() {
  const { positions, realtimeStatus } = usePortfolio()

  return (
    <main className="min-h-full bg-background text-foreground">
      <div className="md:hidden">
        <IOSHeader title="Alertas" subtitle="Objetivos de precio y señales" rightAction={<span className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-card text-primary"><BellRing className="size-4" /></span>} />
      </div>

      <div className="mx-auto w-full max-w-[1440px] px-3 py-4 md:px-6 md:py-7 lg:px-8">
        <PageHeading
          className="hidden md:flex"
          eyebrow="Vigilancia"
          title="Alertas de mercado"
          description="Define precios objetivo, controla la distancia a cada señal y revisa qué alertas se han cumplido."
          icon={BellRing}
          actions={<span className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 text-xs font-bold text-emerald-400"><Radio className="size-3.5" />{realtimeStatus === "connected" ? "Monitor activo" : "Conectando"}</span>}
        />
        <div className="mt-4 md:mt-6"><AlertsWorkspace positions={positions} /></div>
      </div>
    </main>
  )
}
