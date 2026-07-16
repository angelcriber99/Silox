"use client"
import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft, TrendingUp, TrendingDown, Wallet, Layers, Activity,
  LineChart as LineChartIcon, DollarSign, PiggyBank, Briefcase
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatPercent, formatUnits } from "@/lib/utils/formatters"
import type { EnrichedPosition } from '@/lib/types'
import { useAssetCalculations, RawTransaction } from './detail/use-asset-calculations'
import dynamic from 'next/dynamic'
import { AssetAlerts } from "./detail/asset-alerts"
import { AssetNews } from "./detail/asset-news"
import { AssetLogo } from "@/components/ui/asset-logo"
import { PriceAlerts } from "@/components/dashboard/price-alerts"
import { InteractiveAssetChart } from "./detail/interactive-chart"
import { MarketStats } from "./detail/market-stats"
import type { AssetDetails } from '@/lib/actions/market'

const AssetContributionsChart = dynamic(() => import('./detail/asset-charts').then(m => m.AssetContributionsChart), { ssr: false })

interface EtfDetailClientProps {
  position: EnrichedPosition
  transactions: RawTransaction[]
  assetDetails?: AssetDetails | null
}

const TIPO_BADGE_STYLES: Record<string, string> = {
  ETF: "bg-blue-500/10 text-blue-400 border-blue-500/20",
}

