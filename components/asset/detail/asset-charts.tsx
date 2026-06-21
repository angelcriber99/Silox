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
    <Card className="bg-zinc-900/60 border-zinc-800/60 backdrop-blur-sm animate-fade-in stagger-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-100 text-base">
          <DollarSign className="h-5 w-5 text-blue-400" />
          Composición del Capital
        </CardTitle>
        <CardDescription className="text-zinc-400">
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
                <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg shadow-xl">
                  <p className="text-white text-sm font-bold">{d.name}</p>
                  <p className="text-zinc-300 text-sm font-tabular">{formatCurrency(d.value)}</p>
                </div>
              )
            }} />
          </PieChart>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-[10px] text-zinc-500 uppercase font-medium">Total</p>
              <p className="text-lg font-bold text-white font-tabular">{formatCurrency(position.valor_actual ?? 0)}</p>
            </div>
          </div>
        </div>
        <div className="w-full space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-zinc-400 text-sm">Tu Dinero</span>
            </div>
            <span className="text-white font-bold font-tabular text-sm">{formatCurrency(position.coste_total)}</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-zinc-400 text-sm">Intereses</span>
            </div>
            <span className="text-emerald-400 font-bold font-tabular text-sm">
              +{formatCurrency(Math.max(0, stats.gananciaIntereses))}
            </span>
          </div>
          {position.comisiones_total > 0 && (
            <div className="pt-2 border-t border-zinc-800">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 text-xs">Comisiones pagadas</span>
                <span className="text-zinc-400 font-tabular text-xs">-{formatCurrency(position.comisiones_total)}</span>
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
    <Card className="lg:col-span-2 bg-zinc-900/60 border-zinc-800/60 backdrop-blur-sm animate-fade-in stagger-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-100 text-base">
          <History className="h-5 w-5 text-blue-400" />
          Evolución Histórica
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Tu inversión vs el valor de mercado en cada operación.
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
                <linearGradient id="gInvested" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickMargin={8} minTickGap={30} />
              <YAxis stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`} width={55} domain={['auto', 'auto']} />
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const val = payload[0]?.value as number
                const inv = payload[1]?.value as number
                const diff = val - inv
                return (
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-2xl">
                    <p className="text-zinc-300 text-sm mb-3 font-medium border-b border-zinc-800 pb-2">{label}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-6">
                        <span className="text-emerald-400 text-sm">Valor</span>
                        <span className="text-emerald-400 text-sm font-bold font-tabular">{formatCurrency(val)}</span>
                      </div>
                      <div className="flex justify-between gap-6">
                        <span className="text-blue-400 text-sm">Aportado</span>
                        <span className="text-blue-400 text-sm font-bold font-tabular">{formatCurrency(inv)}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-zinc-800 flex justify-between gap-6">
                        <span className="text-zinc-400 text-xs">Beneficio</span>
                        <span className={`text-xs font-bold font-tabular ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              }} />
              <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#gValue)" animationDuration={1500} />
              <Area type="stepAfter" dataKey="invested" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#gInvested)" animationDuration={1500} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function AssetContributionsChart({ monthlyContributionsData }: any) {
  return (
    <Card className="lg:col-span-2 bg-zinc-900/60 border-zinc-800/60 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-100 text-base">
          <PiggyBank className="h-5 w-5 text-amber-400" />
          Aportaciones Mensuales
        </CardTitle>
        <CardDescription className="text-zinc-400">
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
                    <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg shadow-xl">
                      <p className="text-zinc-300 text-sm font-medium mb-1">{label}</p>
                      <p className="text-amber-400 text-sm font-bold font-tabular">{formatCurrency(payload[0].value as number)}</p>
                    </div>
                  )
                }} />
                <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} animationDuration={1200} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[250px] w-full flex flex-col items-center justify-center text-center px-4 border-2 border-dashed border-zinc-800/50 rounded-lg bg-zinc-900/20">
            <PiggyBank className="h-10 w-10 text-zinc-700 mb-3" />
            <p className="text-zinc-300 font-medium text-sm">Tu inversión inicial fue grande</p>
            <p className="text-zinc-500 text-xs mt-2 max-w-[250px]">
              Hemos ocultado la primera aportación para no romper la escala visual. Aquí verás tus futuras aportaciones mensuales DCA.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
