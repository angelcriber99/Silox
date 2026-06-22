"use client"
import { useMemo } from "react"
import Link from "next/link"
import {
  ArrowLeft, TrendingUp, TrendingDown, Wallet, Layers, Activity,
  LineChart as LineChartIcon, DollarSign, BarChart3, Coins
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"
import { formatCurrency, formatPercent, formatUnits } from "@/lib/utils/formatters"
import type { EnrichedPosition } from '@/lib/types'
import { useAssetCalculations, RawTransaction } from './detail/use-asset-calculations'

interface CryptoDetailClientProps {
  position: EnrichedPosition
  transactions: RawTransaction[]
}

const TIPO_BADGE_STYLES: Record<string, string> = {
  Crypto: "bg-orange-500/10 text-orange-400 border-orange-500/20",
}

export function CryptoDetailClient({ position, transactions }: CryptoDetailClientProps) {
  const {
    sparklineData,
    evolutionData,
    stats,
    txTableData
  } = useAssetCalculations(position, transactions)

  // Datos simulados de mercado crypto
  const mockMarketData = {
    marketCap: "1.2T",
    volume24h: "32.4B",
    circulatingSupply: "19.6M",
    allTimeHigh: position.precio_actual ? position.precio_actual * 2.5 : 69000,
    allTimeLow: position.precio_actual ? position.precio_actual * 0.1 : 3000,
    dominance: "52.4%",
  }

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
            <p className="text-5xl md:text-6xl font-bold text-foreground font-tabular drop-shadow-md">
              {position.precio_actual !== null ? formatCurrency(position.precio_actual, position.moneda) : "—"}
            </p>
            <div className="flex items-center md:justify-end gap-2 mt-2">
              {position.change_percent_24h !== null && position.change_amount_24h !== null && (
                <p className={`text-lg font-bold font-tabular flex items-center ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                  {isPositive ? "+" : ""}{formatCurrency(position.change_amount_24h, position.moneda)} 
                  <span className="ml-1 opacity-80">({isPositive ? "+" : ""}{position.change_percent_24h.toFixed(2)}%)</span>
                  <span className="text-muted-foreground text-sm ml-2 font-medium">24h</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════ GRÁFICO DEL ACTIVO (SPARKLINE AMPLIADO) ═══════════ */}
        {sparklineData && (
          <div className="w-full h-[300px] md:h-[400px] mb-8 animate-fade-in stagger-1 relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData.data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colorHex} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={colorHex} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="bg-card/90 backdrop-blur-sm border border-border p-3 rounded-lg shadow-xl">
                        <p className="text-foreground font-bold font-tabular text-lg">
                          {formatCurrency(payload[0].value as number, position.moneda)}
                        </p>
                      </div>
                    )
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="price" 
                  stroke={colorHex} 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorPrice)" 
                  animationDuration={1500} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ═══════════ TU POSICIÓN ═══════════ */}
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2 animate-fade-in stagger-1">
          <Wallet className="h-5 w-5 text-orange-400" />
          Tu Billetera
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 animate-fade-in stagger-2">
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tokens</span>
            <p className="text-2xl font-bold text-foreground font-tabular mt-1">{position.unidades.toFixed(6)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Balance</span>
            <p className="text-2xl font-bold text-foreground font-tabular mt-1">{formatCurrency(position.valor_actual || 0, 'EUR')}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Precio Medio</span>
            <p className="text-2xl font-bold text-foreground font-tabular mt-1">{formatCurrency(stats.precioMedio, position.moneda)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Rentabilidad Total</span>
            <p className={`text-2xl font-bold font-tabular mt-1 ${stats.gananciaIntereses >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {stats.gananciaIntereses >= 0 ? "+" : ""}{formatCurrency(stats.gananciaIntereses, 'EUR')}
            </p>
            <p className={`text-sm font-bold font-tabular ${stats.precioPorcentaje >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {stats.precioPorcentaje >= 0 ? "+" : ""}{stats.precioPorcentaje.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* ═══════════ ESTADÍSTICAS CLAVE (SIMULADAS) ═══════════ */}
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2 animate-fade-in stagger-2">
          <Coins className="h-5 w-5 text-orange-400" />
          Datos de la Red <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">Simulados</span>
        </h2>
        <Card className="bg-card border-border backdrop-blur-sm mb-10 animate-fade-in stagger-3">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Market Cap</p>
                <p className="text-lg font-bold text-foreground font-tabular">{mockMarketData.marketCap}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Volumen (24h)</p>
                <p className="text-lg font-bold text-foreground font-tabular">{mockMarketData.volume24h}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Acc. Circulante</p>
                <p className="text-lg font-bold text-foreground font-tabular">{mockMarketData.circulatingSupply}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Máximo Histórico</p>
                <p className="text-lg font-bold text-foreground font-tabular">{formatCurrency(mockMarketData.allTimeHigh, position.moneda)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Mínimo Histórico</p>
                <p className="text-lg font-bold text-foreground font-tabular">{formatCurrency(mockMarketData.allTimeLow, position.moneda)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Dominancia</p>
                <p className="text-lg font-bold text-foreground font-tabular">{mockMarketData.dominance}</p>
              </div>
            </div>
          </CardContent>
        </Card>

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
                    </td>
                    <td className="px-5 py-4 text-right font-tabular text-foreground/80">{Number(tx.cantidad).toFixed(6)}</td>
                    <td className="px-5 py-4 text-right font-tabular text-foreground/80">{formatCurrency(Number(tx.precio_unitario), position.moneda)}</td>
                    <td className="px-5 py-4 text-right font-tabular font-bold text-foreground">{formatCurrency(tx.total, position.moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
