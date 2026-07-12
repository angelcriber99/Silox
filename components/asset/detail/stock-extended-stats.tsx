"use client"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { BarChart3, TrendingUp, Info, Briefcase, Users, MapPin, Globe } from "lucide-react"

interface StockExtendedStatsProps {
  ticker: string
  moneda: string
  precioActual: number | null
}

export function StockExtendedStats({ ticker, moneda, precioActual }: StockExtendedStatsProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['marketData', ticker, 'Stock'], 
    queryFn: async () => {
      const res = await fetch(`/api/market/${ticker}?range=1mo&type=Stock`)
      if (!res.ok) throw new Error("Failed to fetch market stats")
      return res.json()
    },
    staleTime: 1000 * 60 * 5 
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-[200px] md:col-span-2 rounded-xl" />
        <Skeleton className="h-[200px] rounded-xl" />
        <Skeleton className="h-[250px] md:col-span-3 rounded-xl" />
      </div>
    )
  }

  if (error || !data?.quote) {
    return (
      <Card className="bg-card border-border backdrop-blur-sm h-full">
        <CardContent className="p-6 flex items-center justify-center text-muted-foreground">
          No hay datos extendidos disponibles.
        </CardContent>
      </Card>
    )
  }

  const { quote, summary } = data
  const profile = summary?.profile
  const financials = summary?.financials

  // 52-Week Range Calculation
  const high = quote.week52High
  const low = quote.week52Low
  const current = precioActual || 0
  
  let rangePercent = 0
  if (high && low && current && high > low) {
    rangePercent = ((current - low) / (high - low)) * 100
    rangePercent = Math.max(0, Math.min(100, rangePercent))
  }

  // Analyst Consensus translation
  const getAnalystColor = (rating: string) => {
    if (!rating) return "text-muted-foreground"
    const r = rating.toLowerCase()
    if (r.includes('buy') || r.includes('compra')) return "text-emerald-400"
    if (r.includes('sell') || r.includes('venta')) return "text-rose-400"
    return "text-amber-400"
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Key Metrics */}
        <Card className="bg-card border-border backdrop-blur-sm md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-400" />
              Métricas Clave
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Market Cap</p>
                <p className="text-xl font-bold text-foreground tabular-nums">{quote.marketCap || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">P/E Ratio</p>
                <p className="text-xl font-bold text-foreground tabular-nums">{quote.peRatio || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">EPS (TTM)</p>
                <p className="text-xl font-bold text-foreground tabular-nums">{quote.eps || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Div Yield</p>
                <p className="text-xl font-bold text-foreground tabular-nums">{quote.divYield || "0.00%"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Forward P/E</p>
                <p className="text-lg font-bold text-foreground/80 tabular-nums">{quote.forwardPE || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Volumen</p>
                <p className="text-lg font-bold text-foreground/80 tabular-nums">{quote.volume || "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground font-medium mb-2">Rango 52 Semanas</p>
                {high && low ? (
                  <div className="space-y-1">
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden relative">
                       <div 
                         className="absolute top-0 left-0 h-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500" 
                         style={{ width: '100%' }}
                       />
                       <div 
                         className="absolute top-0 bottom-0 w-1 bg-white shadow-sm z-10 -ml-0.5" 
                         style={{ left: `${rangePercent}%` }}
                       />
                    </div>
                    <div className="flex justify-between text-xs font-medium text-muted-foreground tabular-nums">
                      <span>{formatCurrency(low, moneda)}</span>
                      <span>{formatCurrency(high, moneda)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-lg font-bold text-foreground/80 tabular-nums">—</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analyst Consensus */}
        <Card className="bg-card border-border backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-400" />
              Consenso Wall Street
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col h-full justify-center space-y-6">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Recomendación Media</p>
                <p className={`text-2xl font-bold capitalize ${getAnalystColor(quote.averageAnalystRating)}`}>
                  {quote.averageAnalystRating ? quote.averageAnalystRating.split(' - ')[1] || quote.averageAnalystRating : "Sin Datos"}
                </p>
              </div>
              
              {financials?.targetMeanPrice && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Precio Objetivo Medio</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {formatCurrency(financials.targetMeanPrice, financials.financialCurrency || moneda)}
                  </p>
                  {current > 0 && (
                     <p className={`text-sm font-medium mt-1 ${financials.targetMeanPrice > current ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {financials.targetMeanPrice > current ? 'Potencial alcista:' : 'Potencial bajista:'} 
                        {' '}{(((financials.targetMeanPrice - current) / current) * 100).toFixed(2)}%
                     </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Company Profile */}
      {profile && (
        <Card className="bg-card border-border backdrop-blur-sm">
           <CardHeader className="pb-2 border-b border-border/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-amber-400" />
              Perfil de la Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="flex items-center gap-2">
                 <div className="p-2 bg-muted rounded-md text-muted-foreground"><Briefcase className="w-4 h-4" /></div>
                 <div>
                   <p className="text-xs text-muted-foreground">Sector</p>
                   <p className="text-sm font-bold">{profile.sectorDisp || profile.sector || 'N/A'}</p>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 <div className="p-2 bg-muted rounded-md text-muted-foreground"><Info className="w-4 h-4" /></div>
                 <div>
                   <p className="text-xs text-muted-foreground">Industria</p>
                   <p className="text-sm font-bold truncate max-w-[120px]" title={profile.industryDisp || profile.industry}>{profile.industryDisp || profile.industry || 'N/A'}</p>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 <div className="p-2 bg-muted rounded-md text-muted-foreground"><Users className="w-4 h-4" /></div>
                 <div>
                   <p className="text-xs text-muted-foreground">Empleados</p>
                   <p className="text-sm font-bold">{profile.fullTimeEmployees ? profile.fullTimeEmployees.toLocaleString() : 'N/A'}</p>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 <div className="p-2 bg-muted rounded-md text-muted-foreground"><MapPin className="w-4 h-4" /></div>
                 <div>
                   <p className="text-xs text-muted-foreground">Sede</p>
                   <p className="text-sm font-bold">{profile.city ? `${profile.city}, ${profile.country}` : 'N/A'}</p>
                 </div>
              </div>
            </div>
            
            {profile.longBusinessSummary && (
              <div className="text-sm text-muted-foreground/80 leading-relaxed border-t border-border/30 pt-4">
                <p className="line-clamp-4 hover:line-clamp-none transition-all duration-300">
                  {profile.longBusinessSummary}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
