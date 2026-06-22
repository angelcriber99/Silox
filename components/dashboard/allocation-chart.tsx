"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import type { EnrichedPosition } from '@/lib/types'
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { computePortfolioTotals } from "@/lib/api/assets"

interface AllocationChartProps {
  positions: EnrichedPosition[]
}

const TYPE_COLORS: Record<string, string> = {
  ETF: "#3b82f6",
  "Fondo Indexado": "#8b5cf6",
  "Fondo Monetario": "#06b6d4",
  Acción: "#f59e0b",
  Crypto: "#f97316",
}

const STRATEGY_COLORS: Record<string, string> = {
  Core: "#3b82f6",
  Satellite: "#8b5cf6",
}

type GroupBy = "tipo" | "estrategia"

interface ChartDatum {
  name: string
  value: number
  color: string
  percent: number
}

export function AllocationChart({ positions }: AllocationChartProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>("tipo")
  const totals = useMemo(() => computePortfolioTotals(positions), [positions])

  const chartData = useMemo(() => {
    const groups = new Map<string, number>()
    const colors = groupBy === "tipo" ? TYPE_COLORS : STRATEGY_COLORS

    for (const p of positions) {
      const key = groupBy === "tipo" ? p.tipo : p.estrategia
      const value = p.valor_actual ?? p.coste_total
      if (value > 0) {
        groups.set(key, (groups.get(key) ?? 0) + value)
      }
    }

    const total = Array.from(groups.values()).reduce((a, b) => a + b, 0)
    const data: ChartDatum[] = Array.from(groups.entries())
      .map(([name, value]) => ({
        name,
        value,
        color: colors[name] ?? "#71717a",
        percent: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)

    return { data, total }
  }, [positions, groupBy])

  const hasData = chartData.data.length > 0

  return (
    <Card className="animate-fade-in stagger-2 bg-zinc-900/60 border-zinc-800/60 backdrop-blur-sm h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-zinc-400">
            Distribución
          </CardTitle>
          <div className="flex gap-1 rounded-lg bg-zinc-800/60 p-0.5">
            <button
              onClick={() => setGroupBy("tipo")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all duration-200 ${
                groupBy === "tipo"
                  ? "bg-zinc-700 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Tipo
            </button>
            <button
              onClick={() => setGroupBy("estrategia")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all duration-200 ${
                groupBy === "estrategia"
                  ? "bg-zinc-700 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Estrategia
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col justify-center">
        {!hasData ? (
          <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">
            Añade activos con transacciones para ver la distribución
          </div>
        ) : (
          <div className="flex flex-row flex-wrap items-center justify-center lg:gap-16 gap-8 py-4 w-full">
            <div className="h-[280px] w-[280px] flex-shrink-0 relative group">
              <PieChart width={280} height={280}>
                <Pie
                  data={chartData.data}
                  innerRadius={90}
                  outerRadius={120}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={8}
                >
                  {chartData.data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                      className="hover:opacity-80 transition-opacity duration-300 cursor-pointer outline-none"
                    />
                  ))}
                </Pie>
                <Tooltip
                  cursor={{fill: 'transparent'}}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as ChartDatum
                    return (
                      <div className="rounded-xl bg-zinc-900/95 backdrop-blur-md border border-zinc-700 p-4 shadow-2xl z-50 relative">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                          <p className="text-sm font-bold text-white uppercase tracking-wider">{d.name}</p>
                        </div>
                        <p className="text-2xl font-bold font-tabular text-white">
                          {formatCurrency(d.value)}
                        </p>
                        <p className="text-sm font-medium text-zinc-400 mt-1">
                          Representa el {formatPercent(d.percent).replace("+", "")} de tu cartera
                        </p>
                      </div>
                    )
                  }}
                />
              </PieChart>
              {/* Center label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-500 group-hover:scale-110">
                <div className="text-center">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-1">Total</p>
                  <p className="text-2xl font-bold font-tabular text-white drop-shadow-md">
                    {formatCurrency(totals.totalValue > 0 ? totals.totalValue : chartData.total)}
                  </p>
                  <p className={`text-xs font-medium mt-0.5 ${totals.totalPnlPercent24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {totals.totalPnlPercent24h > 0 ? '+' : ''}{formatPercent(totals.totalPnlPercent24h).replace('+', '')} hoy
                  </p>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-4 w-full sm:w-[320px] max-w-sm">
              {chartData.data.map((d) => (
                <div key={d.name} className="flex items-center gap-4 group">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: d.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
                      {d.name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold font-tabular text-white">
                      {formatCurrency(d.value)}
                    </p>
                    <p className="text-xs font-medium font-tabular text-zinc-500">
                      {d.percent.toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
