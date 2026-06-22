"use client"

import { useMemo } from "react"
import { useSnapshots } from "@/lib/hooks/use-portfolio"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, Cell, ReferenceLine } from "recharts"
import { formatCurrency } from "@/lib/utils/formatters"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Activity } from "lucide-react"

export function DailyPnlChart() {
  const { data: snapshots, isLoading } = useSnapshots()

  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return []

    // Sort snapshots by date
    const sorted = [...snapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const dataPoints = []

    for (let i = 1; i < sorted.length; i++) {
      const today = sorted[i]
      const yesterday = sorted[i - 1]

      const pnlToday = today.total_value - today.total_invested
      const pnlYesterday = yesterday.total_value - yesterday.total_invested
      
      const dailyDelta = pnlToday - pnlYesterday

      dataPoints.push({
        date: today.date,
        value: dailyDelta
      })
    }

    return dataPoints
  }, [snapshots])

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center min-h-[300px]">
        <div className="animate-pulse flex flex-col items-center gap-3 text-muted-foreground/80">
          <Activity className="h-8 w-8 animate-bounce" />
          <p>Calculando volatilidad diaria...</p>
        </div>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center min-h-[300px] text-muted-foreground text-sm text-center px-4">
        Se necesitan al menos dos días de historial (snapshots) para calcular la ganancia/pérdida diaria. Vuelve mañana para ver tu primer gráfico de barras.
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value
      const isPositive = value >= 0
      const formattedDate = format(parseISO(label), "d MMM yyyy", { locale: es })
      
      return (
        <div className="bg-card/90 border border-border p-4 rounded-xl shadow-xl backdrop-blur-md min-w-[150px]">
          <p className="text-muted-foreground text-xs mb-2 font-medium uppercase tracking-wider border-b border-border/50 pb-2">{formattedDate}</p>
          <div>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
              Rendimiento Diario
            </p>
            <p className={`font-bold text-xl font-tabular ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPositive ? '+' : ''}{formatCurrency(value)}
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
        <BarChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tickFormatter={(date) => format(parseISO(date), "MMM yy", { locale: es })}
            tick={{ fill: '#71717a', fontSize: 12 }}
            dy={10}
            minTickGap={30}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
          <ReferenceLine y={0} stroke="#3f3f46" strokeWidth={1} strokeDasharray="3 3" />
          <Bar dataKey="value" radius={[4, 4, 4, 4]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#10b981' : '#fb7185'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
