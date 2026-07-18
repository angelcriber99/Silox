import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const LogoTickerSchema = z.string().trim().toUpperCase().min(1).max(24)
  .regex(/^[A-Z0-9.^=_-]+$/)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const parsedTicker = LogoTickerSchema.safeParse(searchParams.get("ticker"))

  if (!parsedTicker.success) {
    return new NextResponse("Invalid ticker", { status: 400 })
  }
  const ticker = parsedTicker.data
  const encodedTicker = encodeURIComponent(ticker)
  const isCrypto = request.nextUrl.searchParams.get("kind") === "crypto"

  const marketSources = [
    `https://financialmodelingprep.com/image-stock/${encodedTicker}.png`,
    `https://companiesmarketcap.com/img/company-logos/64/${encodedTicker}.png`
  ]
  const sources = isCrypto
    ? [`https://assets.coincap.io/assets/icons/${encodedTicker.toLowerCase()}@2x.png`, ...marketSources]
    : marketSources

  for (const url of sources) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        next: { revalidate: 86400 } // Cache for 24 hours at the Edge/CDN
      })

      if (res.ok) {
        const contentType = res.headers.get("content-type")
        const contentLength = Number(res.headers.get("content-length") ?? 0)

        if (!contentType?.match(/^image\/(png|jpeg|webp)(?:;|$)/i) || contentLength > 1_000_000) {
          continue
        }

        const arrayBuffer = await res.arrayBuffer()
        if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > 1_000_000) continue

        return new NextResponse(arrayBuffer, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          },
        })
      }
    } catch (e) {
      console.warn(`Failed to fetch logo for ${ticker} from ${url}:`, e)
      continue
    }
  }

  return new NextResponse("Logo not found", { status: 404 })
}
