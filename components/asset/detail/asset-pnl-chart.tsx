"use client"
import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from "recharts"
import { formatCurrency } from "@/lib/utils/formatters"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchAssetHistoricalPerformance } from "@/lib/actions/asset-history"
import { PerformanceRange } from "@/lib/utils/performance-history"
import { cn } from "@/lib/utils"

const RANGES: { label: string, value: PerformanceRange }[] = [
  { label: "1D", value: "1D" },
  { label: "1S", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "1A", value: "1Y" },
  { label: "MAX", value: "ALL" }
]

interface AssetPnlChartProps {
  assetId: string
  colorHex?: string
}

export function AssetPnlChart({ assetId, colorHex = "#10b981" }: AssetPnlChartProps) {
  const [range, setRange] = useState<PerformanceRange>("1M")

  const { data, isLoading, error } = useQuery({
    queryKey: ['asset-pnl-history', assetId, range],
    queryFn: () => fetchAssetHistoricalPerformance(assetId, range),
    staleTime: 5 * 60_000,
  })

  const { isPositive, currentPnl } = useMemo(() => {
    if (!data || data.length === 0) return { isPositive: true, currentPnl: 0 }
    
    let currentPnl = data[data.length - 1].pnl
    
    // For specific ranges, we calculate the relative PnL from the start of the range
    if (range !== "ALL" && data.length > 0) {
      const firstPnl = data[0].pnl
      currentPnl = currentPnl - firstPnl
    }
    
    return {
      isPositive: currentPnl >= 0,
      currentPnl
    }
  }, [data, range])

  const dynamicColor = isPositive ? "#10b981" : "#f43f5e"

  if (error) {
    return (
      <div className="h-[250px] md:h-[350px] w-full flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
        Error cargando el beneficio histórico
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Rango y Métricas */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">
            Beneficio {range === "ALL" ? "Total" : "del periodo"}
          </p>
          <div className={cn(
            "text-2xl md:text-3xl font-bold tracking-tight",
            isPositive ? "text-emerald-500" : "text-rose-500"
          )}>
            {currentPnl > 0 ? "+" : ""}{formatCurrency(currentPnl, "EUR")}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/40 rounded-lg">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={cn(
                "px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all duration-200",
                range === r.value
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gráfica */}
      <div className="h-[250px] md:h-[350px] w-full">
        {isLoading ? (
          <Skeleton className="w-full h-full rounded-xl" />
        ) : !data || data.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
            No hay suficientes datos
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={dynamicColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={dynamicColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.2} />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#888' }}
                tickFormatter={(val) => {
                  if (!val) return ''
                  const d = new Date(val)
                  return range === '1D' || range === '1W'
                    ? d.toLocaleDateString("es-ES", { weekday: 'short' })
                    : d.toLocaleDateString("es-ES", { month: 'short', day: 'numeric' })
                }}
                minTickGap={30}
              />
              <YAxis 
                domain={['auto', 'auto']}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#888' }}
                tickFormatter={(val) => formatCurrency(val, "EUR")}
                width={60}
                orientation="right"
              />
              <ReferenceLine y={0} stroke="#888" strokeDasharray="3 3" opacity={0.5} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const data = payload[0].payload
                  return (
                    <div className="rounded-xl border border-border/50 bg-background/95 backdrop-blur-md p-3 shadow-xl">
                      <p className="text-xs text-muted-foreground mb-2">
                        {new Date(data.date).toLocaleDateString("es-ES", {
                          weekday: 'short', year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </p>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-sm font-medium">Beneficio:</span>
                          <span className={cn("text-sm font-bold", data.pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {data.pnl > 0 ? "+" : ""}{formatCurrency(data.pnl, "EUR")}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-xs text-muted-foreground">Valor Posición:</span>
                          <span className="text-xs">{formatCurrency(data.value, "EUR")}</span>
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="pnl"
                stroke={dynamicColor}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorPnl)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
