"use client"

import { useMemo, useEffect, useState } from "react"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { fetchAllTransactionsForTax } from "@/lib/api/transactions"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts"
import { Loader2, TrendingUp, Wallet, Globe2, Briefcase, Activity } from "lucide-react"

// Theme colors
const COLORS = [
  'oklch(0.72 0.18 192)', // Primary Teal
  'oklch(0.70 0.21 155)', // Positive Neon
  'oklch(0.65 0.17 270)', // Blue/Purple
  'oklch(0.78 0.17 55)',  // Warm Amber
  'oklch(0.65 0.22 22)',  // Negative Red
  'oklch(0.60 0.016 230)', // Muted 
]

export function ComprehensiveAnalysis() {
  const { positions, totals, isLoading: portfolioLoading } = usePortfolio()
  const [historyData, setHistoryData] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

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
  const { sectors, geos, assetTypes, topPositions } = useMemo(() => {
    if (!positions) return { sectors: [], geos: [], assetTypes: [], topPositions: [] }

    const sMap = new Map<string, number>()
    const gMap = new Map<string, number>()
    const tMap = new Map<string, number>()

    positions.forEach(p => {
      const val = p.valor_actual || 0
      if (val <= 0) return
      
      const sector = p.sector || 'Desconocido'
      const geo = p.geografia || 'Desconocida'
      const type = p.tipo || 'Otro'

      sMap.set(sector, (sMap.get(sector) || 0) + val)
      gMap.set(geo, (gMap.get(geo) || 0) + val)
      tMap.set(type, (tMap.get(type) || 0) + val)
    })

    const toArray = (map: Map<string, number>) => Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const top = [...positions]
      .filter(p => (p.valor_actual || 0) > 0)
      .sort((a, b) => (b.valor_actual || 0) - (a.valor_actual || 0))
      .slice(0, 5)

    return {
      sectors: toArray(sMap),
      geos: toArray(gMap),
      assetTypes: toArray(tMap),
      topPositions: top
    }
  }, [positions])

  if (portfolioLoading || historyLoading) {
    return (
      <div className="w-full h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── 1. Evolución Histórica (Full width area chart) ── */}
      <div className="p-5 rounded-[32px] border border-border" style={{ background: "var(--card)" }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "oklch(0.72 0.18 192 / 0.15)" }}>
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Evolución Histórica</h2>
            <p className="text-sm font-medium text-muted-foreground">Capital invertido a lo largo del tiempo</p>
          </div>
        </div>

        <div className="h-[240px] w-full">
          {historyData.length > 0 ? (
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
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  dy={10}
                  minTickGap={30}
                />
                <YAxis hide domain={['dataMin - 1000', 'dataMax + 1000']} />
                <RechartsTooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-card border border-border/50 p-3 rounded-xl shadow-xl backdrop-blur-md">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{payload[0].payload.month}</p>
                          <p className="text-lg font-extrabold text-foreground font-tabular">{formatCurrency(payload[0].value as number)}</p>
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
                  fill="url(#colorInvested)" 
                  activeDot={{ r: 6, fill: "oklch(0.075 0.014 240)", stroke: "oklch(0.72 0.18 192)", strokeWidth: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-medium text-muted-foreground">
              No hay suficientes datos históricos
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Bento Grid: Diversificación ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Tipos de Activo */}
        <div className="p-5 rounded-[32px] border border-border flex flex-col" style={{ background: "var(--card)" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "oklch(0.78 0.17 55 / 0.15)" }}>
              <Wallet className="w-5 h-5" style={{ color: "oklch(0.78 0.17 55)" }} />
            </div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">Tipos de Activo</h3>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="h-[200px] w-full">
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
                          <div className="bg-card border border-border/50 px-3 py-2 rounded-lg shadow-xl backdrop-blur-md flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: payload[0].payload.fill }} />
                            <span className="text-sm font-bold text-foreground">{payload[0].name}</span>
                            <span className="text-sm font-bold text-muted-foreground font-tabular">{formatPercent((payload[0].value as number) / totals.totalValue * 100)}</span>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {assetTypes.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                {entry.name}
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
                      {isPositive ? '+' : ''}{formatPercent(p.pnl_percent || 0)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sectores */}
        <div className="p-5 rounded-[32px] border border-border col-span-1 md:col-span-2" style={{ background: "var(--card)" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "oklch(0.65 0.17 270 / 0.15)" }}>
              <Briefcase className="w-5 h-5" style={{ color: "oklch(0.65 0.17 270)" }} />
            </div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">Exposición Sectorial</h3>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectors} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--foreground)", fontWeight: 600 }}
                  width={100}
                />
                <RechartsTooltip 
                  cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-card border border-border/50 px-3 py-2 rounded-lg shadow-xl backdrop-blur-md">
                          <p className="text-sm font-bold text-foreground">{payload[0].payload.name}</p>
                          <p className="text-sm font-bold text-primary font-tabular mt-0.5">{formatCurrency(payload[0].value as number)}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                            {((payload[0].value as number) / totals.totalValue * 100).toFixed(1)}%
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="value" fill="oklch(0.65 0.17 270)" radius={[0, 4, 4, 0]} barSize={24}>
                  {sectors.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {geos.map((geo, index) => {
              const weight = geo.value / totals.totalValue * 100
              return (
                <div key={geo.name} className="flex flex-col gap-2 p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground truncate mr-2">{geo.name}</span>
                    <span className="text-sm font-bold font-tabular text-muted-foreground">{weight.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full rounded-full" 
                      style={{ 
                        width: `${weight}%`,
                        background: COLORS[index % COLORS.length]
                      }} 
                    />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground mt-1 font-tabular">
                    {formatCurrency(geo.value)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