export function EtfDetailClient({ position, transactions, assetDetails }: EtfDetailClientProps) {
  const {
    evolutionData,
    monthlyContributionsData,
    stats,
    txTableData
  } = useAssetCalculations(position, transactions)

  const [alertsOpen, setAlertsOpen] = useState(false)
  const [rangePerformance, setRangePerformance] = useState<{ label: string, absolute: number, percent: number } | null>(null)

  const currentPerformance = rangePerformance || {
    label: "Hoy",
    absolute: position.change_amount_24h ?? 0,
    percent: position.change_percent_24h ?? 0
  }

  const isPositive = currentPerformance.absolute >= 0
  const colorHex = isPositive ? "#10b981" : "#f43f5e"

  return (
    <div className="min-h-screen bg-background selection:bg-blue-500/30">
      {/* ═══════════ HEADER ═══════════ */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Volver</span>
          </Link>
          <div className="flex items-center gap-2.5">
             <Badge variant="outline" className={TIPO_BADGE_STYLES[position.tipo] || "bg-muted text-foreground/80"}>
                {position.tipo}
             </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-20">

        {/* ═══════════ HERO: TICKER & PRECIO ═══════════ */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 animate-fade-in">
          <div className="flex items-center gap-4 md:gap-5">
            <AssetLogo 
              ticker={position.ticker} 
              name={position.nombre} 
              type={position.tipo} 
              size={64}
              className="drop-shadow-sm hidden md:flex"
            />
            <AssetLogo 
              ticker={position.ticker} 
              name={position.nombre} 
              type={position.tipo} 
              size={48}
              className="drop-shadow-sm flex md:hidden"
            />
            <div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground mb-1">
                {position.nombre || position.ticker}
              </h1>
              <p className="text-xl text-muted-foreground font-medium">
                Símbolo: {position.ticker} {position.isin ? `• ISIN: ${position.isin}` : ''}
              </p>
            </div>
          </div>
          <div className="text-left md:text-right">
            <div className="flex items-center md:justify-end gap-3">
              <p className="text-5xl md:text-6xl font-bold text-foreground tabular-nums drop-shadow-md">
                {position.precio_actual !== null ? formatCurrency(position.precio_actual, position.moneda) : "—"}
              </p>
              {position.price_is_stale && (
                <div title="Precio desactualizado, se actualizará en la próxima sesión" className="w-3 h-3 rounded-full bg-amber-500 animate-pulse mt-2 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
              )}
            </div>
            <div className="flex items-center md:justify-end gap-2 mt-2">
              <p className={`text-lg font-bold tabular-nums flex items-center ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                {isPositive ? "+" : ""}{formatCurrency(currentPerformance.absolute, position.moneda)} 
                <span className="ml-1 opacity-80">({isPositive ? "+" : ""}{currentPerformance.percent.toFixed(2)}%)</span>
                <span className="text-muted-foreground text-sm ml-2 font-medium">{currentPerformance.label}</span>
              </p>
            </div>
          </div>
        </div>

        {/* ═══════════ GRÁFICO INTERACTIVO ═══════════ */}
        <div className="mb-8 animate-fade-in stagger-1">
          <InteractiveAssetChart 
            ticker={position.ticker} 
            moneda={position.moneda} 
            colorHex={colorHex} 
            transactions={transactions}
            units={position.unidades}
            historicalPnl={{ absolute: position.pnl ?? 0, percent: position.pnl_percent ?? 0 }}
            onRangePerformanceChange={setRangePerformance}
          />
        </div>

        {/* ═══════════ TU POSICIÓN ═══════════ */}
        {/* ═══════════ DATOS FUNDAMENTALES ═══════════ */}
        {assetDetails && (
          <div className="mb-10 animate-fade-in stagger-3">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-400" />
              Métricas Fundamentales
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-card/40 border-border backdrop-blur-sm">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground font-medium mb-1">Rentabilidad por Div</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">
                    {assetDetails.dividendYield ? (assetDetails.dividendYield * 100).toFixed(2) + '%' : "N/A"}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/40 border-border backdrop-blur-sm">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground font-medium mb-1">Volumen</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">
                    {assetDetails.volume ? assetDetails.volume.toLocaleString() : "N/A"}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/40 border-border backdrop-blur-sm">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground font-medium mb-1">Media 200 Sesiones</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">
                    {assetDetails.twoHundredDayAverage ? formatCurrency(assetDetails.twoHundredDayAverage, position.moneda) : "N/A"}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/40 border-border backdrop-blur-sm">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground font-medium mb-1">Rango 52 Semanas</p>
                  <p className="text-xl font-bold text-foreground tabular-nums truncate">
                    {assetDetails.fiftyTwoWeekLow && assetDetails.fiftyTwoWeekHigh
                      ? `${formatCurrency(assetDetails.fiftyTwoWeekLow, position.moneda)} - ${formatCurrency(assetDetails.fiftyTwoWeekHigh, position.moneda)}`
                      : "N/A"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10 animate-fade-in stagger-3">
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Participaciones</span>
            <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{formatUnits(position.unidades)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor Total</span>
            <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{formatCurrency(position.valor_actual || 0, 'EUR')}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Precio Medio</span>
            <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{formatCurrency(stats.precioMedio, position.moneda)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Beneficio</span>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${stats.gananciaIntereses >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {stats.gananciaIntereses >= 0 ? "+" : ""}{formatCurrency(stats.gananciaIntereses, position.moneda)}
            </p>
            <p className={`text-sm font-bold tabular-nums ${stats.precioPorcentaje >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {stats.precioPorcentaje >= 0 ? "+" : ""}{stats.precioPorcentaje.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {/* ═══════════ DATOS DEL MERCADO ═══════════ */}
          <div className="lg:col-span-1 animate-fade-in stagger-3 space-y-8">
            <div>
               <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                 <Briefcase className="h-5 w-5 text-blue-400" />
                 Datos del Mercado
               </h2>
               <MarketStats ticker={position.ticker} moneda={position.moneda} />
            </div>
            
            <AssetAlerts 
              ticker={position.ticker} 
              moneda={position.moneda} 
              onOpenAlertsModal={() => setAlertsOpen(true)} 
            />
          </div>

          {/* ═══════════ APORTACIONES DCA ═══════════ */}
          <div className="lg:col-span-2 animate-fade-in stagger-3">
             <AssetContributionsChart monthlyContributionsData={monthlyContributionsData} />
          </div>
        </div>

        {/* ═══════════ HISTORIAL DE TRANSACCIONES ═══════════ */}
        <div className="animate-fade-in stagger-4">
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            Operaciones Recientes
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden backdrop-blur-sm overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-background/50 text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-5 py-4">Fecha</th>
                  <th className="px-5 py-4">Tipo</th>
                  <th className="px-5 py-4 text-right">Participaciones</th>
                  <th className="px-5 py-4 text-right">Precio</th>
                  <th className="px-5 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {txTableData.slice().reverse().map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 text-foreground/80 whitespace-nowrap">
                      {new Date(tx.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${tx.tipo_operacion === 'Compra' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {tx.tipo_operacion}
                      </span>
                      {tx.estado === 'Pendiente' && (
                        <span className="ml-1 inline-flex px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-foreground/80">{formatUnits(Number(tx.cantidad))}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-foreground/80">{formatCurrency(Number(tx.precio_unitario), position.moneda)}</td>
                    <td className="px-5 py-4 text-right tabular-nums font-bold text-foreground">{formatCurrency(tx.total, position.moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══════════ NOTICIAS RELEVANTES ═══════════ */}
        <div className="mt-10 animate-fade-in stagger-5">
          <AssetNews ticker={position.ticker} />
        </div>
      </main>

      <PriceAlerts 
        open={alertsOpen} 
        onOpenChange={setAlertsOpen} 
        initialTicker={position.ticker} 
      />
    </div>
  )
}
