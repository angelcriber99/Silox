"use client"

import { useMemo } from "react"
import { useSnapshots } from "@/lib/hooks/use-portfolio"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, ReferenceLine } from "recharts"
import { formatCurrency } from "@/lib/utils/formatters"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Activity } from "lucide-react"
import { usePreferences } from "@/lib/stores/use-preferences"

export function DailyPnlChart({ currentPnl24h, currentTotalValue }: { currentPnl24h?: number, currentTotalValue?: number }) {
  const { data: snapshots, isLoading } = useSnapshots()
  const { hideBalances } = usePreferences()

  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) {
      if (currentTotalValue !== undefined && currentPnl24h !== undefined) {
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        return [{ date: todayStr, pnl: currentPnl24h }]
      }
      return []
    }

    const sorted = [...snapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const dataPoints = []

    for (let i = 0; i < sorted.length; i++) {
      const point = sorted[i]
      const pnlToday = point.total_value - point.total_invested
      let pnl = 0
      
      if (i > 0) {
        const yesterday = sorted[i - 1]
        const pnlYesterday = yesterday.total_value - yesterday.total_invested
        pnl = pnlToday - pnlYesterday
      } else {
        // For the first day, we show 0 so it doesn't skew the chart if they added a lot of assets
        pnl = 0 
      }

      dataPoints.push({
        date: point.date,
        pnl: pnl
      })
    }

    if (currentPnl24h !== undefined) {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const lastPoint = dataPoints[dataPoints.length - 1]
      
      if (lastPoint && lastPoint.date === todayStr) {
        lastPoint.pnl = currentPnl24h
      } else if (!lastPoint || lastPoint.date !== todayStr) {
        dataPoints.push({
          date: todayStr,
          pnl: currentPnl24h
        })
      }
    }

    return dataPoints
  }, [snapshots, currentPnl24h, currentTotalValue])

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center min-h-[300px]">
        <div className="animate-pulse flex flex-col items-center gap-3 text-muted-foreground/80">
          <Activity className="h-8 w-8 animate-bounce" />
          <p>Calculando rendimiento diario...</p>
        </div>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center min-h-[300px] text-muted-foreground text-sm text-center px-4">
        Añade activos a tu portfolio y espera un día para ver tu rendimiento diario.
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const isPositive = data.pnl >= 0
      const dateObj = parseISO(label)
      const formattedDate = format(dateObj, "d MMM yyyy", { locale: es })
      const dayOfWeek = dateObj.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      
      return (
        <div className="bg-card/90 border border-border p-4 rounded-xl shadow-xl backdrop-blur-md min-w-[170px]">
          <p className="text-muted-foreground text-xs mb-2 font-medium uppercase tracking-wider border-b border-border/50 pb-2">{formattedDate}</p>
          <div>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
              PnL Diario
            </p>
            {(isWeekend && Math.abs(data.pnl) < 1) ? (
              <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground mt-1">Mercado Cerrado</p>
            ) : (
              <p className={`font-bold text-lg font-tabular ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
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
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
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
