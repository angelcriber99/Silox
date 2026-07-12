"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { formatCurrency } from "@/lib/utils/formatters"
import { Calculator } from "lucide-react"

interface CompoundSimulatorProps {
  initialCapital: number
}

export function CompoundSimulator({ initialCapital }: CompoundSimulatorProps) {
  const [monthlyContribution, setMonthlyContribution] = useState<number>(300)
  const [years, setYears] = useState<number>(15)
  const [expectedReturn, setExpectedReturn] = useState<number>(8)

  const data = useMemo(() => {
    let currentCapital = initialCapital
    let totalInvested = initialCapital
    const points = []

    // Add year 0
    points.push({
      year: 0,
      capital: currentCapital,
      invested: totalInvested,
      interest: 0
    })

    const monthlyRate = expectedReturn / 100 / 12

    for (let y = 1; y <= years; y++) {
      for (let m = 1; m <= 12; m++) {
        currentCapital += monthlyContribution
        currentCapital *= (1 + monthlyRate)
        totalInvested += monthlyContribution
      }

      points.push({
        year: y,
        capital: Math.round(currentCapital),
        invested: Math.round(totalInvested),
        interest: Math.round(currentCapital - totalInvested)
      })
    }

    return points
  }, [initialCapital, monthlyContribution, years, expectedReturn])

  const finalCapital = data[data.length - 1]?.capital || 0
  const finalInvested = data[data.length - 1]?.invested || 0
  const finalInterest = data[data.length - 1]?.interest || 0

  return (
    <Card className="bg-card border-border backdrop-blur-sm mt-6 animate-fade-in stagger-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Calculator className="h-5 w-5 text-purple-400" />
          Simulador de Interés Compuesto
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Proyecta el crecimiento de tu capital a futuro basado en aportaciones periódicas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Controls */}
          <div className="lg:col-span-1 space-y-6 bg-background/50 p-5 rounded-xl border border-border/50">
            <div className="space-y-3">
              <Label className="text-foreground/80">Aportación Mensual (€)</Label>
              <Input 
                type="number" 
                value={monthlyContribution} 
                onChange={e => setMonthlyContribution(Number(e.target.value))}
                className="bg-card border-border text-foreground"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-foreground/80">Años Vista</Label>
              <Input 
                type="number" 
                value={years} 
                onChange={e => setYears(Number(e.target.value))}
                className="bg-card border-border text-foreground"
                min={1}
                max={50}
              />
            </div>
            <div className="space-y-3">
              <Label className="text-foreground/80">Rentabilidad Anual (%)</Label>
              <Input 
                type="number" 
                value={expectedReturn} 
                onChange={e => setExpectedReturn(Number(e.target.value))}
                className="bg-card border-border text-foreground"
                step={0.1}
              />
            </div>

            <div className="pt-4 border-t border-border/50 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground/80 uppercase font-medium">Total Invertido</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(finalInvested)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground/80 uppercase font-medium">Intereses Generados</p>
                <p className="text-lg font-bold text-emerald-400 tabular-nums">+{formatCurrency(finalInterest)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground/80 uppercase font-medium">Capital Final</p>
                <p className="text-2xl font-bold text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.4)] tabular-nums">
                  {formatCurrency(finalCapital)}
                </p>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="lg:col-span-3 h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="year" 
                  stroke="#52525b" 
                  tick={{fill: '#a1a1aa', fontSize: 12}} 
                  tickFormatter={(val) => `Año ${val}`}
                />
                <YAxis 
                  stroke="#52525b" 
                  tick={{fill: '#a1a1aa', fontSize: 12}}
                  tickFormatter={(val) => `€${(val/1000).toFixed(0)}k`}
                />
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-card border border-border p-3 rounded-lg shadow-xl">
                          <p className="text-foreground/80 text-sm mb-2 font-medium">Año {label}</p>
                          <div className="space-y-1">
                            <p className="text-purple-400 text-sm font-bold tabular-nums">
                              Capital: {formatCurrency(payload[0].value as number)}
                            </p>
                            <p className="text-blue-400 text-sm tabular-nums">
                              Invertido: {formatCurrency(payload[1].value as number)}
                            </p>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="capital" 
                  stroke="#a855f7" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorCapital)" 
                  name="Capital Total"
                />
                <Area 
                  type="monotone" 
                  dataKey="invested" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorInvested)" 
                  name="Total Invertido"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
