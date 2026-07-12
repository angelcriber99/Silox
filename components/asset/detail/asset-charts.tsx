"use client"

import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { DollarSign, History, PiggyBank } from "lucide-react"
import { formatCurrency } from "@/lib/utils/formatters"

export function AssetCapitalDonut({ capitalDonut, position, stats }: any) {
  return (
    <Card className="bg-card border-border backdrop-blur-sm animate-fade-in stagger-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground text-base">
          <DollarSign className="h-5 w-5 text-blue-400" />
          Composición del Capital
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          ¿Cuánto es tuyo y cuánto te ha regalado el mercado?
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="h-[200px] w-[200px] relative">
          <PieChart width={200} height={200}>
            <Pie data={capitalDonut} innerRadius={65} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none" cornerRadius={8}>
              {capitalDonut.map((entry: any, i: number) => (
                <Cell key={i} fill={entry.color} className="hover:opacity-80 transition-opacity cursor-pointer outline-none" />
              ))}
            </Pie>
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload
              return (
                <div className="bg-card border border-border p-3 rounded-lg shadow-xl">
                  <p className="text-foreground text-sm font-bold">{d.name}</p>
                  <p className="text-foreground/80 text-sm tabular-nums">{formatCurrency(d.value, position.moneda)}</p>
                </div>
              )
            }} />
          </PieChart>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground/80 uppercase font-medium">Total</p>
              <p className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(position.valor_actual_nativo ?? 0, position.moneda)}</p>
            </div>
          </div>
        </div>
        <div className="w-full space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-muted-foreground text-sm">Tu Dinero</span>
            </div>
            <span className="text-foreground font-bold tabular-nums text-sm">{formatCurrency(position.coste_total, position.moneda)}</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground text-sm">Intereses</span>
            </div>
            <span className="text-emerald-400 font-bold tabular-nums text-sm">
              +{formatCurrency(Math.max(0, stats.gananciaIntereses), position.moneda)}
            </span>
          </div>
          {position.comisiones_total > 0 && (
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground/80 text-xs">Comisiones pagadas</span>
                <span className="text-muted-foreground tabular-nums text-xs">-{formatCurrency(position.comisiones_total)}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function AssetEvolutionChart({ evolutionData }: any) {
  if (!evolutionData || evolutionData.length === 0) return null
  
  return (
    <Card className="lg:col-span-2 bg-card border-border backdrop-blur-sm animate-fade-in stagger-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground text-base">
          <History className="h-5 w-5 text-blue-400" />
          Evolución Histórica
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Tu inversión y valor total (izq) vs Intereses ganados (der).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={evolutionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickMargin={8} minTickGap={30} />
              
              {/* Eje Izquierdo: Valor e Inversión */}
              <YAxis yAxisId="left" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`} width={55} domain={['auto', 'auto']} />
              
              {/* Eje Derecho: Intereses / Beneficio */}
              <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tick={{ fill: '#f59e0b', fontSize: 11 }} tickFormatter={(v) => `€${v}`} width={55} />
              
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const data = payload[0].payload
                const val = data.value as number
                const inv = data.invested as number
                const prof = data.profit as number
                return (
                  <div className="bg-card border border-border p-4 rounded-xl shadow-2xl">
                    <p className="text-foreground/80 text-sm mb-3 font-medium border-b border-border pb-2">{label}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-6">
                        <span className="text-emerald-400 text-sm">Valor Total</span>
                        <span className="text-emerald-400 text-sm font-bold tabular-nums">{formatCurrency(val)}</span>
                      </div>
                      <div className="flex justify-between gap-6">
                        <span className="text-blue-400 text-sm">Aportaciones</span>
                        <span className="text-blue-400 text-sm font-bold tabular-nums">{formatCurrency(inv)}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-border flex justify-between gap-6">
                        <span className="text-amber-400 text-xs">Intereses</span>
                        <span className={`text-xs font-bold tabular-nums ${prof >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {prof >= 0 ? '+' : ''}{formatCurrency(prof)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              }} />
              
              {/* Valor total */}
              <Area yAxisId="left" type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#gValue)" animationDuration={1500} />
              
              {/* Aportaciones (solo línea punteada para que se vea claramente el área de valor debajo) */}
              <Area yAxisId="left" type="stepAfter" dataKey="invested" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" fillOpacity={0} fill="none" animationDuration={1500} />
              
              {/* Intereses (Eje derecho) */}
              <Area yAxisId="right" type="monotone" dataKey="profit" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#gProfit)" animationDuration={1500} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function AssetContributionsChart({ monthlyContributionsData }: any) {
  return (
    <Card className="lg:col-span-2 bg-card border-border backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground text-base">
          <PiggyBank className="h-5 w-5 text-amber-400" />
          Aportaciones Mensuales
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Dinero invertido de tu bolsillo cada mes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {monthlyContributionsData.length > 0 ? (
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyContributionsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickMargin={8} minTickGap={20} />
                <YAxis stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickFormatter={(v) => `€${v}`} width={55} />
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="bg-card border border-border p-3 rounded-lg shadow-xl">
                      <p className="text-foreground/80 text-sm font-medium mb-1">{label}</p>
                      <p className="text-amber-400 text-sm font-bold tabular-nums">{formatCurrency(payload[0].value as number)}</p>
                    </div>
                  )
                }} />
                <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} animationDuration={1200} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[250px] w-full flex flex-col items-center justify-center text-center px-4 border-2 border-dashed border-border/50 rounded-lg bg-card/20">
            <PiggyBank className="h-10 w-10 text-zinc-700 mb-3" />
            <p className="text-foreground/80 font-medium text-sm">Tu inversión inicial fue grande</p>
            <p className="text-muted-foreground/80 text-xs mt-2 max-w-[250px]">
              Hemos ocultado la primera aportación para no romper la escala visual. Aquí verás tus futuras aportaciones mensuales DCA.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
