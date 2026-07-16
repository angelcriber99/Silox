"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Bell, ChevronRight, Eye, EyeOff, FileUp, Pencil, Plus, Search, SlidersHorizontal, TrendingDown, TrendingUp } from "lucide-react"

import type { EnrichedPosition, EventoRecurrente, PortfolioTotals } from "@/lib/types"
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import { usePreferences } from "@/lib/stores/use-preferences"
import { AssetLogo } from "@/components/ui/asset-logo"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AddAssetModal } from "@/components/asset/add-asset-modal"
import { PriceAlerts } from "@/components/dashboard/price-alerts"
import { UpcomingEvents } from "@/components/market/upcoming-events"
import { RevolutSync } from "@/components/transactions/revolut-sync"

interface MinimalDashboardProps {
  positions: EnrichedPosition[]
  totals: PortfolioTotals
  loading: boolean
  marketState?: string
  pricesUpdatedAt?: string | number | null
  onAddTransaction: (position: EnrichedPosition) => void
  onEditAsset: (position: EnrichedPosition) => void
  onAddEvent: () => void
  onEditEvent: (event: EventoRecurrente) => void
}

const ALL_TYPES = "Todos"
const MARKET_LABELS: Record<string, string> = {
  REGULAR: "Mercado abierto",
  PRE: "Premercado",
  POST: "Postmercado",
  CLOSED: "Mercado cerrado",
}

