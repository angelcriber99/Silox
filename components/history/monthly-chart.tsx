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
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
        <XAxis 
          dataKey="name" 
          stroke="hsl(var(--muted-foreground))" 
          fontSize={12}
          tickLine={false}
          axisLine={false}
          dy={10}
        />
        <YAxis 
          stroke="hsl(var(--muted-foreground))" 
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `€${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            borderColor: 'hsl(var(--border))',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            color: 'hsl(var(--foreground))'
          }}
          formatter={(value: any) => [formatCurrency(Number(value) || 0), undefined]}
          labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
        />
        <Legend 
          wrapperStyle={{ paddingTop: '20px' }}
          iconType="circle"
        />
        <Bar 
          dataKey="Compras" 
          fill="#3b82f6" 
          radius={[4, 4, 0, 0]} 
          maxBarSize={40}
        />
        <Bar 
          dataKey="Ventas" 
          fill="#a855f7" 
          radius={[4, 4, 0, 0]} 
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
