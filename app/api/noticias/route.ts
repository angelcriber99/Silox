import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiUser } from '@/lib/server/api-auth'
import Parser from 'rss-parser'

const NoticiasSchema = z.object({
  items: z.array(z.object({
    query: z.string().trim().min(1).max(50),
    displayName: z.string().trim().min(1).max(50)
  })).min(1).max(20),
})

const parser = new Parser()

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    
    const parsed = NoticiasSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: parsed.error.format() },
        { status: 400 }
      )
    }
    
    const { items } = parsed.data
    const selectedItems = items.slice(0, 10) // Limit to 10 tickers
    
    const noticias: any[] = []
    
    for (const item of selectedItems) {
      try {
        const query = encodeURIComponent(`${item.displayName} stock`)
        const feed = await parser.parseURL(`https://news.google.com/rss/search?q=${query}&hl=es&gl=ES&ceid=ES:es`)
        
        // Take top 3 news for this ticker
        const recentNews = feed.items.slice(0, 3)
        for (const article of recentNews) {
          noticias.push({
            uuid: `google-news-${article.guid || Date.now()}-${Math.random()}`,
            title: article.title || "Noticia sin título",
            publisher: article.creator || article.source || "Google News",
            link: article.link || "",
            providerPublishTime: article.isoDate || new Date().toISOString(),
            relatedTicker: item.displayName,
            sentiment: "NEUTRAL"
          })
        }
      } catch (err) {
        console.error(`Error fetching news for ${item.displayName}:`, err)
      }
    }

    // Sort newest first
    noticias.sort((a, b) => new Date(b.providerPublishTime).getTime() - new Date(a.providerPublishTime).getTime())

    return NextResponse.json(
      { noticias, aiEvents: [] },
      {
        headers: {
          'Cache-Control': 'private, max-age=300',
        },
      }
    )
  } catch (error) {
    console.error("Internal error in /api/noticias:", error)
    return NextResponse.json(
      { error: 'Error interno al obtener noticias' },
      { status: 500 }
    )
  }
}
