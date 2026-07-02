"use client"

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts"
import { formatCurrency } from "@/lib/utils/formatters"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { usePreferences } from "@/lib/stores/use-preferences"
import type { ChartDataPoint } from "./performance-modal"

export function PortfolioHistoryChart({ chartData }: { chartData: ChartDataPoint[] }) {
  const { hideBalances } = usePreferences()

  if (!chartData || chartData.length === 0) {
    return null
  }

  const values = chartData.map(d => d.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range = maxVal - minVal || 1000
  const domainPadding = range * 0.15

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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartDataPoint
      const isPositive = data.totalPnl >= 0
      const dateObj = parseISO(label)
      const formattedDate = format(dateObj, "d MMM yyyy, HH:mm", { locale: es })
      
      return (
        <div className="bg-card/95 border border-border/60 p-4 rounded-xl shadow-2xl backdrop-blur-md min-w-[180px]">
          <p className="text-muted-foreground text-xs mb-3 font-medium uppercase tracking-wider border-b border-border/50 pb-2">{formattedDate}</p>
          <div className="mb-2.5">
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Patrimonio</p>
            <p className="font-bold text-lg font-tabular text-foreground leading-none">
              {hideBalances ? "****" : formatCurrency(data.value)}
            </p>
          </div>
          <div className="mb-2.5">
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Ganancia Total</p>
            <p className={`font-bold text-sm font-tabular leading-none ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {hideBalances ? "****" : `${isPositive ? '+' : ''}${formatCurrency(data.totalPnl)}`}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">PnL Instante</p>
            {data.isFirstPoint ? (
              <p className="font-bold text-sm font-tabular text-muted-foreground leading-none">—</p>
            ) : (
              <p className={`font-bold text-sm font-tabular leading-none ${data.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {hideBalances ? "****" : `${data.pnl >= 0 ? '+' : ''}${formatCurrency(data.pnl)}`}
              </p>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lineColor} stopOpacity={0.25}/>
              <stop offset="95%" stopColor={lineColor} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis 
            dataKey="timestamp" 
            axisLine={false} 
            tickLine={false} 
            tickFormatter={(date) => format(parseISO(date), isOneDay ? "HH:mm" : "d MMM", { locale: es })}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            dy={10}
            minTickGap={40}
          />
          <YAxis 
            hide 
            domain={[minVal - domainPadding, maxVal + domainPadding]} 
          />
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.5 }} 
          />
          {/* Invested reference line */}
          {lastInvested && lastInvested > 0 && (
            <ReferenceLine 
              y={lastInvested} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="4 4" 
              strokeOpacity={0.3}
              strokeWidth={1}
            />
          )}
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={lineColor} 
            strokeWidth={2.5}
            fillOpacity={1} 
            fill="url(#colorValue)" 
            activeDot={{ r: 5, fill: lineColor, stroke: "hsl(var(--background))", strokeWidth: 2 }}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}


