"use client"

import { useMemo } from "react"
import { Activity, TrendingUp, TrendingDown, ChevronRight, LogOut } from "lucide-react"
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
import { usePreferences } from "@/lib/stores/use-preferences"
import { playSound } from "@/lib/utils/sounds"

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
  const { zenMode, soundEffects } = usePreferences()
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
    <div className={`pb-28 flex flex-col ${zenMode ? 'justify-center min-h-[85vh]' : ''}`}>
      {/* ─── Header ──────────────────────── */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 transition-colors">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground/80 font-semibold uppercase tracking-wider">Portfolio</p>
              <p className="text-sm font-bold text-foreground">Resumen Global</p>
            </div>
          </div>
          {/* Logout (subtle) */}
          <button
            onClick={async () => {
              if (soundEffects) playSound('click')
              const { createClient } = await import("@/lib/supabase/client")
              const supabase = createClient()
              await supabase.auth.signOut()
              window.location.href = "/login"
            }}
            className="h-10 w-10 rounded-xl bg-muted/50 backdrop-blur-md border border-border/50 flex items-center justify-center text-muted-foreground active:bg-zinc-700 transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* ─── Big Number ────────────────── */}
        <div className="text-center mb-6">
          <p className="text-xs text-muted-foreground/80 uppercase tracking-widest font-semibold mb-2">
            Valor Total
          </p>
          <p className={`font-extrabold font-tabular text-foreground tracking-tight leading-none transition-all ${zenMode ? 'text-5xl my-4' : 'text-4xl'}`}>
            {totals.totalValue > 0
              ? formatCurrency(totals.totalValue)
              : "0,00 €"}
          </p>

          {/* P&L pill */}
          {totals.totalCost > 0 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
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
        <div className={`w-full px-2 mb-4 transition-all ${zenMode ? 'h-48 mt-4' : 'h-28 -mt-2'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={portfolioSparkline}>
              <defs>
                <linearGradient id="mobileAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={areaColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={areaColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Area
                type="monotone"
                dataKey="v"
                stroke={areaColor}
                strokeWidth={2.5}
                fill="url(#mobileAreaGrad)"
                isAnimationActive={true}
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Conditionally hide the rest if Zen Mode is on */}
      {!zenMode && (
        <div className="animate-fade-in">
          {/* ─── Quick Stats Row ─────────────── */}
          <div className="flex gap-3 px-5 mb-6">
            <div className="flex-1 bg-card/40 backdrop-blur-xl border border-border/50 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold">
                Invertido
              </p>
              <p className="text-lg font-bold font-tabular text-foreground mt-1">
                {totals.totalCost > 0 ? formatCurrency(totals.totalCost) : "—"}
              </p>
            </div>
            <div className="flex-1 bg-card/40 backdrop-blur-xl border border-border/50 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold">
                Rent. Hoy
              </p>
              <p className={`text-lg font-bold font-tabular mt-1 ${dailyPnlInfo.isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                {dailyPnlInfo.percent !== 0 ? formatPercent(dailyPnlInfo.percent) : "—"}
              </p>
            </div>
          </div>

          {/* ─── Assets List ─────────────────── */}
          <div className="px-5 mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Tus Activos
            </h2>
          </div>

          <div className="bg-card/30 border-y border-border/30 divide-y divide-border/20">
            {sortedPositions.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground/60">
                <Activity className="h-10 w-10 mx-auto mb-3 opacity-40 text-primary" />
                <p className="font-medium text-foreground">Sin posiciones</p>
                <p className="text-xs mt-1">
                  Añade tu primer activo desde el dashboard web
                </p>
              </div>
            ) : (
              sortedPositions.map((p) => (
                <MobileAssetCard key={p.activo_id} position={p} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
