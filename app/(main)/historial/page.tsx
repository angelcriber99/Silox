"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Activity, ArrowLeft, ChevronDown } from "lucide-react"

import { HistoryDashboard } from "@/components/history/history-dashboard"
import { PageHeading } from "@/components/layout/page-heading"
import { calculateFIFO } from "@/lib/utils/fifo-calculator"
import { useAllTransactions } from "@/lib/hooks/use-transactions"

export default function HistorialPage() {
  const { data: allTransactions, isLoading } = useAllTransactions()
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const taxEvents = useMemo(() => calculateFIFO(allTransactions ?? []), [allTransactions])
  const availableYears = useMemo(() => {
    const current = new Date().getFullYear()
    const years = new Set([current, current - 1])
    allTransactions?.forEach((transaction) => years.add(new Date(transaction.fecha).getFullYear()))
    return Array.from(years).sort((left, right) => right - left)
  }, [allTransactions])

  return (
    <main className="min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <PageHeading
          eyebrow="Evolución"
          title="Historial anual"
          description="Revisa aportaciones, operaciones y rendimiento consolidado de cada ejercicio."
          icon={Activity}
          actions={<>
            <Link href="/movimientos" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <ArrowLeft className="size-4" /> Movimientos
            </Link>
            <label className="relative">
              <span className="sr-only">Seleccionar año</span>
              <select
                className="h-10 min-w-32 appearance-none rounded-xl border border-primary/20 bg-primary/10 pl-3 pr-9 text-sm font-bold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={selectedYear}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
              >
                {availableYears.map((year) => <option key={year} value={year}>Año {year}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-primary" />
            </label>
          </>}
        />

        {isLoading ? (
          <div className="animate-pulse space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 rounded-2xl bg-muted/50" />)}</div>
            <div className="h-80 rounded-2xl bg-muted/50" />
          </div>
        ) : (
          <HistoryDashboard transactions={allTransactions ?? []} taxEvents={taxEvents} year={selectedYear} />
        )}
      </div>
    </main>
  )
}
