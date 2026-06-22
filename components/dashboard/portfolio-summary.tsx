"use client"

import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import { Target, Briefcase, Wallet, BarChart2, TrendingUp, TrendingDown } from "lucide-react"
import { usePreferences } from "@/lib/stores/use-preferences"
import type { PortfolioTotals } from '@/lib/types'
import { useState } from "react"
import { PerformanceModal } from "./performance-modal"

interface PortfolioSummaryProps {
  totals: PortfolioTotals
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
}: KPICardProps) {
  return (
    <Card
      className={`animate-fade-in ${delay} bg-card border-border backdrop-blur-sm hover:border-border/60 transition-all duration-300 relative`}
    >
      <CardContent className="p-5">
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
          <>
            <p className={`text-2xl font-bold font-tabular tracking-tight ${valueColor}`}>
              {value}
            </p>
            {subvalue && (
              <p className="text-xs text-muted-foreground/80 mt-1">{subvalue}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function PortfolioSummary({
  totals,
  loading = false,
}: PortfolioSummaryProps) {
  const { hideBalances } = usePreferences()
  const [performanceOpen, setPerformanceOpen] = useState(false)
  const isPositive = totals.totalPnl >= 0

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Valor del Portfolio"
          value={hideBalances ? "****" : formatCurrency(totals.totalValue)}
          subvalue={hideBalances ? null : (totals.hasAllPrices ? "Precios sincronizados" : "Precios pendientes")}
          icon={<Wallet className="w-5 h-5 text-muted-foreground/50" />}
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
          action={
            <button 
              onClick={() => setPerformanceOpen(true)}
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Ver gráfico de rendimiento"
            >
              <BarChart2 className="w-4 h-4" />
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
                {totals.totalPnlPercent24h > 0 ? "+" : ""}{formatPercent(totals.totalPnlPercent24h)}
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

      <PerformanceModal open={performanceOpen} onOpenChange={setPerformanceOpen} />
    </>
  )
}
