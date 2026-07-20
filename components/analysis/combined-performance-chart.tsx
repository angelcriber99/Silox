"use client"

import { useMemo, useId, useState, useCallback } from "react"
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

/* ─── Tooltip ─── */
function CombinedTooltip({ active, payload, label, hideBalances }: any) {
  if (!active || !payload?.length || !label) return null

  const areaPayload = payload.find((p: any) => p.dataKey === "value")?.payload as CombinedChartPoint | undefined
  const barPayload = payload.find((p: any) => p.dataKey === "dailyPnl")?.payload as CombinedChartPoint | undefined
  const data = areaPayload || barPayload
  if (!data) return null

  const dailyPnlValue = barPayload?.dailyPnl as number | undefined
  const hasDailyPnl = typeof dailyPnlValue === 'number'
  const dailyPositive = hasDailyPnl && dailyPnlValue >= 0
  const totalPositive = (data.totalPnl ?? 0) >= 0

  return (
    <div className="min-w-[210px] rounded-2xl border border-border/40 bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
      {/* Date header */}
      <div className="mb-3 pb-2.5 border-b border-border/30">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {format(parseISO(label as string), "d MMM yyyy, HH:mm", { locale: es })}
        </span>
      </div>

      {areaPayload && (
        <div className="space-y-2.5">
          {/* Patrimonio */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--chart-accent, #30d158)" }} />
              <span className="text-[13px] font-medium text-foreground">Patrimonio</span>
            </div>
            <span className="text-[13px] font-bold tabular-nums text-foreground">
              {hideBalances ? "****" : formatCurrency(areaPayload.value)}
            </span>
          </div>

          {/* Aportado */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-0.5 rounded-full bg-muted-foreground/50" />
              <div className="h-[1px] w-1.5 bg-muted-foreground/50" />
              <div className="h-2.5 w-0.5 rounded-full bg-muted-foreground/50" />
              <span className="text-[13px] text-muted-foreground -ml-1">Aportado</span>
            </div>
            <span className="text-[13px] font-medium tabular-nums text-muted-foreground">
              {hideBalances ? "****" : formatCurrency(areaPayload.totalInvested)}
            </span>
          </div>

          {/* Rendimiento total */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <span className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">Rendimiento</span>
            <span className={`text-[13px] font-bold tabular-nums ${totalPositive ? "text-emerald-500" : "text-rose-500"}`}>
              {hideBalances ? "****" : `${totalPositive ? "+" : ""}${formatCurrency(areaPayload.totalPnl)}`}
            </span>
          </div>
        </div>
      )}

      {hasDailyPnl && (
        <>
          <div className="my-3 h-px w-full bg-border/30" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-1 rounded-full ${dailyPositive ? "bg-emerald-500" : "bg-rose-500"}`} />
              <span className="text-[13px] font-medium text-foreground">P&L Diario</span>
            </div>
            <div className="flex flex-col items-end">
              <span className={`text-[13px] font-bold tabular-nums ${dailyPositive ? "text-emerald-500" : "text-rose-500"}`}>
                {hideBalances ? "****" : `${dailyPositive ? "+" : ""}${formatCurrency(dailyPnlValue)}`}
              </span>
              {barPayload?.pnlPercent !== undefined && (
                <span className={`text-[10px] font-semibold tabular-nums ${dailyPositive ? "text-emerald-500/70" : "text-rose-500/70"}`}>
                  {hideBalances ? "***" : formatPercent(barPayload.pnlPercent)}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Custom active dot with glow ─── */
function GlowDot(props: any) {
  const { cx, cy, fill } = props
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill={fill} opacity={0.15} />
      <circle cx={cx} cy={cy} r={7} fill={fill} opacity={0.25} />
      <circle cx={cx} cy={cy} r={4.5} fill={fill} stroke="var(--background)" strokeWidth={2.5} />
    </g>
  )
}

/* ─── Legend ─── */
function ChartLegend({ lineColor }: { lineColor: string }) {
  return (
    <div className="flex items-center justify-center gap-6 mt-4 text-[11px] font-semibold text-muted-foreground">
      <div className="flex items-center gap-2">
        <div className="w-4 h-[3px] rounded-full" style={{ background: lineColor }} />
        <span>Patrimonio</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-[2px] rounded-full bg-muted-foreground/50" style={{ backgroundImage: "repeating-linear-gradient(90deg, currentColor 0 3px, transparent 3px 6px)" }} />
        <span>Aportado</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          <div className="w-1.5 h-3 rounded-sm bg-emerald-500/60" />
          <div className="w-1.5 h-3 rounded-sm bg-rose-500/60" />
        </div>
        <span>P&L Diario</span>
      </div>
    </div>
  )
}

/* ─── Main Chart ─── */
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

  const periodPnl = chartData.reduce((sum, point) => sum + point.pnl, 0)
  const lineColor = periodPnl > 0 ? "#30d158" : periodPnl < 0 ? "#ff453a" : "#0a84ff"

  const firstDate = parseISO(mergedData[0].timestamp)
  const lastDate = parseISO(mergedData.at(-1)!.timestamp)
  const isOneDay = timeRange === '1D' || (lastDate.getTime() - firstDate.getTime() <= 24 * 60 * 60 * 1_000)

  // Compute max bar magnitude for opacity scaling
  const maxBarMagnitude = Math.max(...dailyData.map(p => Math.abs(p.pnl)), 1)

  return (
    <div className="w-full" role="img" aria-label="Evolución del patrimonio">
      <style dangerouslySetInnerHTML={{ __html: `
        :root { --chart-accent: ${lineColor}; }
      `}} />
      <div className="h-[280px] sm:h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={mergedData} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id={`colorValue-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.4} />
                <stop offset="40%" stopColor={lineColor} stopOpacity={0.12} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
              {/* Glow filter for the line */}
              <filter id={`glow-${chartId}`}>
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            <CartesianGrid 
              strokeDasharray="3 3" 
              vertical={false} 
              stroke="var(--border)" 
              opacity={0.25} 
            />
            
            <XAxis
              dataKey="timestamp"
              axisLine={false}
              tickLine={false}
              tickFormatter={(date) => {
                try { return format(parseISO(date), isOneDay ? "HH:mm" : "d MMM", { locale: es }) } 
                catch { return "" }
              }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 500 }}
              tickMargin={14}
              minTickGap={50}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => {
                if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
                if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(1)}k`
                return `€${value.toFixed(0)}`
              }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }}
              width={58}
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
              cursor={{ 
                stroke: lineColor, 
                strokeWidth: 1, 
                strokeOpacity: 0.5,
              }}
              isAnimationActive={false}
            />

            <ReferenceLine y={0} yAxisId="left" stroke="var(--border)" strokeOpacity={0.5} strokeDasharray="3 3" />

            <Bar 
              yAxisId="left" 
              dataKey="dailyPnl" 
              radius={[5, 5, 5, 5]} 
              maxBarSize={32}
              isAnimationActive={false}
            >
              {mergedData.map((entry, index) => {
                const pnl = entry.dailyPnl ?? 0
                const magnitude = Math.abs(pnl) / maxBarMagnitude
                const opacity = 0.25 + (magnitude * 0.55)
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={pnl >= 0 ? '#10b981' : '#f43f5e'}
                    fillOpacity={opacity}
                  />
                )
              })}
            </Bar>

            <Area
              yAxisId="right"
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2.5}
              fillOpacity={1}
              fill={`url(#colorValue-${chartId})`}
              activeDot={<GlowDot fill={lineColor} />}
              connectNulls={true}
              isAnimationActive={false}
            />

            <Line
              yAxisId="right"
              type="monotone"
              dataKey="totalInvested"
              stroke="var(--muted-foreground)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              strokeOpacity={0.4}
              dot={false}
              activeDot={false}
              connectNulls={true}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend lineColor={lineColor} />
    </div>
  )
}
