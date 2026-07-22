"use client"

import Marquee from "react-fast-marquee"
import { useQuery } from "@tanstack/react-query"
import type { EnrichedPosition } from '@/lib/types'
import { Newspaper } from "lucide-react"
import { isValidExternalUrl } from "@/lib/utils"
import { z } from "zod"

const portfolioNewsResponseSchema = z.object({
  noticias: z.array(z.object({
    title: z.string(),
    link: z.string(),
    relatedTicker: z.string(),
  })).default([]),
})

interface MarketTickerProps {
  positions?: EnrichedPosition[]
}

export function MarketTicker({ positions = [] }: MarketTickerProps) {
  // Extract top 5 positions by value
  const topItems = positions
    .filter(p => (p.displayValue?.amount ?? null) !== null && p.tipo !== 'Fondo Monetario' && p.tipo !== 'Crypto')
    .sort((a, b) => ((b.displayValue?.amount ?? null) || 0) - ((a.displayValue?.amount ?? null) || 0))
    .slice(0, 5)
    .map(p => {
      const cleanTicker = p.ticker.split('.')[0]
      const isAction = p.tipo === 'Acción'
      return {
        ticker: p.ticker,
        // Si es acción, buscamos por ticker (es más preciso). Si es fondo, buscamos por nombre.
        query: isAction ? cleanTicker : (p.nombre || cleanTicker),
        // Display name corto y bonito
        displayName: isAction ? cleanTicker : (p.nombre ? p.nombre.substring(0, 15) : cleanTicker)
      }
    })

  const { data: newsData, isLoading: isLoadingNews } = useQuery({
    queryKey: ["portfolio-news", topItems.map(i => i.ticker).join(',')],
    queryFn: async () => {
      if (topItems.length === 0) return []
      const res = await fetch("/api/noticias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: topItems }),
      })
      if (!res.ok) throw new Error("Error loading news")
      const payload: unknown = await res.json()
      const parsed = portfolioNewsResponseSchema.safeParse(payload)
      if (!parsed.success) throw new Error("Invalid news response")
      return parsed.data.noticias.filter((news) => isValidExternalUrl(news.link))
    },
    enabled: topItems.length > 0,
    staleTime: 300_000, // 5 mins
  })

  if (isLoadingNews || topItems.length === 0) {
    return (
      <div className="h-10 bg-muted/30 border-b border-border flex items-center px-4">
        <div className="h-4 w-64 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  if (!newsData || newsData.length === 0) return null

  return (
    <div className="h-10 bg-muted/30 border-b border-border flex items-center overflow-hidden">
      <Marquee speed={40} gradient={false} className="overflow-hidden">

        {/* Render News */}
        {newsData.map((newsItem) => (
          <a
            key={`${newsItem.relatedTicker}-${newsItem.link}`}
            href={newsItem.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 mx-8 text-sm group cursor-pointer hover:bg-muted/50 px-3 py-1 rounded-full transition-colors"
          >
            <Newspaper className="h-4 w-4 text-blue-400" />
            <span className="font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded text-[10px] tracking-wider uppercase">
              {newsItem.relatedTicker}
            </span>
            <span className="text-foreground/80 group-hover:text-foreground transition-colors line-clamp-1 max-w-[400px]">
              {newsItem.title}
            </span>
          </a>
        ))}
      </Marquee>
    </div>
  )
}
