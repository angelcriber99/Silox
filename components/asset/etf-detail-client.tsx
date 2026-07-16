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

  const isPositive = (position.change_percent_24h || 0) >= 0
  const colorHex = isPositive ? "#10b981" : "#f43f5e"

  return (
    <div className="min-h-full bg-background selection:bg-blue-500/30">
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
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground mb-1">
                {position.nombre || position.ticker}
              </h1>
              <p className="text-xl text-muted-foreground font-medium">
                Símbolo: {position.ticker} {position.isin ? `• ISIN: ${position.isin}` : ''}
              </p>
            </div>
          </div>
          <div className="text-left md:text-right">
            <p className="text-4xl md:text-5xl font-bold text-foreground tabular-nums drop-shadow-md">
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
        {/* ═══════════ DATOS FUNDAMENTALES ═══════════ */}
        {assetDetails && (
          <div className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Métricas Fundamentales
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x divide-border border border-border">
              <div className="p-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Rentabilidad por Div</span>
                <p className="text-lg font-medium text-foreground tabular-nums mt-1">
                  {assetDetails.dividendYield ? (assetDetails.dividendYield * 100).toFixed(2) + '%' : "N/A"}
                </p>
              </div>
              <div className="p-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Volumen</span>
                <p className="text-lg font-medium text-foreground tabular-nums mt-1">
                  {assetDetails.volume ? assetDetails.volume.toLocaleString() : "N/A"}
                </p>
              </div>
              <div className="p-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Media 200 Sesiones</span>
                <p className="text-lg font-medium text-foreground tabular-nums mt-1">
                  {assetDetails.twoHundredDayAverage ? formatCurrency(assetDetails.twoHundredDayAverage, position.moneda) : "N/A"}
                </p>
              </div>
              <div className="p-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Rango 52 Semanas</span>
                <p className="text-lg font-medium text-foreground tabular-nums truncate mt-1">
                  {assetDetails.fiftyTwoWeekLow && assetDetails.fiftyTwoWeekHigh
                    ? `${formatCurrency(assetDetails.fiftyTwoWeekLow, position.moneda)} - ${formatCurrency(assetDetails.fiftyTwoWeekHigh, position.moneda)}`
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x divide-border border border-border mb-10">
          <div className="p-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Participaciones</span>
            <p className="text-xl font-medium text-foreground tabular-nums mt-1">{formatUnits(position.unidades)}</p>
          </div>
          <div className="p-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Valor Total</span>
            <p className="text-xl font-medium text-foreground tabular-nums mt-1">{formatCurrency(position.valor_actual || 0, 'EUR')}</p>
          </div>
          <div className="p-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Precio Medio</span>
            <p className="text-xl font-medium text-foreground tabular-nums mt-1">{formatCurrency(stats.precioMedio, position.moneda)}</p>
          </div>
          <div className="p-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Beneficio</span>
            <p className="text-xl font-medium tabular-nums mt-1" style={{ color: stats.gananciaIntereses >= 0 ? "var(--positive)" : "var(--negative)" }}>
              {stats.gananciaIntereses >= 0 ? "+" : ""}{formatCurrency(stats.gananciaIntereses, position.moneda)}
            </p>
            <p className="text-sm font-semibold tabular-nums mt-1" style={{ color: stats.precioPorcentaje >= 0 ? "var(--positive)" : "var(--negative)", opacity: 0.8 }}>
              {stats.precioPorcentaje >= 0 ? "+" : ""}{stats.precioPorcentaje.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {/* ═══════════ DATOS DEL MERCADO ═══════════ */}
          <div className="lg:col-span-1 animate-fade-in stagger-3 space-y-8">
            <div>
               <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
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
        <div className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Operaciones Recientes
          </h2>
          <div className="border-t border-border overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-muted-foreground text-[11px] uppercase tracking-widest font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-4 font-semibold">Fecha</th>
                  <th className="px-4 py-4 font-semibold">Tipo</th>
                  <th className="px-4 py-4 text-right font-semibold">Participaciones</th>
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
