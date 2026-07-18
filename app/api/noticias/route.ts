import { NextResponse } from 'next/server'
import { MobileApiError } from '@/lib/mobile/api'
import { requireMobileUser } from '@/lib/mobile/auth'
import { buildPortfolioRadar } from '@/lib/server/portfolio-radar'

export const dynamic = 'force-dynamic'

/**
 * Compatibility response for the news ticker. Catalyst events now come only
 * from source-backed headlines; the previous ungrounded Gemini projection has
 * deliberately been removed.
 */
export async function POST(request: Request) {
  try {
    const context = await requireMobileUser(request)
    const radar = await buildPortfolioRadar(context)
    const noticias = radar.news.map((item) => ({
      uuid: item.id,
      title: item.title,
      publisher: item.source,
      link: item.url,
      providerPublishTime: item.publishedAt,
      relatedTicker: item.ticker,
      sentiment: 'NEUTRAL' as const,
    }))
    const aiEvents = radar.events
      .filter((event) => event.type === 'CATALYST')
      .map((event) => ({
        ...event,
        type: event.certainty === 'speculative' || event.certainty === 'estimated'
          ? 'AI_EVENT_SPECULATIVE'
          : 'AI_EVENT',
      }))

    return NextResponse.json({ noticias, aiEvents }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    if (error instanceof MobileApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[noticias]', error)
    return NextResponse.json({ error: 'No se pudieron cargar las noticias' }, { status: 500 })
  }
}
