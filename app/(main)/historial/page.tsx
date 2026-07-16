"use client"

import { useState, useMemo } from "react"
import { useAllTransactions } from "@/lib/hooks/use-transactions"
import { calculateFIFO } from "@/lib/utils/fifo-calculator"
import { Activity, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { HistoryDashboard } from "@/components/history/history-dashboard"

export default function HistorialPage() {
  const { data: allTransactions, isLoading } = useAllTransactions()

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  // Calulate FIFO events
  const taxEvents = useMemo(() => {
    if (!allTransactions) return []
    const filteredTx = allTransactions.filter(tx => 
      tx.activo?.tipo !== 'Fondo Monetario' && 
      tx.activo?.tipo !== 'Liquidez' &&
      !tx.activo?.ticker?.startsWith('CASH')
    )
    return calculateFIFO(filteredTx)
  }, [allTransactions])

  // Get available years
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    if (allTransactions) {
      allTransactions.forEach(tx => {
        years.add(new Date(tx.fecha).getFullYear())
      })
    }
    // Always include current year and last year as baseline
    const current = new Date().getFullYear()
    years.add(current)
    years.add(current - 1)
    return Array.from(years).sort((a, b) => b - a)
  }, [allTransactions])

  return (
    <main className="min-h-full bg-background text-foreground flex flex-col animate-fade-in">
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 mb-20 md:mb-0 space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col gap-4">
          <Link 
            href="/movimientos" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Movimientos
          </Link>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "oklch(0.65 0.17 270 / 0.12)", border: "1px solid oklch(0.65 0.17 270 / 0.20)" }}
                >
                  <Activity className="h-5 w-5" style={{ color: "oklch(0.65 0.17 270)" }} />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
                  Year in Review
                </h1>
              </div>
              <p className="text-sm pl-[52px]" style={{ color: "var(--muted-foreground)" }}>
                Resumen anual de tu actividad inversora, compras, ventas y rentabilidad.
              </p>
            </div>
            
            <div className="relative">
              <select 
                className="appearance-none font-semibold rounded-xl pl-4 pr-8 py-2.5 min-w-[120px] focus:outline-none focus:ring-2 cursor-pointer transition-all text-sm"
                style={{
                  background: "oklch(0.65 0.17 270 / 0.10)",
                  border: "1px solid oklch(0.65 0.17 270 / 0.25)",
                  color: "oklch(0.65 0.17 270)",
                }}
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>Año {year}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none text-xs">
                ▾
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="animate-pulse flex flex-col gap-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-card/50 rounded-xl" />)}
            </div>
            <div className="h-80 bg-card/50 rounded-xl" />
          </div>
        ) : (
          <HistoryDashboard 
            transactions={allTransactions || []} 
            taxEvents={taxEvents} 
            year={selectedYear} 
          />
        )}
      </div>
    </main>
  )
}
