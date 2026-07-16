import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiUser } from '@/lib/server/api-auth'
import { getGeminiClient } from '@/lib/server/gemini'
import { getYahooFinance } from '@/lib/server/yahoo-finance'
import { SchemaType } from '@google/generative-ai'

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
    const yahooFinance = getYahooFinance()
    const body = await request.json()
    
    const parsed = NoticiasSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: parsed.error.format() },
        { status: 400 }
      )
    }
    
    const { items } = parsed.data

    const selectedItems = items.slice(0, 5)

    const newsResults = await Promise.allSettled(
      selectedItems.map(async (item) => {
        try {
          const result = await yahooFinance.search(item.query)
          // Filtrar para que sean historias (STORY) y coger las 2 primeras
          const news = result.news.filter(n => n.type === 'STORY').slice(0, 2)
          return { item, news }
        } catch {
          return { item, news: [] }
        }
      })
    )

    const noticias = newsResults.flatMap((res) => {
      if (res.status === 'fulfilled') {
        return res.value.news.map(n => ({
          ...n,
          relatedTicker: res.value.item.displayName, // Nombre limpio o Ticker limpio
          sentiment: undefined as string | undefined
        }))
      }
      return []
    })

    // Ordenar noticias por fecha (las más recientes primero)
    noticias.sort((a, b) => new Date(b.providerPublishTime).getTime() - new Date(a.providerPublishTime).getTime())

    let aiEvents: any[] = []

    // Traducir títulos con Gemini y extraer eventos clave
    if (noticias.length > 0 && process.env.GEMINI_API_KEY) {
      try {
        const model = getGeminiClient().getGenerativeModel({ 
          model: "gemini-2.5-flash",
          tools: [{ googleSearch: {} }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: SchemaType.OBJECT,
              properties: {
                translations: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      index: { type: SchemaType.INTEGER },
                      translatedTitle: { type: SchemaType.STRING },
                      sentiment: { type: SchemaType.STRING, enum: ["POSITIVE", "NEGATIVE", "NEUTRAL"], format: "enum" }
                    },
                    required: ["index", "translatedTitle", "sentiment"]
                  }
                },
                events: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      title: { type: SchemaType.STRING, description: "Breve título del evento en español, ej: Lanzamiento Satélite, Aprobación FDA" },
                      date: { type: SchemaType.STRING, description: "Fecha estimada en formato YYYY-MM-DD. Si solo se menciona el mes, pon el primer día del mes." },
                      ticker: { type: SchemaType.STRING, description: "Ticker relacionado (si se deduce de la noticia)" },
                    },
                    required: ["title", "date", "ticker"]
                  }
                }
              },
              required: ["translations", "events"]
            }
          }
        })
        
        const uniqueTickersStr = Array.from(new Set(noticias.map(n => n.relatedTicker))).join(", ")
        const titlesToTranslate = noticias.map((n, i) => `[ID: ${i} | Ticker: ${n.relatedTicker}] ${n.title}`).join('\n')
        
        const prompt = `Analiza los siguientes titulares de noticias financieras.
1. Tradúcelos al español neutro manteniendo el tono periodístico.
2. Analiza el sentimiento de la noticia (POSITIVE, NEGATIVE, NEUTRAL) respecto a la empresa.
3. Extrae cualquier evento futuro importante mencionado (lanzamientos, reuniones clave, aprobaciones). No incluyas resultados financieros (earnings) ni dividendos, solo eventos puntuales de negocio.
4. IMPORTANTE: Además de las noticias provistas, UTILIZA LA BÚSQUEDA EN INTERNET para encontrar eventos corporativos clave y muy relevantes programados para los próximos 6 meses para las siguientes empresas: ${uniqueTickersStr}. (Ejemplo: ASTS lanzamiento de satélites Bluebird, Apple Keynote, Aprobaciones de la FDA, etc.). Añade estos eventos al array de 'events'.

Titulares:
${titlesToTranslate}`

        const result = await model.generateContent(prompt)
        const text = await result.response.text()
        const parsedJson = JSON.parse(text)

        // Parsear traducciones
        if (parsedJson.translations) {
          parsedJson.translations.forEach((t: any) => {
            const idx = t.index
            if (noticias[idx]) {
              noticias[idx].title = t.translatedTitle
              noticias[idx].sentiment = t.sentiment
            }
          })
        }

        if (parsedJson.events) {
          aiEvents = parsedJson.events.map((e: any) => ({
            id: `aievent-${Date.now()}-${Math.random()}`,
            ticker: e.ticker || "UNKNOWN",
            date: new Date(e.date).toISOString(),
            type: 'AI_EVENT',
            title: e.title,
          }))
        }
      } catch (err) {
        console.error("Error traduciendo noticias:", err)
        // Fallback silently to English if translation fails
      }
    }

    return NextResponse.json(
      { noticias, aiEvents },
      {
        headers: {
          'Cache-Control': 'private, max-age=300', // Caché de 5 min para noticias
        },
      }
    )
  } catch {
    return NextResponse.json(
      { error: 'Error interno al obtener noticias' },
      { status: 500 }
    )
  }
}
