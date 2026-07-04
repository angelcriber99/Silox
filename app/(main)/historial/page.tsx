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
    return calculateFIFO(allTransactions)
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
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 space-y-8">
        
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
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-xl border border-violet-500/20">
                  <Activity className="h-6 w-6 text-violet-400" />
                </div>
                Year in Review
              </h1>
              <p className="text-muted-foreground">
                Resumen anual de tu actividad inversora, compras, ventas y rentabilidad.
              </p>
            </div>
            
            <div className="relative">
              <select 
                className="appearance-none bg-muted border border-border text-foreground font-medium rounded-lg pl-4 pr-10 py-2.5 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer transition-shadow"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>Año {year}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                ▼
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
