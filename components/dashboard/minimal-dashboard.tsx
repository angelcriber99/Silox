"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  Bell,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Eye,
  EyeOff,
  FileUp,
  Gauge,
  LayoutDashboard,
  ListFilter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wifi,
} from "lucide-react"

import type {
  EnrichedPosition,
  EventoRecurrente,
  PortfolioTotals,
  Transaccion,
} from "@/lib/types"
import {
  buildDashboardIntelligence,
  type DashboardIntelligence,
} from "@/lib/utils/dashboard-intelligence"
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import { usePreferences } from "@/lib/stores/use-preferences"
import { AddAssetModal } from "@/components/asset/add-asset-modal"
import { PriceAlerts } from "@/components/dashboard/price-alerts"
import { PendingOrders } from "@/components/transactions/pending-orders"
import { RevolutSync } from "@/components/transactions/revolut-sync"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { AssetLogo } from "@/components/ui/asset-logo"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

interface MinimalDashboardProps {
  positions: EnrichedPosition[]
  totals: PortfolioTotals
  loading: boolean
  marketState?: string
  pricesUpdatedAt?: string | number | null
  realtimeStatus?: "connecting" | "connected" | "disconnected"
  pendingTransactions?: Transaccion[]
  onRefresh?: () => void
  onAddTransaction: (position: EnrichedPosition) => void
  onEditAsset: (position: EnrichedPosition) => void
  onAddEvent: () => void
  onEditEvent: (event: EventoRecurrente) => void
}

const ALL_TYPES = "Todos"
const MARKET_LABELS: Record<string, string> = {
  REGULAR: "Mercado regular",
  PRE: "Premercado",
  POST: "Postmercado",
  CLOSED: "Mercado cerrado",
  OPEN: "Mercado abierto",
}

const SESSION_STYLES: Record<string, string> = {
  REGULAR: "bg-emerald-400",
  OPEN: "bg-emerald-400",
  PRE: "bg-sky-400",
  POST: "bg-violet-400",
  CLOSED: "bg-slate-500",
}

function performanceClass(value: number | null | undefined) {
  if ((value ?? 0) > 0) return "text-emerald-400"
  if ((value ?? 0) < 0) return "text-rose-400"
  return "text-muted-foreground"
}

function displayTicker(position?: EnrichedPosition) {
  if (!position) return "—"
  if (position.tipo === "Fondo Indexado" || position.tipo === "Fondo Monetario") {
    return position.nombre?.split(" ")[0]?.toUpperCase() ?? position.ticker
  }
  return position.ticker.split(".")[0]
}

