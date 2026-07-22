"use client"

import { usePortfolioContext } from "@/lib/context/portfolio-context"
import { useDisplayCurrency } from "@/lib/hooks/use-display-currency"
import { formatPnl } from "@/lib/utils/formatters"
import { TrendingUp, TrendingDown, Activity, Globe } from "lucide-react"
import { useEffect } from "react"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { usePreferences } from "@/lib/stores/use-preferences"

export default function TrayPage() {
  const { totals, isLoading, error } = usePortfolioContext()
  const { displayCurrency, convert, format: formatDisplay } = useDisplayCurrency()
  const { hideBalances } = usePreferences()

  useEffect(() => {
    // Add a specific class to the body to ensure transparency and proper framing
    document.body.classList.add("tray-window")
    return () => document.body.classList.remove("tray-window")
  }, [])

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || !totals || !totals.pnl24hMoney) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-rose-500">
        Error al cargar datos o portfolio vacío
      </div>
    )
  }

  const isPositive = totals.pnl24hMoney.amount >= 0

  return (
    <div className="flex-1 flex flex-col p-4 select-none">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
          <Activity className="w-4 h-4" />
          Silox Portfolio
        </h1>
        <div className="w-2 h-2 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
      </div>

      <div className="flex flex-col gap-1 mb-6">
        <span className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
           {hideBalances ? "••••••" : <AnimatedNumber value={convert(totals.valueMoney.amount)} format="currency" currency={displayCurrency} hide={hideBalances} />}
        </span>
        <div className="flex items-center gap-1.5">
          {isPositive ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
          )}
          <span className={`text-sm font-bold tabular-nums ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
            {hideBalances ? "•••" : (
              <>
                {isPositive ? '+' : ''}{formatDisplay(totals.pnl24hMoney.amount)}
                <span className="mx-1">•</span>
                {isPositive ? '+' : ''}{totals.totalPnlPercent24h.toFixed(2)}%
              </>
            )}
          </span>
          <span className="text-xs text-muted-foreground ml-1">Hoy</span>
        </div>
      </div>

      <div className="flex-1">
        {/* Placeholder for top movers or other compact widgets */}
        <div className="p-3 rounded-lg bg-card/40 border border-border/50 text-xs text-muted-foreground text-center">
          <Globe className="w-4 h-4 mx-auto mb-1.5 opacity-50" />
          Mercado en vivo
        </div>
      </div>
    </div>
  )
}
