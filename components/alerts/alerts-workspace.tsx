"use client"

import { useMemo, useState } from "react"
import {
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  Radar,
  Target,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import type { EnrichedPosition } from "@/lib/types"
import { useAlerts } from "@/lib/hooks/use-alerts"
import { formatCurrency } from "@/lib/utils/formatters"
import { AssetLogo } from "@/components/ui/asset-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface AlertsWorkspaceProps {
  positions: EnrichedPosition[]
  compact?: boolean
  initialTicker?: string
}

export function AlertsWorkspace({ positions, compact = false, initialTicker = "" }: AlertsWorkspaceProps) {
  const { alerts, isLoading, addAlert, removeAlert } = useAlerts()
  const [ticker, setTicker] = useState(initialTicker)
  const [targetPrice, setTargetPrice] = useState("")
  const [condition, setCondition] = useState<"above" | "below">("above")
  const [filter, setFilter] = useState<"active" | "triggered" | "all">("active")
  const [saving, setSaving] = useState(false)

  const investablePositions = useMemo(
    () => positions.filter((position) => position.unidades > 0 && position.tipo !== "Liquidez"),
    [positions],
  )
  const positionByTicker = useMemo(
    () => new Map(investablePositions.map((position) => [position.ticker.toUpperCase(), position])),
    [investablePositions],
  )
  const selectedPosition = positionByTicker.get(ticker.toUpperCase())
  const visibleAlerts = alerts.filter((alert) => filter === "all" || (filter === "triggered" ? alert.triggered : !alert.triggered))
  const activeCount = alerts.filter((alert) => !alert.triggered).length
  const coveredAssets = new Set(alerts.filter((alert) => !alert.triggered).map((alert) => alert.ticker.toUpperCase())).size

  const handleAdd = async () => {
    const parsedPrice = Number(targetPrice)
    if (!ticker.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast.error("Selecciona un activo e introduce un precio objetivo válido")
      return
    }

    setSaving(true)
    try {
      await addAlert({ ticker: ticker.trim().toUpperCase(), target_price: parsedPrice, condition })
      setTargetPrice("")
      toast.success("Alerta activada")
      if ("Notification" in window && Notification.permission === "default") {
        void Notification.requestPermission()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la alerta")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn("grid gap-4", !compact && "xl:grid-cols-[minmax(300px,.72fr)_minmax(0,1.45fr)]")}>
      <div className="space-y-4">
        {!compact && (
          <section className="grid grid-cols-3 gap-3" aria-label="Resumen de alertas">
            {[
              { label: "Activas", value: activeCount, icon: Radar, tone: "text-primary" },
              { label: "Activos", value: coveredAssets, icon: Target, tone: "text-sky-400" },
              { label: "Cumplidas", value: alerts.length - activeCount, icon: CheckCircle2, tone: "text-emerald-400" },
            ].map((metric) => (
              <article key={metric.label} className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
                <metric.icon className={cn("size-4", metric.tone)} />
                <p className="mt-3 font-mono text-xl font-black">{metric.value}</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{metric.label}</p>
              </article>
            ))}
          </section>
        )}

        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Plus className="size-4" /></span>
            <div>
              <h2 className="text-sm font-bold">Nueva alerta</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Recibe un aviso cuando el precio cruce tu objetivo.</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Activo</span>
              <select
                value={ticker}
                onChange={(event) => setTicker(event.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Seleccionar posición</option>
                {investablePositions.map((position) => <option key={position.activo_id} value={position.ticker}>{position.ticker} · {position.nombre}</option>)}
              </select>
            </label>

            <div className="grid grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-2">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Condición</span>
                <select value={condition} onChange={(event) => setCondition(event.target.value as "above" | "below")} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="above">Sube hasta</option>
                  <option value="below">Baja hasta</option>
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Precio objetivo</span>
                <div className="relative">
                  <Input type="number" min="0" step="any" value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} placeholder="0,00" className="h-10 rounded-xl pr-12 font-mono" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">{selectedPosition?.moneda ?? "EUR"}</span>
                </div>
              </label>
            </div>

            {selectedPosition?.precio_actual != null && (
              <div className="flex items-center justify-between rounded-xl bg-muted/45 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Precio actual</span>
                <span className="font-mono font-bold">{formatCurrency(selectedPosition.precio_actual, selectedPosition.moneda)}</span>
              </div>
            )}

            <Button type="button" onClick={handleAdd} disabled={saving} className="h-10 w-full rounded-xl">
              <BellRing />{saving ? "Activando…" : "Activar alerta"}
            </Button>
          </div>
        </section>
      </div>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold">Centro de alertas</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Objetivos activos y señales ya alcanzadas.</p>
          </div>
          <div className="grid grid-cols-3 rounded-xl bg-muted/50 p-1">
            {(["active", "triggered", "all"] as const).map((value) => (
              <button key={value} type="button" onClick={() => setFilter(value)} className={cn("rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors", filter === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
                {value === "active" ? "Activas" : value === "triggered" ? "Cumplidas" : "Todas"}
              </button>
            ))}
          </div>
        </div>

        <div className={cn("divide-y divide-border/55", !compact && "max-h-[560px] overflow-y-auto")}>
          {isLoading ? (
            <div className="space-y-3 p-4">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-muted/50" />)}</div>
          ) : visibleAlerts.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><BellRing className="size-5" /></span>
              <p className="mt-4 text-sm font-bold">No hay alertas en esta vista</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">Crea un objetivo de precio para que Silox vigile el mercado por ti.</p>
            </div>
          ) : visibleAlerts.map((alert) => {
            const position = positionByTicker.get(alert.ticker.toUpperCase())
            const current = position?.precio_actual
            const distance = current && current > 0 ? ((alert.target_price - current) / current) * 100 : null
            return (
              <article key={alert.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/25">
                <AssetLogo ticker={alert.ticker} name={position?.nombre} type={position?.tipo} size={38} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-black">{alert.ticker}</span>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase", alert.triggered ? "bg-emerald-400/10 text-emerald-400" : alert.condition === "above" ? "bg-sky-400/10 text-sky-400" : "bg-violet-400/10 text-violet-400")}>
                      {alert.triggered ? <CheckCircle2 className="size-2.5" /> : alert.condition === "above" ? <ChevronUp className="size-2.5" /> : <ChevronDown className="size-2.5" />}
                      {alert.triggered ? "Cumplida" : alert.condition === "above" ? "Al alza" : "A la baja"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    Objetivo <strong className="font-mono text-foreground">{position ? formatCurrency(alert.target_price, position.moneda) : alert.target_price.toLocaleString("es-ES")}</strong>
                    {distance != null && !alert.triggered && <span> · {Math.abs(distance).toFixed(1)}% de distancia</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {current != null && <span className="hidden text-right sm:block"><span className="block font-mono text-xs font-bold">{formatCurrency(current, position?.moneda ?? "EUR")}</span><span className="block text-[9px] text-muted-foreground">Ahora</span></span>}
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => void removeAlert(alert.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Eliminar alerta de ${alert.ticker}`}><Trash2 /></Button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
