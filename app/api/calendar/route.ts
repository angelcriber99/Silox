import { NextResponse } from 'next/server'
import { MobileApiError } from '@/lib/mobile/api'
import { requireMobileUser } from '@/lib/mobile/auth'
import { buildPortfolioRadar } from '@/lib/server/portfolio-radar'

export const dynamic = 'force-dynamic'

/** Backwards-compatible calendar endpoint backed by the portfolio-owned radar. */
export async function POST(request: Request) {
  try {
    const context = await requireMobileUser(request)
    const radar = await buildPortfolioRadar(context)
    return NextResponse.json({ events: radar.events }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    if (error instanceof MobileApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[calendar]', error)
    return NextResponse.json({ error: 'No se pudo cargar el calendario' }, { status: 500 })
  }
}
