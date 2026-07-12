"use client"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils/formatters"

interface MarketStatsProps {
  ticker: string
  moneda: string
}

export function MarketStats({ ticker, moneda }: MarketStatsProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['marketData', ticker, '1mo'], // Use a stable key so it dedupes with chart if it happens to use 1mo
    queryFn: async () => {
      const res = await fetch(`/api/market/${ticker}?range=1mo`)
      if (!res.ok) throw new Error("Failed to fetch market stats")
      return res.json()
    },
    staleTime: 1000 * 60 * 5 // 5 minutes
  })

  if (isLoading) {
    return (
      <Card className="bg-card border-border backdrop-blur-sm h-full">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !data?.quote) {
    return (
      <Card className="bg-card border-border backdrop-blur-sm h-full">
        <CardContent className="p-6 flex items-center justify-center text-muted-foreground">
          No hay datos de mercado disponibles.
        </CardContent>
      </Card>
    )
  }

  const { quote } = data

  return (
    <Card className="bg-card border-border backdrop-blur-sm h-full">
      <CardContent className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Market Cap</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{quote.marketCap || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-1">P/E Ratio</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{quote.peRatio || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Div Yield</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{quote.divYield || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Max 52 sem.</p>
            <p className="text-lg font-bold text-foreground tabular-nums">
              {quote.week52High ? formatCurrency(quote.week52High, quote.currency || moneda) : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Min 52 sem.</p>
            <p className="text-lg font-bold text-foreground tabular-nums">
              {quote.week52Low ? formatCurrency(quote.week52Low, quote.currency || moneda) : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Volumen</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{quote.volume || "—"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