function MiniTrend({ data, positive }: { data: number[]; positive: boolean }) {
  const points = useMemo(() => {
    if (data.length < 2) return ""
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    return data
      .map((value, index) => {
        const x = (index / (data.length - 1)) * 100
        const y = 30 - ((value - min) / range) * 26
        return `${x},${y}`
      })
      .join(" ")
  }, [data])

  if (!points) return <span className="text-[10px] text-muted-foreground">Sin gráfico</span>

  return (
    <svg aria-hidden="true" className="h-8 w-full" preserveAspectRatio="none" viewBox="0 0 100 32">
      <polyline
        fill="none"
        points={points}
        stroke={positive ? "#34d399" : "#fb7185"}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function LiveStatus({
  marketState,
  realtimeStatus,
}: {
  marketState: string
  realtimeStatus: "connecting" | "connected" | "disconnected"
}) {
  const connected = realtimeStatus === "connected"
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex h-7 items-center gap-2 rounded-full border border-border/70 bg-background/65 px-2.5 text-[11px] font-semibold shadow-sm backdrop-blur-xl">
        <span className={`size-2 rounded-full ${SESSION_STYLES[marketState] ?? "bg-slate-500"}`} />
        {MARKET_LABELS[marketState] ?? marketState}
      </span>
      <span className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold ${connected ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-400" : realtimeStatus === "connecting" ? "border-amber-400/25 bg-amber-400/10 text-amber-400" : "border-rose-400/25 bg-rose-400/10 text-rose-400"}`}>
        <Wifi className="size-3" />
        {connected ? "En vivo" : realtimeStatus === "connecting" ? "Conectando" : "Sin conexión"}
      </span>
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  tone?: "positive" | "negative" | "neutral" | "primary"
  icon: typeof Activity
}) {
  const tones = {
    positive: "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-400",
    negative: "border-rose-400/20 bg-rose-400/[0.06] text-rose-400",
    neutral: "border-border/70 bg-card/75 text-foreground",
    primary: "border-sky-400/20 bg-sky-400/[0.06] text-sky-400",
  }

  return (
    <article className={`relative min-w-0 overflow-hidden rounded-2xl border p-3.5 shadow-[0_12px_40px_-28px_rgba(0,0,0,.8)] ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
        <Icon aria-hidden="true" className="size-4 opacity-75" />
      </div>
      <p className="mt-2 truncate font-mono text-lg font-bold tracking-[-0.04em] text-current xl:text-xl">{value}</p>
      <p className="mt-1 truncate text-[10px] font-medium text-muted-foreground">{detail}</p>
    </article>
  )
}

function AllocationBlock({
  intelligence,
  hideBalances,
}: {
  intelligence: DashboardIntelligence
  hideBalances: boolean
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/75 p-3.5 shadow-[0_16px_60px_-40px_rgba(0,0,0,.9)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">Mapa de cartera</h2>
          <p className="text-[10px] text-muted-foreground">Asignación sobre el patrimonio total</p>
        </div>
        <LayoutDashboard className="size-4 text-sky-400" />
      </div>

      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted/70 ring-1 ring-border/50">
        {intelligence.allocation.map((item) => (
          <span
            key={item.name}
            style={{ width: `${Math.max(item.percent, 0.7)}%`, backgroundColor: item.color }}
            title={`${item.name}: ${item.percent.toFixed(1)}%`}
          />
        ))}
      </div>

      <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 content-start gap-x-4 gap-y-2">
        {intelligence.allocation.slice(0, 6).map((item) => (
          <div key={item.name} className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="truncate text-muted-foreground">{item.name}</span>
              <strong className="ml-auto font-mono text-foreground">{item.percent.toFixed(0)}%</strong>
            </div>
            <p className="mt-0.5 truncate pl-3.5 font-mono text-[9px] text-muted-foreground/75">
              {hideBalances ? "••••" : formatCurrency(item.value)}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function MarketPulse({
  intelligence,
  hideBalances,
}: {
  intelligence: DashboardIntelligence
  hideBalances: boolean
}) {
  const totalBreadth = intelligence.winners + intelligence.losers + intelligence.flat || 1
  const freshness = intelligence.invested.length > 0
    ? (intelligence.freshPrices / intelligence.invested.length) * 100
    : 0

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/75 p-3.5 shadow-[0_16px_60px_-40px_rgba(0,0,0,.9)] backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold"><Activity className="size-4 text-emerald-400" />Pulso en directo</h2>
          <p className="text-[10px] text-muted-foreground">Movimiento y estado de tus activos</p>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{freshness.toFixed(0)}% fresco</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {[{ label: "Mejor", item: intelligence.best, positive: true }, { label: "Peor", item: intelligence.worst, positive: false }].map(({ label, item, positive }) => (
          <div key={label} className="min-w-0 rounded-xl border border-border/60 bg-background/50 p-2.5">
            <div className="flex items-center gap-2">
              <AssetLogo ticker={item?.ticker ?? "—"} name={item?.nombre} type={item?.tipo} size={28} />
              <div className="min-w-0 flex-1">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
                <strong className="block truncate text-xs">{displayTicker(item)}</strong>
              </div>
              <span className={`font-mono text-[11px] font-bold ${performanceClass(item?.daily_change_percent_24h)}`}>
                {formatPercent(item?.daily_change_percent_24h ?? 0)}
              </span>
            </div>
            <div className="mt-1 h-8"><MiniTrend data={item?.sparkline ?? []} positive={positive} /></div>
            <p className={`truncate font-mono text-[9px] ${performanceClass(item?.change_amount_24h)}`}>
              {hideBalances ? "••••" : formatPnl(item?.change_amount_24h ?? 0)} hoy
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 [@media(max-height:820px)]:hidden">
        <div className="mb-1.5 flex items-center justify-between text-[9px] font-semibold text-muted-foreground">
          <span>{intelligence.winners} suben</span>
          <span>{intelligence.flat} planas</span>
          <span>{intelligence.losers} bajan</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          <span className="bg-emerald-400" style={{ width: `${(intelligence.winners / totalBreadth) * 100}%` }} />
          <span className="bg-slate-500" style={{ width: `${(intelligence.flat / totalBreadth) * 100}%` }} />
          <span className="bg-rose-400" style={{ width: `${(intelligence.losers / totalBreadth) * 100}%` }} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] [@media(max-height:820px)]:hidden">
        {intelligence.sessions.slice(0, 4).map(({ state, count }) => (
          <div key={state} className="flex h-8 items-center rounded-lg border border-border/50 bg-background/40 px-2">
            <span className={`mr-2 size-2 rounded-full ${SESSION_STYLES[state] ?? "bg-slate-500"}`} />
            <span className="truncate text-muted-foreground">{MARKET_LABELS[state] ?? state}</span>
            <strong className="ml-auto font-mono">{count}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function RiskBlock({ intelligence }: { intelligence: DashboardIntelligence }) {
  const concentrationTone = intelligence.concentration >= 35 ? "text-amber-400" : "text-emerald-400"
  return (
    <section className="rounded-2xl border border-border/70 bg-card/75 p-3.5 shadow-[0_16px_60px_-40px_rgba(0,0,0,.9)] backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold"><ShieldAlert className="size-4 text-amber-400" />Control de exposición</h2>
        <Link href="/analisis" className="text-[10px] font-semibold text-sky-400 hover:text-sky-300">Ver análisis</Link>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="min-w-0 rounded-xl bg-background/50 p-2.5">
          <span className="block truncate text-[9px] text-muted-foreground">Mayor posición</span>
          <strong className="mt-1 block truncate text-xs">{displayTicker(intelligence.largest)}</strong>
          <span className={`font-mono text-[10px] ${concentrationTone}`}>{intelligence.concentration.toFixed(1)}%</span>
        </div>
        <div className="min-w-0 rounded-xl bg-background/50 p-2.5">
          <span className="block truncate text-[9px] text-muted-foreground">Divisa no EUR</span>
          <strong className="mt-1 block font-mono text-xs">{intelligence.foreignCurrencyExposure.toFixed(1)}%</strong>
          <span className="text-[9px] text-muted-foreground">exposición</span>
        </div>
        <div className="min-w-0 rounded-xl bg-background/50 p-2.5">
          <span className="block truncate text-[9px] text-muted-foreground">Liquidez</span>
          <strong className="mt-1 block font-mono text-xs">{intelligence.cashPercent.toFixed(1)}%</strong>
          <span className="text-[9px] text-muted-foreground">del total</span>
        </div>
      </div>
    </section>
  )
}

function PositionRow({
  position,
  totalValue,
  hideBalances,
  onAddTransaction,
  onEditAsset,
}: {
  position: EnrichedPosition
  totalValue: number
  hideBalances: boolean
  onAddTransaction: (position: EnrichedPosition) => void
  onEditAsset: (position: EnrichedPosition) => void
}) {
  const allocation = totalValue > 0 ? ((position.valor_actual ?? 0) / totalValue) * 100 : 0
  const nativePrice = position.precio_actual_nativo ?? position.precio_actual
  const nativeCurrency = position.original_currency ?? position.moneda
  const dailyPositive = (position.daily_change_percent_24h ?? 0) >= 0

  return (
    <article className="group grid min-h-0 items-center gap-2 border-b border-border/45 px-3 transition-colors last:border-b-0 hover:bg-muted/35 xl:grid-cols-[minmax(155px,1.4fr)_minmax(68px,.55fr)_minmax(68px,.55fr)_minmax(72px,.6fr)_minmax(88px,.72fr)_54px_52px]">
      <div className="flex min-w-0 items-center gap-3">
        <AssetLogo ticker={position.ticker} name={position.nombre} type={position.tipo} size={36} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/activo/${position.activo_id}`} className="truncate text-sm font-bold hover:text-sky-400">{displayTicker(position)}</Link>
            <span className={`size-1.5 shrink-0 rounded-full ${SESSION_STYLES[position.market_state ?? "CLOSED"] ?? "bg-slate-500"}`} title={MARKET_LABELS[position.market_state ?? "CLOSED"]} />
          </div>
          <p className="truncate text-[10px] text-muted-foreground">{position.nombre ?? position.tipo}</p>
        </div>
      </div>

      <div className="hidden text-right xl:block">
        <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">Precio</span>
        <strong className="font-mono text-xs">{nativePrice === null ? "—" : formatCurrency(nativePrice, nativeCurrency ?? "EUR")}</strong>
        {position.price_is_stale && <span className="block text-[8px] text-amber-400">pendiente</span>}
      </div>

      <div className="hidden text-right xl:block">
        <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">Sesión</span>
        <strong className={`font-mono text-xs ${performanceClass(position.change_percent_24h)}`}>{formatPercent(position.change_percent_24h ?? 0)}</strong>
      </div>

      <div className="text-right">
        <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">Hoy</span>
        <strong className={`font-mono text-xs ${performanceClass(position.daily_change_percent_24h)}`}>{formatPercent(position.daily_change_percent_24h ?? 0)}</strong>
        <span className={`block font-mono text-[9px] ${performanceClass(position.change_amount_24h)}`}>{hideBalances ? "••••" : formatPnl(position.change_amount_24h ?? 0)}</span>
      </div>

      <div className="text-right">
        <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">Valor · P&L</span>
        <strong className="block truncate font-mono text-xs">{hideBalances ? "••••" : formatCurrency(position.valor_actual ?? 0)}</strong>
        <span className={`block truncate font-mono text-[9px] ${performanceClass(position.pnl)}`}>{hideBalances ? "••••" : `${formatPnl(position.pnl ?? 0)} · ${formatPercent(position.pnl_percent ?? 0)}`}</span>
      </div>

      <div className="hidden min-w-0 xl:block">
        <MiniTrend data={position.sparkline} positive={dailyPositive} />
        <span className="block text-right font-mono text-[9px] text-muted-foreground">{allocation.toFixed(1)}%</span>
      </div>

      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => onAddTransaction(position)} aria-label={`Añadir operación de ${displayTicker(position)}`}><Plus /></Button>
        <Button variant="ghost" size="icon-sm" onClick={() => onEditAsset(position)} aria-label={`Editar ${displayTicker(position)}`}><Pencil /></Button>
      </div>
    </article>
  )
}

function PositionsPanel({
  positions,
  totalValue,
  hideBalances,
  page,
  pageCount,
  setPage,
  onAddTransaction,
  onEditAsset,
  onAddAsset,
}: {
  positions: EnrichedPosition[]
  totalValue: number
  hideBalances: boolean
  page: number
  pageCount: number
  setPage: (page: number) => void
  onAddTransaction: (position: EnrichedPosition) => void
  onEditAsset: (position: EnrichedPosition) => void
  onAddAsset: () => void
}) {
  return (
    <section className="grid min-h-0 grid-rows-[44px_minmax(0,1fr)_34px] overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-[0_22px_80px_-45px_rgba(0,0,0,.95)] backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-border/60 px-3">
        <div>
          <h2 className="text-sm font-bold">Posiciones en tiempo real</h2>
          <p className="text-[9px] text-muted-foreground">Precio, sesión, rendimiento diario y total</p>
        </div>
        <Link href="/movimientos" className="text-[10px] font-semibold text-sky-400 hover:text-sky-300">Ver movimientos</Link>
      </header>

      {positions.length === 0 ? (
        <div className="flex min-h-0 flex-col items-center justify-center px-6 text-center">
          <CircleDollarSign className="mb-3 size-9 text-sky-400/70" />
          <h3 className="text-sm font-bold">Tu cartera está lista para empezar</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">Añade un activo o importa tu histórico para ver el radar en directo.</p>
          <Button className="mt-4" onClick={onAddAsset}><Plus />Añadir activo</Button>
        </div>
      ) : (
        <div className="grid min-h-0" style={{ gridTemplateRows: `repeat(${positions.length}, minmax(0, 1fr))` }}>
          {positions.map((position) => (
            <PositionRow
              key={position.activo_id}
              position={position}
              totalValue={totalValue}
              hideBalances={hideBalances}
              onAddTransaction={onAddTransaction}
              onEditAsset={onEditAsset}
            />
          ))}
        </div>
      )}

      <footer className="flex items-center justify-between border-t border-border/60 px-3 text-[10px] text-muted-foreground">
        <span>Página {page + 1} de {pageCount}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Página anterior"><ChevronLeft /></Button>
          <Button variant="ghost" size="icon-xs" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)} aria-label="Página siguiente"><ChevronRight /></Button>
        </div>
      </footer>
    </section>
  )
}

