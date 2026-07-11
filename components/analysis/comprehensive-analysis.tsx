"use client"

import { useMemo, useEffect, useState, useRef } from "react"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { fetchAllTransactionsForTax } from "@/lib/api/transactions"
import { FundHoldingsResponse } from "@/lib/actions/market-data"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts"
import { Loader2, TrendingUp, Wallet, Globe2, Briefcase, Activity, Lightbulb, ChevronUp, ChevronDown } from "lucide-react"

// Theme colors
const COLORS = [
  'oklch(0.72 0.18 192)', // Primary Teal
  'oklch(0.70 0.21 155)', // Positive Neon
  'oklch(0.65 0.17 270)', // Blue/Purple
  'oklch(0.78 0.17 55)',  // Warm Amber
  'oklch(0.65 0.22 22)',  // Negative Red
  'oklch(0.60 0.016 230)', // Muted 
]

function CategoryCard({ item, totalValue, index }: { item: any, totalValue: number, index: number }) {
  const [expanded, setExpanded] = useState(false);
  const weight = totalValue > 0 ? (item.value / totalValue) * 100 : 0;

  return (
    <div 
      className={`flex flex-col gap-2 p-4 rounded-2xl bg-muted/30 border border-border/50 transition-all duration-300 ${expanded ? 'bg-muted/50' : 'cursor-pointer hover:bg-muted/40'}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-foreground truncate mr-2">{item.name}</span>
        <span className="text-sm font-bold font-tabular text-muted-foreground">{weight.toFixed(1)}%</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500" 
          style={{ 
            width: `${weight}%`,
            background: COLORS[index % COLORS.length]
          }} 
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs font-semibold text-muted-foreground font-tabular">
          {formatCurrency(item.value)}
        </span>
        <span className="text-xs text-muted-foreground">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </div>

      {expanded && item.assets && (
        <div className="mt-3 pt-3 border-t border-border/50 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          {item.assets.map((a: any, i: number) => {
            const assetWeight = a.value / item.value * 100;
            return (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground truncate max-w-[140px]" title={a.name}>{a.name}</span>
                <span className="font-tabular text-muted-foreground whitespace-nowrap ml-2">
                  {formatCurrency(a.value)} <span className="opacity-50 text-[10px] ml-1">({assetWeight.toFixed(1)}%)</span>
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
  const [historyData, setHistoryData] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [marketDataMap, setMarketDataMap] = useState<Record<string, FundHoldingsResponse | null>>({})
  const [isEnriching, setIsEnriching] = useState(false)
  const fetchedIds = useRef<Set<string>>(new Set());

  // Fetch true market holdings for all positions
  useEffect(() => {
    if (!positions || positions.length === 0) return;
    
    async function fetchAllMarketData() {
      const positionsToFetch = positions.filter(p => !fetchedIds.current.has(p.activo_id));
      if (positionsToFetch.length === 0) return;

      setIsEnriching(true);
      try {
        const newData: Record<string, FundHoldingsResponse | null> = {};
        let hasChanges = false;

        const promises = positionsToFetch.map(async (p) => {
          fetchedIds.current.add(p.activo_id); // Optimistically mark as fetched so we don't retry on error
          const identifier = p.isin || p.ticker || p.nombre || '';
          if (identifier) {
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
              const data = await res.json();
              
              newData[p.activo_id] = data;
              hasChanges = true;
            } catch (e) {
              console.error(`Error fetching for ${identifier}`, e);
              newData[p.activo_id] = null;
              hasChanges = true;
            }
          }
        });

        await Promise.all(promises);

        if (hasChanges) {
          setMarketDataMap(prev => ({ ...prev, ...newData }));
        }
      } catch (e) {
        console.error("Critical error in fetchAllMarketData", e);
      } finally {
        setIsEnriching(false);
      }
    }

    fetchAllMarketData();
  }, [positions]); // only depends on positions, we check inside if we already fetched

  // Fetch historical data
  useEffect(() => {
    async function loadData() {
      try {
        const txs = await fetchAllTransactionsForTax()
        const monthlyData = new Map<string, number>()
        let cumulativeInvested = 0
        
        const sorted = [...txs].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

        for (const tx of sorted) {
          const date = new Date(tx.fecha)
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          
          let amount = tx.cantidad * tx.precio_unitario + (tx.comision || 0)
          if (tx.tipo_operacion === 'Compra') {
            cumulativeInvested += amount
          } else if (tx.tipo_operacion === 'Venta') {
            cumulativeInvested -= amount
          }
          monthlyData.set(monthKey, cumulativeInvested)
        }

        if (monthlyData.size > 0) {
          const keys = Array.from(monthlyData.keys()).sort()
          const firstMonth = new Date(keys[0] + "-01")
          const lastMonth = new Date()
          
          const finalData = []
          let lastKnownValue = 0

          let currentMonth = new Date(firstMonth)
          while (currentMonth <= lastMonth) {
            const key = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
            if (monthlyData.has(key)) {
              lastKnownValue = monthlyData.get(key)!
            }
            finalData.push({
              month: currentMonth.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
              invested: lastKnownValue,
            })
            currentMonth.setMonth(currentMonth.getMonth() + 1)
          }
          setHistoryData(finalData)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setHistoryLoading(false)
      }
    }
    loadData()
  }, [])

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
        const fallbackSector = mData?.sector ? translateSectorKey(mData.sector.toLowerCase().replace(/ /g, '_')) : (p.sector || 'Desconocido')
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
    if (!positions || totals.totalValue === 0) return []
    
    const messages = []
    
    // 1. Geographic concentration
    const usExposure = geos.find(g => g.name.toLowerCase().includes('usa') || g.name.toLowerCase().includes('estados unidos'))
    if (usExposure && (usExposure.value / totals.totalValue) > 0.7) {
      messages.push({
        type: 'warning',
        title: 'Alta Concentración Geográfica (EEUU)',
        desc: `Más del 70% de tu cartera está en Estados Unidos. Aunque es el mercado principal, podrías reducir el riesgo añadiendo exposición a mercados emergentes (EJ: MSCI Emerging Markets) o Europa (EJ: Stoxx 600).`
      })
    }

    // 2. Sector concentration
    const techExposure = sectors.find(s => s.name.toLowerCase().includes('tecno') || s.name.toLowerCase().includes('technology'))
    if (techExposure && (techExposure.value / totals.totalValue) > 0.4) {
      messages.push({
        type: 'warning',
        title: 'Sobre-exposición Tecnológica',
        desc: `Tienes más del 40% en el sector tecnológico. Esto aumenta la volatilidad de tu cartera. Considera diversificar hacia sectores más defensivos como Salud (Healthcare) o Consumo Básico (Consumer Staples).`
      })
    }

    // 3. Top 5 concentration
    const top5Weight = topPositions.reduce((acc, p) => acc + (p.valor_actual || 0), 0) / totals.totalValue
    if (top5Weight > 0.5) {
      messages.push({
        type: 'caution',
        title: 'Riesgo de Activo Individual',
        desc: `Tus 5 mayores posiciones representan el ${(top5Weight * 100).toFixed(1)}% de tu dinero. Si una de ellas cae bruscamente, el impacto será grave. La regla general es no tener más del 5-10% en una sola acción/cripto.`
      })
    }

    // 4. Crypto exposure risk
    const cryptoExposure = assetTypes.find(a => a.name.toLowerCase().includes('cripto') || a.name.toLowerCase().includes('crypto'))
    if (cryptoExposure && (cryptoExposure.value / totals.totalValue) > 0.2) {
      messages.push({
        type: 'caution',
        title: 'Alta Volatilidad por Criptomonedas',
        desc: `Más del 20% de tu portfolio está en criptomonedas. Esto representa un perfil de riesgo extremadamente alto. Asegúrate de que esto se alinea con tu tolerancia al riesgo a largo plazo.`
      })
    }

    // 5. Default Boglehead tip
    if (messages.length === 0) {
      messages.push({
        type: 'tip',
        title: 'Cartera Equilibrada (Filosofía Bogle)',
        desc: `Tu cartera parece bien diversificada. Recuerda la regla de oro de John Bogle: "No busques la aguja, compra el pajar". Mantén tus costes bajos y aporta regularmente a tus fondos indexados globales.`
      })
    } else {
      messages.push({
        type: 'tip',
        title: 'El núcleo de tu cartera',
        desc: `Según los Bogleheads, el núcleo (Core) de tu cartera debería ser un fondo global diversificado y de bajo coste (como MSCI World o FTSE All-World) ocupando el 60-80% de tus activos.`
      })
    }

    return messages
  }, [sectors, geos, assetTypes, topPositions, totals.totalValue])

  if (portfolioLoading || historyLoading) {
    return (
      <div className="w-full h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Procesando datos del portfolio...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Top Banner - Historical Evolution */}
      <div className="w-full p-6 rounded-[32px] border border-border relative overflow-hidden" style={{ background: "var(--card)" }}>
        {/* Subtle glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-[64px] pointer-events-none" />
        
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-primary/10">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">Evolución Histórica</h3>
            <p className="text-xs font-medium text-muted-foreground">Capital invertido a lo largo del tiempo</p>
          </div>
        </div>

        <div className="w-full h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.72 0.18 192)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="oklch(0.72 0.18 192)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: "var(--muted-foreground)", fontWeight: 600 }}
                dy={10}
              />
              <YAxis hide domain={['dataMin - 1000', 'dataMax + 1000']} />
              <RechartsTooltip 
                cursor={{ stroke: 'var(--muted)', strokeWidth: 1, strokeDasharray: '4 4' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-card border border-border/50 px-3 py-2 rounded-lg shadow-xl backdrop-blur-md">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{payload[0].payload.month}</p>
                        <p className="text-sm font-bold text-foreground font-tabular">{formatCurrency(payload[0].value as number)}</p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Area 
                type="monotone" 
                dataKey="invested" 
                stroke="oklch(0.72 0.18 192)" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorInvested)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Tipos de Activo */}
        <div className="p-5 rounded-[32px] border border-border flex flex-col" style={{ background: "var(--card)" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-primary/10">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">Tipos de Activo</h3>
          </div>
          
          <div className="flex-1 flex flex-col justify-center relative min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={assetTypes}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
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
                          <p className="text-sm font-bold text-primary font-tabular mt-0.5">{formatCurrency(payload[0].value as number)}</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
            {assetTypes.map((type, idx) => (
              <div key={type.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />
                <span className="text-[11px] font-bold text-muted-foreground">{type.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 Posiciones */}
        <div className="p-5 rounded-[32px] border border-border flex flex-col" style={{ background: "var(--card)" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "oklch(0.70 0.21 155 / 0.15)" }}>
              <Activity className="w-5 h-5" style={{ color: "oklch(0.70 0.21 155)" }} />
            </div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">Top 5 Posiciones</h3>
          </div>
          <div className="flex-1 flex flex-col gap-3">
            {topPositions.map((p, i) => {
              const weight = (p.valor_actual || 0) / totals.totalValue * 100
              const isPositive = (p.pnl_percent || 0) >= 0
              return (
                <div key={p.activo_id} className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground truncate max-w-[120px] sm:max-w-[180px]">{p.ticker.split(".")[0]}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{weight.toFixed(1)}% peso</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold font-tabular text-foreground">{formatCurrency(p.valor_actual || 0)}</p>
                    <p className={`text-[11px] font-bold font-tabular ${isPositive ? 'text-positive' : 'text-negative'}`}>
                      {formatPercent(p.pnl_percent || 0)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sectores */}
        <div className="p-5 rounded-[32px] border border-border col-span-1 md:col-span-2" style={{ background: "var(--card)" }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "oklch(0.65 0.17 270 / 0.15)" }}>
                <Briefcase className="w-5 h-5" style={{ color: "oklch(0.65 0.17 270)" }} />
              </div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">Exposición Sectorial (Look-through)</h3>
            </div>
            {isEnriching && (
              <span className="text-xs font-semibold text-primary animate-pulse flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Escaneando mercado...
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-start">
            {sectors.map((sector, index) => (
              <CategoryCard 
                key={sector.name} 
                item={sector} 
                totalValue={analysisTotal} 
                index={index} 
              />
            ))}
          </div>
        </div>

        {/* Geografía */}
        <div className="p-5 rounded-[32px] border border-border col-span-1 md:col-span-2" style={{ background: "var(--card)" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "oklch(0.60 0.016 230 / 0.20)" }}>
              <Globe2 className="w-5 h-5 text-foreground" />
            </div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">Exposición Geográfica</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-start">
            {geos.map((geo, index) => (
              <CategoryCard 
                key={geo.name} 
                item={geo} 
                totalValue={analysisTotal} 
                index={index} 
              />
            ))}
          </div>
        </div>

        {/* Recomendaciones Estratégicas (Insights) */}
        <div className="p-5 rounded-[32px] border border-border col-span-1 md:col-span-2 relative overflow-hidden" style={{ background: "var(--card)" }}>
          {/* Subtle gradient background effect */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />
          
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-primary/15">
              <Lightbulb className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">Recomendaciones Estratégicas</h3>
              <p className="text-xs font-medium text-muted-foreground">Basado en el estado actual de tu portfolio</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, idx) => {
              const colors = {
                warning: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
                caution: 'text-red-500 bg-red-500/10 border-red-500/20',
                tip: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
                info: 'text-blue-500 bg-blue-500/10 border-blue-500/20'
              }
              const colorClass = colors[insight.type as keyof typeof colors] || colors.info

              return (
                <div key={idx} className={`p-4 rounded-2xl border ${colorClass} backdrop-blur-sm`}>
                  <h4 className="text-sm font-bold mb-1.5 flex items-center gap-2">
                    {insight.type === 'tip' ? '💡' : (insight.type === 'warning' ? '⚠️' : '🚨')} {insight.title}
                  </h4>
                  <p className="text-xs font-medium opacity-90 leading-relaxed">
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
