"use client"

import { useId, useMemo } from "react"
import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts"
import type { TooltipContentProps } from "recharts"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

import { usePreferences } from "@/lib/stores/use-preferences"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import type { PerformancePoint, PerformanceRange } from "@/lib/utils/performance-history"

interface CombinedPerformanceChartProps {
  chartData: PerformancePoint[] // The raw/intraday points for the curve
  dailyData: PerformancePoint[] // The aggregated daily points for the bars
  timeRange: PerformanceRange
  currentDailyPnl?: number
  currentDailyPnlPercent?: number
}

interface CombinedTooltipProps extends TooltipContentProps<any, any> {
  hideBalances: boolean
}

interface CombinedChartPoint extends PerformancePoint {
  dailyPnl?: number | null
}

function CombinedTooltip({ active, payload, label, hideBalances }: CombinedTooltipProps) {
  if (!active || !payload?.length || !label) return null

  // Find the area point and bar point if they exist
  const areaPayload = payload.find(p => p.dataKey === "value")?.payload as CombinedChartPoint | undefined
  const barPayload = payload.find(p => p.dataKey === "dailyPnl")?.payload as CombinedChartPoint | undefined
  
  // Use areaPayload as primary data source for totals, fallback to barPayload
  const data = areaPayload || barPayload
  if (!data) return null

  const formattedDate = format(parseISO(String(label)), "d MMM yyyy, HH:mm", { locale: es })
  const totalPositive = (data.totalPnl ?? 0) >= 0

  // The daily PnL might only be available on the bar payload
  const dailyPnlValue = barPayload?.dailyPnl as number | undefined
  const hasDailyPnl = typeof dailyPnlValue === 'number'
  const dailyPositive = hasDailyPnl && dailyPnlValue >= 0

  return (
    <div className="min-w-[230px] rounded-xl border border-border/60 bg-card/95 p-4 shadow-2xl backdrop-blur-md">
      <p className="mb-3 border-b border-border/50 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {formattedDate}
      </p>
      <dl className="space-y-2.5">
        {areaPayload && areaPayload.value !== null && (
          <>
            <div className="flex items-end justify-between gap-5">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Patrimonio</dt>
              <dd className="text-sm font-bold tabular-nums text-foreground">
                {hideBalances ? "****" : formatCurrency(areaPayload.value)}
              </dd>
            </div>
            <div className="flex items-end justify-between gap-5">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Capital neto</dt>
              <dd className="text-sm font-semibold tabular-nums text-foreground">
                {hideBalances ? "****" : formatCurrency(areaPayload.totalInvested)}
              </dd>
            </div>
            <div className="flex items-end justify-between gap-5">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">P&amp;L Total</dt>
              <dd className={`text-sm font-bold tabular-nums ${totalPositive ? "text-emerald-400" : "text-rose-400"}`}>
                {hideBalances ? "****" : `${totalPositive ? "+" : ""}${formatCurrency(areaPayload.totalPnl)}`}
              </dd>
            </div>
          </>
        )}
        
        {hasDailyPnl && (
          <div className="flex items-end justify-between gap-5 pt-2 mt-2 border-t border-border/40">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">P&amp;L Diario</dt>
            <div className="text-right">
              <dd className={`text-sm font-bold tabular-nums ${dailyPositive ? "text-emerald-400" : "text-rose-400"}`}>
                {hideBalances ? "****" : `${dailyPositive ? "+" : ""}${formatCurrency(dailyPnlValue)}`}
              </dd>
              {barPayload?.pnlPercent !== undefined && (
                <dd className={`text-[10px] font-semibold tabular-nums mt-0.5 ${dailyPositive ? "text-emerald-400" : "text-rose-400"}`}>
                  {hideBalances ? "***" : formatPercent(barPayload.pnlPercent)}
                </dd>
              )}
            </div>
          </div>
        )}
      </dl>
    </div>
  )
}

