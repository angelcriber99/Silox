"use client"

import { formatPercent, formatPnl } from "@/lib/utils/formatters"
import {
  TrendingUp, TrendingDown, Briefcase,
  BarChart2, Target, Sparkles, TriangleAlert,
} from "lucide-react"
import { usePreferences } from "@/lib/stores/use-preferences"
import type { PortfolioTotals, EnrichedPosition, Transaccion } from "@/lib/types"
import { useState, useMemo } from "react"
import Link from "next/link"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { useNotes } from "@/lib/stores/use-notes"
import Marquee from "react-fast-marquee"
import { PerformanceModal } from "@/components/dashboard/performance-modal"
import { useDisplayCurrency } from "@/lib/hooks/use-display-currency"

interface PortfolioSummaryProps {
  totals: PortfolioTotals
  positions?: EnrichedPosition[]
  transactions?: Transaccion[]
  pendingTxs?: Transaccion[]
  loading?: boolean
  variant?: 'default' | 'sidebar'
  marketState?: string
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-muted/40 animate-pulse ${className}`} />
}

export function PortfolioSummary({
  totals,
  positions = [],
  loading = false,
  variant = 'default',
  marketState = 'REGULAR',
}: PortfolioSummaryProps) {
  const { hideBalances } = usePreferences()
  const { displayCurrency, convert, format: formatDisplay } = useDisplayCurrency()
  const [chartsOpen, setChartsOpen] = useState(false)

  const primaryCost = totals.netContributionsMoney?.amount ?? totals.costMoney.amount
  const displayPnl = totals.valueMoney.amount - primaryCost
  const displayPnlPercent = primaryCost > 0 ? (displayPnl / primaryCost) * 100 : 0
  const isPositive = displayPnl >= 0
  
  const daily24Positive = totals.pnl24hMoney.amount >= 0



  const topDailyAsset = useMemo(() => {
    if (!positions.length) return null
    return [...positions].sort((a, b) => ((b.displayDailyPnL?.amount ?? null) ?? -Infinity) - ((a.displayDailyPnL?.amount ?? null) ?? -Infinity))[0]
  }, [positions])

  const movers = useMemo(() => {
    return [...positions]
      .filter(p => (p.displayDailyPnL?.amount ?? null) !== null && Math.abs(p.displayDailyPnL?.amount ?? 0) > 0.01)
      .sort((a, b) => ((b.displayDailyPnL?.amount ?? null) || 0) - ((a.displayDailyPnL?.amount ?? null) || 0))
  }, [positions])

  if (loading) {
    return (
      <div className="w-full">
        {/* Hero skeleton */}
        <div className="p-6 pb-5 border-b border-border/30">
          <Skeleton className="h-4 w-32 mb-3" />
          <Skeleton className="h-10 w-56 mb-2" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-border/30">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-5">
              <Skeleton className="h-3 w-20 mb-3" />
              <Skeleton className="h-6 w-28 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (variant === 'sidebar') {
    return (
      <div className="flex flex-col gap-4 p-4 relative bg-transparent shrink-0">
        <div className="flex flex-col items-center z-10 py-6">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-1.5 opacity-80">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
              Valor del Portfolio
            </p>
            {marketState !== 'REGULAR' && (
              <div className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border/50">
                {marketState === 'CLOSED' ? 'Cerrado' : marketState === 'PRE' ? 'Pre-Market' : 'Post-Market'}
              </div>
            )}
          </div>
          <div className="text-4xl lg:text-5xl font-bold tracking-tight leading-none mb-6 bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60 bg-clip-text text-transparent text-center drop-shadow-sm">
            <AnimatedNumber value={convert(totals.valueMoney.amount)} format="currency" currency={displayCurrency} hide={hideBalances} />
          </div>
          {(totals.accountingIssueCount ?? 0) > 0 && (
            <div className="mb-3 flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold text-amber-400">
              <TriangleAlert className="h-3 w-3" />
              ReconciliaciÃ³n pendiente en {totals.accountingIssueCount} activo{totals.accountingIssueCount === 1 ? '' : 's'}
            </div>
          )}
          
          <div className="flex flex-col items-center gap-1.5 mt-2">
            <div className="flex items-center gap-1.5" style={{ color: daily24Positive ? "#30D158" : "#FF453A" }}>
              {daily24Positive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              <span className="text-xl font-bold tabular-nums tracking-tight drop-shadow-sm">
                {hideBalances ? "••••" : `${daily24Positive ? "+" : ""}${formatDisplay(totals.pnl24hMoney.amount)}`}
              </span>
              <span className="text-sm font-semibold opacity-90">
                ({hideBalances ? "•••" : formatPercent(totals.totalDailyPnlPercent).replace('+', '')})
              </span>
            </div>
            
            <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-[12px] font-medium text-muted-foreground/80 mt-1.5">
              <div className="flex items-center gap-1.5">
                <span className="uppercase tracking-widest text-[10px]">Total Histórico</span>
                <span className="tabular-nums font-semibold" style={{ color: isPositive ? "#30D158" : "#FF453A" }}>
                  {hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatDisplay(displayPnl)}`}
                  {!hideBalances && <span className="opacity-80 ml-1 text-[10px]">({formatPercent(displayPnlPercent).replace('+', '')})</span>}
                </span>
              </div>
              <span className="hidden sm:inline opacity-30 text-[10px]">•</span>
              <div className="flex items-center gap-1.5">
                <span className="uppercase tracking-widest text-[10px]" title="Capital neto aportado de tu bolsillo">Aportado neto</span>
                <span className="tabular-nums font-semibold text-foreground/80">
                  {hideBalances ? "••••" : formatDisplay(totals.netContributionsMoney?.amount ?? totals.costMoney.amount)}
                </span>
              </div>
              {totals.netContributionsMoney !== undefined && (
                <>
                  <span className="hidden sm:inline opacity-30 text-[10px]">•</span>
                  <div className="flex items-center gap-1.5">
                    <span className="uppercase tracking-widest text-[10px]" title="Coste Contable FIFO (valor a efectos fiscales)">FIFO</span>
                    <span className="tabular-nums font-semibold text-foreground/60">
                      {hideBalances ? "••••" : formatDisplay(totals.costMoney.amount)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>





        <div className="flex gap-2 w-full mt-1">
          <button
            type="button"
            onClick={() => useNotes.getState().setIsOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 transition-all text-[13px] font-semibold shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>
            Plan Estratégico
          </button>
          <button
            type="button"
            onClick={() => setChartsOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-[13px] font-semibold shadow-sm"
          >
            <BarChart2 className="w-4 h-4" />
            Análisis
          </button>
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

  return (
    <div className="relative overflow-hidden">
      {/* Subtle background glow for the hero area */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      
      {/* ── Hero: main value ─────────────────────────────────────────── */}
      <div className="relative px-6 pt-8 pb-8">
        <div className="flex flex-col items-center justify-center text-center">
          {/* Left: Value block */}
          <div className="flex flex-col items-center z-10">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Valor del Portfolio
            </p>
            <div className="text-5xl md:text-[56px] font-bold tracking-tight leading-none mb-4 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent text-center">
              <AnimatedNumber value={convert(totals.valueMoney.amount)} format="currency" currency={displayCurrency} hide={hideBalances} />
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 p-3 rounded-2xl bg-card/30 backdrop-blur-md border border-border/40 w-fit">
              {/* Total PnL */}
              <div
                className="flex items-center justify-center gap-1.5"
                style={{ color: isPositive ? "#30D158" : "#FF453A" }}
              >
                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="text-[16px] font-bold tabular-nums">
                  {hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatDisplay(displayPnl)}`}
                </span>
                <span className="text-[14px] font-semibold opacity-80">
                  ({hideBalances ? "•••" : formatPercent(displayPnlPercent)})
                </span>
              </div>

              <span className="w-px h-4 bg-border/60" />

              {/* 24h */}
              <div
                className="flex items-center gap-1 text-[13px] font-medium"
                style={{ color: daily24Positive ? "rgba(48,209,88,0.9)" : "rgba(255,69,58,0.9)" }}
              >
                <span className="text-muted-foreground font-normal">Hoy</span>
                <span className="font-semibold tabular-nums">
                  {hideBalances ? "•••" : formatPercent(totals.totalDailyPnlPercent)}
                </span>
                {!hideBalances && (
                  <span className="opacity-70">
                    ({daily24Positive ? "+" : ""}{formatDisplay(totals.pnl24hMoney.amount)})
                  </span>
                )}
              </div>

              {/* Net Contributions (Primary) */}
              <span className="w-px h-4 bg-border/60" />
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
                <span className="font-normal uppercase tracking-widest text-[10px]" title="Capital neto aportado de tu bolsillo">Aportado neto</span>
                <span className="font-semibold tabular-nums text-foreground/80">
                  {hideBalances ? "•••••" : formatDisplay(totals.netContributionsMoney?.amount ?? totals.costMoney.amount)}
                </span>
              </div>

              {/* Invested FIFO (Secondary) */}
              {totals.netContributionsMoney !== undefined && (
                <>
                  <span className="w-px h-4 bg-border/60" />
                  <div className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
                    <span className="font-normal uppercase tracking-widest text-[10px]" title="Coste Contable FIFO (valor a efectos fiscales)">FIFO</span>
                    <span className="font-semibold tabular-nums text-foreground/60">
                      {hideBalances ? "•••••" : formatDisplay(totals.costMoney.amount)}
                    </span>
                  </div>
                </>
              )}

              {/* Prices sync badge */}
              {!totals.hasAllPrices && (
                <>
                  <span className="w-px h-4 bg-border/60" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border text-amber-400/70 border-amber-500/20 bg-amber-500/5">
                    Precios pendientes
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: Quick actions */}
          <div className="flex flex-row md:absolute md:top-8 md:right-6 md:flex-col gap-3 mt-4 md:mt-0 z-20">


            <button
              type="button"
              onClick={() => useNotes.getState().setIsOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 transition-all text-[13px] font-semibold backdrop-blur-md shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>
              Plan Estratégico
            </button>
            <button
              type="button"
              onClick={() => setChartsOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all text-[13px] font-semibold backdrop-blur-md shadow-sm w-full md:w-auto"
            >
              <BarChart2 className="w-4 h-4" />
              Análisis Avanzado
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-6 pb-6">

        {/* Invested */}
        <div className="p-5 flex flex-col gap-2 glass-card hover:shadow-md transition-shadow relative z-10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Capital aportado</span>
            <div className="p-1.5 rounded-lg bg-foreground/5 text-muted-foreground/50">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl md:text-2xl font-bold tabular-nums text-foreground">
            <AnimatedNumber value={convert(totals.netContributionsMoney?.amount ?? totals.costMoney.amount)} format="currency" currency={displayCurrency} hide={hideBalances} />
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground/60">
            <span>{totals.positionCount} posiciones activas</span>
            {totals.netContributionsMoney !== undefined && (
              <span title="Coste Contable (FIFO)">
                FIFO: {hideBalances ? "••••" : formatDisplay(totals.costMoney.amount)}
              </span>
            )}
          </div>
        </div>

        {/* P&L */}
        <div
          className="p-5 flex flex-col gap-2 glass-card hover:shadow-md transition-shadow relative z-10 text-left"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Ganancia Total</span>
            <div
              className="p-1.5 rounded-lg"
              style={{
                background: isPositive ? "oklch(0.65 0.19 155 / 0.12)" : "oklch(0.62 0.20 20 / 0.12)",
                color: isPositive ? "oklch(0.65 0.19 155)" : "oklch(0.62 0.20 20)",
              }}
            >
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <p
            className="text-xl md:text-2xl font-bold tabular-nums"
            style={{ color: isPositive ? "oklch(0.65 0.19 155)" : "oklch(0.62 0.20 20)" }}
          >
            <AnimatedNumber value={convert(displayPnl)} format="pnl" currency={displayCurrency} hide={hideBalances} />
          </p>
          <p className="text-xs text-muted-foreground/60">
            Acumulado histórico
          </p>
        </div>

        {/* Rentabilidad % */}
        <div className="p-5 flex flex-col gap-2 glass-card hover:shadow-md transition-shadow relative z-10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Rentabilidad</span>
            <div
              className="p-1.5 rounded-lg"
              style={{
                background: isPositive ? "oklch(0.65 0.19 155 / 0.12)" : "oklch(0.62 0.20 20 / 0.12)",
                color: isPositive ? "oklch(0.65 0.19 155)" : "oklch(0.62 0.20 20)",
              }}
            >
              <Target className="w-4 h-4" />
            </div>
          </div>
          <p
            className="text-xl md:text-2xl font-bold tabular-nums"
            style={{ color: isPositive ? "oklch(0.65 0.19 155)" : "oklch(0.62 0.20 20)" }}
          >
            <AnimatedNumber value={displayPnlPercent} format="percent" hide={hideBalances} />
          </p>
          <p
            className="text-xs"
            style={{ color: daily24Positive ? "oklch(0.65 0.19 155 / 0.8)" : "oklch(0.62 0.20 20 / 0.8)" }}
          >
            Hoy: {hideBalances ? "•••" : formatPercent(totals.totalDailyPnlPercent)}
          </p>
        </div>

        {/* Top Activo Hoy */}
        <div className="p-5 flex flex-col gap-2 glass-card hover:shadow-md transition-shadow relative z-10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Top Activo Hoy</span>
            <div className="p-1.5 rounded-lg bg-foreground/5 text-muted-foreground/50">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          {topDailyAsset ? (
            <>
              <Link href={`/activo/${topDailyAsset.activo_id}`} className="group w-fit">
                <p className="text-xl md:text-2xl font-bold text-foreground group-hover:text-primary transition-colors truncate">
                  {topDailyAsset.tipo === "Fondo Indexado" || topDailyAsset.tipo === "Fondo Monetario" 
                    ? topDailyAsset.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
                    : topDailyAsset.ticker.split(".")[0]}
                </p>
              </Link>
              <p className={`text-xs font-semibold tabular-nums ${((topDailyAsset.displayDailyPnL?.amount ?? null) || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {hideBalances ? "••••" : formatPnl(convert((topDailyAsset.displayDailyPnL?.amount ?? null) || 0), displayCurrency)} hoy
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">Sin datos de hoy</p>
          )}
        </div>
      </div>

      {/* ── Live Market Movers (scrollable) ─────────────────── */}
      {!hideBalances && movers.length > 0 && (
        <div className="py-2.5 border-t border-border/10 overflow-hidden bg-background/30 [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
          <Marquee speed={35} gradient={false} pauseOnHover={true}>
            {movers.map(p => {
              const isGain = ((p.displayDailyPnL?.amount ?? null) || 0) >= 0;
              return (
                <Link
                  key={p.activo_id}
                  href={`/activo/${p.activo_id}`}
                  className={`mx-1.5 flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] border transition-all hover:scale-105 ${
                    isGain
                      ? "bg-emerald-500/5 border-emerald-500/15 hover:bg-emerald-500/10"
                      : "bg-rose-500/5 border-rose-500/15 hover:bg-rose-500/10"
                  }`}
                >
                  <span className="text-[11px] font-bold text-foreground/80">
                    {p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario" 
                      ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
                      : p.ticker.split(".")[0]}
                  </span>
                  <span className={`text-[11px] font-bold tabular-nums flex items-center ${isGain ? "text-emerald-400" : "text-rose-400"}`}>
                    {isGain ? "+" : ""}{formatDisplay((p.displayDailyPnL?.amount ?? null) || 0)}
                  </span>
                </Link>
              )
            })}
          </Marquee>
        </div>
      )}
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
