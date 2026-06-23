"use client"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts"
import { formatCurrency } from "@/lib/utils/formatters"
import { Skeleton } from "@/components/ui/skeleton"

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
}

export function InteractiveAssetChart({ ticker, moneda, colorHex }: InteractiveAssetChartProps) {
  const [range, setRange] = useState("1mo")

  const { data, isLoading, error } = useQuery({
    queryKey: ['marketData', ticker, range],
    queryFn: async () => {
      const res = await fetch(`/api/market/${ticker}?range=${range}`)
      if (!res.ok) throw new Error("Failed to fetch market data")
      return res.json()
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
                      <p className="text-foreground font-bold font-tabular text-lg">
                        {formatCurrency(point.price, moneda)}
                      </p>
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
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
