"use client"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from "recharts"
import { formatCurrency } from "@/lib/utils/formatters"
import { Skeleton } from "@/components/ui/skeleton"
import type { RawTransaction } from "./use-asset-calculations"

const PurchaseDot = (props: any) => {
  const { cx, cy, payload } = props
  if (payload?.isPurchase) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill="#10b981"
        stroke="#18181b"
        strokeWidth={2}
        className="animate-fade-in drop-shadow-[0_0_4px_rgba(16,185,129,0.5)]"
      />
    )
  }
  return null
}

const RANGES = [
  { label: "1D", value: "1d" },
  { label: "5D", value: "5d" },
  { label: "1M", value: "1mo" },
  { label: "6M", value: "6mo" },
  { label: "YTD", value: "ytd" },
  { label: "1A", value: "1y" },
  { label: "5A", value: "5y" },
  { label: "MAX", value: "max" }
]

interface InteractiveAssetChartProps {
  ticker: string
  moneda: string
  colorHex: string
  transactions?: RawTransaction[]
  units?: number
  historicalPnl?: { absolute: number, percent: number }
  onRangePerformanceChange?: (perf: { label: string, absolute: number, percent: number } | null) => void
}

export function InteractiveAssetChart({ ticker, moneda, colorHex, transactions = [], units = 0, historicalPnl, onRangePerformanceChange }: InteractiveAssetChartProps) {
  const [range, setRange] = useState("1mo")

  const { data, isLoading, error } = useQuery({
    queryKey: ['marketData', ticker, range],
    queryFn: async () => {
      const res = await fetch(`/api/market/${ticker}?range=${range}`)
      if (!res.ok) throw new Error("Failed to fetch market data")
      const result = await res.json()
      
      let enrichedChart = result.chart || []
      
      if (enrichedChart.length > 0) {
        // Enriquecer con compras
        if (transactions.length > 0) {
          const purchasesByDate = transactions
            .filter(t => t.tipo_operacion === 'Compra' && t.fecha)
            .reduce((acc, t) => {
              const dateStr = new Date(t.fecha).toISOString().split('T')[0]
              if (!acc[dateStr]) acc[dateStr] = []
              acc[dateStr].push(t)
              return acc
            }, {} as Record<string, RawTransaction[]>)
            
          const lastPointOfDay = new Map()
          enrichedChart.forEach((p: any, index: number) => {
            const pointDateStr = new Date(p.date).toISOString().split('T')[0]
            lastPointOfDay.set(pointDateStr, index)
          })
          
          enrichedChart = enrichedChart.map((p: any, index: number) => {
            const pointDateStr = new Date(p.date).toISOString().split('T')[0]
            const purchases = purchasesByDate[pointDateStr]
            if (purchases && lastPointOfDay.get(pointDateStr) === index) {
              const totalQty = purchases.reduce((sum, t) => sum + Number(t.cantidad), 0)
              const avgPrice = purchases.reduce((sum, t) => sum + Number(t.cantidad) * Number(t.precio_unitario), 0) / totalQty
              return {
                ...p,
                isPurchase: true,
                purchaseDetails: { qty: totalQty, price: avgPrice }
              }
            }
            return p
          })
        }
        
        // Calcular rendimiento del rango
        if (onRangePerformanceChange) {
          if (range === '1d') {
             onRangePerformanceChange(null) // Para 1D, usar el cálculo diario estándar del padre
          } else if (range === 'max' && historicalPnl) {
             onRangePerformanceChange({
               label: 'Histórico',
               absolute: historicalPnl.absolute,
               percent: historicalPnl.percent
             })
          } else {
             let effectiveFirstPrice = enrichedChart[0].price
             if (transactions.length > 0) {
               const sortedTx = [...transactions].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
               const firstTxDateStr = new Date(sortedTx[0].fecha).toISOString().split('T')[0]
               const chartStartDateStr = new Date(enrichedChart[0].date).toISOString().split('T')[0]
               
               if (new Date(firstTxDateStr) > new Date(chartStartDateStr)) {
                 const point = enrichedChart.find((p: any) => new Date(p.date).toISOString().split('T')[0] >= firstTxDateStr)
                 if (point) effectiveFirstPrice = point.price
               }
             }

             const lastPrice = enrichedChart[enrichedChart.length - 1].price
             const absoluteChange = (lastPrice - effectiveFirstPrice) * units
             const percentChange = ((lastPrice - effectiveFirstPrice) / effectiveFirstPrice) * 100
             
             const labelMap: Record<string, string> = {
               '5d': 'en 5 días',
               '1mo': 'en 1 mes',
               '6mo': 'en 6 meses',
               'ytd': 'en YTD',
               '1y': 'en 1 año',
               '5y': 'en 5 años',
               'max': 'Histórico'
             }
             
             onRangePerformanceChange({
               label: labelMap[range] || '',
               absolute: absoluteChange,
               percent: percentChange
             })
          }
        }
      } else if (onRangePerformanceChange) {
         onRangePerformanceChange(null)
      }
      
      return { ...result, chart: enrichedChart }
    },
    staleTime: 1000 * 60 * 5 // 5 minutes
  })

  return (
    <div className="w-full">
      {/* Range Selector */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2">
        {RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              range === r.value 
                ? "bg-foreground text-background" 
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="w-full h-[300px] md:h-[400px] relative">
        {isLoading ? (
          <Skeleton className="w-full h-full rounded-xl" />
        ) : error ? (
          <div className="w-full h-full flex items-center justify-center border border-border rounded-xl bg-card">
            <p className="text-muted-foreground text-sm">Error cargando gráfico</p>
          </div>
        ) : !data?.chart?.length ? (
          <div className="w-full h-full flex items-center justify-center border border-border rounded-xl bg-card">
            <p className="text-muted-foreground text-sm">No hay datos para este rango</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.chart} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`colorPrice-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colorHex} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={colorHex} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={['auto', 'auto']} hide />
              <XAxis 
                dataKey="date" 
                hide 
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const point = payload[0].payload
                  const date = new Date(point.date)
                  
                  return (
                    <div className="bg-card/95 backdrop-blur-md border border-border p-3 rounded-lg shadow-xl">
                      <p className="text-muted-foreground text-xs font-medium mb-1">
                        {range === '1d' || range === '5d' 
                          ? date.toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
                        }
                      </p>
                      <p className="text-foreground font-bold tabular-nums text-lg">
                        {formatCurrency(point.price, moneda)}
                      </p>
                      {point.isPurchase && point.purchaseDetails && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-500 mb-0.5">Compra Realizada</p>
                          <p className="text-sm font-medium text-foreground">
                            {point.purchaseDetails.qty} acciones <span className="text-muted-foreground font-normal">a {formatCurrency(point.purchaseDetails.price, moneda)}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="price" 
                stroke={colorHex} 
                strokeWidth={2} 
                fillOpacity={1} 
                fill={`url(#colorPrice-${ticker})`} 
                animationDuration={500}
                dot={<PurchaseDot />}
                activeDot={{ r: 6, strokeWidth: 0, fill: colorHex }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
