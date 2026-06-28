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
import { AnimatedNumber } from "@/components/ui/animated-number"
import { useTranslations } from "next-intl"
import { WithdrawCashModal } from "@/components/transactions/withdraw-cash-modal"

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
  value: React.ReactNode
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
              <div className="text-xs text-muted-foreground/80 mt-1">{subvalue}</div>
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
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [cashAssetId, setCashAssetId] = useState<string | null>(null)
  
  const isPositive = totals.totalPnl >= 0
  const t = useTranslations('Dashboard')

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
    <>
      <div className="flex overflow-x-auto gap-4 pb-4 snap-x [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border/50 hover:[&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="min-w-[280px] sm:min-w-[320px] snap-start flex-1">
          <KPICard
            label={t('portfolio_value')}
            value={<AnimatedNumber value={totals.totalValue} format="currency" hide={hideBalances} />}
            subvalue={hideBalances ? null : (
              <div className="flex flex-col gap-1.5">
                <span>{totals.hasAllPrices ? t('prices_synced') : t('prices_pending')}</span>
                {liquidezAmount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-medium flex items-center gap-1">
                      <Wallet className="w-3 h-3" /> Liquidez: <AnimatedNumber value={liquidezAmount} format="currency" hide={hideBalances} />
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        if (liquidezPos) {
                          setCashAssetId(liquidezPos.activo_id)
                          setWithdrawModalOpen(true)
                        }
                      }}
                      className="bg-border/60 hover:bg-border text-muted-foreground hover:text-foreground text-[10px] px-2 py-0.5 rounded transition-colors"
                      title="Retirar a banco"
                    >
                      Retirar
                    </button>
                  </div>
                )}
              </div>
            )}
            icon={<Wallet className="w-5 h-5 text-muted-foreground/50" />}
            loading={loading}
            delay="stagger-1"
          />
        </div>
        
        <div className="min-w-[280px] sm:min-w-[320px] snap-start flex-1">
          <KPICard
            label={t('total_cost')}
            value={<AnimatedNumber value={totals.totalCost} format="currency" hide={hideBalances} />}
            subvalue={hideBalances ? null : (
              <span className="text-muted-foreground">
                {totals.positionCount} {t('positions_count')}
              </span>
            )}
            icon={<Briefcase className="w-5 h-5 text-muted-foreground/50" />}
            loading={loading}
            delay="stagger-2"
          />
        </div>
        
        <div className="min-w-[280px] sm:min-w-[320px] snap-start flex-1">
          <KPICard
            label={t('pnl')}
            value={<AnimatedNumber value={totals.totalPnl} format="pnl" hide={hideBalances} />}
            valueColor={isPositive ? "text-emerald-400" : "text-rose-400"}
            subvalue={hideBalances ? null : (
              <span className="text-muted-foreground flex items-center gap-1">
                {t('today')}: <span className={`font-medium ${totals.totalPnl24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  <AnimatedNumber value={totals.totalPnl24h} format="pnl" hide={hideBalances} />
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
                {t('daily_performance')}
              </button>
            }
            loading={loading}
            delay="stagger-3"
          />
        </div>
        
        <div className="min-w-[280px] sm:min-w-[320px] snap-start flex-1">
          <KPICard
            label={t('profitability')}
            value={<AnimatedNumber value={totals.totalPnlPercent} format="percent" hide={hideBalances} />}
            valueColor={isPositive ? "text-emerald-400" : "text-rose-400"}
            subvalue={hideBalances ? null : (
              <span className="text-muted-foreground flex items-center gap-1">
                {t('today')}: <span className={totals.totalPnlPercent24h >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  <AnimatedNumber value={totals.totalPnlPercent24h} format="percent" hide={hideBalances} />
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

        {/* Separator */}
        {!hideBalances && historicalAssets.length > 0 && (
          <div className="flex items-center px-2 snap-start">
            <div className="w-px h-16 bg-border/60" />
          </div>
        )}

        {/* Historical Profit Mini Cards */}
        {!hideBalances && historicalAssets.map((asset, index) => (
          <Link key={`historical-${asset.id}`} href={`/activo/${asset.id}`} className={`min-w-[150px] snap-start h-full animate-fade-in`} style={{ animationDelay: `${400 + index * 100}ms` }}>
            <Card className="bg-card/40 border-border/50 hover:bg-muted/80 hover:border-border transition-all h-full flex flex-col justify-center backdrop-blur-sm cursor-pointer active:scale-95">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  {t('total_gain')}
                </span>
                <p className="text-sm font-bold text-foreground mb-1 truncate w-full px-2">{asset.ticker}</p>
                <p className={`text-base font-bold tracking-tight ${asset.historicalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  <AnimatedNumber value={asset.historicalPnl} format="pnl" hide={hideBalances} />
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <PerformanceModal open={performanceOpen} onOpenChange={setPerformanceOpen} currentPnl24h={totals.totalPnl24h} currentTotalValue={totals.totalValue} currentTotalCost={totals.totalCost} />
      <WithdrawCashModal open={withdrawModalOpen} onOpenChange={setWithdrawModalOpen} cashAssetId={cashAssetId || ""} />
    </>
  )
}
