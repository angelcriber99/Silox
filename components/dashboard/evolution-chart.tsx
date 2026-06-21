"use client"

import { useMemo } from "react"
import { useAllTransactions } from "@/lib/hooks/use-transactions"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatCurrency } from "@/lib/utils/formatters"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { TrendingUp, Activity } from "lucide-react"

export function EvolutionChart() {
  const { data: transactions, isLoading } = useAllTransactions()

  const chartData = useMemo(() => {
    if (!transactions || transactions.length === 0) return []

    // Sort transactions by date ascending
    const sorted = [...transactions].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

    let runningCapital = 0
    const dataPoints: Record<string, number> = {}

    // Group by month/year or just by exact date if not too many. 
    // Since transactions can be few, we can just plot them by date.
    sorted.forEach(tx => {
      const dateKey = tx.fecha.split('T')[0]
      const txValue = (tx.cantidad * tx.precio_unitario)
      
      if (tx.tipo_operacion === "Compra") {
        runningCapital += (txValue + tx.comision)
      } else {
        runningCapital -= (txValue - tx.comision)
        if (runningCapital < 0) runningCapital = 0 // prevent negative baseline anomalies
      }
      dataPoints[dateKey] = runningCapital
    })

    // Convert to array
    return Object.entries(dataPoints).map(([date, value]) => ({
      date,
      value
    }))
  }, [transactions])

  if (isLoading) {
    return (
      <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 h-[400px] flex items-center justify-center backdrop-blur-sm">
        <div className="animate-pulse flex flex-col items-center gap-3 text-zinc-500">
          <Activity className="h-8 w-8 animate-bounce" />
          <p>Calculando evolución histórica...</p>
        </div>
      </div>
    )
  }

  if (chartData.length === 0) return null

  // Format tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const formattedDate = format(parseISO(label), "d MMM yyyy", { locale: es })
      return (
        <div className="bg-zinc-900/90 border border-zinc-700 p-4 rounded-xl shadow-xl backdrop-blur-md">
          <p className="text-zinc-400 text-xs mb-1 font-medium uppercase tracking-wider">{formattedDate}</p>
          <p className="text-white font-bold text-xl font-tabular">
            {formatCurrency(payload[0].value)}
          </p>
          <p className="text-blue-400/80 text-xs mt-1">Capital Depositado Neto</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 backdrop-blur-sm overflow-hidden relative group">
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          Evolución del Capital
        </h3>
        <p className="text-sm text-zinc-400 mt-1">Crecimiento histórico de depósitos netos</p>
      </div>

      <div className="h-[350px] w-full mt-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tickFormatter={(date) => format(parseISO(date), "MMM yy", { locale: es })}
              tick={{ fill: '#71717a', fontSize: 12 }}
              dy={10}
              minTickGap={30}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3f3f46', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#3b82f6" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorValue)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
