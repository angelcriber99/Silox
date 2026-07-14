"use client"

import { useMemo, useState } from "react"
import type { EnrichedPosition, Transaccion } from '@/lib/types'
import { PieChartIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { usePreferences } from "@/lib/stores/use-preferences"
import { CategoryDrilldownModal } from "@/components/dashboard/category-drilldown-modal"

interface AllocationChartProps {
  positions: EnrichedPosition[]
  pendingTxs?: Transaccion[]
  marketState?: string
}

const TYPE_COLORS: Record<string, string> = {
  ETF: "#3b82f6",
  "Fondo Indexado": "#8b5cf6",
  "Fondo Monetario": "#06b6d4",
  Acción: "#f59e0b",
  Crypto: "#f97316",
  Metal: "#a8a29e",
  Liquidez: "#a1a1aa",
}

const STRATEGY_COLORS: Record<string, string> = {
  Core: "#3b82f6",
  Satellite: "#8b5cf6",
}

type GroupBy = "tipo" | "estrategia"
type ViewMode = "composition" | "performance"

interface ChartDatum {
  name: string
  originalName: string
  value: number
  color: string
  percent: number
  pnlPercent24h: number
  pnlAmount24h: number
}

export function AllocationChart({ positions, pendingTxs, marketState = 'CLOSED' }: AllocationChartProps) {
  const { hideBalances } = usePreferences()
  const [groupBy, setGroupBy] = useState<GroupBy>("tipo")
  const [drilldownModalOpen, setDrilldownModalOpen] = useState(false)
  const [drilldownCategoryName, setDrilldownCategoryName] = useState("")
  const [drilldownOriginalName, setDrilldownOriginalName] = useState("")
  const t = useTranslations('Dashboard')

  const translateType = (type: string) => {
    const map: Record<string, string> = {
      "ETF": "type_etf",
      "Fondo Indexado": "type_index_fund",
      "Fondo Monetario": "type_money_market",
      "Acción": "type_stock",
      "Crypto": "type_crypto",
      "Metal": "type_metal",
    }
    return map[type] ? t(map[type]) : type
  }

  const chartData = useMemo(() => {
    const groups = new Map<string, { value: number; pnl24h: number; sessionPnl: number; sessionBaseline: number }>()
    const colors = groupBy === "tipo" ? TYPE_COLORS : STRATEGY_COLORS

    for (const p of positions) {
      if (p.tipo === 'Liquidez' || p.tipo === 'Fondo Monetario') continue;
      
      const key = groupBy === "tipo" ? p.tipo : p.estrategia
      const value = p.valor_actual ?? p.coste_total
      const cp = p.change_percent_24h ?? 0
      const sessionBaseline = value > 0 ? value / (1 + cp / 100) : 0
      const sessionPnl = value - sessionBaseline
      const pnl24h = p.change_amount_24h ?? 0

      if (value > 0) {
        const existing = groups.get(key) ?? { value: 0, pnl24h: 0, sessionPnl: 0, sessionBaseline: 0 }
        groups.set(key, {
          value: existing.value + value,
          pnl24h: existing.pnl24h + pnl24h,
          sessionPnl: existing.sessionPnl + sessionPnl,
          sessionBaseline: existing.sessionBaseline + sessionBaseline,
        })
      }
    }

    const total = Array.from(groups.values()).reduce((a, b) => a + b.value, 0)
    const data: ChartDatum[] = Array.from(groups.entries())
      .filter(([name, groupData]) => groupData.value > 0)
      .map(([name, groupData]) => ({
        name: groupBy === "tipo" ? translateType(name) : name,
        originalName: name,
        value: groupData.value,
        color: colors[name] ?? "#71717a",
        percent: total > 0 ? (groupData.value / total) * 100 : 0,
        pnlPercent24h: groupData.sessionBaseline > 0 ? (groupData.sessionPnl / groupData.sessionBaseline) * 100 : 0,
        pnlAmount24h: groupData.pnl24h
      }))
      .sort((a, b) => b.value - a.value)

    return { data, total }
  }, [positions, groupBy, t])

  const hasData = chartData.data.length > 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <PieChartIcon className="w-4 h-4 text-primary" />
          {t('distribution')}
        </h3>
        <div className="flex gap-1 bg-muted p-0.5 rounded-md">
          <button
            onClick={() => setGroupBy("tipo")}
            className={`px-2 py-0.5 text-[10px] rounded font-medium transition-all ${
              groupBy === "tipo"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tipo
          </button>
          <button
            onClick={() => setGroupBy("estrategia")}
            className={`px-2 py-0.5 text-[10px] rounded font-medium transition-all ${
              groupBy === "estrategia"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Estrategia
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="h-4 text-xs text-muted-foreground">Sin datos</div>
      ) : (
        <>
          {/* Stacked Bar */}
          <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted/50">
            {chartData.data.map((d) => (
              <div 
                key={d.name}
                style={{ width: `${d.percent}%`, backgroundColor: d.color }}
                className="h-full hover:brightness-110 transition-all cursor-pointer border-r border-background/20 last:border-0"
                title={`${d.name}: ${d.percent.toFixed(1)}%`}
                onClick={() => {
                  setDrilldownCategoryName(d.name)
                  setDrilldownOriginalName(d.originalName)
                  setDrilldownModalOpen(true)
                }}
              />
            ))}
          </div>

          {/* Compact Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-1">
            {chartData.data.map((d) => (
              <div 
                key={d.name}
                className="flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors"
                onClick={() => {
                  setDrilldownCategoryName(d.name)
                  setDrilldownOriginalName(d.originalName)
                  setDrilldownModalOpen(true)
                }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-xs font-medium text-foreground">{d.name}</span>
                <span className="text-[10px] text-muted-foreground">{d.percent.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </>
      )}

      <CategoryDrilldownModal
        open={drilldownModalOpen}
        onOpenChange={setDrilldownModalOpen}
        categoryName={drilldownCategoryName}
        originalCategoryName={drilldownOriginalName}
        positions={positions}
        groupBy={groupBy}
        hideBalances={hideBalances}
      />
    </div>
  )
}