export function CombinedPerformanceChart({
  chartData,
  dailyData,
  timeRange,
  currentDailyPnl,
  currentDailyPnlPercent
}: CombinedPerformanceChartProps) {
  const { hideBalances } = usePreferences()
  const chartId = useId()

  const mergedData = useMemo(() => {
    // Merge intraday curve data and aggregated daily bar data
    const merged = [
      ...chartData.map(p => ({ ...p, dailyPnl: null })),
      ...dailyData.map(p => ({ 
        ...p, 
        value: null, 
        totalInvested: null, 
        totalPnl: null,
        dailyPnl: p.pnl 
      }))
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    return merged
  }, [chartData, dailyData])

  if (mergedData.length === 0) return null

  // Calculate domains for Portfolio Value (Left Axis)
  const plottedValues = chartData.flatMap((point) => [point.value, point.totalInvested])
  const minValue = Math.min(...plottedValues)
  const maxValue = Math.max(...plottedValues)
  const valueRange = maxValue - minValue || Math.abs(maxValue) * 0.05 || 1_000
  const yMinLeft = minValue - valueRange * 0.1
  const yMaxLeft = maxValue + valueRange * 0.15

  // Calculate domains for Daily P&L (Right Axis)
  const pnlValues = dailyData.map(p => p.pnl)
  const minPnl = Math.min(0, ...pnlValues)
  const maxPnl = Math.max(0, ...pnlValues)
  const pnlRange = maxPnl - minPnl || 100
  const yMinRight = minPnl - pnlRange * 0.2
  const yMaxRight = maxPnl + pnlRange * 0.2

  const periodPnl = chartData.reduce((sum, point) => sum + point.pnl, 0)
  const lineColor = periodPnl >= 0 ? "#10b981" : "#f43f5e"

  const firstDate = parseISO(mergedData[0].timestamp)
  const lastDate = parseISO(mergedData.at(-1)!.timestamp)
  const isOneDay = timeRange === '1D' || (lastDate.getTime() - firstDate.getTime() <= 24 * 60 * 60 * 1_000)

  return (
    <div
      className="h-[400px] w-full"
      role="img"
      aria-label="Evolución del patrimonio y P&L Diario"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={mergedData}
          margin={{ top: 15, right: 10, left: 10, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`colorValue-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
              <stop offset="60%" stopColor={lineColor} stopOpacity={0.05} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" opacity={0.4} />
          
          <XAxis
            dataKey="timestamp"
            axisLine={false}
            tickLine={false}
            tickFormatter={(date) => {
              try {
                if (!date) return ""
                return format(parseISO(date), isOneDay ? "HH:mm" : "d MMM", { locale: es })
              } catch {
                return ""
              }
            }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 500 }}
            tickMargin={12}
            minTickGap={40}
          />

          {/* Left Axis: Portfolio Value */}
          <YAxis
            yAxisId="left"
            orientation="left"
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `€${Math.abs(value) >= 1_000 ? `${(value / 1_000).toFixed(1)}k` : value.toFixed(0)}`}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 500 }}
            width={60}
            domain={[yMinLeft, yMaxLeft]}
          />

          {/* Right Axis: Daily P&L */}
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `${value >= 0 ? "+" : ""}${Math.abs(value) >= 1_000 ? `${(value / 1_000).toFixed(1)}k` : value.toFixed(0)}`}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 500 }}
            width={55}
            domain={[yMinRight, yMaxRight]}
          />

          <Tooltip
            content={(props) => (
              <CombinedTooltip
                {...props}
                hideBalances={hideBalances}
              />
            )}
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "4 4", strokeOpacity: 0.4 }}
          />

          {/* Zero line for P&L on the right axis */}
          <ReferenceLine y={0} yAxisId="right" stroke="var(--border)" strokeOpacity={0.8} strokeDasharray="3 3" />

          {/* Bar Chart for Daily P&L */}
          <Bar 
            yAxisId="right" 
            dataKey="dailyPnl" 
            radius={[4, 4, 4, 4]} 
            maxBarSize={40}
            isAnimationActive={false}
          >
            {mergedData.map((entry, index) => {
              if (entry.dailyPnl === null) return <Cell key={`cell-${index}`} fill="transparent" />;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.dailyPnl >= 0 ? '#10b981' : '#f43f5e'}
                  fillOpacity={0.85}
                />
              )
            })}
          </Bar>

          {/* Area Chart for Portfolio Value */}
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={3}
            fillOpacity={1}
            fill={`url(#colorValue-${chartId})`}
            activeDot={{ r: 5, fill: lineColor, stroke: "var(--background)", strokeWidth: 3 }}
            dot={false}
            connectNulls={true}
            isAnimationActive={false}
          />

          {/* Line Chart for Total Invested */}
          <Line
            yAxisId="left"
            type="stepAfter"
            dataKey="totalInvested"
            stroke="var(--muted-foreground)"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            strokeOpacity={0.8}
            dot={false}
            activeDot={false}
            connectNulls={true}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
