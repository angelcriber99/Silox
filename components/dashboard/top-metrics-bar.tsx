"use client"

import { useState } from "react"
import { formatPercent, formatPnl } from "@/lib/utils/formatters"
import { TrendingUp, TrendingDown, TriangleAlert } from "lucide-react"
import { usePreferences } from "@/lib/stores/use-preferences"
import type { PortfolioTotals, EnrichedPosition } from "@/lib/types"
import { useDisplayCurrency } from "@/lib/hooks/use-display-currency"
import { formatCurrency } from "@/lib/utils/formatters"
import { PerformanceModal } from "@/components/dashboard/performance-modal"

interface TopMetricsBarProps {
  totals: PortfolioTotals
  positions: EnrichedPosition[]
  marketState: string
  loading?: boolean
}

export function TopMetricsBar({ totals, positions, marketState, loading = false }: TopMetricsBarProps) {
  const { hideBalances } = usePreferences()
  const { displayCurrency, convert, format: formatDisplay } = useDisplayCurrency()

  if (loading) {
    return (
      <div className="w-full flex flex-col gap-4 h-40 bg-card/40 border border-border/50 rounded-2xl p-5 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-2" />
        <div className="h-10 w-64 bg-muted rounded" />
        <div className="w-full h-px bg-border/40 my-2" />
        <div className="flex justify-between">
          <div className="h-6 w-32 bg-muted rounded" />
          <div className="h-6 w-32 bg-muted rounded" />
        </div>
      </div>
    )
  }

  const primaryCost = totals.netContributionsMoney?.amount ?? totals.costMoney.amount
  const displayPnl = totals.valueMoney.amount - primaryCost
  const displayPnlPercent = primaryCost > 0 ? (displayPnl / primaryCost) * 100 : 0
  const isPositive = displayPnl >= 0
  
  const daily24Positive = totals.pnl24hMoney.amount >= 0

  return (
    <div className="w-full flex flex-col gap-6 px-2 py-2">
      {/* Hero Value Section (No card, elegant list style) */}
      <div className="flex flex-col items-start gap-2 border-l-4 border-primary pl-4 relative">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
            Valor del Portfolio
          </span>
          {marketState !== 'REGULAR' && (
            <div className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
              {marketState === 'CLOSED' ? 'Cerrado' : marketState === 'PRE' ? 'Pre-Market' : 'Post-Market'}
            </div>
          )}
        </div>
        
        <div className="text-4xl xl:text-5xl font-black tracking-tighter leading-none text-foreground flex items-end gap-2">
          <span>{hideBalances ? "****" : formatCurrency(convert(totals.valueMoney.amount), displayCurrency)}</span>
        </div>
        {!totals.hasAllPrices && (
          <span className="text-[10px] font-semibold text-amber-500 flex items-center gap-1 mt-1">
            <TriangleAlert className="w-3 h-3" /> Precios pendientes
          </span>
        )}
      </div>

      {/* Modern PnL Grid */}
      <div className="grid grid-cols-2 gap-3 mt-2">
        {/* Total Historical */}
        <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/30 border border-border/50">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Histórico Total</span>
          <div
            className="flex items-center gap-1.5 mt-1"
            style={{ color: isPositive ? "#30D158" : "#FF453A" }}
          >
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="text-base font-bold tabular-nums tracking-tight">
              {hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatDisplay(displayPnl)}`}
            </span>
          </div>
          <span className="text-xs font-semibold opacity-80" style={{ color: isPositive ? "#30D158" : "#FF453A" }}>
            {hideBalances ? "•••" : formatPercent(displayPnlPercent)}
          </span>
        </div>

        {/* Daily (Hoy) */}
        <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/30 border border-border/50">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Hoy</span>
          <div
            className="flex items-center gap-1.5 mt-1"
            style={{ color: daily24Positive ? "rgba(48,209,88,0.95)" : "rgba(255,69,58,0.95)" }}
          >
            {daily24Positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="text-base font-bold tabular-nums tracking-tight">
              {hideBalances ? "••••" : `${daily24Positive ? "+" : ""}${formatDisplay(totals.pnl24hMoney.amount)}`}
            </span>
          </div>
          <span className="text-xs font-semibold opacity-80" style={{ color: daily24Positive ? "rgba(48,209,88,0.95)" : "rgba(255,69,58,0.95)" }}>
            {hideBalances ? "•••" : formatPercent(totals.totalDailyPnlPercent)}
          </span>
        </div>
      </div>

      {/* Contributions Pill */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-card border shadow-sm mt-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">FIFO</span>
          <span className="text-sm font-bold tabular-nums text-foreground/80">
            {hideBalances ? "•••••" : formatDisplay(totals.costMoney.amount)}
          </span>
        </div>
        
        <div className="w-px h-4 bg-border" />

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Aportado</span>
          <span className="text-sm font-bold tabular-nums text-foreground">
            {hideBalances ? "•••••" : formatDisplay(totals.netContributionsMoney?.amount ?? totals.costMoney.amount)}
          </span>
        </div>
      </div>
    </div>
  )
}