function SignedValue({ value, kind }: { value: number | null; kind: "currency" | "percent" }) {
  const { hideBalances } = usePreferences()

  if (hideBalances) return <span className="text-muted-foreground">••••</span>
  if (value === null) return <span className="text-muted-foreground">—</span>

  const className = value > 0 ? "text-emerald-500" : value < 0 ? "text-rose-500" : "text-muted-foreground"
  return <span className={`font-medium tabular-nums ${className}`}>{kind === "currency" ? formatPnl(value) : formatPercent(value)}</span>
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
        <div className="h-12 w-64 animate-pulse rounded-xl bg-muted" />
        <div className="h-5 w-44 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="space-y-3 bg-card p-5"><div className="h-3 w-20 animate-pulse rounded bg-muted" /><div className="h-7 w-28 animate-pulse rounded bg-muted" /></div>)}
      </div>
      <div className="space-y-2">{[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-muted/60" />)}</div>
    </div>
  )
}

export function MinimalDashboard({ positions, totals, loading, marketState = "CLOSED", pricesUpdatedAt, onAddTransaction, onEditAsset, onAddEvent, onEditEvent }: MinimalDashboardProps) {
  const { hideBalances, setHideBalances } = usePreferences()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES)
  const [addAssetOpen, setAddAssetOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)

  const activePositions = useMemo(() => positions.filter((position) => position.unidades > 0), [positions])
  const cashValue = useMemo(() => activePositions.filter((position) => position.tipo === "Liquidez" || position.ticker.startsWith("CASH")).reduce((total, position) => total + (position.valor_actual ?? 0), 0), [activePositions])
  const investedValue = Math.max(0, totals.totalValue - cashValue)
  const positionTypes = useMemo(() => [ALL_TYPES, ...Array.from(new Set(activePositions.map((position) => position.tipo))).sort()], [activePositions])
  const visiblePositions = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es")
    return activePositions
      .filter((position) => typeFilter === ALL_TYPES || position.tipo === typeFilter)
      .filter((position) => !normalizedSearch || [position.ticker, position.nombre, position.isin].filter(Boolean).some((value) => value!.toLocaleLowerCase("es").includes(normalizedSearch)))
      .sort((a, b) => (b.valor_actual ?? 0) - (a.valor_actual ?? 0))
  }, [activePositions, search, typeFilter])

  if (loading) return <DashboardSkeleton />

  const marketIsActive = ["REGULAR", "PRE", "POST"].includes(marketState)
  const dailyPositive = totals.totalPnl24h >= 0
  const updatedLabel = pricesUpdatedAt ? new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(new Date(pricesUpdatedAt)) : null

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1480px] px-4 pb-10 pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:pb-28">
        <header className="mb-8 flex flex-col gap-5 border-b border-border/70 pb-7 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
              <span>Cartera</span><span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${marketIsActive ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />{MARKET_LABELS[marketState] ?? MARKET_LABELS.CLOSED}</span>
              {updatedLabel && <><span aria-hidden="true">·</span><span>Precios {updatedLabel}</span></>}
            </div>
            <button type="button" onClick={() => setHideBalances(!hideBalances)} className="group block rounded-lg text-left outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label={hideBalances ? "Mostrar saldos" : "Ocultar saldos"}>
              <span className="block text-sm text-muted-foreground">Patrimonio total</span>
              <span className="mt-1 block text-4xl font-medium tracking-[-0.04em] sm:text-5xl"><AnimatedNumber value={totals.totalValue} format="currency" hide={hideBalances} /></span>
            </button>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className={`inline-flex items-center gap-1.5 font-medium ${dailyPositive ? "text-emerald-500" : "text-rose-500"}`}>{dailyPositive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}{hideBalances ? "••••" : formatPnl(totals.totalPnl24h)}</span>
              <span className="text-muted-foreground">{hideBalances ? "••••" : formatPercent(totals.totalPnlPercent24h)} hoy</span>
              <span className="hidden text-muted-foreground sm:inline">·</span>
              <span className="text-muted-foreground">{hideBalances ? "••••" : `${formatPnl(totals.totalPnl)} total`}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="icon-lg" onClick={() => setHideBalances(!hideBalances)} aria-label={hideBalances ? "Mostrar saldos" : "Ocultar saldos"}>{hideBalances ? <EyeOff /> : <Eye />}</Button>
            <RevolutSync>
              <span
                role="button"
                tabIndex={0}
                className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-background text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Importar movimientos"
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return
                  event.preventDefault()
                  event.currentTarget.parentElement?.querySelector("input")?.click()
                }}
              >
                <FileUp className="size-4" />
              </span>
            </RevolutSync>
            <Button type="button" variant="outline" size="icon-lg" onClick={() => setAlertsOpen(true)} aria-label="Abrir alertas"><Bell /></Button>
            <Button type="button" size="lg" onClick={() => setAddAssetOpen(true)}><Plus />Añadir activo</Button>
          </div>
        </header>

        <section aria-label="Resumen de cartera" className="mb-10 grid overflow-hidden rounded-2xl border border-border/70 bg-border/70 sm:grid-cols-3">
          <div className="bg-card p-5 sm:p-6"><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Invertido</p><p className="mt-2 text-xl font-medium tabular-nums">{hideBalances ? "••••" : formatCurrency(investedValue)}</p></div>
          <div className="border-t border-border/70 bg-card p-5 sm:border-l sm:border-t-0 sm:p-6"><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Liquidez</p><p className="mt-2 text-xl font-medium tabular-nums">{hideBalances ? "••••" : formatCurrency(cashValue)}</p></div>
          <div className="border-t border-border/70 bg-card p-5 sm:border-l sm:border-t-0 sm:p-6"><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Posiciones</p><p className="mt-2 text-xl font-medium tabular-nums">{activePositions.length}</p></div>
        </section>

        <section aria-labelledby="positions-heading">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><h1 id="positions-heading" className="text-xl font-medium tracking-tight">Tus activos</h1><p className="mt-1 text-sm text-muted-foreground">Valor, movimiento diario y rentabilidad total.</p></div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <div className="relative min-w-0 sm:w-64"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar activo" className="pl-8" aria-label="Buscar activo" /></div>
              <label className="relative sm:w-48"><span className="sr-only">Filtrar por tipo</span><SlidersHorizontal className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-8 w-full appearance-none rounded-lg border border-input bg-background pl-8 pr-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Filtrar activos por tipo">{positionTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select><ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 rotate-90 text-muted-foreground" /></label>
            </div>
          </div>

          <div className="hidden grid-cols-[minmax(250px,1.6fr)_repeat(4,minmax(100px,.7fr))_112px] gap-5 border-b border-border px-3 pb-3 text-xs font-medium text-muted-foreground lg:grid"><span>Activo</span><span className="text-right">Precio</span><span className="text-right">Valor</span><span className="text-right">Hoy</span><span className="text-right">Total</span><span className="sr-only">Acciones</span></div>
          <div className="divide-y divide-border/70">
            {visiblePositions.map((position) => (
              <article key={position.activo_id} className="group grid gap-4 py-4 transition-colors hover:bg-muted/35 sm:px-3 lg:grid-cols-[minmax(250px,1.6fr)_repeat(4,minmax(100px,.7fr))_112px] lg:items-center lg:gap-5">
                <Link href={`/activo/${position.activo_id}`} className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <AssetLogo ticker={position.ticker} name={position.nombre} type={position.tipo} size={46} />
                  <span className="min-w-0"><span className="flex items-center gap-2"><strong className="truncate text-sm font-medium">{position.ticker.split(".")[0]}</strong><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{position.tipo}</span></span><span className="mt-1 block truncate text-sm text-muted-foreground">{position.nombre || position.isin || "Activo sin nombre"}</span></span>
                </Link>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 lg:contents">
                  <div className="lg:text-right"><span className="block text-[11px] text-muted-foreground lg:hidden">Precio</span><span className="mt-1 block text-sm tabular-nums lg:mt-0">{hideBalances || (position.precio_actual_nativo ?? position.precio_actual) === null ? hideBalances ? "••••" : "—" : formatCurrency((position.precio_actual_nativo ?? position.precio_actual)!, position.original_currency || position.moneda)}</span></div>
                  <div className="text-right"><span className="block text-[11px] text-muted-foreground lg:hidden">Valor</span><strong className="mt-1 block text-sm font-medium tabular-nums lg:mt-0">{hideBalances || position.valor_actual === null ? hideBalances ? "••••" : "—" : formatCurrency(position.valor_actual)}</strong></div>
                  <div className="lg:text-right"><span className="block text-[11px] text-muted-foreground lg:hidden">Hoy</span><span className="mt-1 block text-sm lg:mt-0"><SignedValue value={position.change_amount_24h} kind="currency" /></span></div>
                  <div className="text-right"><span className="block text-[11px] text-muted-foreground lg:hidden">Total</span><span className="mt-1 block text-sm lg:mt-0"><SignedValue value={position.pnl_percent} kind="percent" /></span></div>
                </div>
                <div className="flex items-center justify-end gap-1 border-t border-border/60 pt-3 sm:border-0 sm:pt-0"><Button type="button" variant="ghost" size="icon-sm" onClick={() => onEditAsset(position)} aria-label={`Editar ${position.ticker}`}><Pencil /></Button><Button type="button" variant="outline" size="sm" onClick={() => onAddTransaction(position)}><Plus />Operar</Button></div>
              </article>
            ))}
          </div>
          {visiblePositions.length === 0 && <div className="border-b border-border py-16 text-center"><p className="font-medium">No hay activos que coincidan</p><p className="mt-1 text-sm text-muted-foreground">Prueba otra búsqueda o cambia el filtro.</p></div>}
        </section>

        <details className="mt-10 border-t border-border/70 pt-5">
          <summary className="cursor-pointer list-none rounded-lg py-2 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">Eventos y recordatorios</summary>
          <div className="mt-4 max-w-2xl"><UpcomingEvents positions={activePositions.filter((position) => position.tipo !== "Liquidez")} onAddEvent={onAddEvent} onEditEvent={onEditEvent} /></div>
        </details>
      </div>
      <AddAssetModal open={addAssetOpen} onOpenChange={setAddAssetOpen} />
      <PriceAlerts open={alertsOpen} onOpenChange={setAlertsOpen} />
    </div>
  )
}
