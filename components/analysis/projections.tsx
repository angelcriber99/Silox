"use client"

import { useState, useMemo, useEffect } from "react"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { formatCurrency } from "@/lib/utils/formatters"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Loader2, TrendingUp, PiggyBank, Wallet } from "lucide-react"

export function Projections() {
  const { positions, isLoading } = usePortfolio()
  
  const currentTotal = useMemo(() => {
    if (!positions) return 0
    return positions.reduce((acc, pos) => acc + (pos.valor_actual || 0), 0)
  }, [positions])

  // Initial state derived from portfolio, but allow user to tweak it
  const [initialCapital, setInitialCapital] = useState<number | null>(null)
  const [monthlySaving, setMonthlySaving] = useState(800)
  const [annualReturn, setAnnualReturn] = useState(25)
  const [futureSaving, setFutureSaving] = useState<number | ''>(300)
  const [futureSavingYear, setFutureSavingYear] = useState<number | ''>(3)

  useEffect(() => {
    try {
      const savedMonthly = localStorage.getItem('silox_proj_monthly');
      const savedFuture = localStorage.getItem('silox_proj_future');
      const savedYear = localStorage.getItem('silox_proj_year');
      
      if (savedMonthly) setMonthlySaving(Number(savedMonthly));
      if (savedFuture) setFutureSaving(Number(savedFuture));
      if (savedYear) setFutureSavingYear(Number(savedYear));
    } catch (e) {
      console.error("Error loading projection defaults", e);
    }
  }, []);

  const saveDefaults = () => {
    try {
      localStorage.setItem('silox_proj_monthly', monthlySaving.toString());
      if (futureSaving !== '') localStorage.setItem('silox_proj_future', futureSaving.toString());
      else localStorage.removeItem('silox_proj_future');
      
      if (futureSavingYear !== '') localStorage.setItem('silox_proj_year', futureSavingYear.toString());
      else localStorage.removeItem('silox_proj_year');
    } catch (e) {
      console.error("Error saving projection defaults", e);
    }
  };

  const startingCapital = initialCapital !== null ? initialCapital : currentTotal

  const projectionData = useMemo(() => {
    // Para que un 8% anual sea exactamente un 8% al final del año, usamos la tasa efectiva mensual
    const monthlyRate = Math.pow(1 + annualReturn / 100, 1 / 12) - 1
    let currentBalance = startingCapital
    let totalContributed = startingCapital
    
    const data: { month: number; monthStr: string; yearStr: string; total: number; contributed: number; interest: number }[] = []
    
    const today = new Date()

    // Add current point (month 0)
    data.push({
      month: 0,
      monthStr: today.toLocaleDateString('es-ES', { month: 'short' }),
      yearStr: today.getFullYear().toString(),
      total: currentBalance,
      contributed: totalContributed,
      interest: 0
    })

    // Project 15 years (180 months)
    for (let i = 1; i <= 180; i++) {
      const currentYear = Math.floor((i - 1) / 12) + 1
      const isFuture = typeof futureSavingYear === 'number' && typeof futureSaving === 'number' && currentYear >= futureSavingYear
      const activeMonthlySaving = isFuture ? futureSaving : monthlySaving

      currentBalance = currentBalance * (1 + monthlyRate) + activeMonthlySaving
      totalContributed += activeMonthlySaving
      
      const futureDate = new Date(today)
      futureDate.setMonth(futureDate.getMonth() + i)
      
      // Save data point every month for a smooth curve
      data.push({
        month: i,
        monthStr: futureDate.toLocaleDateString('es-ES', { month: 'short' }),
        yearStr: futureDate.getFullYear().toString(),
        total: Math.round(currentBalance),
        contributed: Math.round(totalContributed),
        interest: Math.round(currentBalance - totalContributed)
      })
    }

    return data
  }, [startingCapital, monthlySaving, annualReturn, futureSaving, futureSavingYear])

  if (isLoading) {
    return (
      <div className="mobile-panel w-full h-[400px] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Calculate milestones
  const today = new Date()
  const monthsToEndOfYear = 11 - today.getMonth() // Months remaining this year
  
  const endOfYearData = projectionData[monthsToEndOfYear] || projectionData[0]
  const year2Data = projectionData[24] || projectionData[0]
  const year5Data = projectionData[60] || projectionData[0]
  const year10Data = projectionData[120] || projectionData[0]

  const milestones = [
    { label: "Fin de Año", data: endOfYearData },
    { label: "Dentro de 2 años", data: year2Data },
    { label: "Dentro de 5 años", data: year5Data },
    { label: "Dentro de 10 años", data: year10Data },
  ]

  // Chart data: simplify for the graph so it doesn't render 180 ticks, maybe downsample to yearly or keep all for smooth Area
  const chartData = projectionData.filter(d => d.month % 12 === 0 || d.month === 0)

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="mobile-panel p-4 md:p-5">
          <label className="text-xs md:text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-2 md:mb-3 whitespace-nowrap">
            <Wallet className="w-4 h-4 text-violet-500 flex-shrink-0" /> Capital Inicial
          </label>
          <input 
            type="number" 
            value={Math.round(startingCapital)} 
            onChange={e => setInitialCapital(Number(e.target.value))}
            className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 font-semibold focus:ring-2 focus:ring-primary outline-none text-sm md:text-base"
          />
        </div>
        
        <div className="mobile-panel p-4 md:p-5">
          <label className="text-xs md:text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-2 md:mb-3 whitespace-nowrap">
            <PiggyBank className="w-4 h-4 text-emerald-500 flex-shrink-0" /> Ahorro Mensual
          </label>
          <input 
            type="number" 
            value={monthlySaving} 
            onChange={e => setMonthlySaving(Number(e.target.value))}
            className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 font-semibold focus:ring-2 focus:ring-primary outline-none text-sm md:text-base"
          />
        </div>

        <div className="mobile-panel p-4 md:p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-1 bg-amber-500/20 rounded-bl-lg">
            <span className="text-[9px] font-bold text-amber-500 uppercase px-1">Opcional</span>
          </div>
          <label className="text-xs md:text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-2 md:mb-3 whitespace-nowrap">
            <PiggyBank className="w-4 h-4 text-amber-500 flex-shrink-0" /> Ahorro Futuro
          </label>
          <input 
            type="number" 
            placeholder="Ej: 1000"
            value={futureSaving} 
            onChange={e => setFutureSaving(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 font-semibold focus:ring-2 focus:ring-primary outline-none text-sm md:text-base"
          />
        </div>

        <div className="mobile-panel p-4 md:p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-1 bg-amber-500/20 rounded-bl-lg">
            <span className="text-[9px] font-bold text-amber-500 uppercase px-1">Opcional</span>
          </div>
          <label className="text-xs md:text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-2 md:mb-3 whitespace-nowrap">
            <TrendingUp className="w-4 h-4 text-amber-500 flex-shrink-0" /> A partir del Año
          </label>
          <input 
            type="number" 
            placeholder="Ej: 3"
            value={futureSavingYear} 
            onChange={e => setFutureSavingYear(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 font-semibold focus:ring-2 focus:ring-primary outline-none text-sm md:text-base"
          />
        </div>

        <div className="mobile-panel p-4 md:p-5">
          <label className="text-xs md:text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-2 md:mb-3 whitespace-nowrap">
            <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" /> Rentabilidad (%)
          </label>
          <input 
            type="number" 
            value={annualReturn} 
            onChange={e => setAnnualReturn(Number(e.target.value))}
            className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 font-semibold focus:ring-2 focus:ring-primary outline-none text-sm md:text-base"
          />
        </div>
      </div>
      
      <div className="flex justify-end mt-2">
        <button 
          onClick={saveDefaults}
          className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors bg-card/50 px-3 py-1.5 rounded-lg border border-border/50"
        >
          Guardar valores por defecto
        </button>
      </div>

      {/* Milestones Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {milestones.map((milestone, idx) => {
          const passiveRatio = (milestone.data.interest / milestone.data.total) * 100 || 0
          
          return (
            <div 
              key={idx} 
              className="mobile-panel p-4 relative overflow-hidden flex flex-col justify-between min-h-[140px]"
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-primary/80 mb-2">
                  {milestone.label}
                </p>
                <p className="text-xl md:text-2xl font-extrabold text-foreground mb-1 font-tabular">
                  {formatCurrency(milestone.data.total)}
                </p>
              </div>
              
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-muted-foreground">Capital</span>
                  <span className="text-foreground">{formatCurrency(milestone.data.contributed)}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-emerald-500 flex items-center gap-1">Pasivo</span>
                  <span className="text-emerald-500">+{formatCurrency(milestone.data.interest)}</span>
                </div>
                
                {/* Mini progress bar showing passive vs total */}
                <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                  <div className="h-full bg-primary" style={{ width: `${100 - passiveRatio}%` }} />
                  <div className="h-full bg-emerald-400" style={{ width: `${passiveRatio}%` }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Chart */}
      <div className="mobile-panel w-full h-[450px] p-4 md:p-6 flex flex-col">
        <div className="mb-4 flex flex-wrap gap-4 items-center px-2">
          <h3 className="font-bold text-foreground">Proyección a 15 Años</h3>
          <div className="flex gap-4 text-xs font-semibold ml-auto">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-primary" />
              <span className="text-muted-foreground">Aportado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span className="text-muted-foreground">Interés Pasivo</span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorContributed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorInterest" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis 
                dataKey="yearStr" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(val) => `${(val/1000).toFixed(0)}k`}
                dx={-10}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-card/95 backdrop-blur-xl border border-border/50 p-4 rounded-xl shadow-xl min-w-[200px] z-50 relative">
                        <p className="text-sm font-bold text-foreground mb-3">{data.monthStr} {data.yearStr} <span className="text-muted-foreground font-normal">(Año {data.month / 12})</span></p>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm font-semibold">
                            <span className="text-muted-foreground">Capital Aportado</span>
                            <span className="text-primary font-tabular">{formatCurrency(data.contributed)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm font-semibold">
                            <span className="text-muted-foreground">Interés Pasivo</span>
                            <span className="text-emerald-500 font-tabular">+{formatCurrency(data.interest)}</span>
                          </div>
                          <div className="pt-2 mt-2 border-t border-border/50 flex justify-between items-center text-sm font-bold">
                            <span className="text-foreground">Total</span>
                            <span className="text-foreground font-tabular">{formatCurrency(data.total)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              
              <Area 
                type="monotone" 
                dataKey="contributed" 
                stackId="1" 
                stroke="#3b82f6" 
                fill="url(#colorContributed)" 
                strokeWidth={2}
                activeDot={{ r: 6, fill: "#3b82f6" }}
                isAnimationActive
                animationDuration={1500}
              />
              <Area 
                type="monotone" 
                dataKey="interest" 
                stackId="1" 
                stroke="#10b981" 
                fill="url(#colorInterest)" 
                strokeWidth={2}
                activeDot={{ r: 6, fill: "#10b981" }}
                isAnimationActive
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
