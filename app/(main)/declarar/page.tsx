"use client"

import { useState, useMemo } from "react"
import { useAllTransactions } from "@/lib/hooks/use-transactions"
import { calculateFIFO } from "@/lib/utils/fifo-calculator"
import { formatCurrency } from "@/lib/utils/formatters"
import { Scale, TrendingUp, TrendingDown, ArrowLeft, Info, HelpCircle, FileText } from "lucide-react"
import { TaxGuide } from "@/components/tax/tax-guide"
import { TaxChat } from "@/components/tax/tax-chat"
import { TaxPdfExport } from "@/components/tax/tax-pdf-export"
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
    // Also include years from dividends
    if (allTransactions) {
      allTransactions.forEach(tx => {
        if (tx.tipo_operacion === 'Dividendo') {
          years.add(new Date(tx.fecha).getFullYear())
        }
      })
    }
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

  // Get dividends for selected year
  const yearDividends = useMemo(() => {
    if (!allTransactions) return []
    return allTransactions.filter(tx => 
      tx.tipo_operacion === 'Dividendo' && 
      new Date(tx.fecha).getFullYear() === selectedYear
    ).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  }, [allTransactions, selectedYear])

  const dividendTotals = useMemo(() => {
    let gross = 0
    let fees = 0
    yearDividends.forEach(d => {
      gross += (Number(d.cantidad) * Number(d.precio_unitario))
      fees += Number(d.comision)
    })
    return { gross, fees, net: gross - fees }
  }, [yearDividends])

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
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
                <Scale className="h-8 w-8 text-blue-500" />
                Asistente de Declaración
              </h1>
              <p className="text-muted-foreground">
                Cálculo automatizado de ganancias y pérdidas patrimoniales (Método FIFO).
              </p>
            </div>
            <div className="flex items-center gap-3">
              <TaxPdfExport targetId="tax-report-content" filename={`Silox_Informe_Fiscal_${selectedYear}.pdf`} />
              <div className="relative">
                <select 
                  className="appearance-none bg-muted border border-border text-foreground font-medium rounded-lg pl-4 pr-10 py-2.5 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
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
        </div>

        <div id="tax-report-content" className="flex flex-col gap-8 bg-background pb-8">
          {isLoading ? (
          <div className="animate-pulse flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-32 bg-card/50 rounded-xl" />)}
            </div>
            <div className="h-64 bg-card/50 rounded-xl" />
          </div>
        ) : (
          <>
            {/* Totals Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card/40 border border-border rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-muted-foreground mb-2 font-medium">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                  Total Ganancias
                </div>
                <div className="text-3xl font-bold text-foreground font-tabular">
                  {formatCurrency(totals.gains)}
                </div>
                <p className="text-sm text-muted-foreground/80 mt-2">
                  Suma de todas las ventas rentables.
                </p>
              </div>

              <div className="bg-card/40 border border-border rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-muted-foreground mb-2 font-medium">
                  <TrendingDown className="h-5 w-5 text-rose-400" />
                  Total Pérdidas
                </div>
                <div className="text-3xl font-bold text-foreground font-tabular">
                  {formatCurrency(totals.losses)}
                </div>
                <p className="text-sm text-muted-foreground/80 mt-2">
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

            {/* Dividend Totals Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-violet-900/10 border border-violet-800/40 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-violet-400 mb-2 font-medium">
                  <TrendingUp className="h-5 w-5" />
                  Rendimiento Bruto (Dividendos)
                </div>
                <div className="text-3xl font-bold text-foreground font-tabular">
                  {formatCurrency(dividendTotals.gross)}
                </div>
                <p className="text-sm text-violet-400/80 mt-2 font-medium">
                  Intereses o dividendos cobrados.
                </p>
              </div>

              <div className="bg-violet-900/10 border border-violet-800/40 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-violet-400 mb-2 font-medium">
                  <TrendingDown className="h-5 w-5" />
                  Gastos Deducibles
                </div>
                <div className="text-3xl font-bold text-foreground font-tabular">
                  {formatCurrency(dividendTotals.fees)}
                </div>
                <p className="text-sm text-violet-400/80 mt-2 font-medium">
                  Comisiones de servicio deducibles.
                </p>
              </div>

              <div className="bg-violet-900/20 border border-violet-800/60 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-violet-300 mb-2 font-bold">
                  <Scale className="h-5 w-5" />
                  Rendimiento Neto a Tributar
                </div>
                <div className={`text-3xl font-bold font-tabular text-violet-300`}>
                  {dividendTotals.net > 0 ? "+" : ""}{formatCurrency(dividendTotals.net)}
                </div>
                <p className="text-sm text-violet-300/80 mt-2 font-medium">
                  Base imponible del ahorro generada.
                </p>
              </div>
            </div>

            {/* FIFO Table */}
            <div className="border border-border bg-card/40 rounded-xl overflow-hidden backdrop-blur-sm">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  Desglose de Operaciones
                  <div className="group relative">
                    <HelpCircle className="h-4 w-4 text-muted-foreground/80 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-muted text-xs text-foreground/90 p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-border">
                      Este desglose une cada venta con sus correspondientes lotes de compra (FIFO) restando las comisiones aplicables en cada tramo.
                    </div>
                  </div>
                </h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-card/80 border-b border-border text-muted-foreground">
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
                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground/80">
                          <Info className="h-8 w-8 mx-auto mb-3 text-muted-foreground/60" />
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
                          <tr key={idx} className="hover:bg-muted/30 transition-colors group">
                            <td className="px-6 py-4 whitespace-nowrap text-foreground/80 align-top">
                              {date}
                            </td>
                            <td className="px-6 py-4 align-top">
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground/90">{e.ticker}</span>
                                <span className="text-xs text-muted-foreground/80 truncate max-w-[200px] mb-1">{e.nombre}</span>
                                <span className="text-[10px] text-muted-foreground/60 leading-tight max-w-[250px]">{e.detalles}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right font-tabular text-foreground/80 align-top">
                              {e.cantidadVendida.toLocaleString('es-ES', { maximumFractionDigits: 4 })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right font-tabular text-muted-foreground align-top">
                              {formatCurrency(e.ingresoVenta)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right font-tabular text-muted-foreground align-top">
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

            {/* Dividends Table */}
            {yearDividends.length > 0 && (
              <div className="border border-violet-900/40 bg-card/40 rounded-xl overflow-hidden backdrop-blur-sm">
                <div className="p-6 border-b border-violet-900/40 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    Desglose de Rendimientos del Capital Mobiliario
                    <div className="group relative">
                      <HelpCircle className="h-4 w-4 text-violet-400/80 cursor-help" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-muted text-xs text-foreground/90 p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-border">
                        Dividendos e intereses percibidos en este año fiscal.
                      </div>
                    </div>
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-card/80 border-b border-violet-900/40 text-muted-foreground">
                      <tr>
                        <th className="px-6 py-4 font-medium">Fecha</th>
                        <th className="px-6 py-4 font-medium">Activo</th>
                        <th className="px-6 py-4 font-medium text-right">Rendimiento Bruto</th>
                        <th className="px-6 py-4 font-medium text-right">Comisiones</th>
                        <th className="px-6 py-4 font-medium text-right">Rendimiento Neto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-violet-900/20">
                      {yearDividends.map((e, idx) => {
                        const date = new Date(e.fecha).toLocaleDateString('es-ES', {
                          month: 'short',
                          day: 'numeric'
                        })
                        const gross = (Number(e.cantidad) * Number(e.precio_unitario))
                        const fee = Number(e.comision)
                        const net = gross - fee

                        return (
                          <tr key={idx} className="hover:bg-violet-900/10 transition-colors group">
                            <td className="px-6 py-4 whitespace-nowrap text-foreground/80 align-top">
                              {date}
                            </td>
                            <td className="px-6 py-4 align-top">
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground/90">{e.activo?.ticker || "—"}</span>
                                <span className="text-xs text-muted-foreground/80 truncate max-w-[200px] mb-1">{e.activo?.nombre || ""}</span>
                                {e.notas && <span className="text-[10px] text-muted-foreground/60 leading-tight max-w-[250px]">{e.notas}</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right font-tabular text-muted-foreground align-top">
                              {formatCurrency(gross)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right font-tabular text-rose-400/80 align-top">
                              {fee > 0 ? `-${formatCurrency(fee)}` : "—"}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-right font-tabular font-bold align-top text-violet-400`}>
                              +{formatCurrency(net)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Box Mapper UI */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-6 w-6 text-blue-400" />
                Guía de Casillas para la Renta (MyInvestor y Revolut)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* Cuentas Remuneradas */}
                <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-5 backdrop-blur-sm flex flex-col">
                  <div className="text-blue-400 font-bold text-lg mb-1">Casilla 0027</div>
                  <div className="font-semibold text-foreground mb-2">Intereses de Cuentas</div>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">
                    Intereses generados en cuentas remuneradas (MyInvestor) o cuenta corriente estándar de Revolut.
                  </p>
                  <div className="bg-blue-950/50 rounded-lg p-3 text-sm text-blue-200">
                    Suele venir volcado en el borrador al tener IBAN español. Revisa que coincida con tus extractos.
                  </div>
                </div>

                {/* Dividendos */}
                <div className="bg-violet-900/20 border border-violet-800/40 rounded-xl p-5 backdrop-blur-sm flex flex-col">
                  <div className="text-violet-400 font-bold text-lg mb-1">Casilla 0029 y 0589</div>
                  <div className="font-semibold text-foreground mb-2">Dividendos de Acciones</div>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">
                    Casilla 0029 para el bruto cobrado. OJO: Casilla 0589 para la <strong>doble imposición internacional</strong> si te han retenido en origen (ej. acciones de EEUU).
                  </p>
                  <div className="bg-violet-950/50 rounded-lg p-3">
                    <div className="text-xs text-violet-400 font-bold mb-1">TOTAL BRUTO COBRADO</div>
                    <div className="text-lg font-bold font-tabular text-violet-100">{formatCurrency(dividendTotals.gross)}</div>
                  </div>
                </div>

                {/* Fondos */}
                <div className="bg-orange-900/20 border border-orange-800/40 rounded-xl p-5 backdrop-blur-sm flex flex-col">
                  <div className="text-orange-400 font-bold text-lg mb-1">Casillas 310 a 316</div>
                  <div className="font-semibold text-foreground mb-2">Fondos y C. Flexible</div>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">
                    Ganancias de fondos (Roboadvisor MyInvestor) y los intereses de la <strong>Cuenta Flexible de Revolut</strong> (que es un fondo monetario).
                  </p>
                  <div className="bg-orange-950/50 rounded-lg p-3 text-sm text-orange-200 font-medium">
                    ¡Revolut NO retiene por la Flexible! Debes declararlo a mano al sacar el dinero.
                  </div>
                </div>

                {/* Acciones */}
                <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-5 backdrop-blur-sm flex flex-col">
                  <div className="text-emerald-400 font-bold text-lg mb-1">Casillas 326 a 338</div>
                  <div className="font-semibold text-foreground mb-2">Acciones y ETFs</div>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">
                    Ganancias y pérdidas por transmisión de acciones. Usa el desglose FIFO superior para rellenar transmisión y adquisición.
                  </p>
                  <div className="bg-emerald-950/50 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <div className="text-xs text-emerald-400 font-bold">RENDIMIENTO NETO (FIFO):</div>
                      <div className="text-lg font-bold font-tabular text-emerald-100">{formatCurrency(totals.net)}</div>
                    </div>
                  </div>
                </div>

                {/* Criptomonedas */}
                <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-5 backdrop-blur-sm flex flex-col">
                  <div className="text-yellow-400 font-bold text-lg mb-1">Casillas 1800 a 1814</div>
                  <div className="font-semibold text-foreground mb-2">Criptomonedas</div>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">
                    Ventas de cripto a euros o permutas (cambio entre criptos). Si recibes recompensas de staking, van a la Casilla 0033.
                  </p>
                  <div className="bg-yellow-950/50 rounded-lg p-3 text-sm text-yellow-200">
                    Declaración obligatoria de cada permuta o venta en Revolut.
                  </div>
                </div>

                {/* Modelos */}
                <div className="bg-rose-900/20 border border-rose-800/40 rounded-xl p-5 backdrop-blur-sm flex flex-col">
                  <div className="text-rose-400 font-bold text-lg mb-1">Modelos 720 y 721</div>
                  <div className="font-semibold text-foreground mb-2">Informativas Extranjero</div>
                  <p className="text-sm text-muted-foreground flex-1 mb-2">
                    Obligatorios solo si tienes más de <strong>50.000€</strong> fuera de España a 31 dic.
                  </p>
                  <ul className="text-xs text-rose-200 space-y-1 ml-4 list-disc mb-1">
                    <li><strong>720:</strong> Cuentas, fondos, acciones extranjeras.</li>
                    <li><strong>721:</strong> Criptomonedas custodiadas fuera.</li>
                  </ul>
                </div>
              </div>

              <div className="bg-muted/50 border border-border rounded-xl p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Compensación de pérdidas:</strong> Las pérdidas de acciones y fondos se compensan primero con ganancias del mismo tipo (patrimoniales). Si el saldo sigue negativo, puedes compensar hasta un <strong>25%</strong> del saldo positivo de tus rendimientos del capital mobiliario (intereses y dividendos). El resto se arrastra hasta los siguientes 4 años.
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
          </div>
        )}

      </div>
    </main>
  )
}
