"use client"

import { useState, useEffect, useMemo } from "react"
import { IOSHeader } from "@/components/ui/ios-header"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { Newspaper, Calendar as CalendarIcon, Loader2, Rocket, AlertTriangle, Briefcase, TrendingUp } from "lucide-react"

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
  const [activeTab, setActiveTab] = useState<"Noticias" | "Calendario">("Noticias")
  
  const [noticias, setNoticias] = useState<NewsItem[]>([])
  const [aiEvents, setAiEvents] = useState<CalendarEvent[]>([])
  const [marketEvents, setMarketEvents] = useState<CalendarEvent[]>([])
  
  const [loadingNews, setLoadingNews] = useState(false)
  const [loadingCalendar, setLoadingCalendar] = useState(false)

  const uniqueTickers = useMemo(() => {
    if (!positions) return []
    const tickers = new Set<string>()
    positions.forEach(p => {
      if (p.ticker && p.tipo !== 'Fondo Monetario' && p.tipo !== 'Liquidez' && p.ticker !== 'CASH') {
        tickers.add(p.ticker)
      }
    })
    return Array.from(tickers)
  }, [positions])

  useEffect(() => {
    if (uniqueTickers.length === 0) return

    const fetchNews = async () => {
      setLoadingNews(true)
      try {
        const items = uniqueTickers.map(t => ({ query: t, displayName: t }))
        const res = await fetch("/api/noticias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        })
        if (res.ok) {
          const data = await res.json()
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
          body: JSON.stringify({ tickers: uniqueTickers }),
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
  }, [uniqueTickers])

  const allEvents = useMemo(() => {
    const combined = [...marketEvents, ...aiEvents]
    // Filter out past events
    const now = new Date().getTime()
    return combined
      .filter(e => new Date(e.date).getTime() >= now - 24 * 60 * 60 * 1000) // Keep today's events too
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [marketEvents, aiEvents])

  const getEventIcon = (type: string) => {
    switch(type) {
      case 'EARNINGS': return <Briefcase className="w-4 h-4 text-blue-400" />
      case 'DIVIDEND': return <TrendingUp className="w-4 h-4 text-green-400" />
      case 'EX_DIVIDEND': return <AlertTriangle className="w-4 h-4 text-yellow-400" />
      case 'AI_EVENT': return <Rocket className="w-4 h-4 text-purple-400" />
      default: return <CalendarIcon className="w-4 h-4 text-gray-400" />
    }
  }

  const getSentimentColor = (sentiment?: string) => {
    if (sentiment === 'POSITIVE') return 'text-green-500'
    if (sentiment === 'NEGATIVE') return 'text-red-500'
    return 'text-zinc-500'
  }

  return (
    <main className="min-h-full bg-background text-foreground flex flex-col pb-24">
      <IOSHeader title="Radar" />
      
      {/* Sticky Tabs */}
      <div className="sticky top-[env(safe-area-inset-top,0px)] z-20 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex px-4 pt-14 pb-2">
          <div className="flex w-full bg-zinc-900/50 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("Noticias")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === "Noticias" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Newspaper className="w-4 h-4" />
              Noticias
            </button>
            <button
              onClick={() => setActiveTab("Calendario")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === "Calendario" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              Calendario
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
        {activeTab === "Noticias" ? (
          <div className="space-y-4">
            {loadingNews ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>Analizando noticias de tus activos...</p>
              </div>
            ) : noticias.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                No hay noticias recientes para tus activos.
              </div>
            ) : (
              noticias.map((news) => (
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
                      {new Date(news.providerPublishTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
              ))
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {loadingCalendar ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>Extrayendo eventos del mercado e IA...</p>
              </div>
            ) : allEvents.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                No hay eventos próximos detectados para tu cartera.
              </div>
            ) : (
              <div className="relative border-l border-white/10 ml-3 space-y-8 pb-10">
                {allEvents.map((event) => {
                  const dateObj = new Date(event.date)
                  return (
                    <div key={event.id} className="relative pl-6">
                      {/* Timeline dot */}
                      <div className="absolute -left-3 top-1 w-6 h-6 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center">
                        {getEventIcon(event.type)}
                      </div>
                      
                      <div className="flex flex-col">
                        <span className="text-[11px] font-semibold text-primary mb-1 uppercase tracking-wider">
                          {dateObj.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
                        </span>
                        
                        <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-white/5 mt-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/90">
                              {event.ticker}
                            </span>
                            <span className="text-xs text-zinc-400">
                              {event.title}
                            </span>
                          </div>
                          {event.description && (
                            <p className="text-[11px] text-zinc-500 leading-relaxed mt-2">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
