"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { z } from "zod"
import { Calendar, CalendarDays, DollarSign, Loader2, Plus, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchEventosRecurrentes } from "@/lib/api/market"
import type { EnrichedPosition, EventoRecurrente } from "@/lib/types"

interface UpcomingEventsProps {
  positions: EnrichedPosition[]
  onAddEvent: () => void
  onEditEvent?: (event: EventoRecurrente) => void
}

interface UnifiedEvent {
  id: string
  title: string
  date: Date
  type: string
  daysLeft: number
  isManual: boolean
  originalEvent?: EventoRecurrente
}

const AutomaticEventsSchema = z.object({
  events: z.array(z.object({
    ticker: z.string(),
    date: z.string(),
    type: z.string(),
  })).default([]),
})

async function loadUpcomingEvents(activePositions: EnrichedPosition[]): Promise<UnifiedEvent[]> {
  const tickers = Array.from(new Set(activePositions.map((position) => position.ticker)))
  const response = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers }),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`API returned ${response.status}`)

  const automaticEvents = AutomaticEventsSchema.parse(await response.json()).events.map((event) => ({
    id: `auto-${event.ticker}-${event.date}-${event.type}`,
    title: `Dividendo ${event.ticker}`,
    date: new Date(event.date),
    type: event.type,
    isManual: false,
  }))

  const activeAssetIds = new Set(activePositions.map((position) => position.activo_id))
  const manualEvents = (await fetchEventosRecurrentes())
    .filter((event) => activeAssetIds.has(event.activo_id))

  const now = new Date()
  const mappedManualEvents = manualEvents.map((event) => {
    let month = now.getMonth()
    let year = now.getFullYear()

    if (event.dia_del_mes < now.getDate()) {
      month += 1
      if (month > 11) {
        month = 0
        year += 1
      }
    }

    return {
      id: event.id,
      title: event.titulo,
      date: new Date(year, month, event.dia_del_mes),
      type: event.tipo,
      isManual: true,
      originalEvent: event,
    }
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return [...automaticEvents, ...mappedManualEvents]
    .map((event) => ({
      ...event,
      daysLeft: Math.ceil((event.date.getTime() - today.getTime()) / 86_400_000),
    }))
    .filter((event) => event.daysLeft >= 0)
    .sort((left, right) => left.daysLeft - right.daysLeft)
}

function getEventIcon(type: string) {
  switch (type) {
    case "Pago Dividendo":
    case "Ex-Dividendo":
      return <DollarSign aria-hidden="true" className="h-4 w-4 text-emerald-400" />
    case "Interés":
      return <Wallet aria-hidden="true" className="h-4 w-4 text-blue-400" />
    case "Aportación":
      return <Plus aria-hidden="true" className="h-4 w-4 text-amber-400" />
    default:
      return <CalendarDays aria-hidden="true" className="h-4 w-4 text-purple-400" />
  }
}

export function UpcomingEvents({ positions, onAddEvent, onEditEvent }: UpcomingEventsProps) {
  const t = useTranslations("Dashboard")
  const activePositions = useMemo(
    () => positions.filter((position) =>
      position.unidades > 0 && position.ticker !== "CASH" && position.tipo !== "Liquidez"),
    [positions],
  )
  const activePositionKey = useMemo(
    () => activePositions
      .map((position) => `${position.activo_id}:${position.ticker}`)
      .sort()
      .join(","),
    [activePositions],
  )
  const {
    data: events = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["upcoming-events", activePositionKey],
    queryFn: () => loadUpcomingEvents(activePositions),
    enabled: activePositions.length > 0,
    staleTime: 5 * 60_000,
  })

  return (
    <Card className="flex h-full flex-col border-border/40 bg-card/40 shadow-sm backdrop-blur-md transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/20 p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Calendar aria-hidden="true" className="h-4 w-4 text-amber-400" />
          <span>{t("upcoming_events")}</span>
          {isFetching && events.length > 0 && (
            <Loader2 aria-label="Actualizando eventos" className="h-3 w-3 animate-spin" />
          )}
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground/80 hover:text-foreground"
          onClick={onAddEvent}
          aria-label="Añadir evento"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex max-h-[200px] flex-col gap-3 overflow-y-auto p-4 pt-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted/50 [&::-webkit-scrollbar-track]:bg-transparent">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="h-8 w-8 animate-shimmer rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 animate-shimmer rounded bg-muted" />
                <div className="h-2 w-16 animate-shimmer rounded bg-muted/50" />
              </div>
            </div>
          ))
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center py-4 text-center">
            <p className="text-xs font-medium text-destructive">No se pudieron cargar los eventos</p>
            <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-4 text-center">
            <CalendarDays aria-hidden="true" className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs font-medium text-muted-foreground/80">{t("no_upcoming_events")}</p>
            <p className="mt-1 max-w-[200px] text-[10px] text-muted-foreground/60">{t("add_manual_events")}</p>
          </div>
        ) : (
          <div className="max-h-[140px] space-y-2 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted/50 [&::-webkit-scrollbar-track]:bg-transparent">
            {events.map((event) => {
              const content = (
                <>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background/50">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground/90">{event.title}</p>
                    <p className="text-xs text-muted-foreground/80">
                      {event.date.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                      event.daysLeft === 0
                        ? "bg-emerald-500/10 text-emerald-400"
                        : event.daysLeft <= 3
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-muted text-muted-foreground"
                    }`}>
                      {event.daysLeft === 0 ? "Hoy" : `Faltan ${event.daysLeft} d`}
                    </span>
                  </div>
                </>
              )

              if (event.isManual && event.originalEvent && onEditEvent) {
                const originalEvent = event.originalEvent
                return (
                  <button
                    key={event.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/50"
                    onClick={() => onEditEvent(originalEvent)}
                  >
                    {content}
                  </button>
                )
              }

              return (
                <div key={event.id} className="flex items-center gap-3 rounded-lg p-2">
                  {content}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
