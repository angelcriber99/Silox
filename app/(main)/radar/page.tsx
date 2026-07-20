"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  startOfDay,
  startOfMonth,
} from "date-fns"
import { es } from "date-fns/locale"
import {
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Loader2,
  Newspaper,
  Radio,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { z } from "zod"
import { AssetLogo } from "@/components/ui/asset-logo"

const RadarEventSchema = z.object({
  id: z.string(),
  assetId: z.string().optional(),
  ticker: z.string(),
  date: z.string(),
  endDate: z.string().optional(),
  datePrecision: z.enum(["exact", "range", "month", "quarter"]),
  type: z.enum(["EARNINGS", "DIVIDEND", "EX_DIVIDEND", "CATALYST", "MANUAL"]),
  title: z.string(),
  description: z.string().optional(),
  certainty: z.enum(["confirmed", "scheduled", "estimated", "speculative", "manual"]),
  impact: z.enum(["high", "medium", "low"]),
  sourceName: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  sourcePublishedAt: z.string().optional(),
})

const RadarResponseSchema = z.object({
  data: z.object({
    assets: z.array(z.object({
      id: z.string(),
      ticker: z.string(),
      name: z.string(),
      type: z.string(),
      currency: z.string(),
    })),
    events: z.array(RadarEventSchema),
    news: z.array(z.object({
      id: z.string(),
      title: z.string(),
      source: z.string(),
      publishedAt: z.string(),
      url: z.string().url(),
      ticker: z.string(),
    })),
    updatedAt: z.string(),
  }),
})

type RadarEvent = z.infer<typeof RadarEventSchema>
type RadarPayload = z.infer<typeof RadarResponseSchema>["data"]

async function loadRadar(): Promise<RadarPayload> {
  const response = await fetch("/api/mobile/v1/radar", { cache: "no-store" })
  if (!response.ok) throw new Error(`Radar API returned ${response.status}`)
  return RadarResponseSchema.parse(await response.json()).data
}

const CERTAINTY = {
  confirmed: { label: "Confirmado", dot: "bg-emerald-400", badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  scheduled: { label: "Programado", dot: "bg-blue-400", badge: "border-blue-400/30 bg-blue-400/10 text-blue-300" },
  estimated: { label: "Estimado", dot: "bg-amber-400", badge: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
  speculative: { label: "Especulativo", dot: "bg-orange-400", badge: "border-orange-400/40 bg-orange-400/10 text-orange-300 border-dashed" },
  manual: { label: "Manual", dot: "bg-purple-400", badge: "border-purple-400/30 bg-purple-400/10 text-purple-300" },
} as const

function eventOccursOn(event: RadarEvent, day: Date): boolean {
  const target = startOfDay(day).getTime()
  const start = startOfDay(new Date(event.date)).getTime()
  const end = startOfDay(new Date(event.endDate ?? event.date)).getTime()
  return target >= start && target <= end
}

function eventIcon(type: RadarEvent["type"]) {
  switch (type) {
    case "EARNINGS": return BriefcaseBusiness
    case "DIVIDEND":
    case "EX_DIVIDEND": return CircleDollarSign
    case "CATALYST": return Rocket
    case "MANUAL": return CalendarDays
  }
}

function eventDateLabel(event: RadarEvent): string {
  const start = new Date(event.date)
  if (!event.endDate || isSameDay(start, new Date(event.endDate))) {
    return format(start, "d 'de' MMMM 'de' yyyy", { locale: es })
  }
  const end = new Date(event.endDate)
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, "d", { locale: es })}–${format(end, "d 'de' MMMM 'de' yyyy", { locale: es })}`
  }
  return `${format(start, "d MMM", { locale: es })} – ${format(end, "d MMM yyyy", { locale: es })}`
}

export default function RadarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const [previewDateKey, setPreviewDateKey] = useState<string | null>(null)
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["portfolio-radar-v2"],
    queryFn: loadRadar,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  })

  const months = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, index) => {
      const date = addMonths(now, index)
      const start = startOfMonth(date)
      const firstDay = getDay(start)
      return {
        date,
        days: eachDayOfInterval({ start, end: endOfMonth(date) }),
        padding: firstDay === 0 ? 6 : firstDay - 1,
      }
    })
  }, [])

  const filteredEvents = useMemo(() => {
    const events = data?.events ?? []
    return events.filter((event) => {
      if (selectedTicker && event.ticker !== selectedTicker) return false
      if (selectedDate && !eventOccursOn(event, selectedDate)) return false
      return true
    })
  }, [data?.events, selectedDate, selectedTicker])

  const filteredNews = useMemo(() => {
    const news = data?.news ?? []
    return selectedTicker ? news.filter((item) => item.ticker === selectedTicker) : news
  }, [data?.news, selectedTicker])

  const highImpactCount = data?.events.filter((event) => event.impact === "high").length ?? 0
  const estimatedCount = data?.events.filter((event) => event.certainty === "estimated" || event.certainty === "speculative").length ?? 0

  return (
    <main className="min-h-full bg-background pb-28 text-foreground">
      <header className="border-b border-border/50 bg-background/85 px-4 pb-5 pt-16 backdrop-blur-xl lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                Solo posiciones abiertas
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Radar de cartera</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Resultados, dividendos y catalizadores respaldados por una fuente. Las ventanas estimadas nunca se muestran como fechas confirmadas.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Actualizando" />}
              {data && <>Actualizado {format(new Date(data.updatedAt), "HH:mm")}</>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:max-w-xl">
            <SummaryMetric label="Posiciones" value={data?.assets.length ?? 0} icon={ShieldCheck} />
            <SummaryMetric label="Alto impacto" value={highImpactCount} icon={Sparkles} />
            <SummaryMetric label="Por confirmar" value={estimatedCount} icon={Clock3} />
          </div>

          {data && data.assets.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Filtrar por activo">
              <FilterButton active={selectedTicker === null} onClick={() => setSelectedTicker(null)}>Todos</FilterButton>
              {data.assets.map((asset) => (
                <FilterButton
                  key={asset.id}
                  active={selectedTicker === asset.ticker}
                  onClick={() => setSelectedTicker(selectedTicker === asset.ticker ? null : asset.ticker)}
                >
                  {asset.ticker.split(".")[0]}
                </FilterButton>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin" />
            <span className="text-sm">Buscando eventos de tus posiciones…</span>
          </div>
        ) : isError ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-destructive/30 bg-destructive/5 text-center">
            <p className="font-medium text-destructive">No se pudo actualizar el radar.</p>
            <button type="button" onClick={() => void refetch()} className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">
              Reintentar
            </button>
          </div>
        ) : !data || data.assets.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-border text-center">
            <CalendarDays className="mb-3 h-9 w-9 text-muted-foreground" aria-hidden="true" />
            <p className="font-semibold">No hay posiciones con dinero invertido</p>
            <p className="mt-1 text-sm text-muted-foreground">Radar se activará cuando exista al menos una posición abierta.</p>
          </div>
        ) : (
          <>
            <section aria-labelledby="calendar-title">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="calendar-title" className="text-lg font-semibold">Próximos seis meses</h2>
                  <p className="text-xs text-muted-foreground">Las ventanas se marcan durante todos sus días posibles.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {(["confirmed", "scheduled", "estimated", "speculative"] as const).map((certainty) => (
                    <span key={certainty} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className={`h-1.5 w-1.5 rounded-full ${CERTAINTY[certainty].dot}`} />
                      {CERTAINTY[certainty].label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {months.map((month) => (
                  <div key={month.date.toISOString()} className="min-w-[280px] max-w-[320px] flex-1 snap-start shrink-0 rounded-2xl border border-border/60 bg-card/45 p-4 shadow-sm">
                    <h3 className="mb-3 text-sm font-semibold capitalize">{format(month.date, "MMMM yyyy", { locale: es })}</h3>
                    <div className="mb-1 grid grid-cols-7 gap-1 text-center">
                      {["L", "M", "X", "J", "V", "S", "D"].map((day) => <span key={day} className="text-[10px] font-medium text-muted-foreground">{day}</span>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: month.padding }, (_, index) => <span key={`empty-${index}`} className="h-9" />)}
                      {month.days.map((day, dayIndex) => {
                        const dayEvents = data.events.filter((event) => (!selectedTicker || event.ticker === selectedTicker) && eventOccursOn(event, day))
                        const isSelected = selectedDate ? isSameDay(selectedDate, day) : false
                        const dayKey = format(day, "yyyy-MM-dd")
                        const isPreviewed = previewDateKey === dayKey
                        const column = (month.padding + dayIndex) % 7
                        const tooltipPosition = column <= 1
                          ? "left-0"
                          : column >= 5
                            ? "right-0"
                            : "left-1/2 -translate-x-1/2"
                        return (
                          <div key={day.toISOString()} className="relative">
                            <button
                              type="button"
                              onClick={() => setSelectedDate(isSelected ? null : day)}
                              onMouseEnter={() => setPreviewDateKey(dayKey)}
                              onMouseLeave={() => setPreviewDateKey(null)}
                              onFocus={() => setPreviewDateKey(dayKey)}
                              onBlur={() => setPreviewDateKey(null)}
                              aria-pressed={isSelected}
                              aria-describedby={isPreviewed ? `radar-preview-${dayKey}` : undefined}
                              aria-label={`${format(day, "d 'de' MMMM", { locale: es })}: ${dayEvents.length} eventos`}
                              className={`flex h-9 w-full flex-col items-center justify-center rounded-lg text-xs transition-colors ${isSelected ? "bg-foreground text-background" : "hover:bg-muted focus-visible:bg-muted"}`}
                            >
                              <span>{format(day, "d")}</span>
                              <span className="mt-0.5 flex h-1 gap-0.5">
                                {dayEvents.slice(0, 3).map((event) => <span key={event.id} className={`h-1 w-1 rounded-full ${CERTAINTY[event.certainty].dot}`} />)}
                              </span>
                            </button>
                            {isPreviewed && (
                              <DayPreview
                                id={`radar-preview-${dayKey}`}
                                day={day}
                                events={dayEvents}
                                assets={data.assets}
                                positionClassName={tooltipPosition}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
              <section aria-labelledby="events-title">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 id="events-title" className="text-lg font-semibold">
                      {selectedDate ? `Eventos del ${format(selectedDate, "d 'de' MMMM", { locale: es })}` : "Eventos detectados"}
                    </h2>
                    <p className="text-xs text-muted-foreground">{filteredEvents.length} eventos vinculados a posiciones abiertas</p>
                  </div>
                  {selectedDate && <button type="button" onClick={() => setSelectedDate(null)} className="text-xs font-semibold text-primary">Ver todos</button>}
                </div>
                {filteredEvents.length === 0 ? (
                  <EmptyPanel text="No hay eventos para este filtro." />
                ) : (
                  <div className="space-y-2">
                    {filteredEvents.map((event) => {
                      const asset = data.assets.find((item) => item.id === event.assetId || item.ticker === event.ticker)
                      const Icon = eventIcon(event.type)
                      return (
                        <article key={event.id} className="rounded-2xl border border-border/60 bg-card/45 p-4">
                          <div className="flex items-start gap-3">
                            {asset ? <AssetLogo ticker={asset.ticker} name={asset.name} type={asset.type} size={42} /> : (
                              <span className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-muted"><Icon className="h-5 w-5" /></span>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold">{asset ? asset.name : event.ticker.split(".")[0]}</span>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CERTAINTY[event.certainty].badge}`}>
                                  {CERTAINTY[event.certainty].label}
                                </span>
                                {event.impact === "high" && <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-400">Alto impacto</span>}
                              </div>
                              <h3 className="mt-1 font-semibold leading-snug">{event.title}</h3>
                              <p className="mt-1 text-xs font-medium text-muted-foreground">{eventDateLabel(event)}</p>
                              {event.description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{event.description}</p>}
                              {event.sourceUrl && (
                                <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                                  Fuente: {event.sourceName ?? "Abrir"} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                </a>
                              )}
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>

              <section aria-labelledby="news-title">
                <div className="mb-3">
                  <h2 id="news-title" className="flex items-center gap-2 text-lg font-semibold"><Newspaper className="h-4 w-4" /> Noticias relacionadas</h2>
                  <p className="text-xs text-muted-foreground">Fuentes usadas para vigilar nuevos catalizadores</p>
                </div>
                {filteredNews.length === 0 ? <EmptyPanel text="No hay noticias recientes para este filtro." /> : (
                  <div className="space-y-2">
                    {filteredNews.slice(0, 12).map((item) => {
                      const asset = data.assets.find((a) => a.ticker === item.ticker)
                      return (
                      <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="block rounded-2xl border border-border/50 bg-card/35 p-3 transition-colors hover:bg-muted/50">
                        <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                          <span className="font-bold text-primary">{asset ? asset.name : item.ticker.split(".")[0]}</span>
                          <span>{format(new Date(item.publishedAt), "d MMM", { locale: es })}</span>
                        </div>
                        <h3 className="text-sm font-medium leading-snug">{item.title}</h3>
                        <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">{item.source}</p>
                      </a>
                    )})}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function SummaryMetric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof ShieldCheck }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-3">
      <Icon className="mb-2 h-4 w-4 text-primary" aria-hidden="true" />
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  )
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? "border-foreground bg-foreground text-background" : "border-border bg-card/40 text-muted-foreground hover:text-foreground"}`}>{children}</button>
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>
}

function DayPreview({
  id,
  day,
  events,
  assets,
  positionClassName,
}: {
  id: string
  day: Date
  events: RadarEvent[]
  assets: { ticker: string; name: string }[]
  positionClassName: string
}) {
  return (
    <div
      id={id}
      role="tooltip"
      className={`pointer-events-none absolute bottom-full z-50 mb-2 w-60 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl ${positionClassName}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold capitalize">{format(day, "EEEE, d MMMM", { locale: es })}</p>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {events.length === 1 ? "1 evento" : `${events.length} eventos`}
        </span>
      </div>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin eventos previstos para este día.</p>
      ) : (
        <div className="space-y-2">
          {events.slice(0, 3).map((event) => (
            <div key={event.id} className="flex items-start gap-2">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${CERTAINTY[event.certainty].dot}`} />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-primary">
                  {assets.find(a => a.ticker === event.ticker)?.name ?? event.ticker.split(".")[0]}
                </p>
                <p className="line-clamp-2 text-xs leading-snug">{event.title}</p>
              </div>
            </div>
          ))}
          {events.length > 3 && <p className="text-[10px] text-muted-foreground">+{events.length - 3} eventos más</p>}
        </div>
      )}
      <p className="mt-2 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">Haz click para fijar el detalle debajo.</p>
    </div>
  )
}
