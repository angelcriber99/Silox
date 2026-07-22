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
    <div className="w-full flex flex-col gap-4 px-1">
      {/* Top section: Value */}
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-80">
            Valor del Portfolio
          </span>
          {marketState !== 'REGULAR' && (
            <div className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border/50">
              {marketState === 'CLOSED' ? 'Cerrado' : marketState === 'PRE' ? 'Pre-Market' : 'Post-Market'}
            </div>
          )}
        </div>
        
        <div className="text-3xl xl:text-4xl font-bold tracking-tight leading-none text-foreground flex items-end gap-2">
          <span>{hideBalances ? "****" : formatCurrency(convert(totals.valueMoney.amount), displayCurrency)}</span>
          {!totals.hasAllPrices && (
            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border text-amber-400/70 border-amber-500/20 bg-amber-500/5">
              Precios pendientes
            </span>
          )}
        </div>
      </div>

      <div className="w-full h-px bg-border/40" />

      {/* PnL Metrics */}
      <div className="flex flex-col gap-4">
        {/* Total Historical */}
        <div className="flex flex-col items-start gap-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Histórico Total</span>
          <div
            className="flex items-center gap-1.5"
            style={{ color: isPositive ? "#30D158" : "#FF453A" }}
          >
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="text-[15px] font-bold tabular-nums tracking-tight">
              {hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatDisplay(displayPnl)}`}
            </span>
            <span className="text-[12px] font-semibold opacity-80">
              ({hideBalances ? "•••" : formatPercent(displayPnlPercent).replace('+', '')})
            </span>
          </div>
        </div>

        <div className="w-full h-px bg-border/40" />

        {/* Daily (Hoy) */}
        <div className="flex flex-col items-start gap-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Hoy</span>
          <div
            className="flex items-center gap-1.5"
            style={{ color: daily24Positive ? "rgba(48,209,88,0.95)" : "rgba(255,69,58,0.95)" }}
          >
            {daily24Positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="text-[15px] font-bold tabular-nums tracking-tight">
              {hideBalances ? "••••" : `${daily24Positive ? "+" : ""}${formatDisplay(totals.pnl24hMoney.amount)}`}
            </span>
            <span className="text-[12px] font-semibold opacity-80">
              ({hideBalances ? "•••" : formatPercent(totals.totalDailyPnlPercent).replace('+', '')})
            </span>
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-border/40" />

      {/* Contributions */}
      <div className="flex items-center gap-6 mt-1">
        {totals.netContributionsMoney !== undefined && (
          <div className="flex flex-col gap-1">
            <span className="font-semibold uppercase tracking-widest text-[9px] text-muted-foreground">FIFO</span>
            <span className="text-[13px] font-semibold tabular-nums text-foreground/70">
              {hideBalances ? "•••••" : formatDisplay(totals.costMoney.amount)}
            </span>
          </div>
        )}
        
        {totals.netContributionsMoney !== undefined && (
          <div className="w-px h-6 bg-border/40" />
        )}

        <div className="flex flex-col gap-1">
          <span className="font-semibold uppercase tracking-widest text-[9px] text-muted-foreground">Aportado</span>
          <span className="text-[13px] font-bold tabular-nums text-foreground/90">
            {hideBalances ? "•••••" : formatDisplay(totals.netContributionsMoney?.amount ?? totals.costMoney.amount)}
          </span>
        </div>
      </div>
    </div>
  )
}
