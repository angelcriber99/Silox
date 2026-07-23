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
import { usePreferences } from "@/lib/stores/use-preferences"
import { AssetLogo } from "@/components/ui/asset-logo"
import { BackButton } from "@/components/ui/back-button"

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

async function loadRadar(language: string): Promise<RadarPayload> {
  const response = await fetch(`/api/mobile/v1/radar?lang=${language}`, { cache: "no-store" })
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
  const language = usePreferences((state) => state.language)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["radar", language],
    queryFn: () => loadRadar(language),
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
    <main className="min-h-full bg-[#F5F5F7] dark:bg-zinc-950 pb-28 text-foreground selection:bg-primary/20">
      <header className="px-6 pb-6 pt-[max(24px,env(safe-area-inset-top))] flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
            <h1 className="text-[34px] font-bold tracking-tight leading-tight text-zinc-900 dark:text-white">Radar</h1>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <SummaryMetric label="Posiciones" value={data?.assets.length ?? 0} icon={ShieldCheck} />
          <SummaryMetric label="Alto impacto" value={highImpactCount} icon={Sparkles} />
          <SummaryMetric label="Por confirmar" value={estimatedCount} icon={Clock3} />
        </div>

        {data && data.assets.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2" aria-label="Filtrar por activo">
            <FilterButton active={selectedTicker === null} onClick={() => setSelectedTicker(null)}>Todos</FilterButton>
            {data.assets.map((asset) => {
              const displaySymbol = (asset.type === "Fondo Indexado" || asset.type === "Fondo Monetario")
                ? (asset.name?.split(' ')[0].toUpperCase() || "FONDO")
                : (asset.ticker.length > 6 && asset.name) 
                  ? asset.name.split(' ')[0].toUpperCase() 
                  : asset.ticker.split('.')[0]

              return (
                <FilterButton
                  key={asset.id}
                  active={selectedTicker === asset.ticker}
                  onClick={() => setSelectedTicker(selectedTicker === asset.ticker ? null : asset.ticker)}
                >
                  {displaySymbol}
                </FilterButton>
              )
            })}
          </div>
        )}
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-5 py-2 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-zinc-500">
            <Loader2 className="h-7 w-7 animate-spin" />
            <span className="text-sm">Buscando eventos...</span>
          </div>
        ) : isError ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-[32px] bg-white dark:bg-zinc-900 text-center p-6 shadow-sm">
            <p className="font-medium text-rose-500">No se pudo actualizar el radar.</p>
            <button type="button" onClick={() => void refetch()} className="rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black px-5 py-2.5 text-[15px] font-bold">
              Reintentar
            </button>
          </div>
        ) : !data || data.assets.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[32px] bg-white dark:bg-zinc-900 text-center p-6 shadow-sm">
            <CalendarDays className="mb-4 h-10 w-10 text-zinc-300" aria-hidden="true" />
            <p className="text-[18px] font-bold text-zinc-900 dark:text-white">Sin posiciones</p>
            <p className="mt-1.5 text-[14px] text-zinc-500">Añade activos a tu cartera para activar el radar.</p>
          </div>
        ) : (
          <>
            {/* EVENTOS */}
            <section aria-labelledby="events-title">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 id="events-title" className="text-[20px] font-bold text-zinc-900 dark:text-white">
                    Próximos Eventos
                  </h2>
                </div>
              </div>
              
              {filteredEvents.length === 0 ? (
                <EmptyPanel text="No hay eventos previstos." />
              ) : (
                <div className="space-y-4">
                  {filteredEvents.map((event) => {
                    const asset = data.assets.find((item) => item.id === event.assetId || item.ticker === event.ticker)
                    const Icon = eventIcon(event.type)
                    return (
                      <article key={event.id} className="rounded-[32px] bg-white dark:bg-zinc-900 p-5 shadow-sm">
                        <div className="flex items-start gap-4">
                          {asset ? <AssetLogo ticker={asset.ticker} name={asset.name} type={asset.type} size={48} /> : (
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800"><Icon className="h-6 w-6 text-zinc-500" /></span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-[16px] font-bold text-zinc-900 dark:text-white">{asset ? asset.name : event.ticker.split(".")[0]}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CERTAINTY[event.certainty].badge}`}>
                                {CERTAINTY[event.certainty].label}
                              </span>
                            </div>
                            <h3 className="text-[15px] font-medium leading-snug text-zinc-700 dark:text-zinc-300">{event.title}</h3>
                            <p className="mt-2 text-[13px] font-bold text-zinc-500 dark:text-zinc-400">{eventDateLabel(event)}</p>
                            
                            {event.sourceUrl && (
                              <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-[12px] font-bold text-zinc-600 dark:text-zinc-300 transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                {event.sourceName ?? "Fuente externa"} <ExternalLink className="h-3 w-3" aria-hidden="true" />
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

            {/* NOTICIAS */}
            <section aria-labelledby="news-title" className="mt-8">
              <div className="mb-4">
                <h2 id="news-title" className="text-[20px] font-bold text-zinc-900 dark:text-white">Noticias</h2>
              </div>
              {filteredNews.length === 0 ? <EmptyPanel text="No hay noticias recientes." /> : (
                <div className="space-y-3">
                  {filteredNews.slice(0, 12).map((item) => {
                    const asset = data.assets.find((a) => a.ticker === item.ticker)
                    return (
                    <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="block rounded-[24px] bg-white dark:bg-zinc-900 p-5 shadow-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/80">
                      <div className="mb-2 flex items-center justify-between gap-2 text-[12px] font-medium text-zinc-500">
                        <span className="font-bold text-zinc-900 dark:text-white">{asset ? asset.name : item.ticker.split(".")[0]}</span>
                        <span>{format(new Date(item.publishedAt), "d MMM", { locale: es })}</span>
                      </div>
                      <h3 className="text-[15px] font-medium leading-snug text-zinc-700 dark:text-zinc-300">{item.title}</h3>
                      <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-zinc-400">{item.source}</p>
                    </a>
                  )})}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function SummaryMetric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof ShieldCheck }) {
  return (
    <div className="rounded-[24px] bg-white dark:bg-zinc-900 p-4 shadow-sm flex flex-col items-center justify-center text-center">
      <Icon className="mb-2 h-6 w-6 text-zinc-400" aria-hidden="true" strokeWidth={1.5} />
      <p className="text-[24px] font-bold tabular-nums text-zinc-900 dark:text-white leading-none">{value}</p>
      <p className="text-[11px] font-semibold text-zinc-500 mt-1">{label}</p>
    </div>
  )
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button 
      type="button" 
      onClick={onClick} 
      aria-pressed={active} 
      className={`rounded-full px-4 py-2 text-[14px] font-bold transition-all ${
        active 
          ? "bg-zinc-900 text-white dark:bg-white dark:text-black shadow-md" 
          : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-sm"
      }`}
    >
      {children}
    </button>
  )
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="rounded-[32px] bg-white dark:bg-zinc-900 p-8 text-center text-[15px] font-medium text-zinc-500 shadow-sm">{text}</div>
}

