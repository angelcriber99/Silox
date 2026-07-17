"use client"

import { useMemo, useState } from "react"
import { Bell, Eye, EyeOff, FileUp, Plus, Search, SlidersHorizontal } from "lucide-react"

import { PriceAlerts } from "@/components/dashboard/price-alerts"
import { MobileAssetCard } from "@/components/mobile/mobile-asset-card"
import { RevolutSync } from "@/components/transactions/revolut-sync"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import { usePreferences } from "@/lib/stores/use-preferences"
import { useQuickAdd } from "@/lib/stores/use-quick-add"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"

interface MobileDashboardProps {
  positions: EnrichedPosition[]
  totals: PortfolioTotals
  isLoading: boolean
  marketState?: string
}

type SortMode = "value" | "day"

const MARKET_LABELS: Record<string, string> = {
  PRE: "Premercado",
  REGULAR: "Mercado abierto",
  POST: "Postmercado",
  OPEN: "Mercado abierto",
  CLOSED: "Mercado cerrado",
}

export function MobileDashboard({
  positions,
  totals,
  isLoading,
  marketState = "CLOSED",
}: MobileDashboardProps) {
  const { hideBalances, setHideBalances } = usePreferences()
  const { openEmpty } = useQuickAdd()
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("value")

  const visiblePositions = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es")
    return positions
      .filter((position) => position.unidades > 0)
      .filter((position) => !term || `${position.ticker} ${position.nombre ?? ""}`.toLocaleLowerCase("es").includes(term))
      .sort((left, right) => sortMode === "day"
        ? Math.abs(right.change_amount_24h ?? 0) - Math.abs(left.change_amount_24h ?? 0)
        : (right.valor_actual ?? 0) - (left.valor_actual ?? 0))
  }, [positions, search, sortMode])

  const dayPositive = totals.totalPnl24h >= 0
  const marketOpen = ["PRE", "REGULAR", "POST", "OPEN"].includes(marketState)

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="border-b border-border/60 px-4 pb-5 pt-[max(16px,env(safe-area-inset-top))]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Patrimonio total</p>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${marketOpen ? "bg-emerald-400" : "bg-zinc-500"}`} />
              {MARKET_LABELS[marketState] ?? "Mercado cerrado"}
              {totals.estimatedPositionCount > 0 && <span>· {totals.estimatedPositionCount} pendiente(s)</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHideBalances(!hideBalances)}
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
            aria-label={hideBalances ? "Mostrar saldos" : "Ocultar saldos"}
          >
            {hideBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>

        <p className="text-[36px] font-bold leading-none tracking-[-0.04em] tabular-nums">
          {isLoading || hideBalances ? "••••••" : formatCurrency(totals.totalValue)}
        </p>
        <div className={`mt-3 flex items-center gap-2 text-sm font-semibold ${dayPositive ? "text-emerald-500" : "text-rose-500"}`}>
          <span>{hideBalances ? "•••" : `${dayPositive ? "+" : ""}${formatCurrency(totals.totalPnl24h)}`}</span>
          <span className="rounded-md bg-current/10 px-1.5 py-0.5 text-xs">
            {hideBalances ? "••" : formatPercent(totals.totalDailyPnlPercent)}
          </span>
          <span className="font-normal text-muted-foreground">hoy</span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <button type="button" onClick={openEmpty} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
            <Plus className="h-4 w-4" /> Movimiento
          </button>
          <RevolutSync className="w-full">
            <div className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium">
              <FileUp className="h-4 w-4" /> Importar
            </div>
          </RevolutSync>
          <button type="button" onClick={() => setAlertsOpen(true)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium">
            <Bell className="h-4 w-4" /> Alertas
          </button>
        </div>
      </header>

      <section aria-labelledby="positions-title" className="pt-4">
        <div className="flex items-center gap-2 px-4">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar activo"
              className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary/60"
            />
          </div>
          <button
            type="button"
            onClick={() => setSortMode(sortMode === "value" ? "day" : "value")}
            className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-medium"
            aria-label="Cambiar orden de activos"
          >
            <SlidersHorizontal className="h-4 w-4" /> {sortMode === "value" ? "Valor" : "Día"}
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between px-4 pb-2">
          <h2 id="positions-title" className="text-sm font-semibold">Activos</h2>
          <span className="text-xs text-muted-foreground">{visiblePositions.length} posiciones</span>
        </div>

        <div className="border-y border-border/60 bg-card/30">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-muted" />)}
            </div>
          ) : visiblePositions.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-sm font-medium">Sin posiciones abiertas</p>
              <p className="mt-1 text-xs text-muted-foreground">Prueba otra búsqueda o añade tu primer movimiento.</p>
            </div>
          ) : visiblePositions.map((position) => (
            <MobileAssetCard
              key={position.activo_id}
              position={position}
              totalPortfolioValue={totals.totalValue}
            />
          ))}
        </div>
      </section>

      <PriceAlerts open={alertsOpen} onOpenChange={setAlertsOpen} />
    </div>
  )
}
