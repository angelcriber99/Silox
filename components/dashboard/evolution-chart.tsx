"use client"

import { useMemo } from "react"
import { useAllTransactions } from "@/lib/hooks/use-transactions"
import { useSnapshots } from "@/lib/hooks/use-portfolio"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatCurrency } from "@/lib/utils/formatters"
import { format, parseISO, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { TrendingUp, Activity } from "lucide-react"

export function EvolutionChart() {
  const { data: transactions, isLoading: txLoading } = useAllTransactions()
  const { data: snapshots, isLoading: snapshotsLoading } = useSnapshots()

  const isLoading = txLoading || snapshotsLoading

  const chartData = useMemo(() => {
    if (!transactions || transactions.length === 0) return []

    // Calculate daily invested capital from transactions
    const sortedTx = [...transactions].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    let runningCapital = 0
    const txDataPoints: Record<string, number> = {}

    sortedTx.forEach(tx => {
      const dateKey = tx.fecha.split('T')[0]
      const txValue = (tx.cantidad * tx.precio_unitario)
      
      if (tx.tipo_operacion === "Compra") {
        runningCapital += (txValue + tx.comision)
      } else {
        runningCapital -= (txValue - tx.comision)
        if (runningCapital < 0) runningCapital = 0
      }
      txDataPoints[dateKey] = runningCapital
    })

    // Create a unified timeline
    // We want data points for every date we have a transaction OR a snapshot
    const allDates = new Set([
      ...Object.keys(txDataPoints),
      ...(snapshots?.map(s => s.date) || [])
    ])

    const sortedDates = Array.from(allDates).sort()

    // Fill in missing values and combine
    let lastInvested = 0
    let lastValue: number | null = null

    return sortedDates.map(date => {
      if (txDataPoints[date] !== undefined) {
        lastInvested = txDataPoints[date]
      }
      
      const snapshot = snapshots?.find(s => s.date === date)
      if (snapshot) {
        lastValue = snapshot.total_value
        // Optionally trust snapshot's total_invested over calculated runningCapital
        // but since snapshots are new, calculating from transactions is more reliable for old dates.
      } else {
        lastValue = null // Don't chart values we don't have
      }

      return {
        date,
        invested: lastInvested,
        value: lastValue
      }
    })

  }, [transactions, snapshots])

  if (isLoading) {
    return (
      <div className="bg-card/40 border border-border rounded-xl p-6 h-[400px] flex items-center justify-center backdrop-blur-sm">
        <div className="animate-pulse flex flex-col items-center gap-3 text-muted-foreground/80">
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
      
      const investedObj = payload.find((p: any) => p.dataKey === 'invested')
      const valueObj = payload.find((p: any) => p.dataKey === 'value')

      return (
        <div className="bg-card/90 border border-border p-4 rounded-xl shadow-xl backdrop-blur-md min-w-[200px]">
          <p className="text-muted-foreground text-xs mb-3 font-medium uppercase tracking-wider border-b border-border/50 pb-2">{formattedDate}</p>
          
          <div className="space-y-3">
            {valueObj && valueObj.value !== null && (
              <div>
                <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Valor Real
                </p>
                <p className="text-foreground font-bold text-lg font-tabular mt-0.5">
                  {formatCurrency(valueObj.value)}
                </p>
              </div>
            )}

            {investedObj && (
              <div>
                <p className="text-blue-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  Capital Invertido
                </p>
                <p className="text-foreground/80 font-semibold text-sm font-tabular mt-0.5">
                  {formatCurrency(investedObj.value)}
                </p>
              </div>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-card/40 border border-border rounded-xl p-6 backdrop-blur-sm overflow-hidden relative group">
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-500" />
          Evolución del Portfolio
        </h3>
        <p className="text-sm text-muted-foreground mt-1">Rentabilidad histórica (Valor vs Invertido)</p>
      </div>

      <div className="h-[350px] w-full mt-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
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
              dataKey="invested" 
              stroke="#3b82f6" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorInvested)" 
              animationDuration={1500}
            />
            
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#10b981" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorValue)" 
              animationDuration={1500}
              connectNulls={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
