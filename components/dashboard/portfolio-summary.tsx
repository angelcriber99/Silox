"use client"

import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import {
  TrendingUp, TrendingDown, Wallet, Briefcase,
  BarChart2, Target, ArrowUpRight, ArrowDownRight,
  Activity, Minus,
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
    <>
      {/* ── Hero: main value ─────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-5 border-b border-border/20">
        <div className="flex items-start justify-between gap-6">
          {/* Left: Value block */}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1.5">
              Valor del Portfolio
            </p>
            <div className="text-[38px] font-bold tracking-tight text-foreground leading-none mb-2">
              <AnimatedNumber value={totals.totalValue} format="currency" hide={hideBalances} />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Total PnL */}
              <div className={`flex items-center gap-1.5 ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="text-[15px] font-bold font-tabular">
                  {hideBalances ? "••••" : `${isPositive ? "+" : ""}${formatCurrency(totals.totalPnl)}`}
                </span>
                <span className="text-[13px] font-semibold opacity-80">
                  ({hideBalances ? "•••" : formatPercent(totals.totalPnlPercent)})
                </span>
              </div>

              <span className="text-border/60 text-sm">·</span>

              {/* 24h */}
              <div className={`flex items-center gap-1 text-[12px] font-medium ${daily24Positive ? "text-emerald-400/80" : "text-rose-400/80"}`}>
                <span className="text-muted-foreground/40 font-normal">Hoy</span>
                <span className="font-semibold font-tabular">
                  {hideBalances ? "•••" : `${daily24Positive ? "+" : ""}${formatPercent(totals.totalPnlPercent24h)}`}
                </span>
                {!hideBalances && (
                  <span className="opacity-70">
                    ({daily24Positive ? "+" : ""}{formatCurrency(totals.totalPnl24h)})
                  </span>
                )}
              </div>

              {/* Prices sync badge */}
              <span className={`text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                totals.hasAllPrices
                  ? "text-emerald-400/70 border-emerald-500/20 bg-emerald-500/5"
                  : "text-amber-400/70 border-amber-500/20 bg-amber-500/5"
              }`}>
                {totals.hasAllPrices ? "Precios actualizados" : "Precios pendientes"}
              </span>
            </div>
          </div>

          {/* Right: Quick actions */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={() => setPerformanceOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all text-[12px] font-semibold"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Rendimiento Diario
            </button>
            {liquidezAmount > 0 && (
              <button
                onClick={() => {
                  if (liquidezPos) {
                    setCashAssetId(liquidezPos.activo_id)
                    setWithdrawModalOpen(true)
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted/70 text-muted-foreground border border-border/40 transition-all text-[12px] font-medium"
              >
                <Wallet className="w-3.5 h-3.5" />
                Liquidez: {hideBalances ? "••••" : formatCurrency(liquidezAmount)}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-y divide-border/20">

        {/* Invested */}
        <div className="p-5 flex flex-col gap-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Invertido</span>
            <Briefcase className="w-3.5 h-3.5 text-muted-foreground/25" />
          </div>
          <p className="text-[18px] font-bold font-tabular text-foreground">
            <AnimatedNumber value={totals.totalCost} format="currency" hide={hideBalances} />
          </p>
          <p className="text-[11px] text-muted-foreground/50">
            {totals.positionCount} posiciones activas
          </p>
        </div>

        {/* P&L */}
        <div className="p-5 flex flex-col gap-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Ganancia / Pérdida</span>
            {isPositive
              ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400/50" />
              : <TrendingDown className="w-3.5 h-3.5 text-rose-400/50" />}
          </div>
          <p className={`text-[18px] font-bold font-tabular ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
            <AnimatedNumber value={totals.totalPnl} format="pnl" hide={hideBalances} />
          </p>
          <p className="text-[11px] text-muted-foreground/50">
            Total acumulado
          </p>
        </div>

        {/* Rentabilidad % */}
        <div className="p-5 flex flex-col gap-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Rentabilidad</span>
            <Target className={`w-3.5 h-3.5 ${isPositive ? "text-emerald-400/50" : "text-rose-400/50"}`} />
          </div>
          <p className={`text-[18px] font-bold font-tabular ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
            <AnimatedNumber value={totals.totalPnlPercent} format="percent" hide={hideBalances} />
          </p>
          <p className={`text-[11px] ${daily24Positive ? "text-emerald-400/70" : "text-rose-400/70"}`}>
            Hoy: {hideBalances ? "•••" : `${daily24Positive ? "+" : ""}${formatPercent(totals.totalPnlPercent24h)}`}
          </p>
        </div>

        {/* Historical best */}
        <div className="p-5 flex flex-col gap-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Mejor activo</span>
            <Activity className="w-3.5 h-3.5 text-muted-foreground/25" />
          </div>
          {historicalAssets.length > 0 ? (
            <>
              <Link href={`/activo/${historicalAssets[0].id}`} className="group">
                <p className="text-[15px] font-bold text-foreground group-hover:text-primary transition-colors">
                  {historicalAssets[0].ticker}
                </p>
              </Link>
              <p className={`text-[11px] font-semibold font-tabular ${historicalAssets[0].historicalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {hideBalances ? "••••" : formatPnl(historicalAssets[0].historicalPnl)}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground/40">Sin datos</p>
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
    </>
  )
}
