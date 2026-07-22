"use client"

import { useId, useState, useEffect } from "react"
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
import { summarizePerformance, type PerformancePoint, type PerformanceRange } from "@/lib/utils/performance-history"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { useDisplayCurrency } from "@/lib/hooks/use-display-currency"

interface CombinedPerformanceChartProps {
  chartData: PerformancePoint[]
  dailyData?: PerformancePoint[] // kept for type compatibility
  timeRange: PerformanceRange
  currentDailyPnl?: number
  currentDailyPnlPercent?: number
  children?: React.ReactNode
}

/* ─── Custom active dot with glow ─── */
function GlowDot(props: { cx?: number; cy?: number; fill?: string }) {
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
function StateUpdaterTooltip({
  active,
  payload,
  onPointUpdate,
}: {
  active?: boolean
  payload?: Array<{ payload: PerformancePoint }>
  onPointUpdate: (point: PerformancePoint | null) => void
}) {
  useEffect(() => {
    if (active && payload && payload.length > 0) {
      onPointUpdate(payload[0].payload)
    } else {
      onPointUpdate(null)
    }
  }, [active, payload, onPointUpdate])
  return null
}
export function CombinedPerformanceChart({
  chartData,
  timeRange,
  currentDailyPnl,
  currentDailyPnlPercent,
  children
}: CombinedPerformanceChartProps) {
  const { hideBalances } = usePreferences()
  const { displayCurrency, convert, format: formatDisplay } = useDisplayCurrency()
  const chartId = useId()
  const [hoveredPoint, setHoveredPoint] = useState<PerformancePoint | null>(null)

  if (chartData.length === 0) return null

  const lastPoint = chartData[chartData.length - 1]
  const displayPoint = hoveredPoint ?? lastPoint
  const visibleData = hoveredPoint
    ? chartData.filter((point) => new Date(point.timestamp).getTime() <= new Date(hoveredPoint.timestamp).getTime())
    : chartData
  const calculatedPeriod = summarizePerformance(visibleData, timeRange)
  const period = timeRange === "1D" && !hoveredPoint && currentDailyPnl !== undefined
    ? {
        ...calculatedPeriod,
        profit: currentDailyPnl,
        profitPercent: currentDailyPnlPercent ?? calculatedPeriod.profitPercent,
      }
    : calculatedPeriod

  const plottedValues = chartData.map((point) => point.value)
  const minValue = Math.min(...plottedValues)
  const maxValue = Math.max(...plottedValues)
  const valueRange = maxValue - minValue || Math.abs(maxValue) * 0.05 || 1_000
  const yMinRight = minValue - valueRange * 0.05
  const yMaxRight = maxValue + valueRange * 0.05

  const periodPnl = period.profit
  const lineColor = periodPnl > 0 ? "#30d158" : periodPnl < 0 ? "#ff453a" : "#0a84ff"

  const pnlInPeriod = period.profit
  const pnlPercentInPeriod = period.profitPercent
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
               !hoveredPoint ? <AnimatedNumber value={convert(displayPoint.value)} format="currency" currency={displayCurrency} hide={hideBalances} /> : formatDisplay(displayPoint.value)
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
                  {isPositive ? "+" : ""}{formatDisplay(pnlInPeriod)}
                  <span className="mx-0.5">{isPositive ? "▴" : "▾"}</span>
                  {pnlPercentInPeriod >= 0 ? "+" : ""}{pnlPercentInPeriod.toFixed(2)}%
                </>
              )}
            </span>
            {timeRange !== "1D" && currentDailyPnl !== undefined && !hoveredPoint && (
              <>
                <span className="text-xs font-semibold text-muted-foreground">•</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest text-[9px]">Hoy</span>
                <span className={`text-xs font-bold flex items-center tabular-nums ${currentDailyPnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {hideBalances ? "•••" : (
                    <>
                      {currentDailyPnl >= 0 ? "+" : ""}{formatDisplay(currentDailyPnl)}
                      {currentDailyPnlPercent !== undefined && (
                        <>
                           <span className="mx-0.5">{currentDailyPnl >= 0 ? "▴" : "▾"}</span>
                           {currentDailyPnlPercent >= 0 ? "+" : ""}{currentDailyPnlPercent.toFixed(2)}%
                        </>
                      )}
                    </>
                  )}
                </span>
              </>
            )}
          </div>
        </div>
        {children}
      </div>

      <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
        <div className="rounded-lg border border-border/50 bg-background/45 px-3 py-2">
          <span className="block">Inicio</span>
          <strong className="mt-0.5 block tabular-nums text-foreground">{hideBalances ? "••••" : formatDisplay(period.startValue)}</strong>
        </div>
        <div className="rounded-lg border border-border/50 bg-background/45 px-3 py-2">
          <span className="block">Flujos netos</span>
          <strong className="mt-0.5 block tabular-nums text-foreground">{hideBalances ? "••••" : formatDisplay(period.netFlow)}</strong>
        </div>
        <div className="rounded-lg border border-border/50 bg-background/45 px-3 py-2">
          <span className="block">Resultado ajustado</span>
          <strong className={`mt-0.5 block tabular-nums ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>{hideBalances ? "••••" : formatDisplay(period.profit)}</strong>
        </div>
        {currentDailyPnl !== undefined && (
          <div className="rounded-lg border border-border/50 bg-background/45 px-3 py-2">
            <span className="block">Hoy</span>
            <strong className={`mt-0.5 block tabular-nums ${currentDailyPnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {hideBalances ? "••••" : (
                <>
                  {currentDailyPnl >= 0 ? "+" : ""}{formatDisplay(currentDailyPnl)}
                </>
              )}
            </strong>
          </div>
        )}
      </div>

      <div className="h-[240px] sm:h-[290px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart 
            data={chartData} 
            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
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
            <Tooltip content={<StateUpdaterTooltip onPointUpdate={setHoveredPoint} />} cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeOpacity: 0.3 }} />

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
