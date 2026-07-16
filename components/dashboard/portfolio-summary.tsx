"use client"

import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import {
  TrendingUp, TrendingDown, Wallet, Briefcase,
  BarChart2, Target, ArrowUpRight, ArrowDownRight,
  Activity, Minus, Sparkles, PiggyBank,
} from "lucide-react"
import { usePreferences } from "@/lib/stores/use-preferences"
import { calculateFIFO } from "@/lib/utils/fifo-calculator"
import type { PortfolioTotals, EnrichedPosition, Transaccion } from "@/lib/types"
import { useState, useMemo } from "react"
import Link from "next/link"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { useTranslations } from "next-intl"
import { WithdrawCashModal } from "@/components/transactions/withdraw-cash-modal"
import { useNotes } from "@/lib/stores/use-notes"
import Marquee from "react-fast-marquee"
import { PerformanceModal } from "@/components/dashboard/performance-modal"

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
  transactions = [],
  pendingTxs = [],
  loading = false,
  variant = 'default',
  marketState = 'REGULAR',
}: PortfolioSummaryProps) {
  const { hideBalances } = usePreferences()
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [chartsOpen, setChartsOpen] = useState(false)
  const [cashAssetId, setCashAssetId] = useState<string | null>(null)
  const t = useTranslations("Dashboard")

  const isPositive = totals.totalPnl >= 0
  const daily24Positive = totals.totalPnl24h >= 0

  const cashPositions = positions.filter(p => p.ticker.startsWith('CASH') || p.tipo === 'Liquidez')
  const liquidezAmount = cashPositions.reduce((acc, p) => acc + (p.valor_actual || 0), 0)
  const liquidezPos = cashPositions.length > 0 ? cashPositions[0] : null

  const fmPositions = positions.filter(p => p.tipo === 'Fondo Monetario')
  const fmAmount = fmPositions.reduce((acc, p) => acc + (p.valor_actual || 0), 0)
  const fmPos = fmPositions.length > 0 ? fmPositions[0] : null

  const pendingCashEur = useMemo(() => {
    if (!pendingTxs) return 0
    return pendingTxs.reduce((sum, tx) => {
      if (tx.tipo_operacion !== 'Compra') return sum
      const fx = tx.activo?.moneda === 'USD' ? 1.07 : 1
      return sum + ((tx.cantidad * tx.precio_unitario) / fx)
    }, 0)
  }, [pendingTxs])

  const topDailyAsset = useMemo(() => {
    if (!positions.length) return null
    return [...positions].sort((a, b) => (b.change_amount_24h ?? -Infinity) - (a.change_amount_24h ?? -Infinity))[0]
  }, [positions])

  const movers = useMemo(() => {
    return [...positions]
      .filter(p => p.change_amount_24h && Math.abs(p.change_amount_24h) > 0.01)
      .sort((a, b) => (b.change_amount_24h || 0) - (a.change_amount_24h || 0))
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
      <div className="flex flex-col gap-4 p-4 relative bg-background shrink-0">
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
            <AnimatedNumber value={totals.totalValue} format="currency" hide={hideBalances} />
          </div>
          
          <div className="flex flex-col items-center gap-1.5 mt-2">
            <div className="flex items-center gap-1.5" style={{ color: daily24Positive ? "#30D158" : "#FF453A" }}>
              {daily24Positive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              <span className="text-xl font-bold tabular-nums tracking-tight drop-shadow-sm">
                {hideBalances ? "••••" : `${daily24Positive ? "+" : ""}${formatCurrency(totals.totalPnl24h)}`}
              </span>
              <span className="text-sm font-semibold opacity-90">
                ({hideBalances ? "•••" : formatPercent(totals.totalPnlPercent24h).replace('+', '')})
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground/80 mt-1">
              <span className="uppercase tracking-widest text-[10px]">Total Histórico</span>
              <span className="tabular-nums font-semibold" style={{ color: isPositive ? "#30D158" : "#FF453A" }}>
                {hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatCurrency(totals.totalPnl)}`}
              </span>
            </div>
          </div>
        </div>



        {(liquidezAmount > 0 || fmAmount > 0) && (
          <div className="flex gap-2 w-full">
            {liquidezAmount > 0 && (
              <button
                onClick={() => { if (liquidezPos) { setCashAssetId(liquidezPos.activo_id); setWithdrawModalOpen(true); } }}
                className="flex-1 flex flex-col items-center justify-center py-2 rounded-xl bg-card/60 hover:bg-card border border-border/40 transition-all text-xs font-medium"
              >
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Liquidez</span>
                <span className="font-semibold">{hideBalances ? "••••" : formatCurrency(liquidezAmount)}</span>
              </button>
            )}
            {fmAmount > 0 && (
              <button
                onClick={() => { if (fmPos) { setCashAssetId(fmPos.activo_id); setWithdrawModalOpen(true); } }}
                className="flex-1 flex flex-col items-center justify-center py-2 rounded-xl bg-card/60 hover:bg-card border border-border/40 transition-all text-xs font-medium"
              >
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">F. Monetario</span>
                <span className="font-semibold">{hideBalances ? "••••" : formatCurrency(fmAmount)}</span>
              </button>
            )}
          </div>
        )}

        <div className="flex gap-2 w-full mt-1">
          <button
            onClick={() => useNotes.getState().setIsOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 transition-all text-[13px] font-semibold shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>
            Plan Estratégico
          </button>
          <button
            onClick={() => setChartsOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-[13px] font-semibold shadow-sm"
          >
            <BarChart2 className="w-4 h-4" />
            Análisis
          </button>
        </div>
        
        <WithdrawCashModal
          open={withdrawModalOpen}
          onOpenChange={setWithdrawModalOpen}
          cashAssetId={cashAssetId || ""}
          sourceAssetType={positions.find(p => p.activo_id === cashAssetId)?.tipo}
          liquidezAssetId={liquidezPos?.activo_id}
        />

        <PerformanceModal
          open={chartsOpen}
          onOpenChange={setChartsOpen}
          positions={positions}
          currentPnl24h={totals.totalPnl24h}
          currentTotalValue={totals.totalValue}
          currentTotalCost={totals.totalCost}
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
              <AnimatedNumber value={totals.totalValue} format="currency" hide={hideBalances} />
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 p-3 rounded-2xl bg-card/30 backdrop-blur-md border border-border/40 w-fit">
              {/* Total PnL */}
              <div
                className="flex items-center justify-center gap-1.5"
                style={{ color: isPositive ? "#30D158" : "#FF453A" }}
              >
                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="text-[16px] font-bold tabular-nums">
                  {hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatCurrency(totals.totalPnl)}`}
                </span>
                <span className="text-[14px] font-semibold opacity-80">
                  ({hideBalances ? "•••" : formatPercent(totals.totalPnlPercent)})
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
                  {hideBalances ? "•••" : formatPercent(totals.totalPnlPercent24h)}
                </span>
                {!hideBalances && (
                  <span className="opacity-70">
                    ({daily24Positive ? "+" : ""}{formatCurrency(totals.totalPnl24h)})
                  </span>
                )}
              </div>

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
            {liquidezAmount > 0 && (
              <div className="flex flex-col items-center md:items-end gap-1">
                <button
                  onClick={() => {
                    if (liquidezPos) {
                      setCashAssetId(liquidezPos.activo_id)
                      setWithdrawModalOpen(true)
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-card/60 hover:bg-card text-foreground border border-border/40 transition-all text-[13px] font-medium backdrop-blur-md shadow-sm w-full md:w-auto"
                >
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Liquidez:</span>
                  <span className="font-semibold">{hideBalances ? "••••" : formatCurrency(liquidezAmount)}</span>
                </button>
                {pendingCashEur > 0 && !hideBalances && (
                  <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    -{formatCurrency(pendingCashEur)} en uso
                  </span>
                )}
              </div>
            )}
            {fmAmount > 0 && (
              <div className="flex flex-col items-center md:items-end gap-1">
                <button
                  onClick={() => {
                    if (fmPos) {
                      setCashAssetId(fmPos.activo_id)
                      setWithdrawModalOpen(true)
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-card/60 hover:bg-card text-foreground border border-border/40 transition-all text-[13px] font-medium backdrop-blur-md shadow-sm w-full md:w-auto"
                >
                  <PiggyBank className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">F. Monetario:</span>
                  <span className="font-semibold">{hideBalances ? "••••" : formatCurrency(fmAmount)}</span>
                </button>
              </div>
            )}
            <button
              onClick={() => useNotes.getState().setIsOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 transition-all text-[13px] font-semibold backdrop-blur-md shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>
              Plan Estratégico
            </button>
            <button
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
        <div className="p-5 flex flex-col gap-2 rounded-2xl bg-card/40 backdrop-blur-sm border border-border/40 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Invertido</span>
            <div className="p-1.5 rounded-lg bg-foreground/5 text-muted-foreground/50">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl md:text-2xl font-bold tabular-nums text-foreground">
            <AnimatedNumber value={totals.totalCost} format="currency" hide={hideBalances} />
          </p>
          <p className="text-xs text-muted-foreground/60">
            {totals.positionCount} posiciones activas
          </p>
        </div>

        {/* P&L */}
        <div
          className="p-5 flex flex-col gap-2 rounded-2xl bg-card/40 backdrop-blur-sm border border-border/40 shadow-sm hover:shadow-md transition-shadow"
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
            <AnimatedNumber value={totals.totalPnl} format="pnl" hide={hideBalances} />
          </p>
          <p className="text-xs text-muted-foreground/60">
            Acumulado histórico
          </p>
        </div>

        {/* Rentabilidad % */}
        <div className="p-5 flex flex-col gap-2 rounded-2xl bg-card/40 backdrop-blur-sm border border-border/40 shadow-sm hover:shadow-md transition-shadow">
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
            <AnimatedNumber value={totals.totalPnlPercent} format="percent" hide={hideBalances} />
          </p>
          <p
            className="text-xs"
            style={{ color: daily24Positive ? "oklch(0.65 0.19 155 / 0.8)" : "oklch(0.62 0.20 20 / 0.8)" }}
          >
            Hoy: {hideBalances ? "•••" : formatPercent(totals.totalPnlPercent24h)}
          </p>
        </div>

        {/* Top Activo Hoy */}
        <div className="p-5 flex flex-col gap-2 rounded-2xl bg-card/40 backdrop-blur-sm border border-border/40 shadow-sm hover:shadow-md transition-shadow">
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
              <p className={`text-xs font-semibold tabular-nums ${(topDailyAsset.change_amount_24h || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {hideBalances ? "••••" : formatPnl(topDailyAsset.change_amount_24h || 0)} hoy
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
              const isGain = (p.change_amount_24h || 0) >= 0;
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
                    {isGain ? "+" : ""}{formatCurrency(p.change_amount_24h || 0)}
                  </span>
                </Link>
              )
            })}
          </Marquee>
        </div>
      )}
      <WithdrawCashModal
        open={withdrawModalOpen}
        onOpenChange={setWithdrawModalOpen}
        cashAssetId={cashAssetId || ""}
        sourceAssetType={positions.find(p => p.activo_id === cashAssetId)?.tipo}
        liquidezAssetId={liquidezPos?.activo_id}
      />
    </div>
  )
}
