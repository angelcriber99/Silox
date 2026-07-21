"use client"
import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts"
import { formatCurrency } from "@/lib/utils/formatters"
import { Skeleton } from "@/components/ui/skeleton"
import type { RawTransaction } from "./use-asset-calculations"
import { usePreferences } from "@/lib/stores/use-preferences"
import { calculateAssetPeriodPerformance } from "@/lib/utils/asset-period-performance"

interface AssetChartPoint {
  date: string
  price: number
  purchases?: RawTransaction[]
  isPurchase?: boolean
  purchaseDetails?: { qty: number; price: number }
}

interface AssetChartResponse {
  chart: AssetChartPoint[]
  [key: string]: unknown
}

const PurchaseDot = (props: { cx?: number; cy?: number; payload?: AssetChartPoint }) => {
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

export function InteractiveAssetChart({ ticker, moneda, colorHex, transactions = [], historicalPnl, onRangePerformanceChange }: InteractiveAssetChartProps) {
  const [range, setRange] = useState("1mo")
  const { refreshInterval, pauseUpdatesWhenHidden } = usePreferences()
  const historicalAbsolute = historicalPnl?.absolute
  const historicalPercent = historicalPnl?.percent
  const transactionKey = useMemo(
    () => transactions.map((transaction) => `${transaction.id}:${transaction.fecha}:${transaction.tipo_operacion}:${transaction.cantidad}:${transaction.precio_unitario}`).join("|"),
    [transactions],
  )

  const { data, isLoading, error } = useQuery<AssetChartResponse>({
    queryKey: ['marketData', ticker, range, transactionKey],
    queryFn: async () => {
      const res = await fetch(`/api/market/${ticker}?range=${range}`)
      if (!res.ok) throw new Error("Failed to fetch market data")
      const result = await res.json() as AssetChartResponse
      
      let enrichedChart: AssetChartPoint[] = result.chart || []
      
      if (enrichedChart.length > 0) {
        // Enriquecer con compras
        if (transactions.length > 0) {
          const purchases = transactions.filter(t => 
            (t.tipo_operacion === 'Compra' || t.tipo_operacion === 'Traspaso Entrada' || t.tipo_operacion === 'Aportación') && t.fecha
          )
          
          if (purchases.length > 0) {
            purchases.forEach(t => {
              const txTime = new Date(t.fecha).getTime()
              let closestIdx = -1
              let minDiff = Infinity
              
              enrichedChart.forEach((p, index) => {
                const pTime = new Date(p.date).getTime()
                const diff = Math.abs(pTime - txTime)
                if (diff < minDiff) {
                  minDiff = diff
                  closestIdx = index
                }
              })
              
              // Only attach if within a reasonable threshold (e.g., 4 days)
              // to avoid showing a purchase on a chart range that doesn't contain it
              if (closestIdx !== -1 && minDiff < 4 * 24 * 60 * 60 * 1000) {
                const point = enrichedChart[closestIdx]
                if (point) point.purchases = [...(point.purchases ?? []), t]
              }
            })
            
            enrichedChart = enrichedChart.map((p) => {
              if (p.purchases && p.purchases.length > 0) {
                const totalQty = p.purchases.reduce((sum, transaction) => sum + Number(transaction.cantidad), 0)
                const avgPrice = p.purchases.reduce((sum, transaction) => sum + (Number(transaction.cantidad) * Number(transaction.precio_unitario || p.price)), 0) / totalQty
                return {
                  ...p,
                  isPurchase: true,
                  purchaseDetails: { qty: totalQty, price: avgPrice }
                }
              }
              return p
            })
          }
        }
        
      }
      
      return { ...result, chart: enrichedChart }
    },
    staleTime: range === '1d' || range === '5d' ? Math.min(refreshInterval, 10_000) : 5 * 60_000,
    refetchInterval: range === '1d' || range === '5d' ? refreshInterval : false,
    refetchIntervalInBackground: !pauseUpdatesWhenHidden,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  })

  useEffect(() => {
    if (!onRangePerformanceChange || range === "1d") {
      onRangePerformanceChange?.(null)
      return
    }

    const performance = calculateAssetPeriodPerformance(data?.chart ?? [], transactions)
    const labelMap: Record<string, string> = {
      "5d": "en 5 días",
      "1mo": "en 1 mes",
      "6mo": "en 6 meses",
      "ytd": "en YTD",
      "1y": "en 1 año",
      "5y": "en 5 años",
      "max": "Histórico",
    }

    if (performance) {
      onRangePerformanceChange({
        label: labelMap[range] ?? "",
        absolute: performance.absolute,
        percent: performance.percent,
      })
    } else if (range === "max" && historicalAbsolute !== undefined && historicalPercent !== undefined) {
      onRangePerformanceChange({ label: "Histórico", absolute: historicalAbsolute, percent: historicalPercent })
    } else {
      onRangePerformanceChange(null)
    }
  }, [data?.chart, historicalAbsolute, historicalPercent, onRangePerformanceChange, range, transactions])

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
                  const point = payload[0].payload as AssetChartPoint
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
