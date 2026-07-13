"use client"

import { useMemo } from "react"
import { useHistory } from "@/lib/hooks/use-portfolio"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { TooltipContentProps } from "recharts"
import { formatPercent } from "@/lib/utils/formatters"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Activity } from "lucide-react"

export function DrawdownChart() {
  const { data: snapshots, isLoading } = useHistory()

  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return []

    const sorted = [...snapshots].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    let peak = -Infinity

    return sorted.map((snap) => {
      const current = snap.total_value
      if (current > peak) peak = current
      
      const drawdown = peak > 0 ? ((current - peak) / peak) * 100 : 0
      
      return {
        timestamp: snap.timestamp,
        drawdown: drawdown < 0 ? drawdown : 0
      }
    })
  }, [snapshots])

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center min-h-[300px]">
        <div className="animate-pulse flex flex-col items-center gap-3 text-muted-foreground/80">
          <Activity className="h-8 w-8 animate-bounce" />
          <p>Calculando drawdown histórico...</p>
        </div>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center min-h-[300px] text-muted-foreground text-sm text-center px-4">
        Se necesitan al menos dos días de historial.
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label }: TooltipContentProps) => {
    if (active && payload && payload.length) {
      const value = Number(payload[0].value ?? 0)
      const formattedDate = format(parseISO(String(label)), "d MMM yyyy", { locale: es })
      
      return (
        <div className="bg-card/90 border border-border p-4 rounded-xl shadow-xl backdrop-blur-md min-w-[150px]">
          <p className="text-muted-foreground text-xs mb-2 font-medium uppercase tracking-wider border-b border-border/50 pb-2">{formattedDate}</p>
          <div>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
              Drawdown
            </p>
            <p className="font-bold text-xl tabular-nums text-rose-400">
              {formatPercent(value)}
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="drawdownGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#fb7185" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="timestamp" 
            axisLine={false} 
            tickLine={false} 
            tickFormatter={(date) => format(parseISO(date), "d MMM", { locale: es })}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            dy={10}
            minTickGap={30}
          />
          <YAxis hide domain={['dataMin - 2', 0]} />
          <Tooltip content={CustomTooltip} cursor={{ stroke: 'rgba(255, 255, 255, 0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Area 
            type="monotone" 
            dataKey="drawdown" 
            stroke="#fb7185" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#drawdownGrad)" 
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
