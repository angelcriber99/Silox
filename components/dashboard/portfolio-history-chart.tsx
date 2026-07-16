"use client"

import { useEffect, useId } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts"
import type { TooltipContentProps } from "recharts"
import { formatCurrency } from "@/lib/utils/formatters"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { usePreferences } from "@/lib/stores/use-preferences"
import type { ChartDataPoint } from "./performance-modal"

interface PortfolioHistoryChartProps {
  chartData: ChartDataPoint[]
  onHoverChange?: (point: ChartDataPoint | null) => void
  hideTooltipContent?: boolean
  hideYAxis?: boolean
}

export function PortfolioHistoryChart({ chartData, onHoverChange, hideTooltipContent, hideYAxis }: PortfolioHistoryChartProps) {
  const { hideBalances } = usePreferences()
  const chartId = useId()

  if (!chartData || chartData.length === 0) {
    return null
  }

  const values = chartData.map(d => d.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range = maxVal - minVal || maxVal * 0.05 || 1000
  const yMin = minVal - range * 0.02
  const yMax = maxVal + range * 0.15

  // Determine overall performance to choose color
  const firstValue = chartData[0].value
  const lastValue = chartData[chartData.length - 1].value
  const isOverallPositive = lastValue >= firstValue
  const lineColor = isOverallPositive ? "#10b981" : "#f43f5e"

  const lastInvested = chartData[chartData.length - 1]?.totalInvested

  const firstDate = parseISO(chartData[0].timestamp)
  const lastDate = parseISO(chartData[chartData.length - 1].timestamp)
  const spanMs = lastDate.getTime() - firstDate.getTime()
  const isOneDay = spanMs <= 24 * 60 * 60 * 1000

  const CustomTooltip = ({ active, payload, label }: TooltipContentProps) => {
    useEffect(() => {
      if (active && payload && payload.length) {
        onHoverChange?.(payload[0].payload)
      } else if (!active) {
        onHoverChange?.(null)
      }
      return () => onHoverChange?.(null)
    }, [active, payload, onHoverChange])

    if (hideTooltipContent) return null;

    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartDataPoint
      const isPositive = data.totalPnl >= 0
      const dateObj = parseISO(String(label))
      const formattedDate = format(dateObj, "d MMM yyyy, HH:mm", { locale: es })
      
      return (
        <div className="bg-card/95 border border-border/60 p-4 rounded-xl shadow-2xl backdrop-blur-md min-w-[180px]">
          <p className="text-muted-foreground text-xs mb-3 font-medium uppercase tracking-wider border-b border-border/50 pb-2">{formattedDate}</p>
          <div className="mb-2.5">
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Patrimonio</p>
            <p className="font-bold text-lg tabular-nums text-foreground leading-none">
              {hideBalances ? "****" : formatCurrency(data.value)}
            </p>
          </div>
          <div className="mb-2.5">
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Ganancia Total</p>
            <p className={`font-bold text-sm tabular-nums leading-none ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {hideBalances ? "****" : `${isPositive ? '+' : ''}${formatCurrency(data.totalPnl)}`}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">PnL Instante</p>
            {data.isFirstPoint ? (
              <p className="font-bold text-sm tabular-nums text-muted-foreground leading-none">—</p>
            ) : (
              <p className={`font-bold text-sm tabular-nums leading-none ${data.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {hideBalances ? "****" : `${data.pnl >= 0 ? '+' : ''}${formatCurrency(data.pnl)}`}
              </p>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  // The X-axis already handles date labels, and the interactive tooltip provides exact values.
  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart 
          data={chartData} 
          margin={{ top: 15, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`colorValue-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.4}/>
              <stop offset="50%" stopColor={lineColor} stopOpacity={0.1}/>
              <stop offset="100%" stopColor={lineColor} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" opacity={0.5} />
          <XAxis 
            dataKey="timestamp" 
            axisLine={false} 
            tickLine={false} 
            tickFormatter={(date) => {
              try {
                if (!date) return "";
                return format(parseISO(date), isOneDay ? "HH:mm" : "d MMM", { locale: es });
              } catch (e) {
                return "";
              }
            }}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500 }}
            dy={-15}
            minTickGap={30}
          />
          <YAxis 
            hide={hideYAxis}
            orientation="right"
            mirror={true}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `€${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500 }}
            dx={-10}
            dy={-10}
            domain={[yMin, yMax]} 
          />
          <Tooltip 
            content={CustomTooltip}
            cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: hideTooltipContent ? '0' : '4 4', strokeOpacity: 0.5 }} 
          />
          {/* Invested reference line */}
          {lastInvested && lastInvested > 0 && (
            <ReferenceLine 
              y={lastInvested} 
              stroke="var(--muted-foreground)" 
              strokeDasharray="4 4" 
              strokeOpacity={0.3}
              strokeWidth={1}
            />
          )}
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
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}


