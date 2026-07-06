"use client"

import { useMemo } from "react"
import { Transaccion } from "@/lib/types"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts"
import { formatCurrency } from "@/lib/utils/formatters"

interface MonthlyChartProps {
  transactions: Transaccion[]
  year: number
}

const MONTHS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun", 
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
]

export function MonthlyChart({ transactions, year }: MonthlyChartProps) {
  const data = useMemo(() => {
    // Initialize months
    const monthlyData = MONTHS.map(month => ({
      name: month,
      Compras: 0,
      Ventas: 0
    }))

    transactions.forEach(tx => {
      const date = new Date(tx.fecha)
      if (date.getFullYear() !== year) return
      
      const monthIndex = date.getMonth()
      const total = (tx.cantidad * tx.precio_unitario)
      
      if (tx.tipo_operacion === 'Compra') {
        monthlyData[monthIndex].Compras += total + (tx.comision || 0)
      } else if (tx.tipo_operacion === 'Venta') {
        monthlyData[monthIndex].Ventas += total - (tx.comision || 0)
      }
    })

    return monthlyData
  }, [transactions, year])

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
        <XAxis 
          dataKey="name" 
          stroke="var(--muted-foreground)" 
          fontSize={12}
          tickLine={false}
          axisLine={false}
          dy={10}
        />
        <YAxis 
          stroke="var(--muted-foreground)" 
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)}
          width={80}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-card/95 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-2xl min-w-[200px]">
                  <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-3 pb-2 border-b border-white/10">{label} {year}</p>
                  <div className="space-y-3">
                    {payload.map((entry: any, index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span className="text-sm font-medium text-foreground">{entry.name}</span>
                        </div>
                        <span className="text-sm font-bold font-tabular" style={{ color: entry.color }}>
                          {formatCurrency(entry.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
            return null
          }}
        />
        <Legend 
          wrapperStyle={{ paddingTop: '20px' }}
          iconType="circle"
        />
        <Bar 
          dataKey="Compras" 
          fill="#10b981" 
          radius={[4, 4, 0, 0]} 
          maxBarSize={40}
        />
        <Bar 
          dataKey="Ventas" 
          fill="#f43f5e" 
          radius={[4, 4, 0, 0]} 
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
