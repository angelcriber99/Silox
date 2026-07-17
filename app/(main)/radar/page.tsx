"use client"

import { useState, useEffect, useMemo } from "react"
import { IOSHeader } from "@/components/ui/ios-header"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { Newspaper, Loader2, Rocket, AlertTriangle, Briefcase, TrendingUp } from "lucide-react"
import { startOfMonth, endOfMonth, eachDayOfInterval, addMonths, format, isSameDay, getDay, isPast, isToday } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"

type CalendarEvent = {
  id: string
  ticker: string
  date: string
  type: 'EARNINGS' | 'DIVIDEND' | 'EX_DIVIDEND' | 'AI_EVENT'
  title: string
  description?: string
}

type NewsItem = {
  uuid: string
  title: string
  publisher: string
  link: string
  providerPublishTime: string
  relatedTicker: string
  sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
}

export default function RadarPage() {
  const { positions } = usePortfolio()
  
  const [noticias, setNoticias] = useState<NewsItem[]>([])
  const [aiEvents, setAiEvents] = useState<CalendarEvent[]>([])
  const [marketEvents, setMarketEvents] = useState<CalendarEvent[]>([])
  
  const [loadingNews, setLoadingNews] = useState(false)
  const [loadingCalendar, setLoadingCalendar] = useState(false)

  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const uniqueTickers = useMemo(() => {
    if (!positions) return []
    const tickers = new Set<string>()
    positions.forEach(p => {
      if (p.ticker && p.tipo !== 'Fondo Monetario' && p.tipo !== 'Liquidez' && p.ticker !== 'CASH' && Math.abs(p.unidades) > 0.000001) {
        tickers.add(p.ticker)
      }
    })
    return Array.from(tickers)
  }, [positions])

  // Use a stringified version of tickers to prevent infinite refetching
  const tickersStr = uniqueTickers.join(',')

  useEffect(() => {
    if (!tickersStr) return

    const fetchNews = async () => {
      setLoadingNews(true)
      try {
        const items = tickersStr.split(',').map(t => ({ query: t, displayName: t }))
        const res = await fetch("/api/noticias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.error) {
            console.error("API returned error:", data.error)
            toast.error("Error cargando noticias", { description: data.error })
          }
          setNoticias(data.noticias || [])
          setAiEvents(data.aiEvents || [])
        }
      } catch (err) {
        console.error("Error fetching news:", err)
      } finally {
        setLoadingNews(false)
      }
    }

    const fetchCalendar = async () => {
      setLoadingCalendar(true)
      try {
        const res = await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickers: tickersStr.split(',') }),
        })
        if (res.ok) {
          const data = await res.json()
          setMarketEvents(data.events || [])
        }
      } catch (err) {
        console.error("Error fetching calendar:", err)
      } finally {
        setLoadingCalendar(false)
      }
    }

    fetchNews()
    fetchCalendar()
  }, [tickersStr])

  const allEvents = useMemo(() => {
    const combined = [...marketEvents, ...aiEvents]
    return combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [marketEvents, aiEvents])

  // Generate 6 months data
  const monthsData = useMemo(() => {
    const now = new Date()
    const months = []
    for (let i = 0; i < 6; i++) {
      const currentMonth = addMonths(now, i)
      const start = startOfMonth(currentMonth)
      const end = endOfMonth(currentMonth)
      const days = eachDayOfInterval({ start, end })
      
      // Calculate padding for first day of month (0 = Sunday, 1 = Monday)
      // We want Monday to be 0, Sunday to be 6
      const firstDay = getDay(start)
      const padding = firstDay === 0 ? 6 : firstDay - 1

      months.push({
        date: currentMonth,
        days,
        padding,
      })
    }
    return months
  }, [])

  const getEventIcon = (type: string, className?: string) => {
    const cn = className || "w-4 h-4"
    switch(type) {
      case 'EARNINGS': return <Briefcase className={`${cn} text-blue-400`} />
      case 'DIVIDEND': return <TrendingUp className={`${cn} text-green-400`} />
      case 'EX_DIVIDEND': return <AlertTriangle className={`${cn} text-yellow-400`} />
      case 'AI_EVENT': return <Rocket className={`${cn} text-purple-400`} />
      default: return null
    }
  }

  const getEventBgColor = (type: string) => {
    switch(type) {
      case 'EARNINGS': return 'bg-blue-400/20 text-blue-300 border-blue-400/30'
      case 'DIVIDEND': return 'bg-green-400/20 text-green-300 border-green-400/30'
      case 'EX_DIVIDEND': return 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30'
      case 'AI_EVENT': return 'bg-purple-400/20 text-purple-300 border-purple-400/30'
      default: return 'bg-zinc-800 text-zinc-300'
    }
  }

  const getSentimentColor = (sentiment?: string) => {
    if (sentiment === 'POSITIVE') return 'text-green-500'
    if (sentiment === 'NEGATIVE') return 'text-red-500'
    return 'text-zinc-500'
  }

  // Filter lists based on selected date
  const displayedEvents = useMemo(() => {
    let list = allEvents.filter(e => {
      const edate = new Date(e.date)
      return !isPast(edate) || isToday(edate) // filter past events globally unless selected
    })

    if (selectedDate) {
      list = allEvents.filter(e => isSameDay(new Date(e.date), selectedDate))
    }
    return list
  }, [allEvents, selectedDate])

  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)

  const displayedNews = useMemo(() => {
    let list = noticias
    if (selectedDate) {
      list = noticias.filter(n => isSameDay(new Date(n.providerPublishTime), selectedDate))
    }
    if (selectedTicker) {
      list = list.filter(n => n.relatedTicker === selectedTicker)
    }
    return list
  }, [noticias, selectedDate, selectedTicker])

  // Extract tickers that actually have news
  const newsTickers = useMemo(() => {
    const tickers = new Set<string>()
    noticias.forEach(n => tickers.add(n.relatedTicker))
    return Array.from(tickers).sort()
  }, [noticias])

  return (
    <main className="min-h-full bg-background text-foreground flex flex-col pb-24 relative">
      <div className="w-full bg-background/90 backdrop-blur-xl z-20 pt-16 pb-4">
        <div className="px-4 mb-4 relative flex items-center justify-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Radar
          </h1>
          {selectedDate && (
            <button 
              onClick={() => setSelectedDate(null)}
              className="absolute right-4 text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 shadow-sm hover:bg-primary/20 transition-colors"
            >
              Ver Todo
            </button>
          )}
        </div>
        
        {loadingCalendar ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mb-3" />
            <p className="text-sm">Analizando fechas clave...</p>
          </div>
        ) : (
          <div className="flex overflow-x-auto snap-x hide-scrollbar px-4 pb-2 gap-6">
            {monthsData.map((month, i) => (
              <div key={i} className="flex-shrink-0 snap-start w-[260px]">
                <h3 className="text-sm font-semibold capitalize mb-3 px-1 text-zinc-100">
                  {format(month.date, "MMMM yyyy", { locale: es })}
                </h3>
                
                <div className="grid grid-cols-7 gap-1.5 text-center mb-1.5">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, idx) => (
                    <div key={idx} className="text-[10px] font-medium text-zinc-500">{day}</div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: month.padding }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-8 rounded-md" />
                  ))}
                  
                  {month.days.map((day, dayIdx) => {
                    const colIdx = (dayIdx + month.padding) % 7
                    const dayEvents = allEvents.filter(e => isSameDay(new Date(e.date), day))
                    const hasEvent = dayEvents.length > 0
                    const firstEvent = dayEvents[0]
                    const isSelected = selectedDate && isSameDay(day, selectedDate)
                    
                    let bgClass = "bg-transparent text-zinc-400 hover:bg-zinc-800"
                    if (hasEvent) {
                      bgClass = getEventBgColor(firstEvent.type)
                    } else if (isToday(day)) {
                      bgClass = "bg-zinc-800 text-white font-bold"
                    }

                    if (isSelected) {
                      bgClass += " ring-2 ring-primary ring-offset-1 ring-offset-background"
                    }

                    // Smart tooltip positioning based on column index
                    let tooltipPosClass = "left-1/2 -translate-x-1/2"
                    let trianglePosClass = "left-1/2 -translate-x-1/2"
                    if (colIdx <= 1) {
                      tooltipPosClass = "left-0"
                      trianglePosClass = "left-4"
                    } else if (colIdx >= 5) {
                      tooltipPosClass = "right-0"
                      trianglePosClass = "right-4"
                    }

                    return (
                      <div key={dayIdx} className="relative group">
                        <button
                          onClick={() => setSelectedDate(day)}
                          className={`w-full h-8 flex items-center justify-center rounded-md text-xs transition-all border border-transparent ${bgClass}`}
                        >
                          {format(day, "d")}
                        </button>
                        
                        {/* Custom Tooltip on Hover */}
                        {hasEvent && (
                          <div className={`absolute bottom-full mb-2 w-48 p-2.5 rounded-xl bg-zinc-900 border border-white/10 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none ${tooltipPosClass}`}>
                            <div className="flex flex-col gap-1.5">
                              {dayEvents.map(e => (
                                <div key={e.id} className="flex items-start gap-1.5">
                                  <div className="mt-0.5">{getEventIcon(e.type, "w-3.5 h-3.5")}</div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-white leading-tight">{e.ticker}</span>
                                    <span className="text-[10px] text-zinc-400 leading-tight">{e.title}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {/* Little triangle pointer */}
                            <div className={`absolute top-full -mt-[1px] border-4 border-transparent border-t-zinc-900 ${trianglePosClass}`} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-8">
        
        {/* ── News Feed (Filtered) ────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-zinc-400" />
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
                {selectedDate ? `Noticias del ${format(selectedDate, "d 'de' MMMM", { locale: es })}` : "Últimas Noticias"}
              </h3>
            </div>
            {(selectedDate || selectedTicker) && (
              <button 
                onClick={() => { setSelectedDate(null); setSelectedTicker(null); }}
                className="text-xs text-primary"
              >
                Limpiar Filtros
              </button>
            )}
          </div>

          {/* Ticker Filters */}
          {!loadingNews && newsTickers.length > 0 && (
            <div className="flex overflow-x-auto snap-x hide-scrollbar gap-2 pb-4 mb-2">
              <button
                onClick={() => setSelectedTicker(null)}
                className={`snap-start flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                  selectedTicker === null 
                    ? 'bg-zinc-100 text-zinc-900 border-zinc-100' 
                    : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                Todos
              </button>
              {newsTickers.map(ticker => (
                <button
                  key={ticker}
                  onClick={() => setSelectedTicker(ticker === selectedTicker ? null : ticker)}
                  className={`snap-start flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                    selectedTicker === ticker 
                      ? 'bg-primary text-primary-foreground border-primary' 
                      : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                  }`}
                >
                  {ticker}
                </button>
              ))}
            </div>
          )}
          
          {loadingNews ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mb-3" />
              <p className="text-sm">Analizando noticias...</p>
            </div>
          ) : displayedNews.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-muted-foreground text-sm">
              No se encontraron noticias.
            </div>
          ) : (
            <div className="space-y-3">
              {displayedNews.map((news) => (
                <a 
                  key={news.uuid} 
                  href={news.link} 
                  target="_blank" 
                  rel="noreferrer"
                  className="block p-4 rounded-2xl bg-zinc-900/40 border border-white/5 hover:bg-zinc-900/60 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-white/10 text-white/80">
                      {news.relatedTicker}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(news.providerPublishTime).toLocaleDateString(es.code, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-100 leading-snug mb-2">
                    {news.title}
                  </h3>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{news.publisher}</span>
                    {news.sentiment && (
                      <span className={`text-[10px] font-bold tracking-wider ${getSentimentColor(news.sentiment)}`}>
                        {news.sentiment}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
