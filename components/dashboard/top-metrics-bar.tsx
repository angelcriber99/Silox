"use client"

import { useState } from "react"
import { formatPercent, formatPnl } from "@/lib/utils/formatters"
import { TrendingUp, TrendingDown, TriangleAlert, BarChart2 } from "lucide-react"
import { usePreferences } from "@/lib/stores/use-preferences"
import type { PortfolioTotals, EnrichedPosition } from "@/lib/types"
import { useDisplayCurrency } from "@/lib/hooks/use-display-currency"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { useNotes } from "@/lib/stores/use-notes"
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
  const [chartsOpen, setChartsOpen] = useState(false)

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
    <div className="w-full flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-card/30 backdrop-blur-md border border-border/50 rounded-2xl p-4 md:px-5 md:py-3.5 shadow-sm mb-4 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[80px] pointer-events-none -translate-y-1/2 translate-x-1/3" />
      
      {/* Left side: Value & PnL */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6 relative z-10">
        {/* Value */}
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-80">
              Valor del Portfolio
            </span>
            {marketState !== 'REGULAR' && (
              <div className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border/50">
                {marketState === 'CLOSED' ? 'Cerrado' : marketState === 'PRE' ? 'Pre-Market' : 'Post-Market'}
              </div>
            )}
            {(totals.accountingIssueCount ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-500">
                <TriangleAlert className="h-2.5 w-2.5" />
                {totals.accountingIssueCount} {totals.accountingIssueCount === 1 ? 'alerta' : 'alertas'}
              </div>
            )}
          </div>
          <div className="text-3xl xl:text-4xl font-bold tracking-tight leading-none bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60 bg-clip-text text-transparent drop-shadow-sm flex items-end gap-2">
            <AnimatedNumber value={convert(totals.valueMoney.amount)} format="currency" currency={displayCurrency} hide={hideBalances} />
            {!totals.hasAllPrices && (
              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border text-amber-400/70 border-amber-500/20 bg-amber-500/5 mb-1.5">
                Precios pendientes
              </span>
            )}
          </div>
        </div>

        <div className="w-px h-10 bg-border/60 hidden md:block" />

        {/* PnL Metrics */}
        <div className="flex items-center gap-5">
          {/* Total Historical */}
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Histórico Total</span>
            <div
              className="flex items-center gap-1"
              style={{ color: isPositive ? "#30D158" : "#FF453A" }}
            >
              {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span className="text-[15px] font-bold tabular-nums tracking-tight">
                {hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatDisplay(displayPnl)}`}
              </span>
              <span className="text-[11px] font-bold opacity-80">
                ({hideBalances ? "•••" : formatPercent(displayPnlPercent).replace('+', '')})
              </span>
            </div>
          </div>

          <div className="w-px h-6 bg-border/40 hidden sm:block" />

          {/* Daily (Hoy) */}
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Hoy</span>
            <div
              className="flex items-center gap-1"
              style={{ color: daily24Positive ? "rgba(48,209,88,0.95)" : "rgba(255,69,58,0.95)" }}
            >
              {daily24Positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span className="text-[15px] font-bold tabular-nums tracking-tight">
                {hideBalances ? "••••" : `${daily24Positive ? "+" : ""}${formatDisplay(totals.pnl24hMoney.amount)}`}
              </span>
              <span className="text-[11px] font-bold opacity-80">
                ({hideBalances ? "•••" : formatPercent(totals.totalDailyPnlPercent).replace('+', '')})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Contributions & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 relative z-10 shrink-0">
        {/* Contributions */}
        <div className="flex items-center gap-3 bg-background/50 border border-border/40 rounded-lg px-3 py-2">
          {totals.netContributionsMoney !== undefined && (
            <div className="flex flex-col gap-0.5 hidden sm:flex">
              <span className="font-semibold uppercase tracking-widest text-[8px] text-muted-foreground">FIFO</span>
              <span className="text-[11px] font-semibold tabular-nums text-foreground/60">
                {hideBalances ? "•••••" : formatDisplay(totals.costMoney.amount)}
              </span>
            </div>
          )}
          {totals.netContributionsMoney !== undefined && (
            <div className="w-px h-5 bg-border/40 hidden sm:block" />
          )}
          <div className="flex flex-col gap-0.5">
            <span className="font-bold uppercase tracking-widest text-[8px] text-muted-foreground">Aportado</span>
            <span className="text-[12px] font-bold tabular-nums text-foreground/90">
              {hideBalances ? "•••••" : formatDisplay(totals.netContributionsMoney?.amount ?? totals.costMoney.amount)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => useNotes.getState().setIsOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 transition-all text-xs font-semibold shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>
            <span className="hidden xl:inline">Plan Estratégico</span>
            <span className="inline xl:hidden">Plan</span>
          </button>
          <button
            type="button"
            onClick={() => setChartsOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-xs font-semibold shadow-sm"
          >
            <BarChart2 className="w-4 h-4" />
            Análisis
          </button>
        </div>
      </div>

      <PerformanceModal
        open={chartsOpen}
        onOpenChange={setChartsOpen}
        positions={positions}
        currentDailyPnl={totals.pnl24hMoney.amount}
        currentDailyPnlPercent={totals.totalDailyPnlPercent}
        currentDailyCoverage={totals.dailyPerformancePositionCount}
        currentPositionCount={totals.positionCount}
        currentTotalValue={totals.valueMoney.amount}
        currentTotalCost={totals.costMoney.amount}
        currentTotalPnl={totals.pnlMoney.amount}
        currentTotalPnlPercent={totals.totalPnlPercent}
      />
    </div>
  )
}
