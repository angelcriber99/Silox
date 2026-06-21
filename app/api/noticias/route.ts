import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { GoogleGenerativeAI } from "@google/generative-ai"

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { items } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Proporciona un array de items' },
        { status: 400 }
      )
    }

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

    const noticias: any[] = []

    newsResults.forEach((res) => {
      if (res.status === 'fulfilled') {
        noticias.push(...res.value.news.map(n => ({
          ...n,
          relatedTicker: res.value.item.displayName // Nombre limpio o Ticker limpio
        })))
      }
    })

    // Ordenar noticias por fecha (las más recientes primero)
    noticias.sort((a, b) => new Date(b.providerPublishTime).getTime() - new Date(a.providerPublishTime).getTime())

    // Traducir títulos con Gemini de forma masiva
    if (noticias.length > 0 && process.env.GEMINI_API_KEY) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
        const titlesToTranslate = noticias.map((n, i) => `${i}: ${n.title}`).join('\n')
        const prompt = `Traduce los siguientes titulares de noticias financieras del inglés al español neutro. Mantén el tono periodístico.
Devuelve ÚNICAMENTE los títulos traducidos, línea por línea, respetando el número inicial y los dos puntos. No añadas nada más.
Ejemplo de salida:
0: Apple presenta su nuevo iPhone
1: Los mercados se desploman por la inflación

Titulares:
${titlesToTranslate}`

        const result = await model.generateContent(prompt)
        const text = await result.response.text()

        // Parsear traducciones
        const lines = text.split('\n').filter(l => l.trim() !== '')
        lines.forEach(line => {
          const match = line.match(/^(\d+):\s*(.*)$/)
          if (match) {
            const idx = parseInt(match[1], 10)
            if (noticias[idx]) {
              noticias[idx].title = match[2].trim()
            }
          }
        })
      } catch (err) {
        console.error("Error traduciendo noticias:", err)
        // Fallback silently to English if translation fails
      }
    }

    return NextResponse.json(
      { noticias },
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
