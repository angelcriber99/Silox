"use client"
import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft, TrendingUp, TrendingDown, Wallet, Layers, Activity,
  LineChart as LineChartIcon, DollarSign, BarChart3, Info
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
// Recharts removed as it's now in the InteractiveAssetChart
import { formatCurrency, formatPercent, formatUnits } from "@/lib/utils/formatters"
import type { EnrichedPosition } from '@/lib/types'
import { useAssetCalculations, RawTransaction } from './detail/use-asset-calculations'
import { AssetNews } from "./detail/asset-news"
import { AssetLogo } from "@/components/ui/asset-logo"
import { InteractiveAssetChart } from "./detail/interactive-chart"
import { AssetPnlChart } from "./detail/asset-pnl-chart"
import { StockExtendedStats } from "./detail/stock-extended-stats"
import { PurchaseLotsCard } from "./detail/purchase-lots-card"
import type { AssetDetails } from '@/lib/actions/market'

interface StockDetailClientProps {
  position: EnrichedPosition
  transactions: RawTransaction[]
  assetDetails?: AssetDetails | null
  realtimeStatus?: "connecting" | "connected" | "disconnected"
  pricesUpdatedAt?: number
}

const TIPO_BADGE_STYLES: Record<string, string> = {
  Acción: "bg-amber-500/10 text-amber-400 border-amber-500/20",
}

