"use client"

import { formatPercent, formatPnl } from "@/lib/utils/formatters"
import { TrendingUp, TrendingDown, TriangleAlert } from "lucide-react"
import { usePreferences } from "@/lib/stores/use-preferences"
import type { PortfolioTotals } from "@/lib/types"
import { useDisplayCurrency } from "@/lib/hooks/use-display-currency"

interface TopMetricsBarProps {
  totals: PortfolioTotals
  loading?: boolean
}

export function TopMetricsBar({ totals, loading = false }: TopMetricsBarProps) {
  const { hideBalances } = usePreferences()
  const { displayCurrency, convert, format: formatDisplay } = useDisplayCurrency()

  if (loading) {
    return (
      <div className="w-full flex gap-4 h-14 bg-card/40 border border-border/50 rounded-xl px-4 animate-pulse items-center">
        <div className="h-6 w-32 bg-muted rounded" />
        <div className="h-6 w-32 bg-muted rounded" />
        <div className="h-6 w-48 bg-muted rounded ml-auto" />
      </div>
    )
  }

  const primaryCost = totals.netContributionsMoney?.amount ?? totals.costMoney.amount
  const displayPnl = totals.valueMoney.amount - primaryCost
  const displayPnlPercent = primaryCost > 0 ? (displayPnl / primaryCost) * 100 : 0
  const isPositive = displayPnl >= 0
  
  const daily24Positive = totals.pnl24hMoney.amount >= 0

  return (
    <div className="w-full flex items-center justify-between bg-card/30 backdrop-blur-md border border-border/50 rounded-xl px-5 py-3 shadow-sm mb-4">
      {/* Left Group: PnL Metrics */}
      <div className="flex items-center gap-6">
        {/* Total Historical */}
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Histórico Total</span>
          <div
            className="flex items-center gap-1.5"
            style={{ color: isPositive ? "#30D158" : "#FF453A" }}
          >
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="text-[16px] font-bold tabular-nums tracking-tight">
              {hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatDisplay(displayPnl)}`}
            </span>
            <span className="text-[12px] font-bold opacity-80">
              ({hideBalances ? "•••" : formatPercent(displayPnlPercent).replace('+', '')})
            </span>
          </div>
        </div>

        <div className="w-px h-8 bg-border/60 hidden sm:block" />

        {/* Daily (Hoy) */}
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Ganancia de Hoy</span>
          <div
            className="flex items-center gap-1.5"
            style={{ color: daily24Positive ? "rgba(48,209,88,0.95)" : "rgba(255,69,58,0.95)" }}
          >
            {daily24Positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="text-[16px] font-bold tabular-nums tracking-tight">
              {hideBalances ? "••••" : `${daily24Positive ? "+" : ""}${formatDisplay(totals.pnl24hMoney.amount)}`}
            </span>
            <span className="text-[12px] font-bold opacity-80">
              ({hideBalances ? "•••" : formatPercent(totals.totalDailyPnlPercent).replace('+', '')})
            </span>
          </div>
        </div>
      </div>

      {/* Right Group: Contributions and Warnings */}
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-4">
          {/* FIFO (Secondary) */}
          {totals.netContributionsMoney !== undefined && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/60 hidden md:flex">
              <span className="font-semibold uppercase tracking-widest text-[9px]" title="Coste Contable FIFO (valor a efectos fiscales)">FIFO</span>
              <span className="font-semibold tabular-nums text-foreground/60">
                {hideBalances ? "•••••" : formatDisplay(totals.costMoney.amount)}
              </span>
            </div>
          )}

          {/* Aportado Neto (Primary) */}
          <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
            <span className="font-bold uppercase tracking-widest text-[10px]" title="Capital neto aportado de tu bolsillo">Aportado</span>
            <span className="font-bold tabular-nums text-foreground/90">
              {hideBalances ? "•••••" : formatDisplay(totals.netContributionsMoney?.amount ?? totals.costMoney.amount)}
            </span>
          </div>
        </div>

        {(!totals.hasAllPrices || (totals.accountingIssueCount ?? 0) > 0) && (
          <div className="flex gap-2">
            {!totals.hasAllPrices && (
              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border text-amber-400/70 border-amber-500/20 bg-amber-500/5">
                Precios pendientes
              </span>
            )}
            {(totals.accountingIssueCount ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border text-amber-500/70 border-amber-500/20 bg-amber-500/10">
                <TriangleAlert className="w-2.5 h-2.5" />
                {totals.accountingIssueCount} alertas
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
