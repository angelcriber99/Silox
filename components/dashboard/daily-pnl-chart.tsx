"use client"

import { useMemo, useState } from "react"
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
import { useDisplayCurrency } from "@/lib/hooks/use-display-currency"

interface DailyTooltipProps {
  active?: boolean
  payload?: Array<{ payload: ChartDataPoint }>
  label?: string
  isMonthly?: boolean
}

function DailyTooltip({ active, payload, label, isMonthly }: DailyTooltipProps) {
  const { hideBalances } = usePreferences()
  const { displayCurrency } = useDisplayCurrency()

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
            {hideBalances ? "****" : `${isPositive ? '+' : ''}${formatCurrency(data.pnl, displayCurrency)}`}
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
  const { displayCurrency, convert } = useDisplayCurrency()
  const isMonthly = range === '1Y' || range === 'ALL'
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null)
  
  const aggregatedData = isMonthly 
    ? aggregateMonthlyPnl(chartData) 
    : aggregateDailyPnl(chartData)

  const effectiveMarketDate = currentMarketDate ?? getMarketDateKey(new Date())
  const plotData = filterPerformanceSeries(aggregatedData, range).filter((point) => !point.isBoundary).map((point) => {
    const converted = {
      ...point,
      pnl: convert(point.pnl),
      value: convert(point.value),
      totalPnl: convert(point.totalPnl),
      totalInvested: convert(point.totalInvested),
      netFlow: convert(point.netFlow),
      previousValue: convert(point.previousValue),
    }
    return getMarketDateKey(point.timestamp) === effectiveMarketDate && currentDailyPnl !== undefined && !isMonthly
      ? { ...converted, pnl: convert(currentDailyPnl), pnlPercent: currentDailyPnlPercent ?? point.pnlPercent }
      : converted
  })
  const selectedDay = useMemo(
    () => plotData.find((point) => point.timestamp === selectedTimestamp) ?? plotData.at(-1)!,
    [plotData, selectedTimestamp],
  )

  if (plotData.length === 0) {
    return null
  }

  return (
    <div
      className="w-full"
      role="img"
      aria-label="Beneficio o pérdida diario de la cartera, incluyendo premercado, mercado regular y postmercado"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border/50 bg-background/45 px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {isMonthly ? "Mes seleccionado" : "Día seleccionado"}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {format(parseISO(selectedDay.timestamp), isMonthly ? "MMMM yyyy" : "EEEE, d 'de' MMMM", { locale: es })}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold tabular-nums ${selectedDay.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {selectedDay.pnl >= 0 ? "+" : ""}{formatCurrency(selectedDay.pnl, displayCurrency)}
          </p>
          <p className="text-xs font-semibold tabular-nums text-muted-foreground">{formatPercent(selectedDay.pnlPercent)}</p>
        </div>
      </div>
      <div className="h-[330px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={plotData} margin={{ top: 10, right: 6, left: 6, bottom: 48 }} barCategoryGap="18%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
          <XAxis 
            dataKey="timestamp" 
            axisLine={false} 
            tickLine={false} 
            tickFormatter={(date) => format(parseISO(date), isMonthly ? "MMM yy" : "d MMM")}
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            tickMargin={10}
            interval={plotData.length <= 32 ? 0 : "preserveStartEnd"}
            angle={plotData.length > 12 ? -38 : 0}
            textAnchor={plotData.length > 12 ? "end" : "middle"}
            height={58}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `${value >= 0 ? "+" : ""}${Math.abs(value) >= 1_000 ? `${(value / 1_000).toFixed(1)}k` : value.toFixed(0)} ${displayCurrency === 'EUR' ? '€' : '$'}`}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }}
            width={64}
          />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.45} />
          <Tooltip 
            content={<DailyTooltip isMonthly={isMonthly} />} 
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }} 
          />
          <Bar dataKey="pnl" radius={[4, 4, 4, 4]} isAnimationActive={false} maxBarSize={34}>
            {plotData.map((entry, index) => (
              <Cell
                key={entry.timestamp || `cell-${index}`}
                fill={entry.pnl > 0 ? '#30d158' : entry.pnl < 0 ? '#ff453a' : 'var(--muted-foreground)'}
                fillOpacity={entry.timestamp === selectedDay.timestamp ? 1 : 0.72}
                stroke={entry.timestamp === selectedDay.timestamp ? "var(--foreground)" : "transparent"}
                strokeWidth={entry.timestamp === selectedDay.timestamp ? 1.5 : 0}
                className="cursor-pointer"
                onClick={() => setSelectedTimestamp(entry.timestamp)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Cada barra es una jornada con datos reales. Pulsa cualquier día para ver su resultado completo.
      </p>
    </div>
  )
}