export function StockDetailClient({ position, transactions, assetDetails, realtimeStatus = "connecting", pricesUpdatedAt }: StockDetailClientProps) {
  const {
    evolutionData,
    stats,
    txTableData
  } = useAssetCalculations(position, transactions)


  const [rangePerformance, setRangePerformance] = useState<{ label: string, absolute: number, percent: number } | null>(null)
  const [chartMode, setChartMode] = useState<"price" | "pnl">("price")

  const sessionPercent = position.change_percent_24h ?? 0
  const currentNativeValue = position.valor_actual_nativo ?? 0
  const sessionBaseline = sessionPercent > -99.99
    ? currentNativeValue / (1 + sessionPercent / 100)
    : currentNativeValue
  const currentPerformance = rangePerformance || {
    label: position.market_state === "PRE" ? "Premercado" : position.market_state === "POST" ? "Postmercado" : "Sesión",
    absolute: currentNativeValue - sessionBaseline,
    percent: sessionPercent,
  }

  const isPositive = currentPerformance.absolute >= 0
  const colorHex = isPositive ? "#10b981" : "#f43f5e"

  return (
    <div className="min-h-screen bg-background selection:bg-amber-500/30">
      {/* ═══════════ HEADER ═══════════ */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Volver</span>
          </Link>
          <div className="flex items-center gap-2.5">
             <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
               <span className={`h-2 w-2 rounded-full ${realtimeStatus === "connected" && !position.price_is_stale ? "bg-emerald-400" : realtimeStatus === "disconnected" ? "bg-rose-400" : "bg-amber-400"}`} />
               {realtimeStatus === "connected" ? "En vivo" : realtimeStatus === "disconnected" ? "Sin conexión" : "Conectando"}
               {pricesUpdatedAt ? ` · ${new Date(pricesUpdatedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
             </span>
             <Badge variant="outline" className={TIPO_BADGE_STYLES[position.tipo] || "bg-muted text-foreground/80"}>
                {position.tipo}
             </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-20">

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
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-foreground mb-1">
                {position.ticker}
              </h1>
              <p className="text-xl text-muted-foreground font-medium">
                {position.nombre}
              </p>
            </div>
          </div>
          <div className="text-left md:text-right">
            <div className="flex items-center md:justify-end gap-3">
              <p className="text-5xl md:text-6xl font-bold text-foreground tabular-nums drop-shadow-md">
                {position.precio_actual !== null ? formatCurrency(position.precio_actual_nativo ?? position.precio_actual, position.original_currency || position.moneda) : "—"}
              </p>
              {position.price_is_stale && (
                <div title="Precio desactualizado, se actualizará en la próxima sesión" className="w-3 h-3 rounded-full bg-amber-500 animate-pulse mt-2 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
              )}
            </div>
            <div className="flex items-center md:justify-end gap-2 mt-2">
              <p className={`text-lg font-bold tabular-nums flex items-center ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                {isPositive ? "+" : ""}{formatCurrency(currentPerformance.absolute, position.original_currency || position.moneda)} 
                <span className="ml-1 opacity-80">({isPositive ? "+" : ""}{currentPerformance.percent.toFixed(2)}%)</span>
                <span className="text-muted-foreground text-sm ml-2 font-medium">{currentPerformance.label}</span>
              </p>
            </div>
          </div>
        </div>

        {/* ═══════════ GRÁFICO INTERACTIVO ═══════════ */}
        <div className="mb-8 animate-fade-in stagger-1">
          <div className="flex justify-end mb-4">
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg">
              <button
                onClick={() => setChartMode("price")}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${chartMode === "price" ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground"}`}
              >
                Evolución de Precio
              </button>
              <button
                onClick={() => setChartMode("pnl")}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${chartMode === "pnl" ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground"}`}
              >
                Beneficio Histórico
              </button>
            </div>
          </div>
          {chartMode === "price" ? (
            <InteractiveAssetChart 
              ticker={position.ticker} 
              moneda={position.original_currency || position.moneda} 
              colorHex={colorHex} 
              transactions={transactions}
              units={position.unidades}
              historicalPnl={{ absolute: position.pnl ?? 0, percent: position.pnl_percent ?? 0 }}
              onRangePerformanceChange={setRangePerformance}
            />
          ) : (
            <AssetPnlChart assetId={position.activo_id} colorHex={colorHex} />
          )}
        </div>

        {/* ═══════════ TU POSICIÓN ═══════════ */}
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2 animate-fade-in stagger-1">
          <Wallet className="h-5 w-5 text-amber-400" />
          Tu Posición
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 animate-fade-in stagger-2">
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Acciones</span>
            <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{formatUnits(position.unidades)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor</span>
            <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{formatCurrency(position.valor_actual || 0, 'EUR')}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Precio Medio</span>
            <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{formatCurrency(stats.precioMedio, position.moneda)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Rentabilidad Total</span>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${stats.gananciaIntereses >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {stats.gananciaIntereses >= 0 ? "+" : ""}{formatCurrency(stats.gananciaIntereses, position.moneda)}
            </p>
            <p className={`text-sm font-bold tabular-nums ${stats.precioPorcentaje >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {stats.precioPorcentaje >= 0 ? "+" : ""}{stats.precioPorcentaje.toFixed(2)}%
            </p>
          </div>
        </div>

        <PurchaseLotsCard position={position} transactions={transactions} />

        {/* ═══════════ ESTADÍSTICAS EXTENDIDAS DE ACCIÓN ═══════════ */}
        <div className="mb-10 animate-fade-in stagger-3">
          <StockExtendedStats ticker={position.ticker} moneda={position.moneda} precioActual={position.precio_actual_nativo ?? position.precio_actual} />
        </div>

        {/* ═══════════ HISTORIAL DE TRANSACCIONES ═══════════ */}
        <div className="mb-10 animate-fade-in stagger-4">
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
                  <th className="px-5 py-4 text-right">Acciones</th>
                  <th className="px-5 py-4 text-right">Precio</th>
                  <th className="px-5 py-4 text-right">Rendimiento</th>
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
                    <td className="px-5 py-4 text-right tabular-nums text-foreground/80">{formatCurrency(Number(tx.precio_unitario), position.moneda, position.tipo === "Fondo Indexado" ? 4 : 2)}</td>
                    <td className="px-5 py-4 text-right">
                      {(tx.tipo_operacion === 'Compra' || tx.tipo_operacion === 'Traspaso Entrada') && tx.pnlTotal !== null && tx.pnlPct !== null ? (
                        <div className="flex flex-col items-end">
                          <span className={`tabular-nums font-medium ${tx.pnlTotal >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {tx.pnlTotal >= 0 ? "+" : ""}{formatCurrency(tx.pnlTotalEur ?? tx.pnlTotal, 'EUR')}
                          </span>
                          <span className={`text-[10px] tabular-nums ${tx.pnlPct >= 0 ? "text-emerald-500/70" : "text-rose-500/70"}`}>
                            {tx.pnlPct >= 0 ? "+" : ""}{tx.pnlPct.toFixed(2)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
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

    </div>
  )
}
