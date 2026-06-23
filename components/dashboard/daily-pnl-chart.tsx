"use client"

import { useMemo } from "react"
import { useSnapshots } from "@/lib/hooks/use-portfolio"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts"
import { formatCurrency } from "@/lib/utils/formatters"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Activity } from "lucide-react"

export function DailyPnlChart({ currentPnl24h, currentTotalValue }: { currentPnl24h?: number, currentTotalValue?: number }) {
  const { data: snapshots, isLoading } = useSnapshots()

  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) {
      if (currentTotalValue !== undefined) {
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        return [{ date: todayStr, value: currentTotalValue, pnl: currentPnl24h || 0 }]
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
        pnl = pnlToday // O puedes usar 0, pero pnlToday está bien
      }

      dataPoints.push({
        date: point.date,
        value: point.total_value, // El eje Y es el patrimonio total
        pnl: pnl // Pasamos el pnl para el tooltip
      })
    }

    if (currentTotalValue !== undefined) {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const lastPoint = dataPoints[dataPoints.length - 1]
      
      if (lastPoint && lastPoint.date === todayStr) {
        lastPoint.value = currentTotalValue
        lastPoint.pnl = currentPnl24h !== undefined ? currentPnl24h : lastPoint.pnl
      } else if (!lastPoint || lastPoint.date !== todayStr) {
        dataPoints.push({
          date: todayStr,
          value: currentTotalValue,
          pnl: currentPnl24h || 0
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

  const minVal = Math.min(...chartData.map(d => d.value))
  const maxVal = Math.max(...chartData.map(d => d.value))
  const domainPadding = Math.max(Math.abs(maxVal), Math.abs(minVal)) * 0.1 || 10

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const isPositive = data.pnl >= 0
      const formattedDate = format(parseISO(label), "d MMM yyyy", { locale: es })
      
      return (
        <div className="bg-card/90 border border-border p-4 rounded-xl shadow-xl backdrop-blur-md min-w-[170px]">
          <p className="text-muted-foreground text-xs mb-2 font-medium uppercase tracking-wider border-b border-border/50 pb-2">{formattedDate}</p>
          <div className="mb-2">
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
              Patrimonio Total
            </p>
            <p className="font-bold text-lg font-tabular text-foreground">
              {formatCurrency(data.value)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
              PnL Diario
            </p>
            <p className={`font-bold text-sm font-tabular ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPositive ? '+' : ''}{formatCurrency(data.pnl)}
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
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tickFormatter={(date) => format(parseISO(date), "d MMM", { locale: es })}
            tick={{ fill: '#71717a', fontSize: 12 }}
            dy={10}
            minTickGap={30}
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
