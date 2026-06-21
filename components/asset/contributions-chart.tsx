"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { formatCurrency } from "@/lib/utils/formatters"
import { TrendingUp, History } from "lucide-react"

interface Transaction {
  id: string
  fecha: string
  tipo: "COMPRA" | "VENTA"
  unidades: number
  precio_unitario: number
  total_invertido: number
  moneda: string
}

interface ContributionsChartProps {
  transactions: Transaction[]
  currentPrice: number | null
}

export function ContributionsChart({ transactions, currentPrice }: ContributionsChartProps) {
  const data = useMemo(() => {
    if (!transactions || transactions.length === 0) return []

    // Sort ascending by date
    const sorted = [...transactions].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    
    let accumulatedUnits = 0
    let accumulatedCost = 0
    const points = []

    for (const tx of sorted) {
      if (tx.tipo === "COMPRA") {
        accumulatedUnits += tx.unidades
        accumulatedCost += tx.total_invertido
      } else if (tx.tipo === "VENTA") {
        accumulatedUnits -= tx.unidades
        accumulatedCost -= tx.total_invertido 
      }

      const marketValueAtDate = accumulatedUnits * tx.precio_unitario

      points.push({
        date: new Date(tx.fecha).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
        rawDate: tx.fecha,
        invested: Math.max(0, accumulatedCost),
        value: Math.max(0, marketValueAtDate)
      })
    }

    // Add current point if we have a current price
    if (currentPrice !== null && points.length > 0) {
      points.push({
        date: "Actual",
        rawDate: new Date().toISOString(),
        invested: Math.max(0, accumulatedCost),
        value: Math.max(0, accumulatedUnits * currentPrice)
      })
    }

    return points
  }, [transactions, currentPrice])

  if (data.length === 0) return null

  return (
    <Card className="bg-zinc-900/60 border-zinc-800/60 backdrop-blur-sm animate-fade-in stagger-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <History className="h-5 w-5 text-blue-400" />
          Evolución Histórica
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Comparativa entre el capital que has aportado y el valor de mercado en el momento de cada operación.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                stroke="#52525b" 
                tick={{fill: '#a1a1aa', fontSize: 12}} 
                tickMargin={10}
                minTickGap={30}
              />
              <YAxis 
                stroke="#52525b" 
                tick={{fill: '#a1a1aa', fontSize: 12}}
                tickFormatter={(val) => `€${(val/1000).toFixed(1)}k`}
                width={60}
              />
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const value = payload[0].value as number
                    const invested = payload[1]?.value as number
                    const diff = value - invested
                    const isPositive = diff >= 0

                    return (
                      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-2xl">
                        <p className="text-zinc-300 text-sm mb-3 font-medium border-b border-zinc-800 pb-2">{label}</p>
                        <div className="space-y-2">
                          <div className="flex justify-between gap-4">
                            <span className="text-emerald-400 text-sm font-medium">Valor Mercado:</span>
                            <span className="text-emerald-400 text-sm font-bold font-tabular">
                              {formatCurrency(value)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-blue-400 text-sm font-medium">Aportado:</span>
                            <span className="text-blue-400 text-sm font-bold font-tabular">
                              {formatCurrency(invested)}
                            </span>
                          </div>
                          <div className="pt-2 mt-2 border-t border-zinc-800 flex justify-between gap-4">
                            <span className="text-zinc-400 text-xs font-medium">Beneficio latente:</span>
                            <span className={`text-xs font-bold font-tabular ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isPositive ? '+' : ''}{formatCurrency(diff)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#10b981" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorValue)" 
                name="Valor Mercado"
                animationDuration={1500}
              />
              <Area 
                type="stepAfter" 
                dataKey="invested" 
                stroke="#3b82f6" 
                strokeWidth={2}
                strokeDasharray="4 4"
                fillOpacity={1} 
                fill="url(#colorInvested)" 
                name="Total Aportado"
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
