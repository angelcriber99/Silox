import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiUser } from '@/lib/server/api-auth'
import { fetchMarketPricesDirect, type MarketPricesResult } from '@/lib/actions/market'

export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  tickers: z.array(z.string().trim().min(1).max(40)).min(1).max(50),
  convert: z.boolean().default(true),
})

// ── In-memory cache with 60s TTL ────────────────────────────────
// This is per-serverless-instance but still far more predictable
// than Next.js unstable_cache on Vercel.
interface CacheEntry {
  data: MarketPricesResult
  expiresAt: number
}

const priceCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60_000 // 60 seconds

function getCacheKey(tickers: string[], convert: boolean): string {
  return `${tickers.slice().sort().join(',')}:${convert}`
}

function getCached(key: string): MarketPricesResult | null {
  const entry = priceCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    priceCache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key: string, data: MarketPricesResult): void {
  // Evict old entries if cache grows too large (per-instance memory safety)
  if (priceCache.size > 200) {
    const now = Date.now()
    for (const [k, v] of priceCache) {
      if (now > v.expiresAt) priceCache.delete(k)
    }
    // If still too large, clear everything
    if (priceCache.size > 200) priceCache.clear()
  }

  priceCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { tickers, convert } = parsed.data
    const cacheKey = getCacheKey(tickers, convert)

    // Try cache first
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT' },
      })
    }

    // Fetch fresh data — bypasses unstable_cache entirely
    const data = await fetchMarketPricesDirect(tickers, convert)

    // Store in our own predictable cache
    setCache(cacheKey, data)

    return NextResponse.json(data, {
      headers: { 'X-Cache': 'MISS' },
    })
  } catch (error: unknown) {
    console.error('Prices API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error fetching prices' },
      { status: 500 }
    )
  }
}
