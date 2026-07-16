"use client"
import { useState, useMemo } from "react"
import Link from "next/link"
import {
  ArrowLeft, TrendingUp, TrendingDown, Wallet, BarChart3, Layers, Activity,
  Calculator, History, Target, Sparkles, PiggyBank, CalendarDays, Clock,
  Zap, Award, LineChart as LineChartIcon, DollarSign
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"
import { formatCurrency, formatPercent, formatUnits } from "@/lib/utils/formatters"
import type { EnrichedPosition } from '@/lib/types'

import dynamic from 'next/dynamic'
import { useAssetCalculations, RawTransaction } from './detail/use-asset-calculations'
import { AssetLogo } from "@/components/ui/asset-logo"
import { AssetAlerts } from "./detail/asset-alerts"
import { AssetNews } from "./detail/asset-news"
import { PriceAlerts } from "@/components/dashboard/price-alerts"
import { InteractiveAssetChart } from "./detail/interactive-chart"
import { MarketStats } from "./detail/market-stats"
import { TraspasoModal } from "@/components/transactions/traspaso-modal"
import { ArrowRightLeft } from "lucide-react"

const AssetEvolutionChart = dynamic(() => import('./detail/asset-charts').then(m => m.AssetEvolutionChart), { ssr: false })
const AssetCapitalDonut = dynamic(() => import('./detail/asset-charts').then(m => m.AssetCapitalDonut), { ssr: false })
const AssetContributionsChart = dynamic(() => import('./detail/asset-charts').then(m => m.AssetContributionsChart), { ssr: false })


// ─── Types ───────────────────────────────────
interface ActivoDetailClientProps {
  position: EnrichedPosition
  transactions: RawTransaction[]
}

const TIPO_BADGE_STYLES: Record<string, string> = {
  ETF: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Fondo Indexado": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Fondo Monetario": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  Acción: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Crypto: "bg-orange-500/10 text-orange-400 border-orange-500/20",
}

// ─── Component ───────────────────────────────
export function FundDetailClient({ position, transactions }: ActivoDetailClientProps) {
  // Simulator state
  const [monthlyContribution, setMonthlyContribution] = useState(300)
  const [years, setYears] = useState(15)
  const [expectedReturn, setExpectedReturn] = useState(8)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [traspasoOpen, setTraspasoOpen] = useState(false)
  const {
    sparklineData,
    evolutionData,
    monthlyContributionsData,
    stats,
    operacionesDonut,
    capitalDonut,
    txTableData
  } = useAssetCalculations(position, transactions)

  // ── Simulador Interés Compuesto ──
  const simulationData = useMemo(() => {
    let capital = position.valor_actual ?? position.coste_total
    let invested = capital
    const pts = [{ year: 0, capital: Math.round(capital), invested: Math.round(invested), interest: 0 }]
    const monthlyRate = expectedReturn / 100 / 12

    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) {
        capital += monthlyContribution
        capital *= (1 + monthlyRate)
        invested += monthlyContribution
      }
      pts.push({
        year: y,
        capital: Math.round(capital),
        invested: Math.round(invested),
        interest: Math.round(capital - invested)
      })
    }
    return pts
  }, [position.valor_actual, position.coste_total, monthlyContribution, years, expectedReturn])

  const finalData = simulationData[simulationData.length - 1]

  const isPositive = (position.change_percent_24h || 0) >= 0
  const colorHex = isPositive ? "#10b981" : "#f43f5e"

  return (
    <div className="min-h-screen bg-background selection:bg-purple-500/30">
      {/* ═══════════ HEADER ═══════════ */}
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Volver al Dashboard</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTraspasoOpen(true)}
              className="hidden md:flex border-border text-foreground hover:bg-muted transition-colors rounded-none"
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Traspaso
            </Button>
            <div className="flex items-center gap-2.5 opacity-50">
               <span className="text-xs uppercase font-semibold text-muted-foreground tracking-widest">{position.tipo}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 pb-20">

        {/* ═══════════ HERO ═══════════ */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10 animate-fade-in">
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
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {position.tipo}
                </span>
                {position.estrategia && (
                  <>
                    <span className="opacity-50 text-muted-foreground">•</span>
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {position.estrategia}
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-2">
              {position.nombre || position.ticker}
            </h1>
            <p className="text-muted-foreground/80 font-medium">
              Símbolo: <span className="text-foreground/80">{position.ticker}</span>
              {position.isin && <span className="mx-2 opacity-50">•</span>}
              {position.isin && <span>ISIN: <span className="text-foreground/80">{position.isin}</span></span>}
              {position.original_currency && position.original_currency !== "EUR" && (
                <span className="text-muted-foreground/60"> • Moneda nativa: {position.original_currency}</span>
              )}
            </p>
            </div>
          </div>
          <div className="text-left md:text-right">
            <p className="text-sm text-muted-foreground/80 uppercase font-bold tracking-wider mb-1">Valor Actual</p>
            <p className="text-4xl md:text-5xl font-bold text-foreground tabular-nums drop-shadow-md">
              {position.valor_actual !== null ? formatCurrency(position.valor_actual, 'EUR') : "—"}
            </p>
            <div className="flex flex-col md:flex-row items-end justify-end gap-3 mt-1">
              {position.change_percent_24h !== null && (
                <p className={`text-base font-medium tabular-nums flex items-center gap-1 ${position.change_percent_24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {position.change_percent_24h >= 0 ? "+" : ""}{position.change_percent_24h.toFixed(2)}% hoy
                </p>
              )}
              {position.pnl_percent !== null && (
                <p className={`text-lg font-medium tabular-nums flex items-center gap-1 ${position.pnl_percent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  <span className="text-muted-foreground/60 hidden md:inline">|</span>
                  {position.pnl_percent >= 0 ? <TrendingUp className="h-5 w-5 ml-2" /> : <TrendingDown className="h-5 w-5 ml-2" />}
                  {formatPercent(position.pnl_percent)} global
                </p>
              )}
            </div>
            {/* Mini Sparkline 7d */}
            {sparklineData && (
              <div className="flex items-center gap-3 mt-3 md:justify-end">
                <div className="w-[100px] h-[32px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparklineData.data}>
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke={sparklineData.isPositive ? "#10b981" : "#f43f5e"}
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <span className={`text-sm font-bold tabular-nums ${sparklineData.isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                  {sparklineData.isPositive ? "+" : ""}{sparklineData.change.toFixed(2)}% 7d
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════ KPIs GRID ═══════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x divide-border border-y border-border mb-8 mt-10">
          <div className="p-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Total Invertido</span>
            <p className="text-xl font-medium text-foreground tabular-nums mt-1">{formatCurrency(position.coste_total, 'EUR')}</p>
          </div>
          <div className="p-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Ganado por Mercado</span>
            <p className="text-xl font-medium tabular-nums mt-1" style={{ color: stats.gananciaIntereses >= 0 ? "var(--positive)" : "var(--negative)" }}>
              {stats.gananciaIntereses >= 0 ? "+" : ""}{formatCurrency(stats.gananciaIntereses, position.moneda)}
            </p>
          </div>
          <div className="p-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Participaciones</span>
            <p className="text-xl font-medium text-foreground tabular-nums mt-1">{formatUnits(position.unidades)}</p>
          </div>
          <div className="p-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Operaciones</span>
            <p className="text-xl font-medium text-foreground tabular-nums mt-1">{position.num_operaciones}</p>
          </div>
        </div>

        {/* ═══════════ ADVANCED STATS ROW ═══════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x divide-border border-b border-border mb-10">
          <div className="p-6 bg-muted/20">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">CAGR</span>
            <p className="text-xl font-medium text-foreground tabular-nums mt-1">
              {stats.cagr > 0 ? "+" : ""}{stats.cagr.toFixed(2)}%
            </p>
            <p className="text-[10px] text-muted-foreground/80 mt-1">Rentabilidad anualizada</p>
          </div>
          <div className="p-6 bg-muted/20">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Tiempo</span>
            <p className="text-xl font-medium text-foreground tabular-nums mt-1">{stats.monthsInvested} meses</p>
            <p className="text-[10px] text-muted-foreground/80 mt-1">Desde {stats.firstTxDate?.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }) || '—'}</p>
          </div>
          <div className="p-6 bg-muted/20">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Media / Mes</span>
            <p className="text-xl font-medium text-foreground tabular-nums mt-1">{formatCurrency(stats.avgMonthly, 'EUR')}</p>
            <p className="text-[10px] text-muted-foreground/80 mt-1">Aportación media mensual</p>
          </div>
          <div className="p-6 bg-muted/20">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Mayor Compra</span>
            <p className="text-xl font-medium text-foreground tabular-nums mt-1">{formatCurrency(stats.maxCompra, 'EUR')}</p>
            <p className="text-[10px] text-muted-foreground/80 mt-1">Tu mayor aportación</p>
          </div>
        </div>

        {/* ═══════════ GRÁFICO INTERACTIVO Y ESTADÍSTICAS ═══════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10 animate-fade-in stagger-1">
          <div className="lg:col-span-2">
             <InteractiveAssetChart ticker={position.ticker} moneda={position.moneda} colorHex={colorHex} />
          </div>
          <div className="lg:col-span-1">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Datos del Mercado
            </h2>
            <MarketStats ticker={position.ticker} moneda={position.moneda} />
          </div>
        </div>

        {/* ═══════════ PRECIO MEDIO vs PRECIO ACTUAL ═══════════ */}
        <div className="border border-border mb-10 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Precio Medio de Compra</p>
                <p className="text-xl font-medium text-foreground tabular-nums mt-1">{formatCurrency(stats.precioMedio, position.moneda)}</p>
              </div>
            </div>
            <div className="flex-1 max-w-md mx-4">
              <div className="relative h-2 bg-muted overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 transition-all duration-1000"
                  style={{ width: `${Math.min(100, Math.abs(stats.precioPorcentaje) + 50)}%`, backgroundColor: stats.precioPorcentaje >= 0 ? "var(--positive)" : "var(--negative)" }}
                />
              </div>
              <p className="text-center mt-2 text-xs font-semibold tabular-nums" style={{ color: stats.precioPorcentaje >= 0 ? "var(--positive)" : "var(--negative)" }}>
                {stats.precioPorcentaje >= 0 ? "+" : ""}{stats.precioPorcentaje.toFixed(2)}% respecto a tu precio medio
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Precio Actual</p>
              <p className="text-xl font-medium text-foreground tabular-nums mt-1">{formatCurrency(stats.precioActual, position.moneda)}</p>
            </div>
          </div>
        </div>

        {/* ═══════════ TU DINERO vs INTERESES (DONUT GRANDE) + EVOLUCIÓN ═══════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          {/* Donut: Tu dinero vs Intereses */}
          <AssetCapitalDonut capitalDonut={capitalDonut} position={position} stats={stats} />

          {/* Evolución Histórica */}
          <AssetEvolutionChart evolutionData={evolutionData} />
        </div>

        {/* ═══════════ APORTACIONES MENSUALES + OPERACIONES ═══════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10 animate-fade-in stagger-2">
          {/* Barras de aportaciones */}
          <div className="lg:col-span-2">
            <AssetContributionsChart monthlyContributionsData={monthlyContributionsData} />
          </div>
          <div className="lg:col-span-1">
            <div className="mb-4 flex items-center gap-2 select-none pointer-events-none opacity-0">
              <span className="text-xl font-bold text-transparent">Alertas</span>
            </div>
            <AssetAlerts 
              ticker={position.ticker} 
              moneda={position.moneda} 
              onOpenAlertsModal={() => setAlertsOpen(true)} 
            />
          </div>
        </div>

        {/* ═══════════ SIMULADOR DE INTERÉS COMPUESTO ═══════════ */}
        {(position.tipo === "Fondo Indexado" || position.tipo === "Fondo Monetario") && (
          <div className="border border-border mb-10 p-6">
            <div className="mb-6">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-foreground">
                Simulador de Interés Compuesto
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Proyecta el futuro. Cambia los parámetros y observa la curva exponencial.
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Controles */}
              <div className="lg:col-span-1 space-y-6 bg-muted/10 p-5 border border-border">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-semibold text-muted-foreground">Aportación Mensual (€)</Label>
                  <Input type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(Number(e.target.value))} className="bg-background border-border text-foreground rounded-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-semibold text-muted-foreground">Años Vista</Label>
                  <Input type="number" value={years} onChange={e => setYears(Number(e.target.value))} className="bg-background border-border text-foreground rounded-none" min={1} max={50} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-semibold text-muted-foreground">Rentabilidad Anual (%)</Label>
                  <Input type="number" value={expectedReturn} onChange={e => setExpectedReturn(Number(e.target.value))} className="bg-background border-border text-foreground rounded-none" step={0.1} />
                </div>
                <div className="pt-4 border-t border-border space-y-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest">De tu bolsillo</p>
                    <p className="text-lg font-medium text-foreground tabular-nums">{formatCurrency(finalData?.invested ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest">Intereses Generados</p>
                    <p className="text-lg font-medium text-foreground tabular-nums">+{formatCurrency(finalData?.interest ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest">Capital Final</p>
                    <p className="text-xl font-semibold text-foreground tabular-nums">
                      {formatCurrency(finalData?.capital ?? 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Gráfico */}
              <div className="lg:col-span-3 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={simulationData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="year" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickFormatter={(v) => `Año ${v}`} />
                    <YAxis stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const cap = payload[0]?.value as number
                      const inv = payload[1]?.value as number
                      return (
                        <div className="bg-background border border-border p-3 shadow-md">
                          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest border-b border-border pb-2 mb-2">Año {label}</p>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-6">
                              <span className="text-xs text-foreground font-medium">Capital Total</span>
                              <span className="text-xs text-foreground font-semibold tabular-nums">{formatCurrency(cap)}</span>
                            </div>
                            <div className="flex justify-between gap-6">
                              <span className="text-xs text-muted-foreground font-medium">Tu Dinero</span>
                              <span className="text-xs text-muted-foreground font-semibold tabular-nums">{formatCurrency(inv)}</span>
                            </div>
                            <div className="pt-2 mt-1 border-t border-border flex justify-between gap-6">
                              <span className="text-xs text-foreground font-medium">Intereses</span>
                              <span className="text-xs text-foreground font-semibold tabular-nums">+{formatCurrency(cap - inv)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    }} />
                    <Area type="monotone" dataKey="capital" stroke="#a1a1aa" strokeWidth={1} fillOpacity={0.1} fill="#a1a1aa" animationDuration={500} />
                    <Area type="monotone" dataKey="invested" stroke="#52525b" strokeWidth={1} fillOpacity={0.1} fill="#52525b" animationDuration={500} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}


        {/* ═══════════ HISTORIAL DE TRANSACCIONES ═══════════ */}
        <div className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Historial de Transacciones
          </h2>
          <div className="border-t border-border overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-muted-foreground text-[11px] uppercase tracking-widest font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-4 font-semibold">Fecha</th>
                  <th className="px-4 py-4 font-semibold">Tipo</th>
                  <th className="px-4 py-4 text-right font-semibold">Unidades</th>
                  <th className="px-4 py-4 text-right font-semibold">Precio</th>
                  <th className="px-4 py-4 text-right font-semibold">Total</th>
                  <th className="px-4 py-4 text-right font-semibold">Comisión</th>
                  <th className="px-4 py-4 text-right font-semibold">P&L</th>
                  <th className="px-4 py-4 text-right font-semibold">Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {txTableData.map((tx) => (
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
                    <td className="px-4 py-4 text-right tabular-nums text-muted-foreground">
                      {tx.comision > 0 ? formatCurrency(tx.comision, position.moneda) : "—"}
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums">
                      {tx.pnlTotal !== null ? (
                        <span style={{ color: tx.pnlTotal >= 0 ? "var(--positive)" : "var(--negative)" }}>
                          {tx.pnlTotal >= 0 ? "+" : ""}{formatCurrency(tx.pnlTotal)}
                          <span className="text-[10px] ml-1 opacity-60">
                            ({tx.pnlPct !== null ? (tx.pnlPct >= 0 ? "+" : "") + tx.pnlPct.toFixed(1) + "%" : ""})
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums text-muted-foreground">{formatCurrency(tx.accumulated, position.moneda)}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-muted-foreground/80">
                      No hay transacciones para este activo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══════════ NOTICIAS RELEVANTES ═══════════ */}
        <div className="mt-10 animate-fade-in stagger-5">
          <AssetNews ticker={position.ticker} />
        </div>
      </main>

      <TraspasoModal 
        origen={position} 
        open={traspasoOpen} 
        onOpenChange={setTraspasoOpen} 
      />
      
      <PriceAlerts 
        open={alertsOpen} 
        onOpenChange={setAlertsOpen} 
        initialTicker={position.ticker} 
      />
    </div>
  )
}
