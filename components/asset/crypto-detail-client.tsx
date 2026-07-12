"use client"
import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft, TrendingUp, TrendingDown, Wallet, Layers, Activity,
  LineChart as LineChartIcon, DollarSign, BarChart3, Coins
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
// Recharts removed as it's now in the InteractiveAssetChart
import { formatCurrency, formatPercent, formatUnits } from "@/lib/utils/formatters"
import type { EnrichedPosition } from '@/lib/types'
import { useAssetCalculations, RawTransaction } from './detail/use-asset-calculations'
import { AssetAlerts } from "./detail/asset-alerts"
import { AssetNews } from "./detail/asset-news"
import { PriceAlerts } from "@/components/dashboard/price-alerts"
import { InteractiveAssetChart } from "./detail/interactive-chart"
import { MarketStats } from "./detail/market-stats"

interface CryptoDetailClientProps {
  position: EnrichedPosition
  transactions: RawTransaction[]
}

const TIPO_BADGE_STYLES: Record<string, string> = {
  Crypto: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Metal: "bg-stone-500/10 text-stone-300 border-stone-500/20",
}

export function CryptoDetailClient({ position, transactions }: CryptoDetailClientProps) {
  const {
    evolutionData,
    stats,
    txTableData
  } = useAssetCalculations(position, transactions)

  const [alertsOpen, setAlertsOpen] = useState(false)

  const isPositive = (position.change_percent_24h || 0) >= 0
  const colorHex = isPositive ? "#10b981" : "#f43f5e"

  return (
    <div className="min-h-screen bg-background selection:bg-orange-500/30">
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-20">

        {/* ═══════════ HERO: TICKER & PRECIO ═══════════ */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 animate-fade-in">
          <div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-foreground mb-1">
              {position.ticker}
            </h1>
            <p className="text-xl text-muted-foreground font-medium">
              {position.nombre}
            </p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-5xl md:text-6xl font-bold text-foreground tabular-nums drop-shadow-md">
              {position.precio_actual !== null ? formatCurrency(position.precio_actual, position.moneda) : "—"}
            </p>
            <div className="flex items-center md:justify-end gap-2 mt-2">
              {position.change_percent_24h !== null && position.change_amount_24h !== null && (
                <p className={`text-lg font-bold tabular-nums flex items-center ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                  {isPositive ? "+" : ""}{formatCurrency(position.change_amount_24h, position.moneda)} 
                  <span className="ml-1 opacity-80">({isPositive ? "+" : ""}{position.change_percent_24h.toFixed(2)}%)</span>
                  <span className="text-muted-foreground text-sm ml-2 font-medium">Hoy</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════ GRÁFICO INTERACTIVO ═══════════ */}
        <div className="mb-8 animate-fade-in stagger-1">
          <InteractiveAssetChart ticker={position.ticker} moneda={position.moneda} colorHex={colorHex} />
        </div>

        {/* ═══════════ TU POSICIÓN ═══════════ */}
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2 animate-fade-in stagger-1">
          <Wallet className="h-5 w-5 text-orange-400" />
          Tu Billetera
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 animate-fade-in stagger-2">
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tokens</span>
            <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{position.unidades.toFixed(6)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Balance</span>
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

        {/* ═══════════ ESTADÍSTICAS Y ALERTAS ═══════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10 animate-fade-in stagger-3">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Coins className="h-5 w-5 text-orange-400" />
              Datos de la Red
            </h2>
            <MarketStats ticker={position.ticker} moneda={position.moneda} />
          </div>
          <div className="lg:col-span-1">
            <h2 className="text-xl font-bold text-transparent mb-4 flex items-center gap-2 select-none pointer-events-none">
              <Coins className="h-5 w-5 text-transparent" />
              Alertas
            </h2>
            <AssetAlerts 
              ticker={position.ticker} 
              moneda={position.moneda} 
              onOpenAlertsModal={() => setAlertsOpen(true)} 
            />
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
                  <th className="px-5 py-4 text-right">Cantidad</th>
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
                    <td className="px-5 py-4 text-right tabular-nums text-foreground/80">{Number(tx.cantidad).toFixed(6)}</td>
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
