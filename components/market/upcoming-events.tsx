"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Calendar, Plus, CalendarDays, DollarSign, Wallet, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { EnrichedPosition, EventoRecurrente } from '@/lib/types'
import { fetchEventosRecurrentes } from '@/lib/api/market'

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

export function UpcomingEvents({ positions, onAddEvent, onEditEvent }: UpcomingEventsProps) {
  const [events, setEvents] = useState<UnifiedEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadEvents() {
      try {
        setLoading(true)
        
        // 1. Fetch automatic dividends
        const tickers = Array.from(new Set(positions.map(p => p.ticker)))
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickers }),
          cache: 'no-store'
        })
        if (!res.ok) throw new Error(`API returned ${res.status}: ${await res.text()}`)
        const apiData = await res.json()
        
        if (!apiData || typeof apiData !== 'object') throw new Error(`Invalid API response: ${JSON.stringify(apiData)}`)
        
        const autoEvents = (apiData.events || []).map((e: any) => ({
          id: `auto-${e.ticker}-${e.date}`,
          title: `Dividendo ${e.ticker}`,
          date: new Date(e.date),
          type: e.type,
          isManual: false
        }))

        // 2. Fetch manual recurring events
        const manualEvents = await fetchEventosRecurrentes().catch(() => [])
        
        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()
        const todayDay = now.getDate()

        const mappedManual = manualEvents.map((e) => {
          // Si el día del mes ya pasó, proyectamos para el mes que viene
          let month = currentMonth
          let year = currentYear
          if (e.dia_del_mes < todayDay) {
            month++
            if (month > 11) {
              month = 0
              year++
            }
          }
          const eventDate = new Date(year, month, e.dia_del_mes)

          return {
            id: e.id,
            title: e.titulo,
            date: eventDate,
            type: e.tipo,
            isManual: true,
            originalEvent: e
          }
        })

        // Combine, filter out past events, calculate days left, and sort
        const today = new Date()
        today.setHours(0,0,0,0)

        const allEvents = [...autoEvents, ...mappedManual]
          .map(e => {
            const diffTime = e.date.getTime() - today.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            return { ...e, daysLeft: diffDays }
          })
          .filter(e => e.daysLeft >= 0)
          .sort((a, b) => a.daysLeft - b.daysLeft)
          // Mostrar todos los eventos, el contenedor hará scroll

        if (mounted) {
          setEvents(allEvents)
          setLoading(false)
        }

      } catch (err: any) {
        console.error("LOAD EVENTS ERROR:", err)
        if (mounted) {
          setEvents([{ id: 'err', title: `ERROR FATAL: ${err.message}`, date: new Date(), type: 'Interés', daysLeft: 0, isManual: true }])
          setLoading(false)
        }
      }
    }

    if (positions.length > 0) {
      loadEvents()
    } else {
      setLoading(false)
    }

    return () => { mounted = false }
  }, [positions])

  const getIcon = (type: string) => {
    switch (type) {
      case 'Pago Dividendo': 
      case 'Ex-Dividendo': return <DollarSign className="h-4 w-4 text-emerald-400" />
      case 'Interés': return <Wallet className="h-4 w-4 text-blue-400" />
      case 'Aportación': return <Plus className="h-4 w-4 text-amber-400" />
      default: return <CalendarDays className="h-4 w-4 text-purple-400" />
    }
  }

  return (
    <Card className="bg-card border-border backdrop-blur-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4 text-amber-400" />
          Próximos Eventos
          {loading && events.length > 0 && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/80 hover:text-foreground/80" onClick={onAddEvent}>
          <Plus className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent 
        className="flex flex-col gap-3 overflow-y-auto pr-2 pb-2 max-h-[200px] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted/50 [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-zinc-700"
      >

        {loading && events.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted animate-shimmer" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-24 bg-muted rounded animate-shimmer" />
                <div className="h-2 w-16 bg-muted/50 rounded animate-shimmer" />
              </div>
            </div>
          ))
        ) : events.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
            <CalendarDays className="h-8 w-8 text-zinc-700 mb-2" />
            <p className="text-xs text-muted-foreground/80 font-medium">No hay eventos próximos</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1 max-w-[200px]">Añade eventos manuales o compra acciones con dividendos</p>
          </div>
        ) : (
          <div className="max-h-[140px] overflow-y-auto pr-1 space-y-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted/50 [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-zinc-700">
            {events.map((event, idx) => (
              <div 
                key={`${event.id}-${idx}`} 
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${event.isManual ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                onClick={() => {
                  if (event.isManual && onEditEvent && event.originalEvent) {
                    onEditEvent(event.originalEvent)
                  }
                }}
              >
                <div className="h-8 w-8 rounded-full bg-background/50 flex items-center justify-center border border-border/50 shrink-0">
                  {getIcon(event.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground/90 truncate">{event.title}</p>
                  <p className="text-xs text-muted-foreground/80">
                    {event.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              <div className="text-right shrink-0">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  event.daysLeft === 0 
                    ? "bg-emerald-500/10 text-emerald-400" 
                    : event.daysLeft < 0
                      ? "bg-muted text-muted-foreground/80"
                      : event.daysLeft <= 3 
                        ? "bg-amber-500/10 text-amber-400" 
                        : "bg-muted text-muted-foreground"
                }`}>
                  {event.daysLeft === 0 ? "Hoy" : event.daysLeft < 0 ? `Hace ${Math.abs(event.daysLeft)} d` : `Faltan ${event.daysLeft} d`}
                </span>
              </div>
            </div>
          ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
