"use client"

import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import {
  TrendingUp, TrendingDown, Wallet, Briefcase,
  BarChart2, Target, ArrowUpRight, ArrowDownRight,
  Activity, Minus, Sparkles,
} from "lucide-react"
import { usePreferences } from "@/lib/stores/use-preferences"
import { calculateFIFO } from "@/lib/utils/fifo-calculator"
import type { PortfolioTotals, EnrichedPosition } from "@/lib/types"
import { useState, useMemo } from "react"
import { PerformanceModal } from "./performance-modal"
import Link from "next/link"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { useTranslations } from "next-intl"
import { WithdrawCashModal } from "@/components/transactions/withdraw-cash-modal"
import { useNotes } from "@/lib/stores/use-notes"
import { NotesModal } from "./notes-modal"

interface PortfolioSummaryProps {
  totals: PortfolioTotals
  positions?: EnrichedPosition[]
  transactions?: any[]
  loading?: boolean
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-muted/40 animate-pulse ${className}`} />
}

export function PortfolioSummary({
  totals,
  positions = [],
  transactions = [],
  loading = false,
}: PortfolioSummaryProps) {
  const { hideBalances } = usePreferences()
  const [performanceOpen, setPerformanceOpen] = useState(false)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [cashAssetId, setCashAssetId] = useState<string | null>(null)
  const t = useTranslations("Dashboard")

  const isPositive = totals.totalPnl >= 0
  const daily24Positive = totals.totalPnl24h >= 0

  const liquidezPos = positions.find(p => p.tipo === "Liquidez")
  const liquidezAmount = liquidezPos?.valor_actual || 0

  const historicalAssets = useMemo(() => {
    if (!positions.length) return []
    const fifoEvents = calculateFIFO(transactions || [])
    const realizedByAsset: Record<string, number> = {}
    fifoEvents.forEach(e => {
      realizedByAsset[e.activoId] = (realizedByAsset[e.activoId] || 0) + e.gananciaPatrimonial
    })
    transactions.forEach(tx => {
      if (tx.tipo_operacion === "Dividendo") {
        const netDiv = (Number(tx.cantidad) || 0) * (Number(tx.precio_unitario) || 0) - (Number(tx.comision) || 0)
        realizedByAsset[tx.activo_id] = (realizedByAsset[tx.activo_id] || 0) + netDiv
      }
    })
    return positions
      .filter(p => p.unidades > 0)
      .map(p => ({
        id: p.activo_id,
        ticker: p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario"
          ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
          : p.ticker.split(".")[0],
        historicalPnl: (realizedByAsset[p.activo_id] || 0) + (p.pnl || 0),
      }))
      .sort((a, b) => b.historicalPnl - a.historicalPnl)
  }, [positions, transactions])

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
              <div className={`flex items-center justify-center gap-1.5 ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="text-[16px] font-bold font-tabular">
                  {hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatCurrency(totals.totalPnl)}`}
                </span>
                <span className="text-[14px] font-semibold opacity-80">
                  ({hideBalances ? "•••" : formatPercent(totals.totalPnlPercent)})
                </span>
              </div>

              <span className="w-px h-4 bg-border/60" />

              {/* 24h */}
              <div className={`flex items-center gap-1 text-[13px] font-medium ${daily24Positive ? "text-emerald-400/90" : "text-rose-400/90"}`}>
                <span className="text-muted-foreground font-normal">Hoy</span>
                <span className="font-semibold font-tabular">
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
            <button
              onClick={() => setPerformanceOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all text-[13px] font-semibold backdrop-blur-md shadow-sm"
            >
              <BarChart2 className="w-4 h-4" />
              Rendimiento
            </button>
            {liquidezAmount > 0 && (
              <button
                onClick={() => {
                  if (liquidezPos) {
                    setCashAssetId(liquidezPos.activo_id)
                    setWithdrawModalOpen(true)
                  }
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-card/60 hover:bg-card text-foreground border border-border/40 transition-all text-[13px] font-medium backdrop-blur-md shadow-sm"
              >
                <Wallet className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Liquidez:</span>
                <span className="font-semibold">{hideBalances ? "••••" : formatCurrency(liquidezAmount)}</span>
              </button>
            )}
            <button
              onClick={() => useNotes.getState().setIsOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 transition-all text-[13px] font-semibold backdrop-blur-md shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>
              Plan Estratégico
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
          <p className="text-xl md:text-2xl font-bold font-tabular text-foreground">
            <AnimatedNumber value={totals.totalCost} format="currency" hide={hideBalances} />
          </p>
          <p className="text-xs text-muted-foreground/60">
            {totals.positionCount} posiciones activas
          </p>
        </div>

        {/* P&L */}
        <div className="p-5 flex flex-col gap-2 rounded-2xl bg-card/40 backdrop-blur-sm border border-border/40 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Ganancia Total</span>
            <div className={`p-1.5 rounded-lg ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <p className={`text-xl md:text-2xl font-bold font-tabular ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
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
            <div className={`p-1.5 rounded-lg ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <Target className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-xl md:text-2xl font-bold font-tabular ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
            <AnimatedNumber value={totals.totalPnlPercent} format="percent" hide={hideBalances} />
          </p>
          <p className={`text-xs ${daily24Positive ? "text-emerald-400/80" : "text-rose-400/80"}`}>
            Hoy: {hideBalances ? "•••" : formatPercent(totals.totalPnlPercent24h)}
          </p>
        </div>

        {/* Historical best */}
        <div className="p-5 flex flex-col gap-2 rounded-2xl bg-card/40 backdrop-blur-sm border border-border/40 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Mejor activo</span>
            <div className="p-1.5 rounded-lg bg-foreground/5 text-muted-foreground/50">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          {historicalAssets.length > 0 ? (
            <>
              <Link href={`/activo/${historicalAssets[0].id}`} className="group w-fit">
                <p className="text-xl md:text-2xl font-bold text-foreground group-hover:text-primary transition-colors truncate">
                  {historicalAssets[0].ticker}
                </p>
              </Link>
              <p className={`text-xs font-semibold font-tabular ${historicalAssets[0].historicalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {hideBalances ? "••••" : formatPnl(historicalAssets[0].historicalPnl)} histórico
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground/40 mt-1">Sin datos</p>
          )}
        </div>
      </div>

      {/* ── Historical per-asset strip (scrollable) ─────────────────── */}
      {!hideBalances && historicalAssets.length > 1 && (
        <div className="px-6 py-3 border-t border-border/20 flex items-center gap-2 overflow-x-auto hide-scrollbar">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 flex-shrink-0 mr-1">
            Ganancia total por activo
          </span>
          {historicalAssets.map(asset => (
            <Link
              key={asset.id}
              href={`/activo/${asset.id}`}
              className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all hover:scale-105 ${
                asset.historicalPnl >= 0
                  ? "bg-emerald-500/5 border-emerald-500/15 hover:bg-emerald-500/10"
                  : "bg-rose-500/5 border-rose-500/15 hover:bg-rose-500/10"
              }`}
            >
              <span className="text-[11px] font-bold text-foreground/80">{asset.ticker}</span>
              <span className={`text-[11px] font-bold font-tabular ${asset.historicalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {asset.historicalPnl >= 0 ? "+" : ""}{formatCurrency(asset.historicalPnl)}
              </span>
            </Link>
          ))}
        </div>
      )}

      <PerformanceModal
        open={performanceOpen}
        onOpenChange={setPerformanceOpen}
        currentPnl24h={totals.totalPnl24h}
        currentTotalValue={totals.totalValue}
        currentTotalCost={totals.totalCost}
      />
      <WithdrawCashModal
        open={withdrawModalOpen}
        onOpenChange={setWithdrawModalOpen}
        cashAssetId={cashAssetId || ""}
      />
      <NotesModal />
    </div>
  )
}
