import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiUser } from '@/lib/server/api-auth'
import { getGeminiClient } from '@/lib/server/gemini'
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
    const body = await request.json()
    
    const parsed = NoticiasSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: parsed.error.format() },
        { status: 400 }
      )
    }
    
    const { items } = parsed.data
    const selectedItems = items.slice(0, 10) // Limit to 10 tickers to avoid massive prompts
    const tickers = selectedItems.map(i => i.displayName).join(", ")

    let noticias: any[] = []
    let aiEvents: any[] = []

    if (process.env.GEMINI_API_KEY) {
      try {
        const model = getGeminiClient().getGenerativeModel({ 
          model: "gemini-2.5-flash",
          // @ts-ignore: googleSearch is supported by the API but missing in SDK types
          tools: [{ googleSearch: {} }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: SchemaType.OBJECT,
              properties: {
                noticias: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      title: { type: SchemaType.STRING, description: "Título de la noticia en español" },
                      publisher: { type: SchemaType.STRING, description: "Nombre del medio o fuente (ej. Reuters, Bloomberg)" },
                      link: { type: SchemaType.STRING, description: "URL de la noticia original" },
                      providerPublishTime: { type: SchemaType.STRING, description: "Fecha de publicación en formato ISO 8601 (ej. 2024-03-20T14:30:00Z)" },
                      relatedTicker: { type: SchemaType.STRING, description: "El ticker exacto relacionado con esta noticia" },
                      sentiment: { type: SchemaType.STRING, enum: ["POSITIVE", "NEGATIVE", "NEUTRAL"], format: "enum" }
                    },
                    required: ["title", "publisher", "link", "providerPublishTime", "relatedTicker", "sentiment"]
                  }
                },
                events: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      title: { type: SchemaType.STRING, description: "Breve título del evento en español, ej: Lanzamiento Satélite, Aprobación FDA" },
                      date: { type: SchemaType.STRING, description: "Fecha estimada en formato YYYY-MM-DD. Si solo se menciona el mes, pon el primer día del mes." },
                      ticker: { type: SchemaType.STRING, description: "El ticker exacto relacionado" },
                    },
                    required: ["title", "date", "ticker"]
                  }
                }
              },
              required: ["noticias", "events"]
            }
          }
        })
        
        const prompt = `Actúa como un analista financiero experto. Tienes a tu disposición la herramienta de Google Search.
Tu objetivo es buscar en internet la información más reciente, veraz y de fuentes contrastadas y fiables (ej: Reuters, Bloomberg, Expansión, El Economista, webs oficiales, etc) para las siguientes empresas/tickers: ${tickers}.

Tareas obligatorias:
1. Encuentra entre 1 y 2 noticias MUY RECIENTES Y RELEVANTES para CADA UNO de los tickers mencionados. 
2. Redacta el título de la noticia en ESPAÑOL NEUTRO.
3. Evalúa el sentimiento de cada noticia (POSITIVE, NEGATIVE, NEUTRAL) respecto a la empresa.
4. MUY IMPORTANTE: Busca también eventos corporativos clave y muy relevantes programados para los próximos 6 meses para estas mismas empresas (Ejemplo: ASTS lanzamiento de satélites Bluebird, Apple Keynote, Aprobaciones de la FDA, conferencias clave, etc.). Añade estos eventos al array de 'events'. NO incluyas simples presentaciones de resultados trimestrales (earnings) ni pagos de dividendos; céntrate en eventos puntuales de negocio.

Devuelve la información estructurada en el JSON solicitado.`

        const result = await model.generateContent(prompt)
        const text = await result.response.text()
        
        // Remove markdown backticks if Gemini includes them
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        const cleanText = jsonMatch ? jsonMatch[1] : text
        
        const parsedJson = JSON.parse(cleanText)

        if (parsedJson.noticias) {
          noticias = parsedJson.noticias.map((n: any, idx: number) => ({
            uuid: `ai-news-${Date.now()}-${idx}`,
            title: n.title,
            publisher: n.publisher,
            link: n.link,
            providerPublishTime: n.providerPublishTime,
            relatedTicker: n.relatedTicker,
            sentiment: n.sentiment
          }))
          // Sort newest first
          noticias.sort((a, b) => new Date(b.providerPublishTime).getTime() - new Date(a.providerPublishTime).getTime())
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
        console.error("Error generando noticias con Gemini:", err)
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
