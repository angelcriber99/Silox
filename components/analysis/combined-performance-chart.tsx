"use client"

import { useId, useState } from "react"
import { parseISO, format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Area,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts"

import { usePreferences } from "@/lib/stores/use-preferences"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import type { PerformancePoint, PerformanceRange } from "@/lib/utils/performance-history"
import { AnimatedNumber } from "@/components/ui/animated-number"

interface CombinedPerformanceChartProps {
  chartData: PerformancePoint[]
  dailyData?: PerformancePoint[] // kept for type compatibility
  timeRange: any
  currentDailyPnl?: number
  currentDailyPnlPercent?: number
  children?: React.ReactNode
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

/* ─── Main Chart ─── */
export function CombinedPerformanceChart({
  chartData,
  timeRange,
  children
}: CombinedPerformanceChartProps) {
  const { hideBalances } = usePreferences()
  const chartId = useId()
  const [hoveredPoint, setHoveredPoint] = useState<PerformancePoint | null>(null)

  if (chartData.length === 0) return null

  const firstPoint = chartData[0]
  const lastPoint = chartData[chartData.length - 1]
  const displayPoint = hoveredPoint ?? lastPoint

  const plottedValues = chartData.map((point) => point.value)
  const minValue = Math.min(...plottedValues)
  const maxValue = Math.max(...plottedValues)
  const valueRange = maxValue - minValue || Math.abs(maxValue) * 0.05 || 1_000
  const yMinRight = minValue - valueRange * 0.05
  const yMaxRight = maxValue + valueRange * 0.05

  const periodPnl = chartData.reduce((sum, point) => sum + point.pnl, 0)
  const lineColor = periodPnl > 0 ? "#30d158" : periodPnl < 0 ? "#ff453a" : "#0a84ff"

  // Calculamos la rentabilidad del periodo
  const pnlInPeriod = displayPoint.totalPnl - firstPoint.totalPnl
  const startCost = firstPoint.totalInvested || 1 // evitar division por 0
  const pnlPercentInPeriod = (pnlInPeriod / startCost) * 100
  const isPositive = pnlInPeriod >= 0

  const firstDate = parseISO(chartData[0].timestamp)
  const lastDate = parseISO(chartData.at(-1)!.timestamp)
  const isOneDay = timeRange === '1D' || (lastDate.getTime() - firstDate.getTime() <= 24 * 60 * 60 * 1_000)

  // Format the date/time string for the subtitle
  const displayDateStr = hoveredPoint 
    ? format(parseISO(hoveredPoint.timestamp), isOneDay ? "HH:mm" : "d MMM, HH:mm", { locale: es })
    : timeRange === "1D" 
      ? `Hoy, ${format(parseISO(lastPoint.timestamp), "HH:mm")}`
      : timeRange === "ALL" 
        ? "Desde el inicio" 
        : format(parseISO(lastPoint.timestamp), "d MMM yyyy", { locale: es })

  return (
    <div className="w-full flex flex-col" role="img" aria-label="Evolución del patrimonio">
      <style dangerouslySetInnerHTML={{ __html: `
        :root { --chart-accent: ${lineColor}; }
      `}} />
      
      {/* Header estilo Revolut */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex flex-col">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground tabular-nums">
            {hideBalances ? "••••••" : (
               !hoveredPoint ? <AnimatedNumber value={displayPoint.value} format="currency" hide={hideBalances} /> : formatCurrency(displayPoint.value)
            )}
          </h2>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs font-semibold text-muted-foreground capitalize">
              {displayDateStr}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">•</span>
            <span className={`text-xs font-bold flex items-center tabular-nums ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
              {hideBalances ? "•••" : (
                <>
                  {isPositive ? "+" : ""}{formatCurrency(pnlInPeriod)}
                  <span className="mx-0.5">{isPositive ? "▴" : "▾"}</span>
                  {Math.abs(pnlPercentInPeriod).toFixed(2)}%
                </>
              )}
            </span>
          </div>
        </div>
        {children}
      </div>

      <div className="h-[240px] sm:h-[320px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart 
            data={chartData} 
            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
            onMouseMove={(data: any) => {
              if (data?.isTooltipActive && data?.activePayload && data.activePayload.length > 0) {
                setHoveredPoint(data.activePayload[0].payload)
              }
            }}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <defs>
              <linearGradient id={`colorValue-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
              <filter id={`glow-${chartId}`}>
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            <XAxis dataKey="timestamp" hide />
            <YAxis yAxisId="right" orientation="right" hide domain={[yMinRight, yMaxRight]} />

            {/* Tooltip fantasma necesario para onMouseMove y activePayload */}
            <Tooltip content={() => null} cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeOpacity: 0.3 }} />

            {/* Crosshair horizontal opcional, Revolut a veces muestra una linea */}
            {hoveredPoint && (
              <ReferenceLine y={hoveredPoint.value} yAxisId="right" stroke="var(--muted-foreground)" strokeOpacity={0.2} strokeDasharray="3 3" />
            )}

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
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
