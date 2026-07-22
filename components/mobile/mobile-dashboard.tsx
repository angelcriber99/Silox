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

import { MobileAssetCard } from "@/components/mobile/mobile-asset-card"
import { RevolutSync } from "@/components/transactions/revolut-sync"
import { usePreferences } from "@/lib/stores/use-preferences"
import { useQuickAdd } from "@/lib/stores/use-quick-add"
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

type PerformanceMode = "session" | "day"
type SortMode = "value" | "day"

const MARKET_LABELS: Record<string, string> = {
  PRE: "Premercado",
  REGULAR: "Mercado regular",
  POST: "Postmercado",
  OPEN: "Mercado abierto",
  CLOSED: "Mercado cerrado",
}

const SESSION_LABELS: Record<string, string> = {
  PRE: "Pre",
  REGULAR: "Regular",
  POST: "Post",
  OPEN: "Sesión",
  CLOSED: "Última sesión",
}

const ALLOCATION_COLORS: Record<string, string> = {
  "Fondo Indexado": "bg-violet-500",
  ETF: "bg-blue-500",
  Acción: "bg-amber-400",
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
  const { format: formatDisplay } = useDisplayCurrency()
  const { openEmpty } = useQuickAdd()
  const [search, setSearch] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("value")
  const [performanceMode, setPerformanceMode] = useState<PerformanceMode>("session")

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
      .slice()
      .sort((left, right) =>
        sortMode === "day"
          ? Math.abs((right.displayDailyPnL?.amount ?? null) ?? 0) - Math.abs((left.displayDailyPnL?.amount ?? null) ?? 0)
          : ((right.displayValue?.amount ?? null) ?? 0) - ((left.displayValue?.amount ?? null) ?? 0),
      )
  }, [activePositions, search, sortMode])

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
      color: ALLOCATION_COLORS[type] ?? "bg-primary",
    })).sort((left, right) => right.weight - left.weight)
  }, [activePositions])

  const marketOpen = ["PRE", "REGULAR", "POST", "OPEN"].includes(marketState)
  const sessionMode = performanceMode === "session"
  const performanceAmount = sessionMode ? totals.sessionPnlMoney.amount : totals.pnl24hMoney.amount
  const performancePercent = sessionMode ? totals.totalPnlPercent24h : totals.totalDailyPnlPercent
  const performancePositive = performanceAmount >= 0
  
  const primaryCost = totals.netContributionsMoney?.amount ?? totals.costMoney.amount
  const displayPnl = totals.valueMoney.amount - primaryCost
  const totalPositive = displayPnl >= 0
  
  const updatedLabel = pricesUpdatedAt
    ? new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(pricesUpdatedAt)
    : null

  return (
    <div className="min-h-full bg-background pb-4 text-foreground">
      <header className="px-4 pb-4 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="flex h-11 items-center justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-primary text-sm font-black text-primary-foreground">
              S
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-none">Silox</p>
              <div className="mt-1.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${marketOpen ? "bg-emerald-400" : "bg-zinc-500"}`} />
                <span className="truncate">{MARKET_LABELS[marketState] ?? "Mercado cerrado"}</span>
                {updatedLabel && <span className="shrink-0">· {updatedLabel}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setHideBalances(!hideBalances)}
              className="touch-target rounded-full text-muted-foreground transition-colors active:bg-muted active:text-foreground"
              aria-label={hideBalances ? "Mostrar saldos" : "Ocultar saldos"}
            >
              {hideBalances ? <Eye className="h-[18px] w-[18px]" /> : <EyeOff className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>

        <section className="mt-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-muted-foreground">Valor de la cartera</p>
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${marketOpen ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
              {marketOpen ? "En directo" : "Cerrado"}
            </span>
          </div>

          <p className="mt-2 truncate text-[34px] font-bold leading-none tracking-[-0.045em] tabular-nums">
            {isLoading || hideBalances ? "••••••" : formatDisplay(totals.valueMoney.amount)}
          </p>

          <div className="mt-4 flex rounded-xl bg-muted/70 p-1" aria-label="Periodo del rendimiento">
            <PerformanceTab
              active={sessionMode}
              label={SESSION_LABELS[marketState] ?? "Sesión"}
              onClick={() => setPerformanceMode("session")}
            />
            <PerformanceTab active={!sessionMode} label="Día completo" onClick={() => setPerformanceMode("day")} />
          </div>

          <div className="mt-3 flex items-end justify-between gap-4" aria-live="polite">
            <div>
              <p className="text-[11px] text-muted-foreground">
                {sessionMode ? "Rendimiento del periodo activo" : "Acumulado de pre, regular y post"}
              </p>
              <div className={`mt-1 flex items-baseline gap-2 font-semibold tabular-nums ${performancePositive ? "text-emerald-500" : "text-rose-500"}`}>
                <span className="text-base">
                  {hideBalances ? "••••" : `${performancePositive ? "+" : ""}${formatDisplay(performanceAmount)}`}
                </span>
                <span className="text-sm">{hideBalances ? "••" : formatPercent(performancePercent)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 border-t border-border/60 pt-3">
            <div className="min-w-0 px-2 first:pl-0 last:pr-0 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-border/60">
              <p className="truncate text-[10px] text-muted-foreground" title="Capital neto aportado de tu bolsillo">Aportado neto</p>
              <p className="mt-1 truncate text-xs font-semibold tabular-nums text-foreground">
                {hideBalances ? "••••" : formatDisplay(totals.netContributionsMoney?.amount ?? totals.costMoney.amount)}
              </p>
              {totals.netContributionsMoney !== undefined && (
                <p className="mt-0.5 truncate text-[9px] text-muted-foreground/70" title="Coste Contable FIFO (valor a efectos fiscales)">
                  FIFO: {hideBalances ? "•••" : formatDisplay(totals.costMoney.amount)}
                </p>
              )}
            </div>
            <Metric
              label="P&L total"
              value={hideBalances ? "••••" : `${totalPositive ? "+" : ""}${formatDisplay(displayPnl)}`}
              valueClassName={totalPositive ? "text-emerald-500" : "text-rose-500"}
            />
            <Metric label="Posiciones" value={String(activePositions.length)} />
          </div>
        </section>

        {allocation.length > 0 && (
          <section className="mt-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5" aria-label="Distribución de la cartera">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
              {allocation.map((item) => (
                <span key={item.type} className={item.color} style={{ width: `${item.weight}%` }} />
              ))}
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-2 overflow-hidden">
              <p className="shrink-0 text-xs font-semibold">Distribución</p>
              <div className="flex min-w-0 items-center justify-end gap-2.5 overflow-hidden">
                {allocation.slice(0, 3).map((item) => (
                  <span key={item.type} className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.color}`} />
                    <span className="truncate">{item.type}</span>
                    <strong className="font-semibold tabular-nums text-foreground">{item.weight.toFixed(0)}%</strong>
                  </span>
                ))}
              </div>
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
        <div className="flex items-end justify-between px-4">
          <div>
            <h1 id="positions-title" className="text-lg font-semibold tracking-tight">Posiciones</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">{visiblePositions.length} activos</p>
          </div>
          <div className="flex rounded-lg bg-muted/70 p-1" aria-label="Orden de activos">
            <SortTab active={sortMode === "value"} label="Valor" onClick={() => setSortMode("value")} />
            <SortTab active={sortMode === "day"} label="Día" onClick={() => setSortMode("day")} />
          </div>
        </div>

        <div className="relative mx-4 mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar activo"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
          />
          <SlidersHorizontal className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        </div>

        <div className="mt-3 border-y border-border/60 bg-card/40">
          {isLoading ? (
            <div className="space-y-2 p-4">
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
              totalPortfolioValue={totals.valueMoney.amount}
              performanceMode={performanceMode}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

interface ToggleTabProps {
  active: boolean
  label: string
  onClick: () => void
}

function PerformanceTab({ active, label, onClick }: ToggleTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 flex-1 rounded-lg px-2 text-xs font-semibold transition-colors ${active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
      aria-pressed={active}
    >
      {label}
    </button>
  )
}

function SortTab({ active, label, onClick }: ToggleTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 rounded-md px-2.5 text-[11px] font-semibold transition-colors ${active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
      aria-pressed={active}
    >
      {label}
    </button>
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
