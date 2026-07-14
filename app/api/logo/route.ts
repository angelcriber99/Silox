import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const ticker = searchParams.get("ticker")

  if (!ticker) {
    return new NextResponse("Ticker is required", { status: 400 })
  }

  const sources = [
    `https://financialmodelingprep.com/image-stock/${ticker}.png`,
    `https://companiesmarketcap.com/img/company-logos/64/${ticker}.png`
  ]

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
        
        // Extra check: if it's returning HTML (like a 404 page masked as 200), skip
        if (contentType && contentType.includes("text/html")) {
          continue
        }

        const arrayBuffer = await res.arrayBuffer()
        
        return new NextResponse(arrayBuffer, {
          headers: {
            "Content-Type": contentType || "image/png",
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
