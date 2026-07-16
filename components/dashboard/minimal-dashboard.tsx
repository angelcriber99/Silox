"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileUp,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react"

import type { EnrichedPosition, EventoRecurrente, PortfolioTotals } from "@/lib/types"
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import { usePreferences } from "@/lib/stores/use-preferences"
import { AssetLogo } from "@/components/ui/asset-logo"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AddAssetModal } from "@/components/asset/add-asset-modal"
import { PriceAlerts } from "@/components/dashboard/price-alerts"
import { RevolutSync } from "@/components/transactions/revolut-sync"

interface MinimalDashboardProps {
  positions: EnrichedPosition[]
  totals: PortfolioTotals
  loading: boolean
  marketState?: string
  pricesUpdatedAt?: string | number | null
  realtimeStatus?: "connecting" | "connected" | "disconnected"
  onRefresh?: () => void
  onAddTransaction: (position: EnrichedPosition) => void
  onEditAsset: (position: EnrichedPosition) => void
  onAddEvent: () => void
  onEditEvent: (event: EventoRecurrente) => void
}

const ALL_TYPES = "Todos"
const MARKET_LABELS: Record<string, string> = {
  REGULAR: "Mercado",
  PRE: "Pre",
  POST: "Post",
  CLOSED: "Cerrado",
  OPEN: "Abierto",
}

function performanceClass(value: number | null | undefined) {
  if ((value ?? 0) > 0) return "text-emerald-500"
  if ((value ?? 0) < 0) return "text-rose-500"
  return "text-muted-foreground"
}

function SignedValue({ value, kind }: { value: number | null; kind: "currency" | "percent" }) {
  const hideBalances = usePreferences((state) => state.hideBalances)
  if (hideBalances) return <span className="text-muted-foreground">••••</span>
  if (value === null) return <span className="text-muted-foreground">—</span>
  return <span className={`font-semibold tabular-nums ${performanceClass(value)}`}>{kind === "currency" ? formatPnl(value) : formatPercent(value)}</span>
}

function DashboardSkeleton() {
  return <div className="h-[calc(100dvh-112px)] animate-pulse bg-muted/20 md:h-[calc(100dvh-96px)]" />
}

