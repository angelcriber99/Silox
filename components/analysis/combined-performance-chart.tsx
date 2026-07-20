"use client"

import { useMemo, useId } from "react"
import { parseISO, format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { TooltipProps } from "recharts"
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent"

import { usePreferences } from "@/lib/stores/use-preferences"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import type { PerformancePoint, PerformanceRange } from "@/lib/utils/performance-history"

interface CombinedPerformanceChartProps {
  chartData: PerformancePoint[]
  dailyData: PerformancePoint[]
  timeRange: PerformanceRange
  currentDailyPnl?: number
  currentDailyPnlPercent?: number
}

interface CombinedChartPoint extends PerformancePoint {
  dailyPnl?: number | null
}

interface CombinedTooltipProps extends TooltipProps<ValueType, NameType> {
  hideBalances: boolean
}

function CombinedTooltip({ active, payload, label, hideBalances }: CombinedTooltipProps) {
  if (!active || !payload?.length || !label) return null

  const areaPayload = payload.find(p => p.dataKey === "value")?.payload as CombinedChartPoint | undefined
  const barPayload = payload.find(p => p.dataKey === "dailyPnl")?.payload as CombinedChartPoint | undefined
  
  const data = areaPayload || barPayload
  if (!data) return null

  const dailyPnlValue = barPayload?.dailyPnl as number | undefined
  const hasDailyPnl = typeof dailyPnlValue === 'number'
  const dailyPositive = hasDailyPnl && dailyPnlValue >= 0

  const totalPositive = (data.totalPnl ?? 0) >= 0

  return (
    <div className="rounded-xl border border-border/50 bg-background/95 p-3 shadow-xl backdrop-blur-md">
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        {format(parseISO(label as string), "d MMM yyyy, HH:mm", { locale: es })}
      </div>

      <div className="flex flex-col gap-2">
        {areaPayload && (
          <>
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-sm font-medium">Patrimonio</span>
              </div>
              <span className="text-sm font-bold">
                {hideBalances ? "****" : formatCurrency(areaPayload.value)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full border border-muted-foreground border-dashed" />
                <span className="text-sm text-muted-foreground">Aportado</span>
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {hideBalances ? "****" : formatCurrency(areaPayload.totalInvested)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-xs text-muted-foreground ml-4">Rendimiento</span>
              <span className={`text-xs font-bold ${totalPositive ? "text-emerald-500" : "text-rose-500"}`}>
                {hideBalances ? "****" : `${totalPositive ? "+" : ""}${formatCurrency(areaPayload.totalPnl)}`}
              </span>
            </div>
          </>
        )}

        {hasDailyPnl && (
          <>
            <div className="my-1 h-px w-full bg-border/50" />
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${dailyPositive ? "bg-emerald-500" : "bg-rose-500"}`} />
                <span className="text-sm font-medium">P&L Diario</span>
              </div>
              <div className="flex flex-col items-end">
                <span className={`text-sm font-bold ${dailyPositive ? "text-emerald-500" : "text-rose-500"}`}>
                  {hideBalances ? "****" : `${dailyPositive ? "+" : ""}${formatCurrency(dailyPnlValue)}`}
                </span>
                {barPayload?.pnlPercent !== undefined && (
                  <span className={`text-xs ${dailyPositive ? "text-emerald-500/80" : "text-rose-500/80"}`}>
                    {hideBalances ? "***" : formatPercent(barPayload.pnlPercent)}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function CombinedPerformanceChart({
  chartData,
  dailyData,
  timeRange,
}: CombinedPerformanceChartProps) {
  const { hideBalances } = usePreferences()
  const chartId = useId()

  const mergedData = useMemo(() => {
    const result = chartData.map(p => ({ ...p, dailyPnl: null as number | null }))
    
    for (const daily of dailyData) {
      const day = daily.timestamp.split('T')[0]
      const pointsOfDay = result.filter(r => r.timestamp.startsWith(day))
      if (pointsOfDay.length > 0) {
        pointsOfDay[pointsOfDay.length - 1].dailyPnl = daily.pnl
      }
    }
    return result
  }, [chartData, dailyData])

  if (mergedData.length === 0) return null

  const plottedValues = chartData.flatMap((point) => [point.value, point.totalInvested])
  const minValue = Math.min(...plottedValues)
  const maxValue = Math.max(...plottedValues)
  const valueRange = maxValue - minValue || Math.abs(maxValue) * 0.05 || 1_000
  const yMinRight = minValue - valueRange * 0.1
  const yMaxRight = maxValue + valueRange * 0.15

  const pnlValues = dailyData.map(p => p.pnl)
  const minPnl = Math.min(0, ...pnlValues)
  const maxPnl = Math.max(0, ...pnlValues)
  const pnlAbsMax = Math.max(Math.abs(minPnl), Math.abs(maxPnl)) || 100
  const yMaxLeft = maxPnl + (pnlAbsMax * 4)
  const yMinLeft = minPnl - (pnlAbsMax * 0.2)

  const firstDate = parseISO(mergedData[0].timestamp)
  const lastDate = parseISO(mergedData.at(-1)!.timestamp)
  const isOneDay = timeRange === '1D' || (lastDate.getTime() - firstDate.getTime() <= 24 * 60 * 60 * 1_000)

  return (
    <div className="h-[400px] w-full" role="img" aria-label="Evolución del patrimonio">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={mergedData} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id={`colorValue-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
              <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" opacity={0.4} />
          
          <XAxis
            dataKey="timestamp"
            axisLine={false}
            tickLine={false}
            tickFormatter={(date) => {
              try { return format(parseISO(date), isOneDay ? "HH:mm" : "d MMM", { locale: es }) } 
              catch { return "" }
            }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 500 }}
            tickMargin={12}
            minTickGap={40}
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `€${Math.abs(value) >= 1_000 ? `${(value / 1_000).toFixed(1)}k` : value.toFixed(0)}`}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 500 }}
            width={60}
            domain={[yMinRight, yMaxRight]}
          />

          <YAxis
            yAxisId="left"
            orientation="left"
            hide
            domain={[yMinLeft, yMaxLeft]}
          />

          <Tooltip
            content={(props) => <CombinedTooltip {...props} hideBalances={hideBalances} />}
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "4 4", strokeOpacity: 0.4 }}
          />

          <ReferenceLine y={0} yAxisId="left" stroke="var(--border)" strokeOpacity={0.8} strokeDasharray="3 3" />

          <Bar 
            yAxisId="left" 
            dataKey="dailyPnl" 
            radius={[4, 4, 4, 4]} 
            maxBarSize={40}
            isAnimationActive={false}
          >
            {mergedData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={(entry.dailyPnl ?? 0) >= 0 ? '#10b981' : '#f43f5e'}
                fillOpacity={0.6}
              />
            ))}
          </Bar>

          <Area
            yAxisId="right"
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            fillOpacity={1}
            fill={`url(#colorValue-${chartId})`}
            activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "var(--background)", strokeWidth: 3 }}
            connectNulls
            isAnimationActive={false}
          />

          <Line
            yAxisId="right"
            type="monotone"
            dataKey="totalInvested"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
