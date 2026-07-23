"use client"

import { useMemo, useState } from "react"
import {
  Bell,
  Eye,
  EyeOff,
  Headphones,
  Search,
  Share2,
} from "lucide-react"

import { MobileAssetCard } from "@/components/mobile/mobile-asset-card"
import { SharePortfolioModal } from "@/components/dashboard/share-portfolio-modal"
import { usePreferences } from "@/lib/stores/use-preferences"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import { formatPercent } from "@/lib/utils/formatters"
import { useDisplayCurrency } from "@/lib/hooks/use-display-currency"

interface MobileDashboardProps {
  positions: EnrichedPosition[]
  totals: PortfolioTotals
  isLoading: boolean
  marketState?: string
  pricesUpdatedAt?: number
  pendingCount?: number
}

const ALLOCATION_COLORS: Record<string, string> = {
  "Fondo Indexado": "bg-violet-500",
  ETF: "bg-blue-500",
  Acción: "bg-black dark:bg-white",
  Crypto: "bg-amber-400",
  Metal: "bg-zinc-400",
}

export function MobileDashboard({
  positions,
  totals,
  isLoading,
  marketState = "CLOSED",
}: MobileDashboardProps) {
  const { hideBalances, setHideBalances } = usePreferences()
  const { format: formatDisplay } = useDisplayCurrency()
  const [search, setSearch] = useState("")

  const activePositions = useMemo(
    () => positions.filter((position) => position.unidades > 0),
    [positions],
  )

  const visiblePositions = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es")
    return activePositions
      .filter((position) =>
        !term || `${position.ticker} ${position.nombre ?? ""}`.toLocaleLowerCase("es").includes(term),
      )
      .sort((left, right) => ((right.displayValue?.amount ?? null) ?? 0) - ((left.displayValue?.amount ?? null) ?? 0))
  }, [activePositions, search])

  const allocation = useMemo(() => {
    const byType = new Map<string, number>()
    for (const position of activePositions) {
      const value = (position.displayValue?.amount ?? null) ?? position.displayCost.amount
      byType.set(position.tipo, (byType.get(position.tipo) ?? 0) + value)
    }
    const total = Array.from(byType.values()).reduce((sum, value) => sum + value, 0)
    return Array.from(byType, ([type, value]) => ({
      type,
      weight: total > 0 ? (value / total) * 100 : 0,
      color: ALLOCATION_COLORS[type] ?? "bg-zinc-800",
    })).sort((left, right) => right.weight - left.weight)
  }, [activePositions])

  const primaryCost = totals.netContributionsMoney?.amount ?? totals.costMoney.amount
  const displayPnl = totals.valueMoney.amount - primaryCost

  const [shareOpen, setShareOpen] = useState(false)

  return (
    <div className="min-h-[100dvh] bg-[#F5F5F7] dark:bg-zinc-950 pb-[100px] text-foreground">
      <SharePortfolioModal 
        open={shareOpen} 
        onOpenChange={setShareOpen} 
        positions={positions} 
        totals={totals} 
      />

      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      {/* HEADER */}
      <header className="px-6 pb-4 pt-[max(24px,env(safe-area-inset-top))] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            {/* Placeholder avatar, can be replaced with real user image later */}
            <div className="flex h-full w-full items-center justify-center text-lg font-bold text-zinc-500">
              S
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShareOpen(true)} className="text-zinc-600 dark:text-zinc-400 active:scale-95 transition-transform">
            <Share2 className="h-6 w-6" strokeWidth={1.8} />
          </button>
          <button className="text-zinc-600 dark:text-zinc-400">
            <Headphones className="h-6 w-6" strokeWidth={1.8} />
          </button>
          <button className="relative text-zinc-600 dark:text-zinc-400">
            <Bell className="h-6 w-6" strokeWidth={1.8} />
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border-2 border-[#F5F5F7] dark:border-zinc-950">
              4
            </span>
          </button>
        </div>
      </header>

      {/* TOTAL BALANCE CARD */}
      <div className="px-5 mt-2">
        <section className="rounded-[32px] bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-medium text-zinc-500 dark:text-zinc-400">Total Balance</p>
            <button
              onClick={() => setHideBalances(!hideBalances)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
            >
              {hideBalances ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <p className="mt-2 text-[40px] font-bold leading-none tracking-tight text-zinc-900 dark:text-white tabular-nums">
            {isLoading || hideBalances ? "••••••" : formatDisplay(totals.valueMoney.amount)}
          </p>

          <div className="mt-8 flex gap-3">
            {/* Aportado (Payment Next equivalent) */}
            <div className="flex-1 rounded-2xl bg-[#F5F5F7] dark:bg-zinc-800/50 p-4">
              <p className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400">Capital Aportado</p>
              <p className="mt-1 text-[16px] font-semibold text-zinc-900 dark:text-white tabular-nums">
                {hideBalances ? "••••" : formatDisplay(primaryCost)}
              </p>
            </div>
            
            {/* P&L (Payment Completed equivalent) */}
            <div className="flex-1 rounded-2xl bg-[#F5F5F7] dark:bg-zinc-800/50 p-4">
              <p className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400">Beneficio Total</p>
              <p className="mt-1 text-[16px] font-semibold text-zinc-900 dark:text-white tabular-nums">
                {hideBalances ? "••••" : formatDisplay(displayPnl)}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* CARD LIMITS (Distribucion) */}
      {allocation.length > 0 && (
        <div className="px-5 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-zinc-900 dark:text-white">Distribución</h2>
            <span className="text-[14px] font-medium text-zinc-500">100%</span>
          </div>
          
          <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            {allocation.map((item) => (
              <span key={item.type} className={`${item.color} transition-all duration-500`} style={{ width: `${item.weight}%` }} />
            ))}
          </div>
          
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {allocation.slice(0, 3).map((item) => (
              <div key={item.type} className="flex items-center gap-1.5 text-[12px] text-zinc-500">
                <span className={`h-2 w-2 rounded-full ${item.color}`} />
                <span className="font-medium">{item.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRANSACTIONS (Posiciones) */}
      <div className="px-5 mt-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[20px] font-bold text-zinc-900 dark:text-white">Posiciones</h2>
        </div>
        <p className="text-[14px] font-medium text-zinc-500 mb-4">Activas</p>

        <div className="space-y-0 pb-10">
          {isLoading ? (
            <div className="space-y-4">
              {[0, 1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />)}
            </div>
          ) : visiblePositions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-zinc-500">Sin posiciones abiertas</p>
            </div>
          ) : visiblePositions.map((position) => (
            <MobileAssetCard
              key={position.activo_id}
              position={position}
              totalPortfolioValue={totals.valueMoney.amount}
              performanceMode="session"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
