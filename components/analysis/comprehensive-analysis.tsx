"use client"

import { useMemo, useEffect, useState, useRef } from "react"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { FundHoldingsResponse } from "@/lib/actions/market-data"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { Loader2, Wallet, Globe2, Briefcase, Lightbulb, Activity } from "lucide-react"
import { useHistory } from "@/lib/hooks/use-portfolio"
import { buildPerformanceSeries, filterPerformanceSeries, aggregateDailyPnl, type PerformanceRange } from "@/lib/utils/performance-history"
import { CombinedPerformanceChart } from "./combined-performance-chart"

// Theme colors
const COLORS = [
  'oklch(0.72 0.18 192)', // Primary Teal
  'oklch(0.70 0.21 155)', // Positive Neon
  'oklch(0.65 0.17 270)', // Blue/Purple
  'oklch(0.78 0.17 55)',  // Warm Amber
  'oklch(0.65 0.22 22)',  // Negative Red
  'oklch(0.60 0.016 230)', // Muted 
]

const marketDataCache: Record<string, FundHoldingsResponse | null> = {}
const fetchedMarketDataIds = new Set<string>()

interface DistributionAsset {
  name: string
  value: number
}

interface DistributionItem extends DistributionAsset {
  assets?: DistributionAsset[]
}

