"use client"

import { useState, useMemo, useEffect } from "react"
import { AssetDetails } from "@/lib/actions/asset-details"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { Building2, Globe, Coins, TrendingUp, TrendingDown, Plus, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts"
import { getAssetHistory } from "@/lib/actions/asset-history-action"
import { AddAssetModal } from "@/components/asset/add-asset-modal"

type TimeRange = '1d' | '5d' | '1mo' | 'ytd' | '1y' | '5y' | 'max'
const RANGES: { label: string, value: TimeRange }[] = [
  { label: '1D', value: '1d' },
  { label: '1S', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: 'YTD', value: 'ytd' },
  { label: '1A', value: '1y' },
  { label: '5A', value: '5y' },
  { label: 'MAX', value: 'max' },
]

export function AssetClient({ details }: { details: AssetDetails }) {
  const [range, setRange] = useState<TimeRange>('1y')
  const [chartData, setChartData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  useEffect(() => {
    async function loadHistory() {
      setIsLoading(true)
      try {
        const history = await getAssetHistory(details.symbol, range)
        setChartData(history)
      } catch (error) {
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }
    loadHistory()
  }, [details.symbol, range])

  const { price, change, changePercent } = useMemo(() => {
    // Si tenemos datos en vivo de quoteSummary, usamos esos
    if (range === '1d' || chartData.length === 0) {
      return {
        price: details.regularMarketPrice ?? 0,
        change: details.regularMarketChange ?? 0,
        changePercent: details.regularMarketChangePercent ?? 0
      }
    }
    
    // Si no, calculamos la variación en base a la gráfica actual
    const first = chartData[0]?.close ?? 0
    const last = chartData[chartData.length - 1]?.close ?? 0
    const c = last - first
    const cp = first > 0 ? (c / first) * 100 : 0
    return {
      price: details.regularMarketPrice ?? last,
      change: c,
      changePercent: cp
    }
  }, [details, chartData, range])

  const isPositive = change >= 0
  const color = isPositive ? 'var(--positive, #10b981)' : 'var(--negative, #ef4444)'

  const getIcon = () => {
    switch (details.quoteType?.toUpperCase()) {
      case 'CRYPTOCURRENCY': return <Coins className="h-6 w-6 text-orange-500" />
      case 'ETF': return <Globe className="h-6 w-6 text-blue-500" />
      case 'EQUITY': return <Building2 className="h-6 w-6 text-emerald-500" />
      default: return <TrendingUp className="h-6 w-6 text-muted-foreground" />
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Main Chart) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border/50 rounded-3xl p-6 md:p-8">
            <div className="flex justify-between items-start mb-6">
              <div className="flex gap-4">
                <div className="hidden sm:flex h-14 w-14 rounded-full bg-muted items-center justify-center shrink-0 border border-border/50">
                  {getIcon()}
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    {details.shortName || details.longName || details.symbol}
                  </h1>
                  <p className="text-sm font-medium text-muted-foreground mt-1 flex items-center gap-2">
                    <span className="bg-muted px-2 py-0.5 rounded-md text-foreground">{details.symbol}</span>
                    {details.exchange && <span>{details.exchange}</span>}
                  </p>
                </div>
              </div>
              <Button onClick={() => setIsAddModalOpen(true)} className="rounded-full shadow-lg gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline-block">Añadir a mi cartera</span>
              </Button>
            </div>

            <div className="mb-6">
              <div className="text-4xl font-extrabold tracking-tighter tabular-nums text-foreground">
                {formatCurrency(price, details.currency || 'USD')}
              </div>
              <div className="flex items-center gap-2 mt-1" style={{ color }}>
                {isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                <span className="text-lg font-bold tabular-nums">
                  {isPositive ? '+' : ''}{formatCurrency(change, details.currency || 'USD')} ({formatPercent(changePercent)})
                </span>
                <span className="text-sm font-medium text-muted-foreground ml-2">
                  {range === '1d' ? 'Hoy' : `Rango: ${RANGES.find(r => r.value === range)?.label}`}
                </span>
              </div>
            </div>

            {/* Chart Area */}
            <div className="h-[300px] w-full mt-4 -ml-2 relative">
              {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-xl">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover border border-border p-3 rounded-xl shadow-xl">
                            <p className="text-sm text-muted-foreground mb-1">
                              {new Date(payload[0].payload.date).toLocaleDateString(undefined, {
                                month: 'short', day: 'numeric', year: 'numeric',
                                hour: range === '1d' || range === '5d' ? '2-digit' : undefined,
                                minute: range === '1d' || range === '5d' ? '2-digit' : undefined,
                              })}
                            </p>
                            <p className="text-lg font-bold tabular-nums" style={{ color }}>
                              {formatCurrency(payload[0].value as number, details.currency || 'USD')}
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <YAxis 
                    domain={['auto', 'auto']} 
                    hide 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="close" 
                    stroke={color} 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorGradient)" 
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            {/* Range Selectors */}
            <div className="flex gap-2 mt-6 overflow-x-auto pb-2 scrollbar-hide">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                    range === r.value 
                      ? 'bg-foreground text-background' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* About Section */}
          {details.longBusinessSummary && (
            <div className="bg-card border border-border/50 rounded-3xl p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Info className="h-5 w-5 text-muted-foreground" /> Acerca de
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {details.longBusinessSummary}
              </p>
            </div>
          )}
        </div>

        {/* Right Column (Stats) */}
        <div className="space-y-6">
          <div className="bg-card border border-border/50 rounded-3xl p-6">
            <h3 className="text-lg font-bold mb-4">Estadísticas Clave</h3>
            <div className="space-y-4">
              <StatRow label="Cierre Anterior" value={details.regularMarketPreviousClose ? formatCurrency(details.regularMarketPreviousClose, details.currency || 'USD') : '-'} />
              <StatRow label="Máximo (52 sem)" value={details.fiftyTwoWeekHigh ? formatCurrency(details.fiftyTwoWeekHigh, details.currency || 'USD') : '-'} />
              <StatRow label="Mínimo (52 sem)" value={details.fiftyTwoWeekLow ? formatCurrency(details.fiftyTwoWeekLow, details.currency || 'USD') : '-'} />
              
              {details.marketCap && (
                <StatRow 
                  label="Capitalización" 
                  value={
                    details.marketCap >= 1e12 ? `${(details.marketCap / 1e12).toFixed(2)}T` :
                    details.marketCap >= 1e9 ? `${(details.marketCap / 1e9).toFixed(2)}B` :
                    `${(details.marketCap / 1e6).toFixed(2)}M`
                  } 
                />
              )}
              
              {details.trailingPE && <StatRow label="Ratio PER" value={details.trailingPE.toFixed(2)} />}
              {details.dividendYield && <StatRow label="Rentabilidad Div" value={formatPercent(details.dividendYield * 100)} />}
              {details.beta && <StatRow label="Beta" value={details.beta.toFixed(2)} />}
            </div>
          </div>

          {(details.sector || details.industry || details.website || details.country) && (
            <div className="bg-card border border-border/50 rounded-3xl p-6">
              <h3 className="text-lg font-bold mb-4">Perfil</h3>
              <div className="space-y-4">
                {details.sector && <StatRow label="Sector" value={details.sector} />}
                {details.industry && <StatRow label="Industria" value={details.industry} />}
                {details.country && <StatRow label="País" value={details.country} />}
                {details.website && (
                  <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0 text-sm">
                    <span className="text-muted-foreground font-medium">Sitio web</span>
                    <a href={details.website} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                      Visitar web
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <AddAssetModal 
        open={isAddModalOpen} 
        onOpenChange={setIsAddModalOpen} 
        initialTicker={details.symbol}
        initialName={details.shortName || details.longName || undefined}
      />
    </>
  )
}

function StatRow({ label, value }: { label: string, value: string | React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0 text-sm">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className="font-semibold text-foreground text-right">{value}</span>
    </div>
  )
}
