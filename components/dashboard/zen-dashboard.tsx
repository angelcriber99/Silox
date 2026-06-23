"use client"

import { useMemo, useState, useEffect } from "react"
import { PieChart, Pie, Cell } from "recharts"
import type { EnrichedPosition } from '@/lib/types'
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { computePortfolioTotals } from "@/lib/api/assets"
import { motion } from "framer-motion"
import { usePreferences } from "@/lib/stores/use-preferences"
import { Minimize } from "lucide-react"

const TYPE_COLORS: Record<string, string> = {
  ETF: "#3b82f6",
  "Fondo Indexado": "#8b5cf6",
  "Fondo Monetario": "#06b6d4",
  Acción: "#f59e0b",
  Crypto: "#f97316",
}

interface ZenDashboardProps {
  positions: EnrichedPosition[]
}

interface ChartDatum {
  name: string
  value: number
  color: string
  percent: number
}

export function ZenDashboard({ positions }: ZenDashboardProps) {
  const { setZenMode } = usePreferences()
  const totals = useMemo(() => computePortfolioTotals(positions), [positions])
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const chartData = useMemo(() => {
    const groups = new Map<string, { value: number }>()

    for (const p of positions) {
      const key = p.tipo
      const value = p.valor_actual ?? p.coste_total

      if (value > 0) {
        const existing = groups.get(key) ?? { value: 0 }
        groups.set(key, { value: existing.value + value })
      }
    }

    const total = Array.from(groups.values()).reduce((a, b) => a + b.value, 0)
    const data: ChartDatum[] = Array.from(groups.entries())
      .map(([name, groupData]) => ({
        name,
        value: groupData.value,
        color: TYPE_COLORS[name] ?? "#71717a",
        percent: total > 0 ? (groupData.value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)

    return { data, total }
  }, [positions])

  // Sort by absolute daily percentage change to show most volatile first
  const volatilePositions = [...positions].sort((a, b) => {
    const valA = Math.abs(a.change_percent_24h ?? 0)
    const valB = Math.abs(b.change_percent_24h ?? 0)
    return valB - valA
  })

  return (
    <div className="flex flex-col w-full h-full min-h-[90vh] justify-center items-center p-8 space-y-16 animate-in fade-in duration-1000">
      
      {/* EXIT ZEN MODE BUTTON */}
      <button 
        onClick={() => setZenMode(false)}
        className="fixed top-6 right-6 p-4 rounded-full bg-background/50 hover:bg-muted border border-border/50 backdrop-blur-md transition-all text-muted-foreground hover:text-foreground z-50 group"
        title="Salir del Modo Zen"
      >
        <Minimize className="w-6 h-6 group-hover:scale-90 transition-transform" />
      </button>

      {/* HEADER: HUGE NUMBERS */}
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <p className="text-muted-foreground tracking-widest uppercase font-semibold text-lg md:text-xl">
          Valor del Portfolio • {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        <motion.h1 
          className="text-6xl md:text-[8rem] font-bold font-tabular tracking-tighter text-foreground drop-shadow-2xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, type: "spring" }}
        >
          {formatCurrency(totals.totalValue)}
        </motion.h1>
        
        <div className="flex items-center gap-6 mt-4">
          <p className={`text-4xl md:text-6xl font-bold font-tabular tracking-tight ${totals.totalPnl24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totals.totalPnl24h >= 0 ? '+' : ''}{formatCurrency(totals.totalPnl24h)}
          </p>
          <div className={`px-4 py-2 rounded-full text-2xl md:text-3xl font-bold bg-background/50 border ${totals.totalPnl24h >= 0 ? 'border-emerald-400/30 text-emerald-400' : 'border-rose-400/30 text-rose-400'}`}>
            {totals.totalPnlPercent24h >= 0 ? '+' : ''}{formatPercent(totals.totalPnlPercent24h).replace('+', '')}
          </div>
        </div>
      </div>

      {/* BODY: CHART & LIST */}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        
        {/* LEFT: DONUT */}
        <div className="flex justify-center items-center relative">
          <PieChart width={400} height={400}>
            <Pie
              data={chartData.data}
              innerRadius={130}
              outerRadius={180}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
              cornerRadius={10}
            >
              {chartData.data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-lg font-medium text-muted-foreground uppercase tracking-widest mb-1">Activos</p>
              <p className="text-4xl font-bold text-foreground">
                {positions.length}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT: PROFESSIONAL TERMINAL FEED */}
        <div className="flex flex-col h-full bg-background/20 rounded-xl border border-border/40 p-1">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-card/20">
            <h2 className="text-sm font-medium tracking-widest text-muted-foreground uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Monitor de Volatilidad
            </h2>
          </div>
          
          <div className="flex flex-col overflow-y-auto max-h-[450px] hide-scrollbar">
            {volatilePositions.map((p, i) => {
              const val = p.valor_actual ?? p.coste_total
              const pnl = val > 0 ? val - (val / (1 + (p.change_percent_24h ?? 0) / 100)) : 0
              const percent = p.change_percent_24h ?? 0
              const isPositive = pnl >= 0
              
              return (
                <div key={p.id} className="flex items-center justify-between px-6 py-4 border-b border-border/20 hover:bg-card/40 transition-colors">
                  <div className="flex items-center gap-4 w-1/3">
                    <div className="w-1 h-full min-h-[24px] rounded-full" style={{ backgroundColor: TYPE_COLORS[p.tipo] ?? '#71717a' }} />
                    <div className="flex flex-col">
                      <h3 className="text-xl font-bold font-mono tracking-tight">{p.ticker || p.nombre}</h3>
                      <p className="text-xs text-muted-foreground uppercase tracking-widest">{p.tipo}</p>
                    </div>
                  </div>
                  
                  <div className="w-1/3 text-right">
                    <p className="text-lg font-mono font-medium">{formatCurrency(val)}</p>
                  </div>
                  
                  <div className="w-1/3 flex flex-col items-end">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded bg-background/50 border ${isPositive ? 'border-emerald-500/20 text-emerald-400' : 'border-rose-500/20 text-rose-400'}`}>
                      <span className="text-sm font-mono font-bold">
                        {isPositive ? '+' : ''}{formatPercent(percent).replace('+', '')}
                      </span>
                    </div>
                    <p className={`text-sm font-mono mt-1 ${isPositive ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                      {isPositive ? '+' : ''}{formatCurrency(pnl)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
