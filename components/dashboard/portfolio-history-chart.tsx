"use client"

import { useId } from "react"
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { TooltipContentProps } from "recharts"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

import { usePreferences } from "@/lib/stores/use-preferences"
import { formatCurrency } from "@/lib/utils/formatters"
import type { ChartDataPoint } from "./performance-modal"

interface PortfolioHistoryChartProps {
  chartData: ChartDataPoint[]
  onHoverChange?: (point: ChartDataPoint | null) => void
  hideTooltipContent?: boolean
  hideYAxis?: boolean
}

interface HistoryTooltipProps extends TooltipContentProps {
  hideBalances: boolean
  hidden: boolean
}

function HistoryTooltip({ active, payload, label, hideBalances, hidden }: HistoryTooltipProps) {
  if (hidden || !active || !payload?.length || !label) return null

  const data = payload[0].payload as ChartDataPoint
  const totalPositive = data.totalPnl >= 0
  const intervalPositive = data.pnl >= 0
  const formattedDate = format(parseISO(String(label)), "d MMM yyyy, HH:mm", { locale: es })

  return (
    <div className="min-w-[210px] rounded-xl border border-border/60 bg-card/95 p-4 shadow-2xl backdrop-blur-md">
      <p className="mb-3 border-b border-border/50 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {formattedDate}
      </p>
      <dl className="space-y-2.5">
        <div className="flex items-end justify-between gap-5">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Patrimonio</dt>
          <dd className="text-sm font-bold tabular-nums text-foreground">
            {hideBalances ? "****" : formatCurrency(data.value)}
          </dd>
        </div>
        <div className="flex items-end justify-between gap-5">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Capital neto</dt>
          <dd className="text-sm font-semibold tabular-nums text-foreground">
            {hideBalances ? "****" : formatCurrency(data.totalInvested)}
          </dd>
        </div>
        <div className="flex items-end justify-between gap-5">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">P&amp;L total</dt>
          <dd className={`text-sm font-bold tabular-nums ${totalPositive ? "text-emerald-400" : "text-rose-400"}`}>
            {hideBalances ? "****" : `${totalPositive ? "+" : ""}${formatCurrency(data.totalPnl)}`}
          </dd>
        </div>
        <div className="flex items-end justify-between gap-5">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">P&amp;L del intervalo</dt>
          <dd className={`text-sm font-bold tabular-nums ${intervalPositive ? "text-emerald-400" : "text-rose-400"}`}>
            {data.isFirstPoint
              ? "—"
              : hideBalances
                ? "****"
                : `${intervalPositive ? "+" : ""}${formatCurrency(data.pnl)}`}
          </dd>
        </div>
      </dl>
    </div>
  )
}

export function PortfolioHistoryChart({
  chartData,
  onHoverChange,
  hideTooltipContent = false,
  hideYAxis = false,
}: PortfolioHistoryChartProps) {
  const { hideBalances } = usePreferences()
  const chartId = useId()

  if (chartData.length === 0) return null

  const plottedValues = chartData.flatMap((point) => [point.value, point.totalInvested])
  const minValue = Math.min(...plottedValues)
  const maxValue = Math.max(...plottedValues)
  const valueRange = maxValue - minValue || Math.abs(maxValue) * 0.05 || 1_000
  const yMin = minValue - valueRange * 0.08
  const yMax = maxValue + valueRange * 0.12
  const periodPnl = chartData.reduce((sum, point) => sum + point.pnl, 0)
  const lineColor = periodPnl > 0 ? "#30d158" : periodPnl < 0 ? "#ff453a" : "#0a84ff"

  const firstDate = parseISO(chartData[0].timestamp)
  const lastDate = parseISO(chartData.at(-1)!.timestamp)
  const isOneDay = lastDate.getTime() - firstDate.getTime() <= 24 * 60 * 60 * 1_000

  const handleMouseMove = (state: unknown) => {
    const activePayload = (state as { activePayload?: Array<{ payload?: ChartDataPoint }> } | undefined)?.activePayload
    onHoverChange?.(activePayload?.[0]?.payload ?? null)
  }

  return (
    <div
      className="h-full w-full"
      role="img"
      aria-label="Evolución del patrimonio y del capital neto aportado"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 15, right: 6, left: 6, bottom: 0 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => onHoverChange?.(null)}
        >
          <defs>
            <linearGradient id={`colorValue-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
              <stop offset="55%" stopColor={lineColor} stopOpacity={0.08} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" opacity={0.5} />
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
            tickMargin={10}
            minTickGap={30}
          />
          <YAxis
            hide={hideYAxis}
            orientation="right"
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `€${Math.abs(value) >= 1_000 ? `${(value / 1_000).toFixed(1)}k` : value.toFixed(0)}`}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 500 }}
            width={58}
            domain={[yMin, yMax]}
          />
          <Tooltip
            content={(props) => (
              <HistoryTooltip
                {...props}
                hideBalances={hideBalances}
                hidden={hideTooltipContent}
              />
            )}
            cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: hideTooltipContent ? "0" : "4 4", strokeOpacity: 0.6 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={3}
            fillOpacity={1}
            fill={`url(#colorValue-${chartId})`}
            activeDot={{ r: 5, fill: lineColor, stroke: "var(--background)", strokeWidth: 3 }}
            dot={false}
            isAnimationActive={false}
            connectNulls={true}
          />
          <Line
            type="monotone"
            dataKey="totalInvested"
            stroke="var(--muted-foreground)"
            strokeWidth={2}
            strokeDasharray="5 5"
            strokeOpacity={0.8}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            connectNulls={true}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
