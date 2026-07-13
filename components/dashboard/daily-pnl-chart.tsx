"use client"

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, ReferenceLine, CartesianGrid } from "recharts"
import { formatCurrency } from "@/lib/utils/formatters"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { usePreferences } from "@/lib/stores/use-preferences"
import type { ChartDataPoint } from "./performance-modal"
import { aggregateDailyPnl } from "@/lib/utils/performance-history"

interface DailyTooltipProps {
  active?: boolean
  payload?: Array<{ payload: ChartDataPoint }>
  label?: string
}

function DailyTooltip({ active, payload, label }: DailyTooltipProps) {
  const { hideBalances } = usePreferences()

  if (active && payload?.length && label) {
    const data = payload[0].payload
    const isPositive = data.pnl >= 0
    const formattedDate = format(parseISO(label), "d MMM yyyy", { locale: es })

    return (
      <div className="bg-card/95 border border-border p-4 rounded-xl shadow-xl backdrop-blur-md min-w-[170px]">
        <p className="text-muted-foreground text-xs mb-3 font-medium uppercase tracking-wider border-b border-border/50 pb-2">{formattedDate}</p>
        <div>
          <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
            PnL Diario
          </p>
          <p className={`font-bold text-xl tabular-nums leading-none ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {hideBalances ? "****" : `${isPositive ? '+' : ''}${formatCurrency(data.pnl)}`}
          </p>
        </div>
      </div>
    )
  }

  return null
}

export function DailyPnlChart({ chartData }: { chartData: ChartDataPoint[] }) {
  const dailyData = aggregateDailyPnl(chartData)

  if (dailyData.length === 0) {
    return null
  }

  return (
    <div className="w-full h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dailyData} margin={{ top: 10, right: 0, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
          <XAxis 
            dataKey="timestamp" 
            axisLine={false} 
            tickLine={false} 
            tickFormatter={(date) => format(parseISO(date), "d MMM")}
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            tickMargin={10}
            minTickGap={30}
          />
          <YAxis hide />
          <ReferenceLine y={0} stroke="#27272a" />
          <Tooltip content={<DailyTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
          <Bar dataKey="pnl" radius={[4, 4, 4, 4]} isAnimationActive={false}>
            {dailyData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
