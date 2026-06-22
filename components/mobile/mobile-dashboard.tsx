"use client"

import { useMemo } from "react"
import { Activity, TrendingUp, TrendingDown, ChevronRight } from "lucide-react"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import {
  formatCurrency,
  formatPercent,
  formatPnl,
} from "@/lib/utils/formatters"
import { MobileAssetCard } from "@/components/mobile/mobile-asset-card"
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
} from "recharts"

interface MobileDashboardProps {
  positions: EnrichedPosition[]
  totals: PortfolioTotals
  isLoading: boolean
}

export function MobileDashboard({
  positions,
  totals,
  isLoading,
}: MobileDashboardProps) {
  const isPositive = totals.totalPnl >= 0
  const pnlColor = isPositive ? "text-emerald-400" : "text-rose-400"
  const PnlIcon = isPositive ? TrendingUp : TrendingDown

  // Build a simple portfolio sparkline from all positions
  const portfolioSparkline = useMemo(() => {
    if (positions.length === 0) return []
    const maxLen = Math.max(...positions.map((p) => p.sparkline?.length ?? 0))
    if (maxLen < 2) return []

    const combined: number[] = []
    for (let i = 0; i < maxLen; i++) {
      let sum = 0
      for (const p of positions) {
        if (p.unidades > 0 && p.sparkline && p.sparkline.length > 0) {
          const idx = Math.floor((i / maxLen) * p.sparkline.length)
          const priceAtIdx = p.sparkline[Math.min(idx, p.sparkline.length - 1)]
          sum += priceAtIdx * p.unidades
        }
      }
      combined.push(sum)
    }
    return combined.map((v, i) => ({ i, v }))
  }, [positions])

  const areaColor = isPositive ? "#34d399" : "#fb7185"

  // Sort positions by value (descending)
  const sortedPositions = useMemo(
    () =>
      [...positions].sort(
        (a, b) => (b.valor_actual ?? 0) - (a.valor_actual ?? 0)
      ),
    [positions]
  )

  // Calculate daily PnL
  const dailyPnlInfo = useMemo(() => {
    let todayValue = 0
    let yesterdayValue = 0

    for (const p of positions) {
      if (p.unidades > 0 && p.precio_actual !== null) {
        todayValue += p.unidades * p.precio_actual
        
        let yesterdayPrice = p.precio_actual
        if (p.sparkline && p.sparkline.length >= 2) {
          yesterdayPrice = p.sparkline[p.sparkline.length - 2]
        }
        
        yesterdayValue += p.unidades * yesterdayPrice
      }
    }

    if (yesterdayValue === 0) {
      return { percent: 0, isPositive: true, amount: 0 }
    }

    const diff = todayValue - yesterdayValue
    const percent = (diff / yesterdayValue) * 100
    
    return {
      percent,
      amount: diff,
      isPositive: diff >= 0
    }
  }, [positions])

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="px-5 pt-6 pb-24 space-y-6">
        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
        <div className="h-12 w-48 bg-muted rounded animate-pulse mx-auto" />
        <div className="h-32 w-full bg-muted/50 rounded-2xl animate-pulse" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-16 w-full bg-muted/50 rounded-xl animate-pulse"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="pb-28">
      {/* ─── Header ──────────────────────── */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground/80 font-semibold uppercase tracking-wider">Portfolio</p>
              <p className="text-sm font-bold text-white">Resumen Global</p>
            </div>
          </div>
          {/* Logout (subtle) */}
          <button
            onClick={async () => {
              const { createClient } = await import("@/lib/supabase/client")
              const supabase = createClient()
              await supabase.auth.signOut()
              window.location.href = "/login"
            }}
            className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground active:bg-zinc-700 transition-colors"
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>

        {/* ─── Big Number ────────────────── */}
        <div className="text-center mb-2">
          <p className="text-xs text-muted-foreground/80 uppercase tracking-widest font-semibold mb-2">
            Valor Total
          </p>
          <p className="text-4xl font-extrabold font-tabular text-white tracking-tight leading-none">
            {totals.totalValue > 0
              ? formatCurrency(totals.totalValue)
              : "0,00 €"}
          </p>

          {/* P&L pill */}
          {totals.totalCost > 0 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                  isPositive
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-rose-500/10 text-rose-400"
                }`}
              >
                <PnlIcon className="h-4 w-4" />
                {formatPnl(totals.totalPnl)}
              </div>
              <span className={`text-sm font-bold font-tabular ${pnlColor}`}>
                ({formatPercent(totals.totalPnlPercent)})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Portfolio Chart ─────────────── */}
      {portfolioSparkline.length > 1 && (
        <div className="h-28 w-full px-2 -mt-2 mb-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={portfolioSparkline}>
              <defs>
                <linearGradient id="mobileAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={areaColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={areaColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Area
                type="monotone"
                dataKey="v"
                stroke={areaColor}
                strokeWidth={2}
                fill="url(#mobileAreaGrad)"
                isAnimationActive={true}
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── Quick Stats Row ─────────────── */}
      <div className="flex gap-3 px-5 mb-5">
        <div className="flex-1 bg-card backdrop-blur-sm border border-border rounded-2xl p-4">
          <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold">
            Invertido
          </p>
          <p className="text-lg font-bold font-tabular text-white mt-1">
            {totals.totalCost > 0 ? formatCurrency(totals.totalCost) : "—"}
          </p>
        </div>
        <div className="flex-1 bg-card backdrop-blur-sm border border-border rounded-2xl p-4">
          <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold">
            Rent. Hoy
          </p>
          <p className={`text-lg font-bold font-tabular mt-1 ${dailyPnlInfo.isPositive ? "text-emerald-400" : "text-rose-400"}`}>
            {dailyPnlInfo.percent !== 0 ? formatPercent(dailyPnlInfo.percent) : "—"}
          </p>
        </div>
      </div>

      {/* ─── Assets List ─────────────────── */}
      <div className="px-5 mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Tus Activos
        </h2>
      </div>

      <div className="bg-card/30 border-y border-border/30">
        {sortedPositions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground/60">
            <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium text-muted-foreground/80">Sin posiciones</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Pulsa el botón + para añadir tu primer activo
            </p>
          </div>
        ) : (
          sortedPositions.map((p) => (
            <MobileAssetCard key={p.activo_id} position={p} />
          ))
        )}
      </div>
    </div>
  )
}
