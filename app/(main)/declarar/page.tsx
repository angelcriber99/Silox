"use client"

import { useState, useMemo } from "react"
import { useAllTransactions } from "@/lib/hooks/use-transactions"
import { calculateFIFO } from "@/lib/utils/fifo-calculator"
import { formatCurrency } from "@/lib/utils/formatters"
import { Scale, TrendingUp, TrendingDown, ArrowLeft, Info, HelpCircle, FileText, ChevronDown } from "lucide-react"
import { TaxGuide } from "@/components/tax/tax-guide"
import { TaxChat } from "@/components/tax/tax-chat"
import { TaxPdfExport } from "@/components/tax/tax-pdf-export"
import Link from "next/link"
import { PageHeading } from "@/components/layout/page-heading"

export default function DeclararPage() {
  const { data: allTransactions, isLoading } = useAllTransactions()

  const currentYear = new Date().getFullYear()
  const defaultYear = currentYear === 2026 ? 2025 : currentYear
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear)

  // Calulate FIFO events
  const taxEvents = useMemo(() => {
    if (!allTransactions) return []
    return calculateFIFO(allTransactions).filter(e => 
      e.ticker !== 'CASH' && !e.ticker.startsWith('CASH_') && e.tipoActivo !== 'Liquidez'
    )
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

  // Split yearEvents by type
  const stockEvents = useMemo(() => {
    return yearEvents.filter(e => e.tipoActivo !== 'Fondo Indexado' && e.tipoActivo !== 'Fondo Monetario' && e.tipoActivo !== 'Crypto')
  }, [yearEvents])

  const fundEvents = useMemo(() => {
    return yearEvents.filter(e => e.tipoActivo === 'Fondo Indexado' || e.tipoActivo === 'Fondo Monetario')
  }, [yearEvents])

  const cryptoEvents = useMemo(() => {
    return yearEvents.filter(e => e.tipoActivo === 'Crypto')
  }, [yearEvents])

  const getTotalsForEvents = (events: typeof yearEvents) => {
    let gains = 0, losses = 0, saleValue = 0, purchaseValue = 0, retOrigen = 0, retDestino = 0
    events.forEach(e => {
      if (e.gananciaPatrimonial > 0) gains += e.gananciaPatrimonial
      else losses += Math.abs(e.gananciaPatrimonial)
      saleValue += e.ingresoVenta || 0
      purchaseValue += e.costeAdquisicion || 0
      retOrigen += e.retencionOrigen || 0
      retDestino += e.retencionDestino || 0
    })
    return { gains, losses, net: gains - losses, saleValue, purchaseValue, retOrigen, retDestino }
  }

  // Calculate totals
  const totals = useMemo(() => getTotalsForEvents(yearEvents), [yearEvents])
  const stockTotals = useMemo(() => getTotalsForEvents(stockEvents), [stockEvents])
  const fundTotals = useMemo(() => getTotalsForEvents(fundEvents), [fundEvents])
  const cryptoTotals = useMemo(() => getTotalsForEvents(cryptoEvents), [cryptoEvents])

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
    let retOrigen = 0
    let retDestino = 0
    yearDividends.forEach(d => {
      // Gross is now based on precio_unitario only (since cantidad is 0 for dividends after fix)
      const isLegacy = Number(d.cantidad) === 0.000001
      const g = isLegacy ? Number(d.precio_unitario) : (Number(d.precio_unitario))
      gross += g
      fees += Number(d.comision)
      retOrigen += Number(d.retencion_origen || 0)
      retDestino += Number(d.retencion_destino || 0)
    })
    return { gross, fees, retOrigen, retDestino, baseImponible: gross - fees, net: gross - fees - retOrigen - retDestino }
  }, [yearDividends])

  return (
    <main className="min-h-full bg-background text-foreground flex flex-col">
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 pb-10 mb-20 md:mb-0 space-y-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
        
        <PageHeading
          eyebrow="Fiscalidad"
          title="Asistente de declaración"
          description="Calcula ganancias, pérdidas, dividendos y retenciones con el método FIFO."
          icon={Scale}
          actions={<>
              <Link href="/movimientos" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><ArrowLeft className="size-4" />Movimientos</Link>
              <TaxPdfExport targetId="tax-report-content" filename={`Silox_Informe_Fiscal_${selectedYear}.pdf`} />
              <label className="relative">
                <span className="sr-only">Seleccionar ejercicio fiscal</span>
                <select 
                  className="h-10 min-w-[120px] appearance-none rounded-xl border border-primary/20 bg-primary/10 pl-3 pr-9 text-sm font-bold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>Año {year}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-primary" />
              </label>
          </>}
        />

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
                <div className="text-3xl font-bold text-foreground tabular-nums">
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
                <div className="text-3xl font-bold text-foreground tabular-nums">
                  {formatCurrency(totals.losses)}
                </div>
                <p className="text-sm text-muted-foreground/80 mt-2">
                  Suma de todas las ventas con minusvalía.
                </p>
              </div>

              <div
                className="rounded-2xl p-6"
                style={{
                  background: "oklch(0.68 0.17 192 / 0.08)",
                  border: "1px solid oklch(0.68 0.17 192 / 0.20)",
                }}
              >
                <div className="flex items-center gap-2 mb-2 font-medium" style={{ color: "var(--primary)" }}>
                  <Scale className="h-5 w-5" />
                  Rendimiento Neto
                </div>
                <div
                  className="text-3xl font-bold tabular-nums"
                  style={{ color: totals.net >= 0 ? "oklch(0.65 0.19 155)" : "oklch(0.62 0.20 20)" }}
                >
                  {totals.net >= 0 ? "+" : ""}{formatCurrency(totals.net)}
                </div>
                <p className="text-sm mt-2 font-medium" style={{ color: "var(--primary)", opacity: 0.7 }}>
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
                <div className="text-3xl font-bold text-foreground tabular-nums">
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
                <div className="text-3xl font-bold text-foreground tabular-nums">
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
                <div className={`text-3xl font-bold tabular-nums text-violet-300`}>
                  {dividendTotals.baseImponible > 0 ? "+" : ""}{formatCurrency(dividendTotals.baseImponible)}
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
                            <td className="px-6 py-4 whitespace-nowrap text-right tabular-nums text-foreground/80 align-top">
                              {e.cantidadVendida.toLocaleString('es-ES', { maximumFractionDigits: 4 })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right tabular-nums text-muted-foreground align-top">
                              {formatCurrency(e.ingresoVenta)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right tabular-nums text-muted-foreground align-top">
                              {formatCurrency(e.costeAdquisicion)}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-right tabular-nums font-bold align-top ${
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
                        <th className="px-6 py-4 font-medium text-right">Bruto</th>
                        <th className="px-6 py-4 font-medium text-right">Ret. Origen</th>
                        <th className="px-6 py-4 font-medium text-right">Ret. Destino</th>
                        <th className="px-6 py-4 font-medium text-right">Comisión</th>
                        <th className="px-6 py-4 font-medium text-right">Neto Cobrado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-violet-900/20">
                      {yearDividends.map((e, idx) => {
                        const date = new Date(e.fecha).toLocaleDateString('es-ES', {
                          month: 'short',
                          day: 'numeric'
                        })
                        const isLegacy = Number(e.cantidad) === 0.000001
                        const gross = isLegacy ? Number(e.precio_unitario) : (Number(e.precio_unitario))
                        const fee = Number(e.comision)
                        const retOrigen = Number(e.retencion_origen || 0)
                        const retDestino = Number(e.retencion_destino || 0)
                        const net = gross - fee - retOrigen - retDestino

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
                            <td className="px-6 py-4 whitespace-nowrap text-right tabular-nums text-muted-foreground align-top">
                              {formatCurrency(gross)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right tabular-nums text-rose-400/80 align-top">
                              {retOrigen > 0 ? `-${formatCurrency(retOrigen)}` : "—"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right tabular-nums text-rose-400/80 align-top">
                              {retDestino > 0 ? `-${formatCurrency(retDestino)}` : "—"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right tabular-nums text-rose-400/80 align-top">
                              {fee > 0 ? `-${formatCurrency(fee)}` : "—"}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-right tabular-nums font-bold align-top text-violet-400`}>
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
                  <div className="text-violet-400 font-bold text-lg mb-1">Dividendos</div>
                  <div className="font-semibold text-foreground mb-2">Acciones y ETFs</div>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">
                    Atención a la doble imposición internacional si has cobrado de USA (Casilla 0588).
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="bg-violet-950/50 rounded-lg p-3">
                      <div className="text-[10px] text-violet-400 font-bold mb-1">CASILLA 0029 (BRUTO)</div>
                      <div className="text-sm font-bold tabular-nums text-violet-100">{formatCurrency(dividendTotals.gross)}</div>
                    </div>
                    <div className="bg-violet-950/50 rounded-lg p-3">
                      <div className="text-[10px] text-violet-400 font-bold mb-1">CASILLA 0034 (GASTOS)</div>
                      <div className="text-sm font-bold tabular-nums text-violet-100">{formatCurrency(dividendTotals.fees)}</div>
                    </div>
                  </div>
                  {dividendTotals.retOrigen > 0 && (
                    <div className="bg-rose-950/50 rounded-lg p-3 border border-rose-900/50">
                      <div className="text-[10px] text-rose-400 font-bold mb-1">CASILLA 0588 (DOBLE IMPOSICIÓN)</div>
                      <div className="text-sm font-bold tabular-nums text-rose-100">{formatCurrency(dividendTotals.retOrigen)}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">Impuesto retenido en origen (ej. 15% W-8BEN) a deducir.</div>
                    </div>
                  )}
                </div>

                {/* Fondos */}
                <div className="bg-orange-900/20 border border-orange-800/40 rounded-xl p-5 backdrop-blur-sm flex flex-col">
                  <div className="text-orange-400 font-bold text-lg mb-1">Casillas 310 a 316</div>
                  <div className="font-semibold text-foreground mb-2">Fondos y C. Flexible</div>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">
                    Tus intereses de la <strong>Cuenta Flexible de Revolut</strong> van aquí. MyInvestor lo mete en el borrador automático.
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="bg-orange-950/50 rounded-lg p-3">
                      <div className="text-[10px] text-orange-400 font-bold mb-1">CASILLAS 312-313 (VENTA)</div>
                      <div className="text-sm font-bold tabular-nums text-orange-100">{formatCurrency(fundTotals.saleValue)}</div>
                    </div>
                    <div className="bg-orange-950/50 rounded-lg p-3">
                      <div className="text-[10px] text-orange-400 font-bold mb-1">CASILLAS 314-315 (COMPRA)</div>
                      <div className="text-sm font-bold tabular-nums text-orange-100">{formatCurrency(fundTotals.purchaseValue)}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground">Comprueba esto con tu PDF fiscal para asegurar que cuadra, y añade manualmente los intereses diarios de la C. Flexible.</div>
                </div>

                {/* Acciones */}
                <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-5 backdrop-blur-sm flex flex-col">
                  <div className="text-emerald-400 font-bold text-lg mb-1">Acciones y ETFs</div>
                  <div className="font-semibold text-foreground mb-2">Ventas del año (FIFO)</div>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">
                    Transmisión de elementos patrimoniales negociados. Cópialo tal cual.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-emerald-950/50 rounded-lg p-3">
                      <div className="text-[10px] text-emerald-400 font-bold mb-1">CASILLA 0327 (VENTA)</div>
                      <div className="text-sm font-bold tabular-nums text-emerald-100">{formatCurrency(stockTotals.saleValue)}</div>
                    </div>
                    <div className="bg-emerald-950/50 rounded-lg p-3">
                      <div className="text-[10px] text-emerald-400 font-bold mb-1">CASILLA 0328 (COMPRA)</div>
                      <div className="text-sm font-bold tabular-nums text-emerald-100">{formatCurrency(stockTotals.purchaseValue)}</div>
                    </div>
                  </div>
                  {(stockTotals.retDestino > 0 || stockTotals.retOrigen > 0) && (
                    <div className="bg-rose-950/50 rounded-lg p-3 border border-rose-900/50 mt-2">
                      <div className="text-[10px] text-rose-400 font-bold mb-1">RETENCIONES PAGADAS EN VENTAS</div>
                      <div className="text-sm font-bold tabular-nums text-rose-100">{formatCurrency(stockTotals.retDestino + stockTotals.retOrigen)}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">Impuestos ya pagados al Estado. ¡No olvides deducirlos!</div>
                    </div>
                  )}
                </div>

                {/* Criptomonedas */}
                <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-5 backdrop-blur-sm flex flex-col">
                  <div className="text-yellow-400 font-bold text-lg mb-1">Casillas 1800 a 1814</div>
                  <div className="font-semibold text-foreground mb-2">Criptomonedas</div>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">
                    Ventas de cripto a euros o permutas (cambio entre criptos). Si recibes recompensas de staking, van a la Casilla 0033.
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="bg-yellow-950/50 rounded-lg p-3">
                      <div className="text-[10px] text-yellow-400 font-bold mb-1">CASILLA 1802 (VENTA)</div>
                      <div className="text-sm font-bold tabular-nums text-yellow-100">{formatCurrency(cryptoTotals.saleValue)}</div>
                    </div>
                    <div className="bg-yellow-950/50 rounded-lg p-3">
                      <div className="text-[10px] text-yellow-400 font-bold mb-1">CASILLA 1803 (COMPRA)</div>
                      <div className="text-sm font-bold tabular-nums text-yellow-100">{formatCurrency(cryptoTotals.purchaseValue)}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground">Declaración obligatoria de cada permuta o venta en Revolut.</div>
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
          </>
        )}
        </div>
      </div>
    </main>
  )
}