function MobilePositionRow({
  position,
  hideBalances,
  onAddTransaction,
}: {
  position: EnrichedPosition
  hideBalances: boolean
  onAddTransaction: (position: EnrichedPosition) => void
}) {
  return (
    <article className="grid min-h-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-xl border border-border/60 bg-card/80 px-2.5 shadow-sm">
      <AssetLogo ticker={position.ticker} name={position.nombre} type={position.tipo} size={36} />
      <Link href={`/activo/${position.activo_id}`} className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex items-center gap-1.5">
          <strong className="truncate text-sm">{displayTicker(position)}</strong>
          <span className={`size-1.5 shrink-0 rounded-full ${SESSION_STYLES[position.market_state ?? "CLOSED"] ?? "bg-slate-500"}`} />
        </div>
        <p className="truncate text-[10px] text-muted-foreground">{position.nombre ?? position.tipo}</p>
      </Link>
      <div className="text-right">
        <strong className="block truncate font-mono text-xs">{hideBalances ? "••••" : formatCurrency(position.valor_actual ?? 0)}</strong>
        <span className={`block font-mono text-[10px] font-semibold ${performanceClass(position.daily_change_percent_24h)}`}>{formatPercent(position.daily_change_percent_24h ?? 0)} hoy</span>
      </div>
      <Button variant="ghost" size="icon-lg" onClick={() => onAddTransaction(position)} aria-label={`Añadir operación de ${displayTicker(position)}`}><Plus /></Button>
    </article>
  )
}

