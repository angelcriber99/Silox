import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiUser } from '@/lib/server/api-auth'
import { getGeminiClient } from '@/lib/server/gemini'
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
          relatedTicker: res.value.item.displayName // Nombre limpio o Ticker limpio
        }))
      }
      return []
    })

    // Ordenar noticias por fecha (las más recientes primero)
    noticias.sort((a, b) => new Date(b.providerPublishTime).getTime() - new Date(a.providerPublishTime).getTime())

    // Traducir títulos con Gemini de forma masiva
    if (noticias.length > 0 && process.env.GEMINI_API_KEY) {
      try {
        const model = getGeminiClient().getGenerativeModel({ model: "gemini-2.5-flash" })
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
