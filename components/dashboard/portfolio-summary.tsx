"use client"

import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import { Target, Briefcase, Wallet, BarChart2, TrendingUp, TrendingDown } from "lucide-react"
import { usePreferences } from "@/lib/stores/use-preferences"
import { calculateFIFO } from "@/lib/utils/fifo-calculator"
import type { PortfolioTotals, EnrichedPosition } from '@/lib/types'
import { useState, useMemo } from "react"
import { PerformanceModal } from "./performance-modal"
import Link from "next/link"

interface PortfolioSummaryProps {
  totals: PortfolioTotals
  positions?: EnrichedPosition[]
  transactions?: any[]
  loading?: boolean
}

function SkeletonValue() {
  return (
    <div className="h-7 w-28 rounded bg-muted animate-shimmer mt-1" />
  )
}

interface KPICardProps {
  label: string
  value: string
  valueColor?: string
  subvalue?: React.ReactNode
  icon: React.ReactNode
  loading?: boolean
  delay?: string
  action?: React.ReactNode
  extraContent?: React.ReactNode
}

function KPICard({
  label,
  value,
  valueColor = "text-foreground",
  subvalue,
  icon,
  loading = false,
  delay = "stagger-1",
  action,
  extraContent,
}: KPICardProps) {
  return (
    <Card
      className={`animate-fade-in ${delay} bg-card border-border backdrop-blur-sm hover:border-border/60 transition-all duration-300 relative flex flex-col h-full`}
    >
      <CardContent className="p-5 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider">
            {label}
          </span>
          <div className="flex items-center gap-2">
            {action}
            {icon}
          </div>
        </div>
        {loading ? (
          <SkeletonValue />
        ) : (
          <div className="flex-1">
            <p className={`text-2xl font-bold font-tabular tracking-tight ${valueColor}`}>
              {value}
            </p>
            {subvalue && (
              <p className="text-xs text-muted-foreground/80 mt-1">{subvalue}</p>
            )}
          </div>
        )}
        {extraContent && (
          <div className="mt-4">
            {extraContent}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

import { Eye, EyeOff } from "lucide-react"

export function PortfolioSummary({
  totals,
  positions = [],
  transactions = [],
  loading = false,
}: PortfolioSummaryProps) {
  const { hideBalances, zenMode, setZenMode } = usePreferences()
  const [performanceOpen, setPerformanceOpen] = useState(false)
  const isPositive = totals.totalPnl >= 0

  const historicalAssets = useMemo(() => {
    if (!positions.length) return []
    const fifoEvents = calculateFIFO(transactions || [])
    
    const realizedByAsset: Record<string, number> = {}
    fifoEvents.forEach(e => {
      realizedByAsset[e.activoId] = (realizedByAsset[e.activoId] || 0) + e.gananciaPatrimonial
    })
    
    // Add dividends to realized PnL
    transactions.forEach(tx => {
      if (tx.tipo_operacion === "Dividendo") {
        const qty = Number(tx.cantidad) || 0
        const price = Number(tx.precio_unitario) || 0
        const comision = Number(tx.comision) || 0
        const netDividend = (qty * price) - comision
        realizedByAsset[tx.activo_id] = (realizedByAsset[tx.activo_id] || 0) + netDividend
      }
    })

    const items = positions.map(p => {
      const realized = realizedByAsset[p.activo_id] || 0
      const unrealized = p.pnl || 0
      const totalHistoricalPnl = realized + unrealized
      
      const displayTicker = p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario"
          ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
          : p.ticker.split(".")[0]

      return {
        id: p.activo_id,
        ticker: displayTicker,
        tipo: p.tipo,
        historicalPnl: totalHistoricalPnl
      }
    })

    return items.sort((a, b) => b.historicalPnl - a.historicalPnl)
  }, [positions, transactions])

  const liquidezPos = positions.find(p => p.tipo === "Liquidez")
  const liquidezAmount = liquidezPos?.valor_actual || 0

  return (
    <div className="space-y-6">
      {/* ─── MAIN KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Valor del Portfolio"
          value={hideBalances ? "****" : formatCurrency(totals.totalValue)}
          subvalue={hideBalances ? null : (
            <div className="flex flex-col gap-1">
              <span>{totals.hasAllPrices ? "Precios sincronizados" : "Precios pendientes"}</span>
              {liquidezAmount > 0 && (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <Wallet className="w-3 h-3" /> Liquidez: {formatCurrency(liquidezAmount)}
                </span>
              )}
            </div>
          )}
          icon={<Wallet className="w-5 h-5 text-muted-foreground/50" />}
          action={
            <button
              onClick={() => setZenMode(!zenMode)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
              title={zenMode ? "Salir del Modo ZEN" : "Activar Modo ZEN"}
            >
              {zenMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
          loading={loading}
          delay="stagger-1"
        />
        
        <KPICard
          label="Total Invertido"
          value={hideBalances ? "****" : formatCurrency(totals.totalCost)}
          subvalue={hideBalances ? null : (
            <span className="text-muted-foreground">
              {totals.positionCount} posición(es)
            </span>
          )}
          icon={<Briefcase className="w-5 h-5 text-muted-foreground/50" />}
          loading={loading}
          delay="stagger-2"
        />
        
        <KPICard
          label="Beneficio / Pérdida"
          value={hideBalances ? "****" : formatPnl(totals.totalPnl)}
          valueColor={isPositive ? "text-emerald-400" : "text-rose-400"}
          subvalue={hideBalances ? null : (
            <span className="text-muted-foreground flex items-center gap-1">
              Hoy: <span className={totals.totalPnl24h >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {totals.totalPnl24h > 0 ? "+" : ""}{formatCurrency(totals.totalPnl24h)}
              </span>
            </span>
          )}
          icon={
            isPositive ? (
              <TrendingUp className="w-5 h-5 text-emerald-400/50" />
            ) : (
              <TrendingDown className="w-5 h-5 text-rose-400/50" />
            )
          }
          extraContent={
            <button 
              onClick={() => setPerformanceOpen(true)}
              className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 rounded-lg py-2 px-3 flex items-center justify-center gap-2 font-semibold transition-colors text-xs"
            >
              <BarChart2 className="w-4 h-4" />
              Ver Rendimiento Diario
            </button>
          }
          loading={loading}
          delay="stagger-3"
        />
        
        <KPICard
          label="Rentabilidad"
          value={hideBalances ? "****" : formatPercent(totals.totalPnlPercent)}
          valueColor={isPositive ? "text-emerald-400" : "text-rose-400"}
          subvalue={hideBalances ? null : (
            <span className="text-muted-foreground flex items-center gap-1">
              Hoy: <span className={totals.totalPnlPercent24h >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {formatPercent(totals.totalPnlPercent24h)}
              </span>
            </span>
          )}
          icon={
            <Target
              className={`w-5 h-5 ${
                isPositive ? "text-emerald-400/50" : "text-rose-400/50"
              }`}
            />
          }
          loading={loading}
          delay="stagger-4"
        />
      </div>

      {/* ─── HISTORICAL ASSETS ─── */}
      {!hideBalances && historicalAssets.length > 0 && (
        <div className="pt-4 border-t border-border/40">
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground mb-4 uppercase">Activos Vendidos</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 opacity-60 hover:opacity-100 transition-opacity duration-300">
            {historicalAssets.map((asset, i) => (
              <KPICard
                key={`historical-${asset.id}`}
                label={`Histórico: ${asset.ticker}`}
                value={formatPnl(asset.historicalPnl)}
                valueColor={asset.historicalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}
                subvalue={
                  <span className="text-muted-foreground">
                    Vendiste este activo
                  </span>
                }
                icon={
                  asset.historicalPnl >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-emerald-400/50" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-rose-400/50" />
                  )
                }
                loading={loading}
                delay={`stagger-${(i % 4) + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      <PerformanceModal open={performanceOpen} onOpenChange={setPerformanceOpen} currentPnl24h={totals.totalPnl24h} currentTotalValue={totals.totalValue} />
    </div>
  )
}
