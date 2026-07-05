"use client"

import { useState, useMemo } from "react"
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Tooltip } from "recharts"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { motion } from "framer-motion"
import { hapticFeedback } from "@/lib/utils/haptics"

type TimeRange = "1S" | "1M" | "1A" | "ALL"

interface PerformanceChartProps {
  history: { timestamp: string; total_value: number; total_invested: number }[]
  sparkline: { i: number; v: number; pnl: number; date?: string }[]
  currentValue: number
  currentCost: number
}

export function PerformanceChart({ history, sparkline, currentValue, currentCost }: PerformanceChartProps) {
  const [range, setRange] = useState<TimeRange>("1M")

  const chartData = useMemo(() => {
    const now = new Date()
    let data: any[] = []

    if (range === "1S") {
      // Usar sparkline (velas diarias de 7 dias)
      data = sparkline.map(d => ({
        timestamp: d.date || new Date().toISOString(),
        v: d.v,
        cost: currentCost // Aproximación
      }))
    } else {
      // Filtrar historial
      let cutoff = new Date(0)
      if (range === "1M") cutoff = new Date(now.setMonth(now.getMonth() - 1))
      if (range === "1A") cutoff = new Date(now.setFullYear(now.getFullYear() - 1))

      data = history
        .filter(h => new Date(h.timestamp) >= cutoff)
        .map(h => ({
          timestamp: h.timestamp,
          v: h.total_value,
          cost: h.total_invested
        }))
      
      // Añadir el punto actual para que conecte con el presente exacto
      if (data.length > 0) {
        data.push({
          timestamp: new Date().toISOString(),
          v: currentValue,
          cost: currentCost
        })
      }
    }

    return data
  }, [history, sparkline, range, currentValue, currentCost])

  const firstPoint = chartData[0]?.v || currentValue
  const lastPoint = chartData[chartData.length - 1]?.v || currentValue
  const pnl = lastPoint - firstPoint
  const pnlPercent = firstPoint > 0 ? pnl / firstPoint : 0
  const isUp = pnl >= 0

  const areaColor = isUp ? "#10b981" : "#f43f5e"

  const ranges: TimeRange[] = ["1S", "1M", "1A", "ALL"]

  return (
    <div className="w-full flex flex-col">
      {/* Chart Header (Optional, could just rely on main KPI) */}
      <div className="flex flex-col items-center justify-center mb-4 mt-2">
        <span className={`text-[16px] font-bold font-tabular tracking-tight ${isUp ? "text-emerald-500" : "text-rose-500"}`}>
          {isUp ? "+" : ""}{formatCurrency(pnl)} ({formatPercent(pnlPercent)})
        </span>
        <span className="text-[12px] font-medium text-muted-foreground">
          {range === "1S" ? "Última semana" : range === "1M" ? "Último mes" : range === "1A" ? "Último año" : "Todo el historial"}
        </span>
      </div>

      {/* Chart */}
      <div className="h-48 w-full relative">
        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={areaColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={areaColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <XAxis dataKey="timestamp" hide />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  const diff = d.v - d.cost
                  const diffUp = diff >= 0
                  const dateObj = new Date(d.timestamp)
                  return (
                    <div className="bg-card/95 backdrop-blur-xl border border-border/40 rounded-xl px-3 py-2 shadow-2xl">
                      <p className="text-[14px] font-bold font-tabular text-foreground">{formatCurrency(d.v)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )
                }}
                cursor={{ stroke: areaColor, strokeWidth: 1, strokeDasharray: "4 4" }}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={areaColor}
                strokeWidth={2.5}
                fill="url(#colorPerf)"
                isAnimationActive={true}
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-muted-foreground text-sm">No hay suficientes datos</span>
          </div>
        )}
      </div>

      {/* Time Selectors */}
      <div className="flex justify-center mt-6">
        <div className="bg-muted/40 p-1 rounded-full flex items-center gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => {
                hapticFeedback.light()
                setRange(r)
              }}
              className={`relative px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors z-10 ${
                range === r ? "text-background dark:text-foreground" : "text-muted-foreground"
              }`}
            >
              {r}
              {range === r && (
                <motion.div
                  layoutId="activeTimeRange"
                  className="absolute inset-0 bg-foreground rounded-full -z-10 shadow-sm"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
