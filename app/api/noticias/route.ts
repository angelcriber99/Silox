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

    let aiEvents: any[] = []
    
    // Use Gemini for events (no googleSearch tools to avoid 404/400 errors with some API keys)
    if (process.env.GEMINI_API_KEY) {
      try {
        const { getGeminiClient } = await import('@/lib/server/gemini')
        const model = getGeminiClient().getGenerativeModel({ 
          model: "gemini-2.5-flash",
        })
        
        const tickersStr = selectedItems.map(i => i.displayName).join(", ")
        const prompt = `Actúa como un analista financiero experto. 
Basándote en tu conocimiento y proyecciones, enumera los eventos corporativos clave y muy relevantes programados para los próximos 6 meses (del año 2026) para los siguientes tickers: ${tickersStr}.
(Ejemplo: ASTS lanzamiento de satélites Bluebird en agosto, Apple Keynote, Aprobaciones de la FDA, conferencias clave, etc.). 
NO incluyas simples presentaciones de resultados trimestrales (earnings) ni pagos de dividendos; céntrate en eventos puntuales de negocio.
Si un evento no tiene fecha exacta (ej. "Agosto 2026" o "Primera quincena"), estima el día más razonable (ej. el día 1 o 15 del mes) e indica "isSpeculative": true.

Devuelve tu respuesta EXACTAMENTE en el siguiente formato JSON y SIN NADA MÁS (sin texto antes o después del JSON):
{
  "events": [
    {
      "title": "Breve título del evento",
      "date": "Fecha estimada YYYY-MM-DD",
      "ticker": "Ticker exacto relacionado",
      "isSpeculative": true o false
    }
  ]
}`

        const result = await model.generateContent(prompt)
        const text = await result.response.text()
        
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        const cleanText = jsonMatch ? jsonMatch[1] : text
        const parsedJson = JSON.parse(cleanText)

        if (parsedJson.events) {
          aiEvents = parsedJson.events.map((e: any) => ({
            id: `aievent-${Date.now()}-${Math.random()}`,
            ticker: e.ticker || "UNKNOWN",
            date: new Date(e.date).toISOString(),
            type: e.isSpeculative ? 'AI_EVENT_SPECULATIVE' : 'AI_EVENT',
            title: e.title,
          }))
        }
      } catch (err: any) {
        console.error("Error generando eventos con Gemini:", err)
      }
    }

    return NextResponse.json(
      { noticias, aiEvents },
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