function MobileCommandCenter({
  intelligence,
  totals,
  marketState,
  realtimeStatus,
  updatedLabel,
  hideBalances,
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  positionTypes,
  visiblePositions,
  page,
  pageCount,
  setPage,
  mobilePanel,
  setMobilePanel,
  onRefresh,
  onAddTransaction,
  onOpenAlerts,
}: {
  intelligence: DashboardIntelligence
  totals: PortfolioTotals
  marketState: string
  realtimeStatus: "connecting" | "connected" | "disconnected"
  updatedLabel: string
  hideBalances: boolean
  search: string
  setSearch: (search: string) => void
  typeFilter: string
  setTypeFilter: (type: string) => void
  positionTypes: string[]
  visiblePositions: EnrichedPosition[]
  page: number
  pageCount: number
  setPage: (page: number) => void
  mobilePanel: "overview" | "positions"
  setMobilePanel: (panel: "overview" | "positions") => void
  onRefresh?: () => void
  onAddTransaction: (position: EnrichedPosition) => void
  onOpenAlerts: () => void
}) {
  const preferences = usePreferences()
  const dayPositive = totals.totalPnl24h >= 0

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5 px-3 pb-2 pt-[calc(env(safe-area-inset-top,0px)+10px)] xl:hidden">
      <header className="flex h-10 shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-emerald-400 text-slate-950 shadow-lg shadow-sky-500/15"><Gauge className="size-5" /></div>
          <div>
            <p className="text-sm font-black tracking-[0.08em]">SILOX</p>
            <p className="text-[9px] text-muted-foreground">CENTRO DE CARTERA</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-lg" onClick={onRefresh} aria-label="Actualizar precios"><RefreshCw /></Button>
          <Button variant="ghost" size="icon-lg" onClick={onOpenAlerts} aria-label="Alertas de precio"><Bell /></Button>
          <Button variant="ghost" size="icon-lg" onClick={() => preferences.setHideBalances(!hideBalances)} aria-label={hideBalances ? "Mostrar saldos" : "Ocultar saldos"}>{hideBalances ? <EyeOff /> : <Eye />}</Button>
        </div>
      </header>

      <section className="relative h-[112px] shrink-0 overflow-hidden rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-500/15 via-card to-emerald-500/10 p-3.5 shadow-[0_22px_70px_-35px_rgba(14,165,233,.6)]">
        <div className="absolute -right-8 -top-12 size-32 rounded-full bg-sky-400/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Patrimonio total</span>
            <button type="button" onClick={() => preferences.setHideBalances(!hideBalances)} className="mt-1 block rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="block truncate font-mono text-[28px] font-black tracking-[-0.055em]"><AnimatedNumber value={totals.totalValue} format="currency" hide={hideBalances} /></span>
            </button>
          </div>
          <span className={`rounded-full border px-2 py-1 font-mono text-[10px] font-bold ${dayPositive ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-400" : "border-rose-400/25 bg-rose-400/10 text-rose-400"}`}>
            {hideBalances ? "••••" : formatPercent(totals.totalDailyPnlPercent)}
          </span>
        </div>
        <div className="relative mt-2 flex items-center justify-between gap-2">
          <p className={`font-mono text-xs font-bold ${performanceClass(totals.totalPnl24h)}`}>{hideBalances ? "••••" : `${formatPnl(totals.totalPnl24h)} hoy`}</p>
          <p className="text-[9px] text-muted-foreground">Actualizado {updatedLabel}</p>
        </div>
        <div className="relative mt-1.5"><LiveStatus marketState={marketState} realtimeStatus={realtimeStatus} /></div>
      </section>

      <nav aria-label="Vista del dashboard" className="grid h-11 shrink-0 grid-cols-2 rounded-xl border border-border/60 bg-muted/40 p-1">
        <button type="button" onClick={() => setMobilePanel("overview")} className={`rounded-lg text-xs font-bold transition-colors ${mobilePanel === "overview" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}><Sparkles className="mr-1.5 inline size-3.5" />Resumen</button>
        <button type="button" onClick={() => setMobilePanel("positions")} className={`rounded-lg text-xs font-bold transition-colors ${mobilePanel === "positions" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}><ListFilter className="mr-1.5 inline size-3.5" />Activos ({intelligence.active.length})</button>
      </nav>

      <div className="min-h-0 flex-1">
        {mobilePanel === "overview" ? (
          <div className="grid h-full min-h-0 grid-rows-[64px_minmax(96px,1fr)_minmax(84px,.9fr)] gap-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border/60 bg-card/75 p-2"><span className="block text-[9px] text-muted-foreground">P&L total</span><strong className={`mt-1 block truncate font-mono text-xs ${performanceClass(totals.totalPnl)}`}>{hideBalances ? "••••" : formatPnl(totals.totalPnl)}</strong><span className={`font-mono text-[9px] ${performanceClass(totals.totalPnlPercent)}`}>{formatPercent(totals.totalPnlPercent)}</span></div>
              <div className="rounded-xl border border-border/60 bg-card/75 p-2"><span className="block text-[9px] text-muted-foreground">Invertido</span><strong className="mt-1 block truncate font-mono text-xs">{hideBalances ? "••••" : formatCurrency(totals.totalCost)}</strong><span className="text-[9px] text-muted-foreground">{totals.positionCount} posiciones</span></div>
              <div className="rounded-xl border border-border/60 bg-card/75 p-2"><span className="block text-[9px] text-muted-foreground">Liquidez</span><strong className="mt-1 block truncate font-mono text-xs">{hideBalances ? "••••" : formatCurrency(intelligence.cash)}</strong><span className="text-[9px] text-muted-foreground">{intelligence.cashPercent.toFixed(1)}% total</span></div>
            </div>

            <section className="grid min-h-0 grid-cols-2 gap-2">
              {[{ label: "Líder", item: intelligence.best, positive: true }, { label: "En vigilancia", item: intelligence.worst, positive: false }].map(({ label, item, positive }) => (
                <div key={label} className="flex min-h-0 flex-col rounded-xl border border-border/60 bg-card/75 p-2.5">
                  <div className="flex items-center gap-2">
                    <AssetLogo ticker={item?.ticker ?? "—"} name={item?.nombre} type={item?.tipo} size={30} />
                    <div className="min-w-0"><span className="block text-[9px] text-muted-foreground">{label}</span><strong className="block truncate text-xs">{displayTicker(item)}</strong></div>
                    <span className={`ml-auto font-mono text-[10px] font-bold ${performanceClass(item?.daily_change_percent_24h)}`}>{formatPercent(item?.daily_change_percent_24h ?? 0)}</span>
                  </div>
                  <div className="my-auto min-h-0"><MiniTrend data={item?.sparkline ?? []} positive={positive} /></div>
                  <div className="flex items-end justify-between gap-2 border-t border-border/40 pt-1.5 font-mono text-[9px]">
                    <span className={performanceClass(item?.change_amount_24h)}>{hideBalances ? "••••" : `${formatPnl(item?.change_amount_24h ?? 0)} hoy`}</span>
                    <span className="truncate text-muted-foreground">{hideBalances ? "••••" : formatCurrency(item?.valor_actual ?? 0)}</span>
                  </div>
                </div>
              ))}
            </section>

            <section className="min-h-0 rounded-xl border border-border/60 bg-card/75 p-2.5">
              <div className="flex items-center justify-between"><h2 className="text-[11px] font-bold">Asignación y mercado</h2><span className="font-mono text-[9px] text-muted-foreground">{intelligence.winners}↑ {intelligence.losers}↓</span></div>
              <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-muted">
                {intelligence.allocation.map((item) => <span key={item.name} style={{ width: `${Math.max(item.percent, 0.7)}%`, backgroundColor: item.color }} />)}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {intelligence.allocation.slice(0, 3).map((item) => <div key={item.name} className="min-w-0"><span className="block truncate text-[8px] text-muted-foreground">{item.name}</span><strong className="font-mono text-[10px]">{item.percent.toFixed(0)}%</strong></div>)}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-border/40 pt-2">
                <div className="min-w-0"><span className="block truncate text-[8px] text-muted-foreground">Mayor posición</span><strong className="block truncate text-[10px]">{displayTicker(intelligence.largest)} · {intelligence.concentration.toFixed(0)}%</strong></div>
                <div className="min-w-0"><span className="block truncate text-[8px] text-muted-foreground">Divisa no EUR</span><strong className="font-mono text-[10px]">{intelligence.foreignCurrencyExposure.toFixed(0)}%</strong></div>
                <div className="min-w-0"><span className="block truncate text-[8px] text-muted-foreground">Precios frescos</span><strong className="font-mono text-[10px]">{intelligence.freshPrices}/{intelligence.invested.length}</strong></div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {intelligence.sessions.slice(0, 3).map(({ state, count }) => <span key={state} className="inline-flex items-center gap-1 rounded-md bg-background/55 px-1.5 py-1 text-[8px] text-muted-foreground"><span className={`size-1.5 rounded-full ${SESSION_STYLES[state] ?? "bg-slate-500"}`} />{MARKET_LABELS[state] ?? state} <strong className="text-foreground">{count}</strong></span>)}
              </div>
            </section>
          </div>
        ) : (
          <div className="grid h-full min-h-0 grid-rows-[38px_minmax(0,1fr)_34px] gap-2">
            <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
              <div className="relative"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar activo" className="h-[38px] pl-8 text-sm" aria-label="Buscar activo" /></div>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-[38px] rounded-lg border border-input bg-card px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Filtrar por tipo">{positionTypes.map((type) => <option key={type}>{type}</option>)}</select>
            </div>
            {visiblePositions.length > 0 ? (
              <div className="grid min-h-0 gap-1.5" style={{ gridTemplateRows: `repeat(${visiblePositions.length}, minmax(0,1fr))` }}>
                {visiblePositions.map((position) => <MobilePositionRow key={position.activo_id} position={position} hideBalances={hideBalances} onAddTransaction={onAddTransaction} />)}
              </div>
            ) : (
              <div className="flex min-h-0 items-center justify-center rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">No hay activos con estos filtros</div>
            )}
            <div className="flex items-center justify-between rounded-lg bg-muted/35 px-2 text-[10px] text-muted-foreground"><span>Página {page + 1}/{pageCount}</span><div className="flex"><Button variant="ghost" size="icon-xs" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Página anterior"><ChevronLeft /></Button><Button variant="ghost" size="icon-xs" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)} aria-label="Página siguiente"><ChevronRight /></Button></div></div>
          </div>
        )}
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="h-[calc(100dvh-88px-env(safe-area-inset-bottom,0px))] animate-pulse overflow-hidden bg-background p-3 xl:h-dvh xl:p-5">
      <div className="mx-auto grid h-full max-w-[1720px] grid-rows-[56px_92px_minmax(0,1fr)] gap-3">
        <div className="rounded-2xl bg-muted/50" />
        <div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="rounded-2xl bg-muted/40" />)}</div>
        <div className="grid grid-cols-[1.7fr_1fr] gap-3"><div className="rounded-2xl bg-muted/35" /><div className="rounded-2xl bg-muted/35" /></div>
      </div>
    </div>
  )
}

