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
import { AssetAlerts } from "./detail/asset-alerts"
import { AssetNews } from "./detail/asset-news"
import { AssetLogo } from "@/components/ui/asset-logo"
import { PriceAlerts } from "@/components/dashboard/price-alerts"
import { InteractiveAssetChart } from "./detail/interactive-chart"
import { StockExtendedStats } from "./detail/stock-extended-stats"
import type { AssetDetails } from '@/lib/actions/market'

interface StockDetailClientProps {
  position: EnrichedPosition
  transactions: RawTransaction[]
  assetDetails?: AssetDetails | null
}

const TIPO_BADGE_STYLES: Record<string, string> = {
  Acción: "bg-amber-500/10 text-amber-400 border-amber-500/20",
}

export function StockDetailClient({ position, transactions, assetDetails }: StockDetailClientProps) {
  const {
    evolutionData,
    stats,
    txTableData
  } = useAssetCalculations(position, transactions)

  const [alertsOpen, setAlertsOpen] = useState(false)

  const isPositive = (position.change_percent_24h || 0) >= 0
  const colorHex = isPositive ? "#10b981" : "#f43f5e"

  return (
    <div className="min-h-full bg-background selection:bg-amber-500/30">
      {/* ═══════════ HEADER ═══════════ */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Volver</span>
          </Link>
          <div className="flex items-center gap-2.5">
             <span className="text-xs uppercase font-semibold text-muted-foreground tracking-widest">{position.tipo}</span>
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
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground mb-1">
                {position.ticker}
              </h1>
              <p className="text-xl text-muted-foreground font-medium">
                {position.nombre}
              </p>
            </div>
          </div>
          <div className="text-left md:text-right">
            <p className="text-5xl md:text-6xl font-bold text-foreground tabular-nums drop-shadow-md">
              {position.precio_actual !== null ? formatCurrency(position.precio_actual_nativo ?? position.precio_actual, position.original_currency || position.moneda) : "—"}
            </p>
            <div className="flex items-center md:justify-end gap-2 mt-2">
              {position.change_percent_24h !== null && position.change_amount_24h !== null && (
                <p className={`text-lg font-bold tabular-nums flex items-center ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                  {isPositive ? "+" : ""}{formatCurrency(position.change_amount_24h_nativo ?? position.change_amount_24h, position.original_currency || position.moneda)} 
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
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2 mt-12">
          Tu Posición
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x divide-border border-y border-border mb-10">
          <div className="p-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Acciones</span>
            <p className="text-xl font-medium text-foreground tabular-nums mt-1">{formatUnits(position.unidades)}</p>
          </div>
          <div className="p-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Valor</span>
            <p className="text-xl font-medium text-foreground tabular-nums mt-1">{formatCurrency(position.valor_actual || 0, 'EUR')}</p>
          </div>
          <div className="p-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Precio Medio</span>
            <p className="text-xl font-medium text-foreground tabular-nums mt-1">{formatCurrency(stats.precioMedio, position.moneda)}</p>
          </div>
          <div className="p-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Rentabilidad Total</span>
            <p className="text-xl font-medium text-foreground tabular-nums mt-1" style={{ color: stats.gananciaIntereses >= 0 ? "var(--positive)" : "var(--negative)" }}>
              {stats.gananciaIntereses >= 0 ? "+" : ""}{formatCurrency(stats.gananciaIntereses, position.moneda)}
            </p>
            <p className="text-sm font-semibold tabular-nums mt-1" style={{ color: stats.precioPorcentaje >= 0 ? "var(--positive)" : "var(--negative)", opacity: 0.8 }}>
              {stats.precioPorcentaje >= 0 ? "+" : ""}{stats.precioPorcentaje.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* ═══════════ ESTADÍSTICAS EXTENDIDAS DE ACCIÓN ═══════════ */}
        <div className="mb-10 animate-fade-in stagger-3">
          <StockExtendedStats ticker={position.ticker} moneda={position.moneda} precioActual={position.precio_actual_nativo ?? position.precio_actual} />
        </div>

        {/* ═══════════ HISTORIAL DE TRANSACCIONES Y ALERTAS ═══════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10 animate-fade-in stagger-4">
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Operaciones Recientes
            </h2>
            <div className="border-t border-border overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-muted-foreground text-[11px] uppercase tracking-widest font-semibold border-b border-border">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Fecha</th>
                    <th className="px-4 py-4 font-semibold">Tipo</th>
                    <th className="px-4 py-4 text-right font-semibold">Acciones</th>
                    <th className="px-4 py-4 text-right font-semibold">Precio</th>
                    <th className="px-4 py-4 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {txTableData.slice().reverse().map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4 text-foreground/80 whitespace-nowrap">
                        {new Date(tx.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: tx.tipo_operacion === 'Compra' ? "var(--positive)" : "var(--negative)" }}>
                          {tx.tipo_operacion}
                        </span>
                        {tx.estado === 'Pendiente' && (
                          <span className="ml-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-foreground">{formatUnits(Number(tx.cantidad))}</td>
                      <td className="px-4 py-4 text-right tabular-nums text-foreground">{formatCurrency(Number(tx.precio_unitario), position.moneda)}</td>
                      <td className="px-4 py-4 text-right tabular-nums font-medium text-foreground">{formatCurrency(tx.total, position.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Tus Alertas
            </h2>
            <AssetAlerts 
              ticker={position.ticker} 
              moneda={position.moneda} 
              onOpenAlertsModal={() => setAlertsOpen(true)} 
            />
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
