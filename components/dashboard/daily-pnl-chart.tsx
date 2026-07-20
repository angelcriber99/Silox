"use client"

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, ReferenceLine, CartesianGrid } from "recharts"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { usePreferences } from "@/lib/stores/use-preferences"
import type { ChartDataPoint } from "./performance-modal"
import {
  aggregateDailyPnl,
  aggregateMonthlyPnl,
  filterPerformanceSeries,
  type PerformanceRange,
} from "@/lib/utils/performance-history"
import { getMarketDateKey } from "@/lib/utils/market-performance"

interface DailyTooltipProps {
  active?: boolean
  payload?: Array<{ payload: ChartDataPoint }>
  label?: string
  isMonthly?: boolean
}

function DailyTooltip({ active, payload, label, isMonthly }: DailyTooltipProps) {
  const { hideBalances } = usePreferences()

  if (active && payload?.length && label) {
    const data = payload[0].payload
    const isPositive = data.pnl >= 0
    const formattedDate = format(parseISO(label), "d MMM yyyy", { locale: es })

    return (
      <div className="bg-card/95 border border-border p-4 rounded-xl shadow-xl backdrop-blur-md min-w-[170px]">
        <p className="text-muted-foreground text-xs mb-3 font-medium uppercase tracking-wider border-b border-border/50 pb-2">{formattedDate}</p>
        <div>
          <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
            {isMonthly ? 'P&L mensual completo' : 'P&L diario completo'}
          </p>
          <p className={`font-bold text-xl tabular-nums leading-none ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {hideBalances ? "****" : `${isPositive ? '+' : ''}${formatCurrency(data.pnl)}`}
          </p>
          <p className={`mt-1 text-xs font-semibold tabular-nums ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {hideBalances ? "***" : formatPercent(data.pnlPercent)}
          </p>
        </div>
      </div>
    )
  }

  return null
}

interface DailyPnlChartProps {
  chartData: ChartDataPoint[]
  range: PerformanceRange
  currentDailyPnl?: number
  currentDailyPnlPercent?: number
  currentMarketDate?: string
}

export function DailyPnlChart({
  chartData,
  range,
  currentDailyPnl,
  currentDailyPnlPercent,
  currentMarketDate,
}: DailyPnlChartProps) {
  const isMonthly = range === '1Y' || range === 'ALL'
  
  const aggregatedData = isMonthly 
    ? aggregateMonthlyPnl(chartData) 
    : aggregateDailyPnl(chartData)

  const plotData = filterPerformanceSeries(aggregatedData, range).map((point) => (
    getMarketDateKey(point.timestamp) === currentMarketDate && currentDailyPnl !== undefined && !isMonthly
      ? {
          ...point,
          pnl: currentDailyPnl,
          pnlPercent: currentDailyPnlPercent ?? point.pnlPercent,
        }
      : point
  ))

  if (plotData.length === 0) {
    return null
  }

  return (
    <div
      className="h-[360px] w-full"
      role="img"
      aria-label="Beneficio o pérdida diario de la cartera, incluyendo premercado, mercado regular y postmercado"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={plotData} margin={{ top: 10, right: 6, left: 6, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
          <XAxis 
            dataKey="timestamp" 
            axisLine={false} 
            tickLine={false} 
            tickFormatter={(date) => format(parseISO(date), isMonthly ? "MMM yy" : "d MMM")}
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            tickMargin={10}
            minTickGap={isMonthly ? 15 : 30}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `${value >= 0 ? "+" : ""}${Math.abs(value) >= 1_000 ? `${(value / 1_000).toFixed(1)}k` : value.toFixed(0)} €`}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }}
            width={64}
          />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.45} />
          <Tooltip 
            content={<DailyTooltip isMonthly={isMonthly} />} 
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }} 
          />
          <Bar dataKey="pnl" radius={[4, 4, 4, 4]} isAnimationActive={false}>
            {plotData.map((entry, index) => (
              <Cell
                key={entry.timestamp || `cell-${index}`}
                fill={entry.pnl > 0 ? '#30d158' : entry.pnl < 0 ? '#ff453a' : 'var(--muted-foreground)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
