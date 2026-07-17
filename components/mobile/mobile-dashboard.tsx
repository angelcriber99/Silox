"use client"

import { useMemo, useState } from "react"
import {
  Bell,
  Eye,
  EyeOff,
  FileUp,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react"

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
  pricesUpdatedAt?: number
  pendingCount?: number
}

type SortMode = "value" | "day"

const MARKET_LABELS: Record<string, string> = {
  PRE: "Premercado",
  REGULAR: "Mercado abierto",
  POST: "Postmercado",
  OPEN: "Mercado abierto",
  CLOSED: "Mercado cerrado",
}

const ALLOCATION_COLORS: Record<string, string> = {
  "Fondo Indexado": "bg-violet-500",
  ETF: "bg-blue-500",
  "Acción": "bg-amber-400",
  Crypto: "bg-cyan-400",
  Metal: "bg-zinc-400",
}

export function MobileDashboard({
  positions,
  totals,
  isLoading,
  marketState = "CLOSED",
  pricesUpdatedAt,
  pendingCount = 0,
}: MobileDashboardProps) {
  const { hideBalances, setHideBalances } = usePreferences()
  const { openEmpty } = useQuickAdd()
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("value")

  const activePositions = useMemo(
    () => positions.filter((position) => position.unidades > 0),
    [positions],
  )

  const visiblePositions = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es")
    return activePositions
      .filter((position) => !term || `${position.ticker} ${position.nombre ?? ""}`.toLocaleLowerCase("es").includes(term))
      .slice()
      .sort((left, right) => sortMode === "day"
        ? Math.abs(right.change_amount_24h ?? 0) - Math.abs(left.change_amount_24h ?? 0)
        : (right.valor_actual ?? 0) - (left.valor_actual ?? 0))
  }, [activePositions, search, sortMode])

  const allocation = useMemo(() => {
    const byType = new Map<string, number>()
    for (const position of activePositions) {
      const value = position.valor_actual ?? position.coste_total_eur
      byType.set(position.tipo, (byType.get(position.tipo) ?? 0) + value)
    }
    const total = Array.from(byType.values()).reduce((sum, value) => sum + value, 0)
    return Array.from(byType, ([type, value]) => ({
      type,
      value,
      weight: total > 0 ? (value / total) * 100 : 0,
      color: ALLOCATION_COLORS[type] ?? "bg-primary",
    })).sort((left, right) => right.value - left.value)
  }, [activePositions])

  const dayPositive = totals.totalPnl24h >= 0
  const totalPositive = totals.totalPnl >= 0
  const marketOpen = ["PRE", "REGULAR", "POST", "OPEN"].includes(marketState)
  const updatedLabel = pricesUpdatedAt
    ? new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(pricesUpdatedAt)
    : null

  return (
    <div className="min-h-full bg-background pb-3 text-foreground">
      <span className="sr-only">Patrimonio total</span>
      <header className="px-4 pb-4 pt-[max(18px,env(safe-area-inset-top))]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-black text-primary-foreground">
              S
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">Silox</p>
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${marketOpen ? "bg-emerald-400" : "bg-zinc-500"}`} />
                <span>{MARKET_LABELS[marketState] ?? "Mercado cerrado"}</span>
                {updatedLabel && <span>· {updatedLabel}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setHideBalances(!hideBalances)}
              className="touch-target rounded-full text-muted-foreground transition-colors active:bg-muted active:text-foreground"
              aria-label={hideBalances ? "Mostrar saldos" : "Ocultar saldos"}
            >
              {hideBalances ? <Eye className="h-[18px] w-[18px]" /> : <EyeOff className="h-[18px] w-[18px]" />}
            </button>
            <button
              type="button"
              onClick={() => setAlertsOpen(true)}
              className="touch-target relative rounded-full text-muted-foreground transition-colors active:bg-muted active:text-foreground"
              aria-label="Abrir alertas"
            >
              <Bell className="h-[18px] w-[18px]" />
              {pendingCount > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-400" />}
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card px-4 py-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Valor del portfolio</p>
              <p className="mt-2 truncate text-[34px] font-bold leading-none tracking-[-0.045em] tabular-nums">
                {isLoading || hideBalances ? "••••••" : formatCurrency(totals.totalValue)}
              </p>
              <div className={`mt-3 flex items-center gap-2 text-sm font-semibold ${dayPositive ? "text-emerald-500" : "text-rose-500"}`}>
                <span>{hideBalances ? "•••" : `${dayPositive ? "+" : ""}${formatCurrency(totals.totalPnl24h)}`}</span>
                <span>{hideBalances ? "••" : formatPercent(totals.totalDailyPnlPercent)}</span>
                <span className="font-normal text-muted-foreground">hoy</span>
              </div>
            </div>
            <span className={`mt-1 rounded-full px-2 py-1 text-[10px] font-semibold ${marketOpen ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
              {marketOpen ? "En directo" : "Cerrado"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 border-t border-border/60 pt-3">
            <Metric label="Aportado neto" value={hideBalances ? "••••" : formatCurrency(totals.totalCost)} />
            <Metric
              label="P&L total"
              value={hideBalances ? "••••" : `${totalPositive ? "+" : ""}${formatCurrency(totals.totalPnl)}`}
              valueClassName={totalPositive ? "text-emerald-500" : "text-rose-500"}
            />
            <Metric label="Posiciones" value={String(activePositions.length)} />
          </div>
        </section>

        {allocation.length > 0 && (
          <section className="mt-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-xs font-semibold">Distribución</p>
              <p className="text-[11px] text-muted-foreground">por tipo</p>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              {allocation.map((item) => (
                <span key={item.type} className={item.color} style={{ width: `${item.weight}%` }} />
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5">
              {allocation.slice(0, 4).map((item) => (
                <div key={item.type} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={`h-1.5 w-1.5 rounded-full ${item.color}`} />
                  <span>{item.type}</span>
                  <span className="font-medium tabular-nums text-foreground">{item.weight.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={openEmpty}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity active:opacity-80"
          >
            <Plus className="h-4 w-4" /> Movimiento
          </button>
          <RevolutSync className="w-full">
            <div className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium transition-colors active:bg-muted">
              <FileUp className="h-4 w-4" /> Importar
            </div>
          </RevolutSync>
        </div>
      </header>

      <section aria-labelledby="positions-title" className="border-t border-border/50 pt-4">
        <div className="flex items-center justify-between px-4">
          <div>
            <h1 id="positions-title" className="text-lg font-semibold tracking-tight">Posiciones</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">{visiblePositions.length} activos en cartera</p>
          </div>
          <button
            type="button"
            onClick={() => setSortMode(sortMode === "value" ? "day" : "value")}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground"
            aria-label="Cambiar orden de activos"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> {sortMode === "value" ? "Valor" : "Día"}
          </button>
        </div>

        <div className="relative mx-4 mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o símbolo"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60"
          />
        </div>

        <div className="mt-3 border-y border-border/60 bg-card/40">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2, 3].map((item) => <div key={item} className="h-[72px] animate-pulse rounded-xl bg-muted" />)}
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

interface MetricProps {
  label: string
  value: string
  valueClassName?: string
}

function Metric({ label, value, valueClassName = "text-foreground" }: MetricProps) {
  return (
    <div className="min-w-0 px-2 first:pl-0 last:pr-0 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-border/60">
      <p className="truncate text-[10px] text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate text-xs font-semibold tabular-nums ${valueClassName}`}>{value}</p>
    </div>
  )
}