export function MinimalDashboard({
  positions,
  totals,
  loading,
  marketState = "CLOSED",
  pricesUpdatedAt,
  realtimeStatus = "connecting",
  onRefresh,
  onAddTransaction,
  onEditAsset,
  onAddEvent,
}: MinimalDashboardProps) {
  const preferences = usePreferences()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES)
  const [page, setPage] = useState(0)
  const [autoPageSize, setAutoPageSize] = useState(5)
  const [addAssetOpen, setAddAssetOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)

  useEffect(() => {
    const update = () => setAutoPageSize(window.innerWidth >= 1280 && window.innerHeight >= 800 ? 12 : window.innerWidth >= 768 ? 8 : window.innerHeight < 720 ? 4 : 5)
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const activePositions = useMemo(() => positions.filter((position) => position.unidades > 0), [positions])
  const positionTypes = useMemo(() => [ALL_TYPES, ...Array.from(new Set(activePositions.map((position) => position.tipo))).sort()], [activePositions])
  const pageSize = preferences.dashboardPageSize === "auto" ? autoPageSize : preferences.dashboardPageSize
  const sortedPositions = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es")
    const getSortValue = (position: EnrichedPosition) => {
      if (preferences.dashboardSort === "day") return position.change_amount_24h ?? 0
      if (preferences.dashboardSort === "session") return position.change_percent_24h ?? 0
      if (preferences.dashboardSort === "pnl") return position.pnl_percent ?? 0
      return position.valor_actual ?? 0
    }
    return activePositions
      .filter((position) => typeFilter === ALL_TYPES || position.tipo === typeFilter)
      .filter((position) => !normalizedSearch || [position.ticker, position.nombre, position.isin].filter(Boolean).some((value) => value!.toLocaleLowerCase("es").includes(normalizedSearch)))
      .sort((left, right) => getSortValue(right) - getSortValue(left))
  }, [activePositions, preferences.dashboardSort, search, typeFilter])
  const pageCount = Math.max(1, Math.ceil(sortedPositions.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const visiblePositions = sortedPositions.slice(safePage * pageSize, (safePage + 1) * pageSize)

  if (loading) return <DashboardSkeleton />

  const hide = preferences.hideBalances
  const updatedLabel = pricesUpdatedAt ? new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(pricesUpdatedAt)) : "—"
  const compact = preferences.dashboardDensity !== "comfortable"
  const textScale = preferences.fontScale === "large" ? "text-[15px]" : preferences.fontScale === "small" ? "text-xs" : "text-sm"

  return (
    <div className={`h-[calc(100dvh-112px)] overflow-hidden bg-background md:h-[calc(100dvh-96px)] ${textScale}`}>
      <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col gap-3 px-3 py-3 sm:px-5 lg:px-7">
        <header className="grid shrink-0 grid-cols-[1fr_auto] items-start gap-3 border-b border-border/70 pb-3 lg:grid-cols-[1.15fr_1fr_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
              {preferences.showMarketStatus && <span className="inline-flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${marketState === "CLOSED" ? "bg-muted-foreground" : "bg-emerald-500"}`} />{MARKET_LABELS[marketState] ?? marketState}</span>}
              <span className="inline-flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${realtimeStatus === "connected" ? "bg-emerald-500" : realtimeStatus === "connecting" ? "bg-amber-500" : "bg-rose-500"}`} />{realtimeStatus === "connected" ? "Datos en vivo" : realtimeStatus === "connecting" ? "Conectando" : "Sin conexión"}</span>
              {preferences.showLastUpdate && <span className="hidden sm:inline">Actualizado {updatedLabel}</span>}
            </div>
            <button type="button" onClick={() => preferences.setHideBalances(!hide)} className="mt-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={hide ? "Mostrar saldos" : "Ocultar saldos"}>
              <span className="block text-[11px] text-muted-foreground">Patrimonio</span>
              <span className="block text-2xl font-semibold tracking-[-0.035em] sm:text-3xl"><AnimatedNumber value={totals.totalValue} format="currency" hide={hide} /></span>
            </button>
          </div>

          <div className="hidden grid-cols-3 gap-5 lg:grid">
            <div><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Hoy</span><p className={`mt-1 font-semibold tabular-nums ${performanceClass(totals.totalPnl24h)}`}>{hide ? "••••" : `${formatPnl(totals.totalPnl24h)} · ${formatPercent(totals.totalDailyPnlPercent)}`}</p></div>
            <div><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Sesión</span><p className={`mt-1 font-semibold tabular-nums ${performanceClass(totals.totalPnlPercent24h)}`}>{hide ? "••••" : formatPercent(totals.totalPnlPercent24h)}</p></div>
            <div><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</span><p className={`mt-1 font-semibold tabular-nums ${performanceClass(totals.totalPnlPercent)}`}>{hide ? "••••" : formatPercent(totals.totalPnlPercent)}</p></div>
          </div>

          <div className="flex items-center justify-end gap-1.5">
            <Button variant="ghost" size="icon-sm" onClick={onRefresh} aria-label="Actualizar precios"><RefreshCw /></Button>
            <Button variant="ghost" size="icon-sm" onClick={() => preferences.setHideBalances(!hide)} aria-label={hide ? "Mostrar saldos" : "Ocultar saldos"}>{hide ? <EyeOff /> : <Eye />}</Button>
            <RevolutSync><span role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") event.currentTarget.parentElement?.querySelector("input")?.click() }} className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label="Importar movimientos"><FileUp className="size-4" /></span></RevolutSync>
            <Button variant="ghost" size="icon-sm" onClick={() => setAlertsOpen(true)} aria-label="Alertas"><Bell /></Button>
            <Button size="sm" onClick={() => setAddAssetOpen(true)}><Plus /><span className="hidden sm:inline">Activo</span></Button>
          </div>

          <div className="col-span-2 grid grid-cols-3 gap-2 lg:hidden">
            <div><span className="text-[9px] uppercase text-muted-foreground">Hoy</span><p className={performanceClass(totals.totalPnl24h)}>{hide ? "••••" : `${formatPnl(totals.totalPnl24h)} · ${formatPercent(totals.totalDailyPnlPercent)}`}</p></div>
            <div><span className="text-[9px] uppercase text-muted-foreground">Sesión</span><p className={performanceClass(totals.totalPnlPercent24h)}>{hide ? "••••" : formatPercent(totals.totalPnlPercent24h)}</p></div>
            <div><span className="text-[9px] uppercase text-muted-foreground">Total</span><p className={performanceClass(totals.totalPnlPercent)}>{hide ? "••••" : formatPercent(totals.totalPnlPercent)}</p></div>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col" aria-labelledby="positions-heading">
          <div className="mb-2 flex shrink-0 items-center gap-2">
            <div className="mr-auto"><h1 id="positions-heading" className="font-semibold">Posiciones <span className="font-normal text-muted-foreground">{activePositions.length}</span></h1><p className="hidden text-[11px] text-muted-foreground sm:block">Sesión, día acumulado y rendimiento total sin mezclar periodos.</p></div>
            <div className="relative w-32 sm:w-52"><Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Buscar" className="h-8 pl-7 text-xs" /></div>
            <label className="relative w-9 sm:w-36"><span className="sr-only">Filtrar</span><SlidersHorizontal className="absolute left-2.5 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" /><select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(0) }} className="h-8 w-full appearance-none rounded-lg border border-input bg-background pl-8 pr-2 text-xs outline-none"><option value={ALL_TYPES}>Todos</option>{positionTypes.slice(1).map((type) => <option key={type}>{type}</option>)}</select></label>
            <Button variant="outline" size="sm" onClick={onAddEvent} className="hidden sm:inline-flex">Evento</Button>
          </div>

          <div className="hidden shrink-0 grid-cols-[minmax(190px,1.5fr)_repeat(5,minmax(80px,.7fr))_72px] gap-3 border-b border-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground lg:grid">
            <span>Activo</span><span className="text-right">Precio</span><span className="text-right">Valor</span>{preferences.showSessionPerformance && <span className="text-right">Sesión</span>}{preferences.showDailyPerformance && <span className="text-right">Hoy</span>}{preferences.showTotalPerformance && <span className="text-right">Total</span>}<span />
          </div>
          <div className="min-h-0 flex-1 divide-y divide-border/60 overflow-hidden">
            {visiblePositions.map((position) => (
              <article key={position.activo_id} className={`grid items-center gap-2 px-1 transition-colors hover:bg-muted/30 lg:grid-cols-[minmax(190px,1.5fr)_repeat(5,minmax(80px,.7fr))_72px] lg:gap-3 ${compact ? "py-1.5" : "py-3"}`}>
                <Link href={`/activo/${position.activo_id}`} className="flex min-w-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <AssetLogo ticker={position.ticker} name={position.nombre} type={position.tipo} size={compact ? 34 : 42} />
                  <span className="min-w-0"><strong className="block truncate text-xs sm:text-sm">{position.ticker.split(".")[0]}</strong>{preferences.showAssetNames && <span className="block truncate text-[10px] text-muted-foreground sm:text-xs">{position.nombre || position.isin || "Sin nombre"}</span>}{preferences.showAssetTypes && <span className="hidden text-[9px] text-muted-foreground sm:block lg:hidden">{position.tipo}</span>}</span>
                </Link>
                <div className="grid grid-cols-5 items-center gap-2 lg:contents">
                  <div className="text-right"><span className="block text-[9px] text-muted-foreground lg:hidden">Precio</span><span className="tabular-nums">{hide ? "••••" : (position.precio_actual_nativo ?? position.precio_actual) == null ? "—" : formatCurrency((position.precio_actual_nativo ?? position.precio_actual)!, position.original_currency || position.moneda)}</span>{position.price_is_stale && <span className="ml-1 text-amber-500" title="Cotización retrasada">•</span>}</div>
                  <div className="text-right"><span className="block text-[9px] text-muted-foreground lg:hidden">Valor</span><span className="font-semibold tabular-nums">{hide ? "••••" : position.valor_actual == null ? "—" : formatCurrency(position.valor_actual)}</span></div>
                  {preferences.showSessionPerformance && <div className="text-right" title={position.market_session_ends_at ? `La sesión termina a las ${new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: position.market_timezone }).format(new Date(position.market_session_ends_at))} (${position.market_timezone})` : "Mercado sin sesión horaria"}><span className="block text-[9px] text-muted-foreground lg:hidden">{MARKET_LABELS[position.market_state ?? marketState] ?? "Sesión"}</span><SignedValue value={position.change_percent_24h} kind="percent" /></div>}
                  {preferences.showDailyPerformance && <div className="text-right"><span className="block text-[9px] text-muted-foreground lg:hidden">Hoy</span><SignedValue value={position.change_amount_24h} kind="currency" /></div>}
                  {preferences.showTotalPerformance && <div className="text-right"><span className="block text-[9px] text-muted-foreground lg:hidden">Total</span><SignedValue value={position.pnl_percent} kind="percent" /></div>}
                </div>
                <div className="hidden items-center justify-end gap-1 lg:flex"><Button variant="ghost" size="icon-sm" onClick={() => onEditAsset(position)} aria-label={`Editar ${position.ticker}`}><Pencil /></Button><Button variant="outline" size="icon-sm" onClick={() => onAddTransaction(position)} aria-label={`Operar con ${position.ticker}`}><Plus /></Button></div>
              </article>
            ))}
            {visiblePositions.length === 0 && <div className="grid h-full place-items-center text-sm text-muted-foreground">No hay activos que coincidan.</div>}
          </div>

          <footer className="flex shrink-0 items-center justify-between border-t border-border/70 pt-2 text-[11px] text-muted-foreground">
            <span>{sortedPositions.length ? `${safePage * pageSize + 1}–${Math.min((safePage + 1) * pageSize, sortedPositions.length)} de ${sortedPositions.length}` : "0 activos"}</span>
            <div className="flex items-center gap-1"><Button variant="ghost" size="icon-sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Página anterior"><ChevronLeft /></Button><span className="min-w-12 text-center">{safePage + 1}/{pageCount}</span><Button variant="ghost" size="icon-sm" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} aria-label="Página siguiente"><ChevronRight /></Button></div>
          </footer>
        </section>
      </div>
      <AddAssetModal open={addAssetOpen} onOpenChange={setAddAssetOpen} />
      <PriceAlerts open={alertsOpen} onOpenChange={setAlertsOpen} />
    </div>
  )
}
