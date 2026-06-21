"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  BarChart3,
  Layers,
} from "lucide-react"
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import type { PortfolioTotals } from '@/lib/types'

interface PortfolioSummaryProps {
  totals: PortfolioTotals
  loading: boolean
}

function SkeletonValue() {
  return (
    <div className="h-7 w-28 rounded bg-zinc-800 animate-shimmer mt-1" />
  )
}

interface KPICardProps {
  label: string
  value: string
  subvalue?: string
  icon: React.ReactNode
  colorClass?: string
  delay?: string
}

function KPICard({
  label,
  value,
  subvalue,
  icon,
  colorClass = "text-zinc-400",
  delay = "stagger-1",
}: KPICardProps) {
  return (
    <Card
      className={`animate-fade-in ${delay} bg-zinc-900/60 border-zinc-800/60 backdrop-blur-sm hover:border-zinc-700/60 transition-all duration-300`}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            {label}
          </span>
          <div className={`${colorClass} opacity-60`}>{icon}</div>
        </div>
        <p
          className={`text-2xl font-bold font-tabular tracking-tight ${colorClass === "text-zinc-400" ? "text-white" : colorClass}`}
        >
          {value}
        </p>
        {subvalue && (
          <p className="text-xs text-zinc-500 mt-1">{subvalue}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function PortfolioSummary({ totals, loading }: PortfolioSummaryProps) {
  const pnlColor =
    totals.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"
  const PnlIcon =
    totals.totalPnl >= 0 ? TrendingUp : TrendingDown

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card
            key={i}
            className="bg-zinc-900/60 border-zinc-800/60"
          >
            <CardContent className="p-5">
              <div className="h-4 w-20 rounded bg-zinc-800 mb-3" />
              <SkeletonValue />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        label="Valor del Portfolio"
        value={
          totals.totalValue > 0
            ? formatCurrency(totals.totalValue)
            : "—"
        }
        subvalue={
          totals.hasAllPrices
            ? "Precios sincronizados"
            : totals.positionCount > 0
              ? "Precios pendientes"
              : undefined
        }
        icon={<Wallet className="h-4 w-4" />}
        colorClass="text-zinc-400"
        delay="stagger-1"
      />
      <KPICard
        label="Total Invertido"
        value={
          totals.totalCost > 0
            ? formatCurrency(totals.totalCost)
            : "—"
        }
        subvalue={
          totals.positionCount > 0
            ? `${totals.positionCount} posición(es)`
            : undefined
        }
        icon={<PiggyBank className="h-4 w-4" />}
        colorClass="text-zinc-400"
        delay="stagger-2"
      />
      <KPICard
        label="Beneficio / Pérdida"
        value={
          totals.totalCost > 0
            ? formatPnl(totals.totalPnl)
            : "—"
        }
        icon={<PnlIcon className="h-4 w-4" />}
        colorClass={totals.totalCost > 0 ? pnlColor : "text-zinc-400"}
        delay="stagger-3"
      />
      <KPICard
        label="Rentabilidad"
        value={
          totals.totalCost > 0
            ? formatPercent(totals.totalPnlPercent)
            : "—"
        }
        subvalue={
          totals.totalCost > 0
            ? totals.totalPnl >= 0
              ? "En positivo"
              : "En negativo"
            : undefined
        }
        icon={
          totals.totalCost > 0 ? (
            <BarChart3 className="h-4 w-4" />
          ) : (
            <Layers className="h-4 w-4" />
          )
        }
        colorClass={totals.totalCost > 0 ? pnlColor : "text-zinc-400"}
        delay="stagger-4"
      />
    </div>
  )
}
