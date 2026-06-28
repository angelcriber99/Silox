"use client"

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, ReferenceLine, CartesianGrid } from "recharts"
import { formatCurrency } from "@/lib/utils/formatters"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { usePreferences } from "@/lib/stores/use-preferences"
import type { ChartDataPoint } from "./performance-modal"

export function DailyPnlChart({ chartData }: { chartData: ChartDataPoint[] }) {
  const { hideBalances } = usePreferences()

  if (!chartData || chartData.length === 0) {
    return null
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartDataPoint
      const isPositive = data.pnl >= 0
      const dateObj = parseISO(label)
      const formattedDate = format(dateObj, "d MMM yyyy", { locale: es })
      
      return (
        <div className="bg-card/95 border border-border p-4 rounded-xl shadow-xl backdrop-blur-md min-w-[170px]">
          <p className="text-muted-foreground text-xs mb-3 font-medium uppercase tracking-wider border-b border-border/50 pb-2">{formattedDate}</p>
          <div>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
              PnL Diario
            </p>
            {data.isFilled ? (
               <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                  <p className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground leading-none">Cerrado</p>
               </div>
            ) : (
              <p className={`font-bold text-xl font-tabular leading-none ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
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
        <BarChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tickFormatter={(date) => format(parseISO(date), "d MMM", { locale: es })}
            tick={{ fill: '#71717a', fontSize: 12 }}
            dy={10}
            minTickGap={30}
          />
          <YAxis hide />
          <ReferenceLine y={0} stroke="#27272a" />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
          <Bar dataKey="pnl" radius={[4, 4, 4, 4]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
