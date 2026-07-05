"use client"

import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { Loader2 } from "lucide-react"

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#6366f1']

export function AdvancedDiversification() {
  const { positions, isLoading } = usePortfolio()

  if (isLoading) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-card/30 border border-border/50 rounded-2xl">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!positions || positions.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-card/30 border border-border/50 rounded-2xl">
        <p className="text-muted-foreground">No hay posiciones para analizar.</p>
      </div>
    )
  }

  // Aggregate by Sector
  const sectorMap = new Map<string, number>()
  // Aggregate by Geografia
  const geoMap = new Map<string, number>()

  positions.forEach(p => {
    const val = p.valor_actual || 0
    const sector = p.sector || 'Desconocido'
    const geo = p.geografia || 'Desconocida'

    sectorMap.set(sector, (sectorMap.get(sector) || 0) + val)
    geoMap.set(geo, (geoMap.get(geo) || 0) + val)
  })

  const sectorData = Array.from(sectorMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const geoData = Array.from(geoMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card/90 backdrop-blur-xl border border-border/50 p-3 rounded-xl shadow-xl">
          <p className="text-sm font-semibold">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(payload[0].value)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sector Chart */}
        <div className="bg-card/10 border border-border/30 rounded-3xl p-6 flex flex-col items-center">
          <h3 className="text-lg font-bold text-foreground mb-6">Por Sector</h3>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sectorData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="transparent"
                >
                  {sectorData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Geo Chart */}
        <div className="bg-card/10 border border-border/30 rounded-3xl p-6 flex flex-col items-center">
          <h3 className="text-lg font-bold text-foreground mb-6">Por Geografía</h3>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={geoData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="transparent"
                >
                  {geoData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
