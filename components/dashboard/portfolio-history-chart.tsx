"use client"

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"
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

  const minVal = Math.min(...chartData.map(d => d.value))
  const maxVal = Math.max(...chartData.map(d => d.value))
  const domainPadding = Math.max(Math.abs(maxVal), Math.abs(minVal)) * 0.1 || 10

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartDataPoint
      const isPositive = data.pnl >= 0
      const dateObj = parseISO(label)
      const formattedDate = format(dateObj, "d MMM yyyy", { locale: es })
      
      return (
        <div className="bg-card/95 border border-border p-4 rounded-xl shadow-xl backdrop-blur-md min-w-[170px]">
          <p className="text-muted-foreground text-xs mb-3 font-medium uppercase tracking-wider border-b border-border/50 pb-2">{formattedDate}</p>
          <div className="mb-3">
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
              Patrimonio
            </p>
            <p className="font-bold text-lg font-tabular text-foreground leading-none">
              {hideBalances ? "****" : formatCurrency(data.value)}
            </p>
          </div>
          <div className="mb-3">
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
              Beneficio All-Time
            </p>
            <p className={`font-bold text-sm font-tabular leading-none ${data.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {hideBalances ? "****" : `${data.totalPnl >= 0 ? '+' : ''}${formatCurrency(data.totalPnl)}`}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
              PnL Diario
            </p>
            {data.isFirstDay ? (
              <p className="font-bold text-sm font-tabular text-muted-foreground leading-none">---</p>
            ) : data.isFilled ? (
               <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                  <p className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground leading-none">Cerrado</p>
               </div>
            ) : (
              <p className={`font-bold text-sm font-tabular leading-none ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {hideBalances ? "****" : `${isPositive ? '+' : ''}${formatCurrency(data.pnl)}`}
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
        <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tickFormatter={(date) => format(parseISO(date), "d MMM", { locale: es })}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            dy={10}
            minTickGap={40}
          />
          <YAxis hide domain={[minVal - domainPadding, maxVal + domainPadding]} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255, 255, 255, 0.1)', strokeWidth: 2, strokeDasharray: '5 5' }} />
          <Area 
            type="linear" 
            dataKey="value" 
            stroke="#3b82f6" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorValue)" 
            activeDot={{ r: 6, fill: "#3b82f6", stroke: "#18181b", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
