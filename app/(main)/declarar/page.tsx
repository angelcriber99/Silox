"use client"

import { useState, useMemo } from "react"
import { useAllTransactions } from "@/lib/hooks/use-transactions"
import { calculateFIFO } from "@/lib/utils/fifo-calculator"
import { formatCurrency } from "@/lib/utils/formatters"
import { Scale, TrendingUp, TrendingDown, ArrowLeft, Info, HelpCircle, FileText } from "lucide-react"
import { TaxGuide } from "@/components/tax/tax-guide"
import { TaxChat } from "@/components/tax/tax-chat"
import Link from "next/link"

export default function DeclararPage() {
  const { data: allTransactions, isLoading } = useAllTransactions()

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  // Calulate FIFO events
  const taxEvents = useMemo(() => {
    if (!allTransactions) return []
    return calculateFIFO(allTransactions)
  }, [allTransactions])

  // Get available years
  const availableYears = useMemo(() => {
    const years = new Set(taxEvents.map(e => e.añoFiscal))
    // Always include current year and last year as baseline
    const current = new Date().getFullYear()
    years.add(current)
    years.add(current - 1)
    return Array.from(years).sort((a, b) => b - a)
  }, [taxEvents])

  // Filter events for selected year
  const yearEvents = useMemo(() => {
    return taxEvents.filter(e => e.añoFiscal === selectedYear)
  }, [taxEvents, selectedYear])

  // Calculate totals
  const totals = useMemo(() => {
    let gains = 0
    let losses = 0
    yearEvents.forEach(e => {
      if (e.gananciaPatrimonial > 0) gains += e.gananciaPatrimonial
      else losses += Math.abs(e.gananciaPatrimonial)
    })
    return { gains, losses, net: gains - losses }
  }, [yearEvents])

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col gap-4">
          <Link 
            href="/movimientos" 
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors w-fit text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Movimientos
          </Link>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                <Scale className="h-8 w-8 text-blue-500" />
                Asistente de Declaración
              </h1>
              <p className="text-zinc-400">
                Cálculo automatizado de ganancias y pérdidas patrimoniales (Método FIFO).
              </p>
            </div>
            
            <div className="relative">
              <select 
                className="appearance-none bg-zinc-800 border border-zinc-700 text-white font-medium rounded-lg pl-4 pr-10 py-2.5 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>Año {year}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                ▼
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="animate-pulse flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-32 bg-zinc-900/50 rounded-xl" />)}
            </div>
            <div className="h-64 bg-zinc-900/50 rounded-xl" />
          </div>
        ) : (
          <>
            {/* Totals Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-zinc-400 mb-2 font-medium">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                  Total Ganancias
                </div>
                <div className="text-3xl font-bold text-white font-tabular">
                  {formatCurrency(totals.gains)}
                </div>
                <p className="text-sm text-zinc-500 mt-2">
                  Suma de todas las ventas rentables.
                </p>
              </div>

              <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-zinc-400 mb-2 font-medium">
                  <TrendingDown className="h-5 w-5 text-rose-400" />
                  Total Pérdidas
                </div>
                <div className="text-3xl font-bold text-white font-tabular">
                  {formatCurrency(totals.losses)}
                </div>
                <p className="text-sm text-zinc-500 mt-2">
                  Suma de todas las ventas con minusvalía.
                </p>
              </div>

              <div className="bg-blue-900/10 border border-blue-800/40 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-blue-400 mb-2 font-medium">
                  <Scale className="h-5 w-5" />
                  Rendimiento Neto
                </div>
                <div className={`text-3xl font-bold font-tabular ${totals.net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {totals.net >= 0 ? "+" : ""}{formatCurrency(totals.net)}
                </div>
                <p className="text-sm text-blue-400/80 mt-2 font-medium">
                  {totals.net >= 0 ? "Ganancia sujeta a tributación." : "Pérdida a compensar."}
                </p>
              </div>
            </div>

            {/* FIFO Table */}
            <div className="border border-zinc-800/60 bg-zinc-900/40 rounded-xl overflow-hidden backdrop-blur-sm">
              <div className="p-6 border-b border-zinc-800/60 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Desglose de Operaciones
                  <div className="group relative">
                    <HelpCircle className="h-4 w-4 text-zinc-500 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-zinc-800 text-xs text-zinc-200 p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-zinc-700">
                      Este desglose une cada venta con sus correspondientes lotes de compra (FIFO) restando las comisiones aplicables en cada tramo.
                    </div>
                  </div>
                </h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-900/80 border-b border-zinc-800/60 text-zinc-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">Fecha Venta</th>
                      <th className="px-6 py-4 font-medium">Activo</th>
                      <th className="px-6 py-4 font-medium text-right">Cant. Vendida</th>
                      <th className="px-6 py-4 font-medium text-right">Ingreso Venta</th>
                      <th className="px-6 py-4 font-medium text-right">Coste FIFO</th>
                      <th className="px-6 py-4 font-medium text-right">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {yearEvents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                          <Info className="h-8 w-8 mx-auto mb-3 text-zinc-600" />
                          <p>No se encontraron ventas para el año fiscal {selectedYear}</p>
                        </td>
                      </tr>
                    ) : (
                      yearEvents.map((e, idx) => {
                        const isGain = e.gananciaPatrimonial >= 0
                        const date = new Date(e.fechaVenta).toLocaleDateString('es-ES', {
                          month: 'short',
                          day: 'numeric'
                        })

                        return (
                          <tr key={idx} className="hover:bg-zinc-800/30 transition-colors group">
                            <td className="px-6 py-4 whitespace-nowrap text-zinc-300 align-top">
                              {date}
                            </td>
                            <td className="px-6 py-4 align-top">
                              <div className="flex flex-col">
                                <span className="font-medium text-zinc-200">{e.ticker}</span>
                                <span className="text-xs text-zinc-500 truncate max-w-[200px] mb-1">{e.nombre}</span>
                                <span className="text-[10px] text-zinc-600 leading-tight max-w-[250px]">{e.detalles}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right font-tabular text-zinc-300 align-top">
                              {e.cantidadVendida.toLocaleString('es-ES', { maximumFractionDigits: 4 })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right font-tabular text-zinc-400 align-top">
                              {formatCurrency(e.ingresoVenta)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right font-tabular text-zinc-400 align-top">
                              {formatCurrency(e.costeAdquisicion)}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-right font-tabular font-bold align-top ${
                              isGain ? "text-emerald-400" : "text-rose-400"
                            }`}>
                              {isGain ? "+" : ""}{formatCurrency(e.gananciaPatrimonial)}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Box Mapper UI */}
            <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="bg-emerald-500/20 p-3 rounded-xl mt-1">
                  <FileText className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-emerald-100 mb-2">Instrucciones para el Borrador (AEAT)</h3>
                  <p className="text-sm text-emerald-200/80 mb-4">
                    Para introducir estos datos en la web de Hacienda (modelo 100), dirígete al apartado <strong>"Ganancias y pérdidas patrimoniales derivadas de transmisiones de otros elementos patrimoniales"</strong> (acciones y fondos cotizados).
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-emerald-950/50 border border-emerald-800/50 rounded-lg p-4">
                      <div className="text-xs text-emerald-400 font-bold mb-1">CASILLA 0327</div>
                      <div className="text-sm text-emerald-100">Suma total de los <strong>Ingresos de Venta</strong>. Introduce esta cantidad:</div>
                      <div className="text-xl font-bold text-white mt-1 font-tabular">
                        {formatCurrency(totals.gains > 0 ? totals.gains + totals.losses : 0 /* Aproximación rápida, en un escenario real se suma el Ingreso de todas las operaciones */)}
                      </div>
                    </div>
                    <div className="bg-emerald-950/50 border border-emerald-800/50 rounded-lg p-4">
                      <div className="text-xs text-emerald-400 font-bold mb-1">CASILLA 0328</div>
                      <div className="text-sm text-emerald-100">Suma total de tu <strong>Coste de Adquisición</strong> (incluyendo comisiones).</div>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-400 mt-4 italic">
                    Nota: La casilla final de Rendimiento Neto se calcula sola en la plataforma de la AEAT al restar la 0328 a la 0327. ¡Comprueba que coincide con nuestro cálculo!
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Tax Guide relocated here */}
              <div className="h-full">
                <TaxGuide />
              </div>
              
              {/* AI Chat Assistant */}
              <div className="h-full">
                <TaxChat context={{ añoFiscal: selectedYear, gains: totals.gains, losses: totals.losses, net: totals.net }} />
              </div>
            </div>
          </>
        )}

      </div>
    </main>
  )
}
