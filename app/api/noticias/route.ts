import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiUser } from '@/lib/server/api-auth'
import { getYahooFinance } from '@/lib/server/yahoo-finance'

const NoticiasSchema = z.object({
  items: z.array(z.object({
    query: z.string().trim().min(1).max(50),
    displayName: z.string().trim().min(1).max(50)
  })).min(1).max(20),
})

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
    const yahooFinance = getYahooFinance()
    
    for (const item of selectedItems) {
      try {
        const searchResult = await yahooFinance.search(item.displayName)
        
        // Take top 4 news for this ticker
        const recentNews = (searchResult.news || []).slice(0, 4)
        for (const article of recentNews) {
          noticias.push({
            uuid: article.uuid || `yahoo-news-${Date.now()}-${Math.random()}`,
            title: article.title || "Noticia sin título",
            publisher: article.publisher || "Yahoo Finance",
            link: article.link || "",
            providerPublishTime: article.providerPublishTime 
              ? new Date(article.providerPublishTime).toISOString() 
              : new Date().toISOString(),
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
Basándote en tu conocimiento y proyecciones, enumera los eventos corporativos clave y catalizadores programados o rumoreados para los próximos 6 meses (del año 2026) para los siguientes tickers: ${tickersStr}.
(Ejemplo: ASTS lanzamiento de satélites Bluebird, Apple Keynote, Aprobaciones de la FDA, rumores de M&A, etc.). 
NO incluyas simples presentaciones de resultados trimestrales (earnings) ni dividendos.

MUY IMPORTANTE: INCLUYE obligatoriamente eventos especulativos, rumores fuertes o eventos que aún no tengan fecha confirmada exacta, marcándolos como especulativos.
Si un evento no tiene fecha exacta (ej. "Agosto 2026" o "Q3"), estima el día más razonable (ej. el día 15 del mes) e indica "isSpeculative": true.

Devuelve tu respuesta EXACTAMENTE en el siguiente formato JSON y SIN NADA MÁS:
{
  "events": [
    {
      "title": "Breve título del evento",
      "date": "Fecha estimada YYYY-MM-DD",
      "ticker": "Ticker exacto relacionado",
      "isSpeculative": true
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