export function MinimalDashboard({
  positions,
  totals,
  loading,
  marketState = "CLOSED",
  pricesUpdatedAt,
  realtimeStatus = "connecting",
  pendingTransactions = [],
  onRefresh,
  onAddTransaction,
  onEditAsset,
  onAddEvent,
}: MinimalDashboardProps) {
  const preferences = usePreferences()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES)
  const [desktopPage, setDesktopPage] = useState(0)
  const [mobilePage, setMobilePage] = useState(0)
  const [pageSizes, setPageSizes] = useState({ desktop: 6, mobile: 4 })
  const [mobilePanel, setMobilePanel] = useState<"overview" | "positions">("overview")
  const [addAssetOpen, setAddAssetOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [pendingOpen, setPendingOpen] = useState(false)

  useEffect(() => {
    const updatePageSizes = () => {
      setPageSizes({
        desktop: window.innerHeight >= 940 ? 9 : window.innerHeight >= 800 ? 7 : 5,
        mobile: window.innerHeight < 740 ? 3 : 4,
      })
    }
    updatePageSizes()
    window.addEventListener("resize", updatePageSizes)
    return () => window.removeEventListener("resize", updatePageSizes)
  }, [])

  const intelligence = useMemo(
    () => buildDashboardIntelligence(positions, totals.totalValue),
    [positions, totals.totalValue],
  )
  const positionTypes = useMemo(
    () => [ALL_TYPES, ...Array.from(new Set(intelligence.active.map((position) => position.tipo))).sort()],
    [intelligence.active],
  )
  const filteredPositions = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es")
    const sortValue = (position: EnrichedPosition) => {
      if (preferences.dashboardSort === "day") return position.change_amount_24h ?? 0
      if (preferences.dashboardSort === "session") return position.change_percent_24h ?? 0
      if (preferences.dashboardSort === "pnl") return position.pnl_percent ?? 0
      return position.valor_actual ?? 0
    }
    return intelligence.active
      .filter((position) => typeFilter === ALL_TYPES || position.tipo === typeFilter)
      .filter((position) => !normalizedSearch || [position.ticker, position.nombre, position.isin].filter(Boolean).some((value) => value!.toLocaleLowerCase("es").includes(normalizedSearch)))
      .sort((left, right) => sortValue(right) - sortValue(left))
  }, [intelligence.active, preferences.dashboardSort, search, typeFilter])

  const requestedDesktopSize = preferences.dashboardPageSize === "auto" ? pageSizes.desktop : preferences.dashboardPageSize
  const desktopPageSize = Math.min(requestedDesktopSize, pageSizes.desktop)
  const desktopPageCount = Math.max(1, Math.ceil(filteredPositions.length / desktopPageSize))
  const safeDesktopPage = Math.min(desktopPage, desktopPageCount - 1)
  const desktopPositions = filteredPositions.slice(safeDesktopPage * desktopPageSize, (safeDesktopPage + 1) * desktopPageSize)
  const mobilePageCount = Math.max(1, Math.ceil(filteredPositions.length / pageSizes.mobile))
  const safeMobilePage = Math.min(mobilePage, mobilePageCount - 1)
  const mobilePositions = filteredPositions.slice(safeMobilePage * pageSizes.mobile, (safeMobilePage + 1) * pageSizes.mobile)

  if (loading) return <DashboardSkeleton />

  const hideBalances = preferences.hideBalances
  const updatedLabel = pricesUpdatedAt
    ? new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(pricesUpdatedAt))
    : "—"
  const dayTone = totals.totalPnl24h > 0 ? "positive" : totals.totalPnl24h < 0 ? "negative" : "neutral"
  const totalTone = totals.totalPnl > 0 ? "positive" : totals.totalPnl < 0 ? "negative" : "neutral"

  const changeSearch = (value: string) => {
    setSearch(value)
    setDesktopPage(0)
    setMobilePage(0)
  }
  const changeType = (value: string) => {
    setTypeFilter(value)
    setDesktopPage(0)
    setMobilePage(0)
  }

  return (
    <div className="relative h-[calc(100dvh-88px-env(safe-area-inset-bottom,0px))] overflow-hidden bg-background xl:h-dvh">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(14,165,233,.10),transparent_34%),radial-gradient(circle_at_92%_5%,rgba(52,211,153,.08),transparent_28%)]" />

      <MobileCommandCenter
        intelligence={intelligence}
        totals={totals}
        marketState={marketState}
        realtimeStatus={realtimeStatus}
        updatedLabel={updatedLabel}
        hideBalances={hideBalances}
        search={search}
        setSearch={changeSearch}
        typeFilter={typeFilter}
        setTypeFilter={changeType}
        positionTypes={positionTypes}
        visiblePositions={mobilePositions}
        page={safeMobilePage}
        pageCount={mobilePageCount}
        setPage={setMobilePage}
        mobilePanel={mobilePanel}
        setMobilePanel={setMobilePanel}
        onRefresh={onRefresh}
        onAddTransaction={onAddTransaction}
        onOpenAlerts={() => setAlertsOpen(true)}
      />

      <div className="relative mx-auto hidden h-full min-w-0 w-full max-w-[1720px] grid-rows-[58px_94px_minmax(0,1fr)_22px] gap-3 px-4 py-3 xl:grid xl:px-6">
        <header className="flex min-w-0 items-center justify-between gap-4 overflow-hidden rounded-2xl border border-border/70 bg-card/70 px-4 shadow-[0_18px_60px_-42px_rgba(0,0,0,.95)] backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-emerald-400 text-slate-950 shadow-lg shadow-sky-500/15"><Gauge className="size-5" /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2"><h1 className="truncate text-base font-black tracking-tight">Centro de cartera</h1><span className="hidden text-[9px] font-bold uppercase tracking-[0.18em] text-sky-400 lg:inline">Live desk</span></div>
              <p className="truncate text-[10px] text-muted-foreground">Todo tu portfolio, actualizado y visible de un vistazo</p>
            </div>
            <div className="ml-2 hidden xl:block"><LiveStatus marketState={marketState} realtimeStatus={realtimeStatus} /></div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative mr-1 hidden w-48 2xl:block"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => changeSearch(event.target.value)} placeholder="Buscar posición" className="h-8 bg-background/60 pl-8 text-xs" aria-label="Buscar posición" /></div>
            <select value={typeFilter} onChange={(event) => changeType(event.target.value)} className="hidden h-8 rounded-lg border border-input bg-background/60 px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring 2xl:block" aria-label="Filtrar posiciones por tipo">{positionTypes.map((type) => <option key={type}>{type}</option>)}</select>
            {pendingTransactions.length > 0 && <Button variant="outline" size="sm" onClick={() => setPendingOpen(true)} className="border-amber-400/25 bg-amber-400/10 text-amber-400"><Activity />{pendingTransactions.length} pendientes</Button>}
            <Button variant="ghost" size="icon" onClick={onRefresh} aria-label="Actualizar precios"><RefreshCw /></Button>
            <Button variant="ghost" size="icon" onClick={() => preferences.setHideBalances(!hideBalances)} aria-label={hideBalances ? "Mostrar saldos" : "Ocultar saldos"}>{hideBalances ? <EyeOff /> : <Eye />}</Button>
            <RevolutSync><span role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.closest("label")?.querySelector("input")?.click() } }} className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Importar movimientos"><FileUp className="size-4" /></span></RevolutSync>
            <Button variant="ghost" size="icon" onClick={() => setAlertsOpen(true)} aria-label="Alertas de precio"><Bell /></Button>
            <Button variant="ghost" size="icon" onClick={onAddEvent} aria-label="Añadir evento"><CalendarPlus /></Button>
            <Button onClick={() => setAddAssetOpen(true)}><Plus />Activo</Button>
            <Button asChild variant="ghost" size="icon"><Link href="/settings" aria-label="Personalizar dashboard"><Settings2 /></Link></Button>
          </div>
        </header>

        <section aria-label="Indicadores principales" className="grid grid-cols-[1.25fr_repeat(4,minmax(0,1fr))] gap-3">
          <article className="relative min-w-0 overflow-hidden rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-500/15 via-card/90 to-emerald-500/10 p-3.5 shadow-[0_18px_60px_-38px_rgba(14,165,233,.55)]">
            <div className="absolute -right-6 -top-12 size-28 rounded-full bg-sky-400/10 blur-2xl" />
            <div className="relative flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Patrimonio</span><span className="font-mono text-[9px] text-muted-foreground">{updatedLabel}</span></div>
            <button type="button" onClick={() => preferences.setHideBalances(!hideBalances)} className="relative mt-1 block max-w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="block truncate font-mono text-2xl font-black tracking-[-0.055em] xl:text-[28px]"><AnimatedNumber value={totals.totalValue} format="currency" hide={hideBalances} /></span></button>
            <p className="relative mt-1 text-[10px] text-muted-foreground">{totals.positionCount} posiciones · {intelligence.freshPrices}/{intelligence.invested.length} precios frescos</p>
          </article>
          <MetricCard label="Resultado de hoy" value={hideBalances ? "••••" : formatPnl(totals.totalPnl24h)} detail={`${formatPercent(totals.totalDailyPnlPercent)} acumulado del día`} tone={dayTone} icon={Activity} />
          <MetricCard label="Rendimiento total" value={hideBalances ? "••••" : formatPnl(totals.totalPnl)} detail={`${formatPercent(totals.totalPnlPercent)} desde el inicio`} tone={totalTone} icon={TrendingUp} />
          <MetricCard label="Capital invertido" value={hideBalances ? "••••" : formatCurrency(totals.totalCost)} detail={`${intelligence.invested.length} activos con mercado`} tone="primary" icon={CircleDollarSign} />
          <MetricCard label="Liquidez disponible" value={hideBalances ? "••••" : formatCurrency(intelligence.cash)} detail={`${intelligence.cashPercent.toFixed(1)}% del patrimonio`} icon={Gauge} />
        </section>

        <div className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1.72fr)_minmax(280px,.72fr)] gap-3">
          <PositionsPanel positions={desktopPositions} totalValue={totals.totalValue} hideBalances={hideBalances} page={safeDesktopPage} pageCount={desktopPageCount} setPage={setDesktopPage} onAddTransaction={onAddTransaction} onEditAsset={onEditAsset} onAddAsset={() => setAddAssetOpen(true)} />
          <aside className="grid min-h-0 grid-rows-[minmax(0,1.45fr)_minmax(0,.95fr)_auto] gap-3">
            <MarketPulse intelligence={intelligence} hideBalances={hideBalances} />
            <AllocationBlock intelligence={intelligence} hideBalances={hideBalances} />
            <RiskBlock intelligence={intelligence} />
          </aside>
        </div>

        <footer className="flex items-center justify-between px-1 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${realtimeStatus === "connected" ? "animate-pulse bg-emerald-400" : "bg-amber-400"}`} />Datos de cartera sincronizados · actualización {updatedLabel}</span>
          <span>Los precios fuera de sesión pueden reflejar el último cierre disponible</span>
        </footer>
      </div>

      <AddAssetModal open={addAssetOpen} onOpenChange={setAddAssetOpen} />
      <PriceAlerts open={alertsOpen} onOpenChange={setAlertsOpen} positions={positions} />
      <Dialog open={pendingOpen} onOpenChange={setPendingOpen}>
        <DialogContent className="max-h-[86dvh] max-w-5xl overflow-auto bg-card/95">
          <DialogHeader>
            <DialogTitle>Órdenes pendientes</DialogTitle>
            <DialogDescription>Revisa, completa o rechaza operaciones sin abandonar el centro de cartera.</DialogDescription>
          </DialogHeader>
          <PendingOrders transactions={pendingTransactions} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
