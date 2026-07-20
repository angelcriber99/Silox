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
import { PurchaseLotsCard } from "./detail/purchase-lots-card"

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

  const [rangePerformance, setRangePerformance] = useState<{ label: string, absolute: number, percent: number } | null>(null)

  const currentPerformance = rangePerformance || {
    label: "hoy",
    absolute: position.change_amount_24h ?? 0,
    percent: position.change_percent_24h ?? 0
  }

  const isPositive = currentPerformance.absolute >= 0
  const colorHex = isPositive ? "#10b981" : "#f43f5e"

  return (
    <div className="min-h-screen bg-background selection:bg-purple-500/30">
      {/* ═══════════ HEADER ═══════════ */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
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
              className="hidden md:flex border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-colors"
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Traspaso
            </Button>
            <div className="flex items-center gap-2.5 opacity-50">
              <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <Activity className="h-3 w-3 text-foreground" />
              </div>
              <span className="text-sm font-bold tracking-tight text-foreground">Silox</span>
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
                <Badge variant="outline" className={TIPO_BADGE_STYLES[position.tipo] || "bg-muted text-foreground/80"}>
                  {position.tipo}
                </Badge>
                {position.estrategia && (
                  <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border">
                    {position.estrategia}
                  </Badge>
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
              <p className={`text-base font-medium tabular-nums flex items-center gap-1 ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                {isPositive ? "+" : ""}{currentPerformance.percent.toFixed(2)}% {currentPerformance.label}
              </p>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-in stagger-1">
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Total Invertido</span>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{formatCurrency(position.coste_total, 'EUR')}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-medium uppercase tracking-wider">Ganado por Mercado</span>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${stats.gananciaIntereses >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {stats.gananciaIntereses >= 0 ? "+" : ""}{formatCurrency(stats.gananciaIntereses, position.moneda)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              <Layers className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Participaciones</span>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{formatUnits(position.unidades)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Operaciones</span>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{position.num_operaciones}</p>
          </div>
        </div>

        {/* ═══════════ ADVANCED STATS ROW ═══════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 animate-fade-in stagger-1">
          <div className="bg-gradient-to-br from-purple-950/40 to-zinc-900/60 border border-purple-800/30 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2 text-purple-300">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">CAGR</span>
            </div>
            <p className="text-2xl font-bold text-purple-300 tabular-nums">
              {stats.cagr > 0 ? "+" : ""}{stats.cagr.toFixed(2)}%
            </p>
            <p className="text-[10px] text-muted-foreground/80 mt-1">Rentabilidad anualizada</p>
          </div>
          <div className="bg-gradient-to-br from-blue-950/40 to-zinc-900/60 border border-blue-800/30 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2 text-blue-300">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Tiempo</span>
            </div>
            <p className="text-2xl font-bold text-blue-300 tabular-nums">{stats.monthsInvested} meses</p>
            <p className="text-[10px] text-muted-foreground/80 mt-1">Desde {stats.firstTxDate?.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }) || '—'}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-950/40 to-zinc-900/60 border border-amber-800/30 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2 text-amber-300">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Media / Mes</span>
            </div>
            <p className="text-2xl font-bold text-amber-300 tabular-nums">{formatCurrency(stats.avgMonthly, 'EUR')}</p>
            <p className="text-[10px] text-muted-foreground/80 mt-1">Aportación media mensual</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-950/40 to-zinc-900/60 border border-emerald-800/30 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2 text-emerald-300">
              <Award className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Mayor Compra</span>
            </div>
            <p className="text-2xl font-bold text-emerald-300 tabular-nums">{formatCurrency(stats.maxCompra, 'EUR')}</p>
            <p className="text-[10px] text-muted-foreground/80 mt-1">Tu mayor aportación</p>
          </div>
        </div>

        {/* ═══════════ GRÁFICO INTERACTIVO Y ESTADÍSTICAS ═══════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10 animate-fade-in stagger-1">
          <div className="lg:col-span-2">
             <InteractiveAssetChart 
               ticker={position.ticker} 
               moneda={position.original_currency || position.moneda} 
               colorHex={colorHex}
               transactions={transactions}
               units={position.unidades}
               historicalPnl={{ absolute: position.pnl ?? 0, percent: position.pnl_percent ?? 0 }}
               onRangePerformanceChange={setRangePerformance}
             />
          </div>
          <div className="lg:col-span-1">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-400" />
              Datos del Mercado
            </h2>
            <MarketStats ticker={position.ticker} moneda={position.moneda} />
          </div>
        </div>

        {/* ═══════════ PRECIO MEDIO vs PRECIO ACTUAL ═══════════ */}
        <Card className="bg-card border-border backdrop-blur-sm mb-10 animate-fade-in stagger-1">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Precio Medio de Compra</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">{formatCurrency(stats.precioMedio, position.moneda)}</p>
                </div>
              </div>
              <div className="flex-1 max-w-md mx-4">
                <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ${stats.precioPorcentaje >= 0 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-rose-500 to-rose-400'}`}
                    style={{ width: `${Math.min(100, Math.abs(stats.precioPorcentaje) + 50)}%` }}
                  />
                </div>
                <p className={`text-center mt-2 text-sm font-medium tabular-nums ${stats.precioPorcentaje >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {stats.precioPorcentaje >= 0 ? "+" : ""}{stats.precioPorcentaje.toFixed(2)}% respecto a tu precio medio
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">Precio Actual</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-foreground tabular-nums">{formatCurrency(stats.precioActual, position.moneda)}</p>
                  {position.price_is_stale && (
                    <div title="Precio desactualizado, se actualizará en la próxima sesión" className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <PurchaseLotsCard position={position} transactions={transactions} />

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
          <Card className="bg-card border-border backdrop-blur-sm mb-10 animate-fade-in stagger-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <Calculator className="h-5 w-5 text-purple-400" />
                🔮 La Magia del Interés Compuesto
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Proyecta el futuro. Cambia los parámetros y observa cómo la curva se despega exponencialmente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Controles */}
                <div className="lg:col-span-1 space-y-6 bg-background/50 p-5 rounded-xl border border-border/50">
                  <div className="space-y-2">
                    <Label className="text-foreground/80 text-sm">Aportación Mensual (€)</Label>
                    <Input type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(Number(e.target.value))} className="bg-card border-border text-foreground" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground/80 text-sm">Años Vista</Label>
                    <Input type="number" value={years} onChange={e => setYears(Number(e.target.value))} className="bg-card border-border text-foreground" min={1} max={50} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground/80 text-sm">Rentabilidad Anual (%)</Label>
                    <Input type="number" value={expectedReturn} onChange={e => setExpectedReturn(Number(e.target.value))} className="bg-card border-border text-foreground" step={0.1} />
                  </div>
                  <div className="pt-4 border-t border-border/50 space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground/80 uppercase font-medium">De tu bolsillo</p>
                      <p className="text-lg font-bold text-blue-400 tabular-nums">{formatCurrency(finalData?.invested ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground/80 uppercase font-medium">Intereses Generados</p>
                      <p className="text-lg font-bold text-emerald-400 tabular-nums">+{formatCurrency(finalData?.interest ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground/80 uppercase font-medium">Capital Final</p>
                      <p className="text-2xl font-bold text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.4)] tabular-nums">
                        {formatCurrency(finalData?.capital ?? 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Gráfico */}
                <div className="lg:col-span-3 h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={simulationData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cCapital" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="cInvested" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="year" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 12 }} tickFormatter={(v) => `Año ${v}`} />
                      <YAxis stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 12 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <Tooltip content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const cap = payload[0]?.value as number
                        const inv = payload[1]?.value as number
                        return (
                          <div className="bg-card border border-border p-4 rounded-xl shadow-2xl">
                            <p className="text-foreground/80 text-sm mb-3 font-medium border-b border-border pb-2">Año {label}</p>
                            <div className="space-y-2">
                              <div className="flex justify-between gap-6">
                                <span className="text-purple-400 text-sm">Capital Total</span>
                                <span className="text-purple-400 text-sm font-bold tabular-nums">{formatCurrency(cap)}</span>
                              </div>
                              <div className="flex justify-between gap-6">
                                <span className="text-blue-400 text-sm">Tu Dinero</span>
                                <span className="text-blue-400 text-sm font-bold tabular-nums">{formatCurrency(inv)}</span>
                              </div>
                              <div className="pt-2 mt-2 border-t border-border flex justify-between gap-6">
                                <span className="text-emerald-400 text-xs">Intereses</span>
                                <span className="text-emerald-400 text-xs font-bold tabular-nums">+{formatCurrency(cap - inv)}</span>
                              </div>
                            </div>
                          </div>
                        )
                      }} />
                      <Area type="monotone" dataKey="capital" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#cCapital)" animationDuration={1500} />
                      <Area type="monotone" dataKey="invested" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#cInvested)" animationDuration={1500} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        )}


        {/* ═══════════ HISTORIAL DE TRANSACCIONES ═══════════ */}
        <div className="animate-fade-in stagger-4">
          <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            Historial de Transacciones
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden backdrop-blur-sm overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-background/50 text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-5 py-4">Fecha</th>
                  <th className="px-5 py-4">Tipo</th>
                  <th className="px-5 py-4 text-right">Unidades</th>
                  <th className="px-5 py-4 text-right">Precio</th>
                  <th className="px-5 py-4 text-right">Total</th>
                  <th className="px-5 py-4 text-right">Comisión</th>
                  <th className="px-5 py-4 text-right">Rendimiento</th>
                  <th className="px-5 py-4 text-right">Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {txTableData.map((tx) => (
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
                    <td className="px-5 py-4 text-right tabular-nums font-medium text-foreground">{formatCurrency(tx.total, position.moneda)}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-muted-foreground/80">
                      {tx.comision > 0 ? formatCurrency(tx.comision, position.moneda) : "—"}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {(tx.tipo_operacion === 'Compra' || tx.tipo_operacion === 'Traspaso Entrada') && tx.pnlTotal !== null && tx.pnlPct !== null ? (
                        <div className="flex flex-col items-end">
                          <span className={`tabular-nums font-medium ${tx.pnlTotal >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {tx.pnlTotal >= 0 ? "+" : ""}{formatCurrency(tx.pnlTotal)}
                          </span>
                          <span className={`text-[10px] tabular-nums ${tx.pnlPct >= 0 ? "text-emerald-500/70" : "text-rose-500/70"}`}>
                            {tx.pnlPct >= 0 ? "+" : ""}{tx.pnlPct.toFixed(2)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-muted-foreground">{formatCurrency(tx.accumulated, position.moneda)}</td>
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
