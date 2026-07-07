"use client"

import { useEffect, useState, useMemo } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { fetchAllTransactionsForTax } from "@/lib/api/transactions"
import type { Transaccion } from "@/lib/types"
import { formatCurrency } from "@/lib/utils/formatters"
import { Loader2 } from "lucide-react"

interface ChartDataPoint {
  month: string
  invested: number
  dateObj: Date
}

export function HistoricalChart() {
  const [data, setData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const txs = await fetchAllTransactionsForTax()
        
        // Group by month
        const monthlyData = new Map<string, number>() // YYYY-MM -> net invested
        let cumulativeInvested = 0
        
        // Sort explicitly by date to be sure
        const sorted = [...txs].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

        for (const tx of sorted) {
          const date = new Date(tx.fecha)
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          
          let amount = tx.cantidad * tx.precio_unitario + (tx.comision || 0)
          
          if (tx.tipo_operacion === 'Compra') {
            cumulativeInvested += amount
          } else if (tx.tipo_operacion === 'Venta') {
            cumulativeInvested -= amount
          }
          
          monthlyData.set(monthKey, cumulativeInvested)
        }

        // Fill gaps between first and last month
        if (monthlyData.size > 0) {
          const keys = Array.from(monthlyData.keys()).sort()
          const firstMonth = new Date(keys[0] + "-01")
          const lastMonth = new Date() // up to today
          
          const finalData: ChartDataPoint[] = []
          let lastKnownValue = 0

          let currentMonth = new Date(firstMonth)
          while (currentMonth <= lastMonth) {
            const key = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
            if (monthlyData.has(key)) {
              lastKnownValue = monthlyData.get(key)!
            }
            finalData.push({
              month: currentMonth.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
              invested: lastKnownValue,
              dateObj: new Date(currentMonth)
            })
            currentMonth.setMonth(currentMonth.getMonth() + 1)
          }
          setData(finalData)
        }
      } catch (e) {
        console.error("Error loading historical data", e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-card/30 border border-border/50 rounded-2xl">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-card/30 border border-border/50 rounded-2xl">
        <p className="text-muted-foreground">No hay datos suficientes para dibujar el gráfico.</p>
      </div>
    )
  }

  const currentValue = data[data.length - 1].invested

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Capital Invertido Histórico</h2>
        <div className="text-3xl font-bold text-foreground">
          {formatCurrency(currentValue)}
        </div>
      </div>
      
      <div className="w-full h-[400px] bg-card/10 border border-border/30 rounded-3xl p-6 relative group overflow-hidden">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 -z-10" />
        
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
              dy={10}
              minTickGap={30}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
              tickFormatter={(val) => `€${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
              dx={-5}
              width={55}
              domain={['dataMin - (dataMin * 0.05)', 'dataMax + (dataMax * 0.05)']}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-card/90 backdrop-blur-xl border border-border/50 p-4 rounded-xl shadow-xl">
                      <p className="text-sm text-muted-foreground mb-1">{payload[0].payload.month}</p>
                      <p className="text-xl font-bold text-foreground">
                        {formatCurrency(payload[0].value as number)}
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Area 
              type="linear" 
              dataKey="invested" 
              stroke="var(--primary)" 
              strokeWidth={2.5}
              fillOpacity={1} 
              fill="url(#colorInvested)" 
              activeDot={{ r: 6, fill: "var(--primary)", stroke: "hsl(var(--background))", strokeWidth: 3 }}
              dot={data.length <= 45 ? { r: 3, fill: "hsl(var(--background))", stroke: "var(--primary)", strokeWidth: 2 } : false}
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
