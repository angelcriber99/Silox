"use client"

import { useState, useMemo } from "react"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { formatCurrency } from "@/lib/utils/formatters"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { Loader2, Target, PiggyBank, TrendingUp } from "lucide-react"

export function FireTracker() {
  const { positions, isLoading } = usePortfolio()
  const [targetAmount, setTargetAmount] = useState(300000)
  const [monthlySaving, setMonthlySaving] = useState(500)
  const [annualReturn, setAnnualReturn] = useState(7)

  const currentTotal = useMemo(() => {
    if (!positions) return 0
    return positions.reduce((acc, pos) => acc + (pos.valor_actual || 0), 0)
  }, [positions])

  const projectionData = useMemo(() => {
    if (currentTotal === 0 && monthlySaving === 0) return []
    
    const monthlyRate = annualReturn / 100 / 12
    let currentBalance = currentTotal
    let months = 0
    const data: { monthStr: string, balance: number, isTarget: boolean, monthsToReach?: number }[] = []
    
    const today = new Date()

    // Add current point
    data.push({
      monthStr: today.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
      balance: currentBalance,
      isTarget: false
    })

    // Project until target is reached (cap at 50 years to avoid infinite loops)
    while (currentBalance < targetAmount && months < 600) {
      months++
      currentBalance = currentBalance * (1 + monthlyRate) + monthlySaving
      
      // Save data point every year
      if (months % 12 === 0) {
        const futureDate = new Date(today)
        futureDate.setMonth(futureDate.getMonth() + months)
        data.push({
          monthStr: futureDate.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
          balance: Math.round(currentBalance),
          isTarget: false
        })
      }
    }

    // Add final point exactly when reached
    if (months > 0 && months % 12 !== 0) {
      const futureDate = new Date(today)
      futureDate.setMonth(futureDate.getMonth() + months)
      data.push({
        monthStr: futureDate.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
        balance: Math.round(currentBalance),
        isTarget: true,
        monthsToReach: months
      })
    } else if (months > 0) {
      data[data.length - 1].isTarget = true
      data[data.length - 1].monthsToReach = months
    }

    return data
  }, [currentTotal, targetAmount, monthlySaving, annualReturn])

  if (isLoading) {
    return (
      <div className="mobile-panel w-full h-[400px] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const finalPoint = projectionData.find(d => d.isTarget)
  const years = finalPoint ? Math.floor(finalPoint.monthsToReach! / 12) : 0
  const remainingMonths = finalPoint ? finalPoint.monthsToReach! % 12 : 0

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="mobile-panel p-5">
          <label className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-rose-500" /> Objetivo FIRE (€)
          </label>
          <input 
            type="number" 
            value={targetAmount} 
            onChange={e => setTargetAmount(Number(e.target.value))}
            className="w-full bg-background border border-border/50 rounded-xl px-4 py-2 font-semibold focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
        
        <div className="mobile-panel p-5">
          <label className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
            <PiggyBank className="w-4 h-4 text-emerald-500" /> Ahorro Mensual (€)
          </label>
          <input 
            type="number" 
            value={monthlySaving} 
            onChange={e => setMonthlySaving(Number(e.target.value))}
            className="w-full bg-background border border-border/50 rounded-xl px-4 py-2 font-semibold focus:ring-2 focus:ring-primary outline-none"
          />
        </div>

        <div className="mobile-panel p-5">
          <label className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" /> Rentabilidad Anual (%)
          </label>
          <input 
            type="number" 
            value={annualReturn} 
            onChange={e => setAnnualReturn(Number(e.target.value))}
            className="w-full bg-background border border-border/50 rounded-xl px-4 py-2 font-semibold focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
      </div>

      {/* Summary */}
      {finalPoint ? (
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">¡Objetivo a la vista!</h3>
            <p className="text-muted-foreground mt-1">
              Alcanzarás los <strong>{formatCurrency(targetAmount)}</strong> en <strong>{finalPoint.monthStr}</strong>.
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-primary">
              {years > 0 ? `${years} años` : ''} {remainingMonths > 0 ? `y ${remainingMonths} meses` : ''}
            </div>
            <p className="text-sm text-primary/70 font-semibold uppercase tracking-widest mt-1">Tiempo Restante</p>
          </div>
        </div>
      ) : (
        <div className="mobile-panel p-5 md:p-6 text-center">
          <p className="text-muted-foreground">Tardarás más de 50 años. Ajusta tus parámetros.</p>
        </div>
      )}

      {/* Chart */}
      <div className="mobile-panel w-full h-[400px] p-5 md:p-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={projectionData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis 
              dataKey="monthStr" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(val) => `€${(val/1000).toFixed(0)}k`}
              dx={-10}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-card/90 backdrop-blur-xl border border-border/50 p-4 rounded-xl shadow-xl">
                      <p className="text-sm text-muted-foreground mb-1">{payload[0].payload.monthStr}</p>
                      <p className="text-xl font-bold text-foreground">
                        {formatCurrency(payload[0].value as number)}
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <ReferenceLine y={targetAmount} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
            <Line 
              type="monotone" 
              dataKey="balance" 
              stroke="hsl(var(--primary))" 
              strokeWidth={4}
              dot={false}
              activeDot={{ r: 8, fill: "hsl(var(--primary))" }}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