function DistributionRow({ item, totalValue, index }: { item: DistributionItem, totalValue: number, index: number }) {
  const [expanded, setExpanded] = useState(false);
  const weight = totalValue > 0 ? (item.value / totalValue) * 100 : 0;

  return (
    <div 
      className="flex flex-col w-full mb-5 last:mb-0 group cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="font-semibold text-foreground truncate pr-2 flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[index % COLORS.length] }} />
          {item.name}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground tabular-nums hidden sm:inline-block">{formatCurrency(item.value)}</span>
          <span className="font-bold text-foreground tabular-nums w-12 text-right">{weight.toFixed(1)}%</span>
        </div>
      </div>
      <div className="w-full h-2.5 rounded-full bg-muted/50 overflow-hidden relative">
        <div 
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out group-hover:brightness-110" 
          style={{ 
            width: `${weight}%`,
            background: COLORS[index % COLORS.length]
          }} 
        />
      </div>
      
      {expanded && item.assets && (
        <div className="mt-3 pl-4 flex flex-col gap-2 border-l-2 border-border/50 animate-in fade-in slide-in-from-top-2 duration-200">
          {item.assets.map((asset) => {
            const assetWeight = totalValue > 0 ? asset.value / totalValue * 100 : 0;
            return (
              <div key={`${asset.name}-${asset.value}`} className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground truncate max-w-[140px]" title={asset.name}>{asset.name}</span>
                <span className="tabular-nums text-muted-foreground whitespace-nowrap ml-2 flex items-center gap-2">
                  {formatCurrency(asset.value)}
                  <span className="text-foreground font-semibold w-8 text-right">{assetWeight.toFixed(1)}%</span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function translateSectorKey(key: string): string {
  const map: Record<string, string> = {
    realestate: "Inmobiliario",
    consumer_cyclical: "Consumo Cíclico",
    basic_materials: "Materiales Básicos",
    consumer_defensive: "Consumo Defensivo",
    technology: "Tecnología",
    communication_services: "Telecomunicaciones",
    financial_services: "Servicios Financieros",
    utilities: "Servicios Públicos",
    industrials: "Industrial",
    energy: "Energía",
    healthcare: "Salud",
    cash: "Efectivo",
    other: "Otros"
  }
  return map[key] || key;
}

function translateAssetClass(key: string): string {
  if (key.toLowerCase().includes('etf')) return 'ETF';
  if (key.toLowerCase().includes('mutual')) return 'Fondo Indexado';
  if (key.toLowerCase().includes('equity')) return 'Acción';
  return key;
}

export function ComprehensiveAnalysis() {
  const { positions, totals, isLoading: portfolioLoading } = usePortfolio()
  const { data: snapshots = [] } = useHistory()
  const [timeRange, setTimeRange] = useState<PerformanceRange>("1Y")
  
  const [marketDataMap, setMarketDataMap] = useState<Record<string, FundHoldingsResponse | null>>(() => ({ ...marketDataCache }))
  const [isEnriching, setIsEnriching] = useState(false)
  const fetchedIds = useRef(fetchedMarketDataIds);

  const processedData = useMemo(() => buildPerformanceSeries(snapshots, {
    timestamp: new Date().toISOString(),
    total_value: totals.totalValue,
    total_invested: totals.totalCost,
  }), [snapshots, totals.totalValue, totals.totalCost])

  const filteredData = useMemo(
    () => filterPerformanceSeries(processedData, timeRange),
    [processedData, timeRange],
  )
  
  const dailyAggregatedData = useMemo(
    () => aggregateDailyPnl(filteredData),
    [filteredData]
  )


  // Fetch true market holdings for all positions
  useEffect(() => {
    if (!positions || positions.length === 0) return;
    let cancelled = false;
    
    async function fetchAllMarketData() {
      const positionsToFetch = positions.filter(p =>
        p.tipo !== 'Liquidez' &&
        p.tipo !== 'Fondo Monetario' &&
        !p.ticker.startsWith('CASH') &&
        !fetchedIds.current.has(p.activo_id)
      );
      if (positionsToFetch.length === 0) return;

      setIsEnriching(true);
      try {
        for (let i = 0; i < positionsToFetch.length && !cancelled; i += 3) {
          const batch = positionsToFetch.slice(i, i + 3);
          const batchData: Record<string, FundHoldingsResponse | null> = {};

          await Promise.all(batch.map(async (p) => {
            const identifier = p.isin || p.ticker || p.nombre || '';
            if (!identifier) return;

            try {
              const res = await fetch('/api/market-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  identifier,
                  isin: p.isin,
                  name: p.nombre
                })
              });

              if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
              batchData[p.activo_id] = await res.json();
            } catch (e) {
              console.error(`Error fetching for ${identifier}`, e);
              batchData[p.activo_id] = null;
            }
          }));

          if (!cancelled && Object.keys(batchData).length > 0) {
            Object.assign(marketDataCache, batchData);
            Object.keys(batchData).forEach(id => fetchedIds.current.add(id));
            setMarketDataMap(prev => ({ ...prev, ...batchData }));
          }
        }
      } catch (e) {
        console.error("Critical error in fetchAllMarketData", e);
      } finally {
        if (!cancelled) setIsEnriching(false);
      }
    }

    const timer = window.setTimeout(fetchAllMarketData, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    }
  }, [positions]); // only depends on positions, we check inside if we already fetched

  // Aggegations
  const { sectors, geos, assetTypes, topPositions, analysisTotal } = useMemo(() => {
    if (!positions) return { sectors: [], geos: [], assetTypes: [], topPositions: [], analysisTotal: 0 }

    const analysisPositions = positions.filter(p => p.tipo !== 'Liquidez' && p.tipo !== 'Fondo Monetario' && !p.ticker.startsWith('CASH'))
    const analysisTotal = analysisPositions.reduce((acc, p) => acc + (p.valor_actual || 0), 0)

    const sMap = new Map<string, { value: number, assets: { name: string, value: number, symbol: string }[] }>()
    const gMap = new Map<string, { value: number, assets: { name: string, value: number, symbol: string }[] }>()
    const tMap = new Map<string, number>()

    const addToMap = (
      map: Map<string, { value: number, assets: { name: string, value: number, symbol: string }[] }>,
      key: string,
      valToAdd: number,
      assetName: string,
      assetSymbol: string
    ) => {
      if (!map.has(key)) {
        map.set(key, { value: 0, assets: [] });
      }
      const entry = map.get(key)!;
      entry.value += valToAdd;
      
      const existingAsset = entry.assets.find(a => a.name === assetName);
      if (existingAsset) {
        existingAsset.value += valToAdd;
      } else {
        entry.assets.push({ name: assetName, value: valToAdd, symbol: assetSymbol });
      }
    }

    analysisPositions.forEach(p => {
      const val = p.valor_actual || 0
      if (val <= 0) return
      
      const mData = marketDataMap[p.activo_id];
      const assetName = p.nombre || p.ticker || p.isin || 'Desconocido'
      const assetSymbol = p.ticker || ''

      // SECTOR LOGIC: use look-through if available
      if (mData && mData.sectorWeightings) {
        let totalAssigned = 0;
        for (const [sKey, weight] of Object.entries(mData.sectorWeightings)) {
          const w = typeof weight === 'number' ? weight : 0;
          if (w > 0) {
            const actualVal = val * w;
            const translatedSector = translateSectorKey(sKey);
            addToMap(sMap, translatedSector, actualVal, assetName, assetSymbol);
            totalAssigned += actualVal;
          }
        }
        // If weights didn't sum to 100%, assign remainder to Other/Cash
        if (totalAssigned < val * 0.99) {
           const remainder = val - totalAssigned;
           addToMap(sMap, "Otros", remainder, assetName, assetSymbol);
        }
      } else {
        let fallbackSector = mData?.sector ? translateSectorKey(mData.sector.toLowerCase().replace(/ /g, '_')) : (p.sector || 'Desconocido')
        if (assetSymbol.toUpperCase().startsWith('UNH')) {
          fallbackSector = 'Salud';
        }
        addToMap(sMap, fallbackSector, val, assetName, assetSymbol);
      }

      // GEO LOGIC:
      if (mData && mData.geographicWeightings) {
        let totalAssigned = 0;
        for (const [cKey, weight] of Object.entries(mData.geographicWeightings)) {
          const w = typeof weight === 'number' ? weight : 0;
          if (w > 0) {
            const actualVal = val * w;
            addToMap(gMap, cKey, actualVal, assetName, assetSymbol);
            totalAssigned += actualVal;
          }
        }
        if (totalAssigned < val * 0.99) {
           const remainder = val - totalAssigned;
           addToMap(gMap, "Otros", remainder, assetName, assetSymbol);
        }
      } else if (mData?.country) {
        // Map common country codes/names if necessary
        const geo = mData.country === 'United States' ? 'USA' : mData.country;
        addToMap(gMap, geo, val, assetName, assetSymbol);
      } else {
        const geo = p.geografia || 'Desconocida'
        addToMap(gMap, geo, val, assetName, assetSymbol);
      }

      // ASSET TYPE LOGIC
      const type = mData?.assetClass ? translateAssetClass(mData.assetClass) : (p.tipo || 'Otro');
      tMap.set(type, (tMap.get(type) || 0) + val)
    })

    const toArrayWithAssets = (map: Map<string, { value: number, assets: { name: string, value: number, symbol: string }[] }>) => 
      Array.from(map.entries())
      .map(([name, data]) => ({ 
        name, 
        value: data.value, 
        assets: data.assets.sort((a, b) => b.value - a.value) 
      }))
      .sort((a, b) => b.value - a.value)

    const toArray = (map: Map<string, number>) => Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const top = [...analysisPositions]
      .filter(p => (p.valor_actual || 0) > 0)
      .sort((a, b) => (b.valor_actual || 0) - (a.valor_actual || 0))
      .slice(0, 5)

    return {
      sectors: toArrayWithAssets(sMap),
      geos: toArrayWithAssets(gMap),
      assetTypes: toArray(tMap),
      topPositions: top,
      analysisTotal
    }
  }, [positions, marketDataMap])

  // Generate dynamic insights based on the portfolio data
  const insights = useMemo(() => {
    if (!positions || totals.totalValue === 0 || analysisTotal === 0) return []
    
    const messages = []
    
    // 1. Geographic concentration
    const topGeo = geos[0]
    if (topGeo && (topGeo.value / analysisTotal) > 0.6) {
      messages.push({
        type: 'warning',
        title: `Alta Concentración en ${topGeo.name}`,
        desc: `Tienes un ${(topGeo.value / analysisTotal * 100).toFixed(1)}% de tu inversión en ${topGeo.name}. Sería prudente diversificar tus futuras aportaciones hacia otras regiones para mitigar el riesgo país.`
      })
    } else if (topGeo && (topGeo.value / analysisTotal) <= 0.5) {
       messages.push({
        type: 'tip',
        title: 'Buena Diversificación Geográfica',
        desc: `Tu exposición a ${topGeo.name} está bien controlada (${(topGeo.value / analysisTotal * 100).toFixed(1)}%). Tienes una cartera global que te protege frente a crisis regionales.`
      })
    }

    // 2. Sector concentration
    const techExposure = sectors.find(s => s.name.toLowerCase().includes('tecno') || s.name.toLowerCase().includes('technology'))
    if (techExposure && (techExposure.value / analysisTotal) > 0.35) {
      messages.push({
        type: 'warning',
        title: 'Sobre-exposición Tecnológica',
        desc: `El sector tecnológico representa un ${(techExposure.value / analysisTotal * 100).toFixed(1)}% de tus inversiones, aumentando la volatilidad. Considera destinar nuevas aportaciones a sectores más estables como Salud o Consumo Básico.`
      })
    }

    const topSector = sectors[0]
    if (topSector && topSector.name !== techExposure?.name && (topSector.value / analysisTotal) > 0.4) {
      messages.push({
        type: 'caution',
        title: `Concentración en sector ${topSector.name}`,
        desc: `Tu cartera depende en un ${(topSector.value / analysisTotal * 100).toFixed(1)}% del sector ${topSector.name}. Evalúa detener las aportaciones a este sector para equilibrar tu riesgo.`
      })
    }

    // 3. Top 5 & Individual Asset concentration
    const top1 = topPositions[0]
    const isTop1GlobalFund = top1?.nombre?.toLowerCase().includes('msci') || top1?.nombre?.toLowerCase().includes('world') || top1?.nombre?.toLowerCase().includes('sp500') || top1?.nombre?.toLowerCase().includes('all world');
    
    if (top1 && (top1.valor_actual || 0) / analysisTotal > 0.25 && !isTop1GlobalFund) {
      messages.push({
        type: 'caution',
        title: `Excesiva dependencia de ${top1.nombre || top1.ticker}`,
        desc: `Un solo activo específico pesa el ${((top1.valor_actual || 0) / analysisTotal * 100).toFixed(1)}% de tu cartera. Es un riesgo altísimo. Deberías asegurar tu posición reduciendo exposición o diversificando las próximas compras.`
      })
    } else if (top1 && isTop1GlobalFund && (top1.valor_actual || 0) / analysisTotal > 0.5) {
      messages.push({
        type: 'tip',
        title: 'Núcleo Sólido (Core-Satellite)',
        desc: `¡Genial! Tu posición principal es un fondo global (${top1.nombre || top1.ticker}) con un ${((top1.valor_actual || 0) / analysisTotal * 100).toFixed(1)}%. Estás aplicando perfectamente la filosofía pasiva para el núcleo de tu cartera.`
      })
    }

    const top5Weight = topPositions.reduce((acc, p) => acc + (p.valor_actual || 0), 0) / analysisTotal
    if (top5Weight > 0.65 && !isTop1GlobalFund) {
      messages.push({
        type: 'caution',
        title: 'Falta de Diversificación (Top 5)',
        desc: `Tus 5 mayores posiciones (excluyendo liquidez) suman el ${(top5Weight * 100).toFixed(1)}%. Si alguna sufre una caída drástica, tu cartera entera sufrirá.`
      })
    }

    // 4. Crypto exposure
    const cryptoExposure = assetTypes.find(a => a.name.toLowerCase().includes('cripto') || a.name.toLowerCase().includes('crypto'))
    if (cryptoExposure && (cryptoExposure.value / analysisTotal) > 0.15) {
      messages.push({
        type: 'warning',
        title: 'Alerta de Volatilidad Cripto',
        desc: `Tienes un ${(cryptoExposure.value / analysisTotal * 100).toFixed(1)}% invertido en criptomonedas. Vigila de cerca estas posiciones y toma beneficios si tu tolerancia al riesgo a largo plazo ha cambiado.`
      })
    }

    // 5. Winners/Losers (Take profit / Cut losses)
    const bigWinner = topPositions.find(p => (p.pnl_percent || 0) > 40)
    if (bigWinner) {
      messages.push({
        type: 'info',
        title: `Asegurar ganancias en ${bigWinner.nombre || bigWinner.ticker}`,
        desc: `Llevas un +${(bigWinner.pnl_percent || 0).toFixed(1)}% de rentabilidad en este activo. Plantéate una venta parcial para asegurar beneficios (Take Profit) y rebalancear la cartera.`
      })
    }

    const bigLoser = topPositions.find(p => (p.pnl_percent || 0) < -25)
    if (bigLoser) {
       messages.push({
        type: 'caution',
        title: `Revisar posición en ${bigLoser.nombre || bigLoser.ticker}`,
        desc: `Este activo acumula una caída del ${(bigLoser.pnl_percent || 0).toFixed(1)}%. Revisa tu tesis de inversión inicial: a veces es mejor cortar pérdidas a tiempo que promediar a la baja.`
      })
    }

    if (messages.length === 0) {
      messages.push({
        type: 'tip',
        title: 'Cartera Equilibrada',
        desc: `Tu cartera está bien balanceada y no salta ninguna alarma de riesgo activa. Sigue aportando pacientemente a largo plazo.`
      })
    }

    // Order matters, we want to show the most pressing ones first.
    return messages.sort((a, b) => {
      const p = { warning: 3, caution: 2, info: 1, tip: 0 };
      return (p[b.type as keyof typeof p] || 0) - (p[a.type as keyof typeof p] || 0);
    }).slice(0, 4)
  }, [sectors, geos, assetTypes, topPositions, totals.totalValue, analysisTotal])

  if (portfolioLoading) {
    return (
      <div className="w-full h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Procesando datos del portfolio...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Gráfica Combinada de Evolución y P&L */}
      <div className="p-6 rounded-[32px] border border-border flex flex-col relative overflow-hidden" style={{ background: "var(--card)" }}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[64px] pointer-events-none" />
        
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-primary/10">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-foreground">Rendimiento Histórico</h3>
                <p className="text-xs font-medium text-muted-foreground">Evolución del patrimonio y ganancias diarias</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 mt-2 ml-13">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-0.5">
                  Rendimiento Global
                </span>
                <div className={`flex items-baseline gap-1.5 ${(totals.totalPnl ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  <span className="text-base font-bold tabular-nums tracking-tight">
                    {(totals.totalPnl ?? 0) >= 0 ? "+" : ""}{formatCurrency(totals.totalPnl ?? 0)}
                  </span>
                  <span className="text-xs font-semibold tabular-nums">
                    ({(totals.totalPnl ?? 0) >= 0 ? "+" : ""}{formatPercent(totals.totalPnlPercent ?? 0)})
                  </span>
                </div>
              </div>

              <div className="w-px h-8 bg-border/50 mx-2" />

              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-0.5">
                  En el periodo ({timeRange === "1W" ? "1S" : timeRange === "ALL" ? "TODO" : timeRange})
                </span>
                <div className={`flex items-baseline gap-1.5 ${filteredData.reduce((acc, p) => acc + p.pnl, 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  <span className="text-base font-bold tabular-nums tracking-tight">
                    {filteredData.reduce((acc, p) => acc + p.pnl, 0) >= 0 ? "+" : ""}{formatCurrency(filteredData.reduce((acc, p) => acc + p.pnl, 0))}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center rounded-full border border-border/40 bg-muted/30 p-1 sm:self-start mt-4 sm:mt-0 shadow-inner">
            {(["1D", "1W", "1M", "YTD", "1Y", "ALL"] as PerformanceRange[]).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={`min-w-10 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-wider font-bold transition-all duration-200 ${
                  timeRange === range
                    ? "bg-foreground text-background shadow-md scale-105"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {range === "1W" ? "1S" : range === "ALL" ? "TODO" : range}
              </button>
            ))}
          </div>
        
        <div className="relative mt-2">
          <CombinedPerformanceChart 
            chartData={filteredData}
            dailyData={dailyAggregatedData}
            timeRange={timeRange}
            currentDailyPnl={totals.totalSessionPnl}
            currentDailyPnlPercent={totals.totalDailyPnlPercent}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        
        {/* Tipos de Activo */}
        <div className="p-6 rounded-[32px] border border-border flex flex-col relative overflow-hidden" style={{ background: "var(--card)" }}>
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-[48px] pointer-events-none" />
          <div className="flex items-center gap-3 mb-6 relative">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-primary/10">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">Tipos de Activo</h3>
              <p className="text-xs font-medium text-muted-foreground">Distribución por clase</p>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col justify-center relative min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={assetTypes}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                  animationDuration={1500}
                >
                  {assetTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-card border border-border/50 px-3 py-2 rounded-lg shadow-xl backdrop-blur-md">
                          <p className="text-sm font-bold text-foreground">{payload[0].payload.name}</p>
                          <p className="text-sm font-bold text-primary tabular-nums mt-0.5">{formatCurrency(payload[0].value as number)}</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
            {assetTypes.map((type, idx) => (
              <div key={type.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[idx % COLORS.length] }} />
                <span className="text-[12px] font-bold text-foreground">{type.name}</span>
                <span className="text-[11px] font-semibold text-muted-foreground tabular-nums ml-1">
                  {((type.value / analysisTotal) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sectores */}
        <div className="p-6 rounded-[32px] border border-border flex flex-col relative overflow-hidden" style={{ background: "var(--card)" }}>
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 rounded-full blur-[48px] pointer-events-none" />
          <div className="flex items-center justify-between mb-8 relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "oklch(0.65 0.17 270 / 0.15)" }}>
                <Briefcase className="w-5 h-5" style={{ color: "oklch(0.65 0.17 270)" }} />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-foreground">Sectores</h3>
                <p className="text-xs font-medium text-muted-foreground">Diversificación industrial</p>
              </div>
            </div>
            {isEnriching && (
              <span className="text-xs font-semibold text-primary animate-pulse flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
              </span>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {sectors.map((sector, index) => (
              <DistributionRow 
                key={sector.name} 
                item={sector} 
                totalValue={analysisTotal} 
                index={index} 
              />
            ))}
          </div>
        </div>

        {/* Geografía */}
        <div className="p-6 rounded-[32px] border border-border flex flex-col relative overflow-hidden" style={{ background: "var(--card)" }}>
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-[48px] pointer-events-none" />
          <div className="flex items-center gap-3 mb-8 relative">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "oklch(0.60 0.016 230 / 0.20)" }}>
              <Globe2 className="w-5 h-5" style={{ color: "oklch(0.60 0.016 230)" }} />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">Geografía</h3>
              <p className="text-xs font-medium text-muted-foreground">Exposición global</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {geos.map((geo, index) => (
              <DistributionRow 
                key={geo.name} 
                item={geo} 
                totalValue={analysisTotal} 
                index={index} 
              />
            ))}
          </div>
        </div>

        {/* Recomendaciones Estratégicas (Insights) */}
        <div className="p-6 rounded-[32px] border border-border lg:col-span-3 relative overflow-hidden" style={{ background: "var(--card)" }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[64px] pointer-events-none" />
          
          <div className="flex items-center gap-3 mb-8 relative">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-primary/10">
              <Lightbulb className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">Insights de la Cartera</h3>
              <p className="text-xs font-medium text-muted-foreground">Análisis de riesgos y oportunidades detectados</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative">
            {insights.map((insight, idx) => {
              const colors = {
                warning: 'text-amber-500 bg-amber-500/5 border-amber-500/20',
                caution: 'text-red-500 bg-red-500/5 border-red-500/20',
                tip: 'text-emerald-500 bg-emerald-500/5 border-emerald-500/20',
                info: 'text-blue-500 bg-blue-500/5 border-blue-500/20'
              }
              const colorClass = colors[insight.type as keyof typeof colors] || colors.info

              return (
                <div key={idx} className={`p-5 rounded-2xl border ${colorClass} backdrop-blur-xl transition-transform hover:-translate-y-1 duration-300`}>
                  <h4 className="text-sm font-bold mb-2.5 flex items-center gap-2">
                    {insight.type === 'tip' ? '💡' : (insight.type === 'warning' ? '⚠️' : '🚨')} {insight.title}
                  </h4>
                  <p className="text-xs font-medium opacity-80 leading-relaxed">
                    {insight.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
