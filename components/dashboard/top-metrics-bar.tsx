"use client"

import { useState } from "react"
import { formatPercent, formatPnl } from "@/lib/utils/formatters"
import { TrendingUp, TrendingDown, TriangleAlert, BarChart2 } from "lucide-react"
import { usePreferences } from "@/lib/stores/use-preferences"
import type { PortfolioTotals, EnrichedPosition } from "@/lib/types"
import { useDisplayCurrency } from "@/lib/hooks/use-display-currency"
import { formatCurrency } from "@/lib/utils/formatters"
import { PerformanceModal } from "@/components/dashboard/performance-modal"
import { useNotes } from "@/lib/stores/use-notes"
import Link from "next/link"

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
        
        <div className="text-2xl sm:text-3xl lg:text-4xl 2xl:text-5xl font-black tracking-tighter leading-none text-foreground flex items-end gap-2 truncate w-full">
          <span className="truncate">{hideBalances ? "****" : formatCurrency(convert(totals.valueMoney.amount), displayCurrency)}</span>
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
            <span className="text-xs lg:text-sm 2xl:text-base font-bold tabular-nums tracking-tight">
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
            <span className="text-xs lg:text-sm 2xl:text-base font-bold tabular-nums tracking-tight">
              {hideBalances ? "••••" : `${daily24Positive ? "+" : ""}${formatDisplay(totals.pnl24hMoney.amount)}`}
            </span>
          </div>
          <span className="text-xs font-semibold opacity-80" style={{ color: daily24Positive ? "rgba(48,209,88,0.95)" : "rgba(255,69,58,0.95)" }}>
            {hideBalances ? "•••" : formatPercent(totals.totalDailyPnlPercent)}
          </span>
        </div>
      </div>

      {/* Contributions Pill & Actions */}
      <div className="flex flex-col gap-2 mt-1">
        <div className="flex flex-wrap items-center justify-between px-3 py-2.5 rounded-lg bg-card border shadow-sm gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">FIFO</span>
            <span className="text-xs sm:text-sm font-bold tabular-nums text-foreground/80 break-all">
              {hideBalances ? "•••••" : formatDisplay(totals.costMoney.amount)}
            </span>
          </div>
          
          <div className="hidden sm:block w-px h-4 bg-border" />

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Aportado</span>
            <span className="text-xs sm:text-sm font-bold tabular-nums text-foreground break-all">
              {hideBalances ? "•••••" : formatDisplay(totals.netContributionsMoney?.amount ?? totals.costMoney.amount)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => useNotes.getState().setIsOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 transition-all text-xs font-semibold shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>
            Plan
          </button>
          
          <Link
            href="/analisis"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all text-xs font-semibold shadow-sm"
          >
            <BarChart2 className="w-4 h-4" />
            Análisis
          </Link>
        </div>
      </div>
    </div>
  )
}
