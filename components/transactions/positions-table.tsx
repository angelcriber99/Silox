"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, TrendingUp, TrendingDown, Minus, ArrowUpDown, Layers, Edit3, Search, Plus } from "lucide-react"
import type { EnrichedPosition } from '@/lib/types'
import { formatCurrency, formatPercent, formatUnits, formatPnl } from "@/lib/utils/formatters"
import { Sparkline } from "@/components/asset/sparkline"
import { AddAssetModal } from "@/components/asset/add-asset-modal"
import Link from "next/link"

interface PositionsTableProps {
  positions: EnrichedPosition[]
  loading: boolean
  onAddTransaction: (position: EnrichedPosition) => void
  onEditAsset: (position: EnrichedPosition) => void
}

const TIPO_BADGE_STYLES: Record<string, string> = {
  ETF: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Fondo Indexado": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Fondo Monetario": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  Acción: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Crypto: "bg-orange-500/10 text-orange-400 border-orange-500/20",
}

const FILTER_OPTIONS = [
  "Todos",
  "ETF",
  "Fondo Indexado",
  "Fondo Monetario",
  "Acción",
  "Crypto",
] as const

type SortKey = "ticker" | "tipo" | "unidades" | "valor_actual" | "pnl" | "pnl_percent"
type SortDir = "asc" | "desc"

function PnlDisplay({ value, type }: { value: number | null; type: "currency" | "percent" }) {
  if (value === null) return <span className="text-zinc-600">—</span>

  const color = value > 0 ? "text-emerald-400" : value < 0 ? "text-rose-400" : "text-zinc-400"
  const formatted = type === "currency" ? formatPnl(value) : formatPercent(value)

  return (
    <span className={`inline-flex items-center gap-1 font-tabular ${color}`}>
      {value > 0 ? "+" : ""}{formatted.replace("+", "")}
    </span>
  )
}

function SkeletonRow() {
  return (
    <TableRow className="border-zinc-800/50">
      {Array.from({ length: 9 }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 w-16 rounded bg-zinc-800 animate-shimmer" />
        </TableCell>
      ))}
    </TableRow>
  )
}

export function PositionsTable({
  positions,
  loading,
  onAddTransaction,
  onEditAsset,
}: PositionsTableProps) {
  const [filter, setFilter] = useState("Todos")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("valor_actual")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [addAssetOpen, setAddAssetOpen] = useState(false)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const filteredAndSorted = useMemo(() => {
    let list = positions
    if (searchQuery.trim() !== "") {
      const lowerQuery = searchQuery.toLowerCase()
      list = list.filter(p => 
        p.ticker.toLowerCase().includes(lowerQuery) || 
        (p.nombre && p.nombre.toLowerCase().includes(lowerQuery)) ||
        (p.isin && p.isin.toLowerCase().includes(lowerQuery))
      )
    }
    if (filter !== "Todos") {
      list = list.filter((p) => p.tipo === filter)
    }
    return list.slice().sort((a, b) => {
      const av = a[sortKey] ?? -Infinity
      const bv = b[sortKey] ?? -Infinity
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number)
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [positions, filter, searchQuery, sortKey, sortDir])

  const typesWithData = useMemo(() => {
    const types = new Set(positions.map((p) => p.tipo))
    return types
  }, [positions])

  const SortableHeader = ({
    label,
    sortKeyName,
    className = "",
  }: {
    label: string
    sortKeyName: SortKey
    className?: string
  }) => (
    <TableHead
      className={`text-zinc-500 cursor-pointer select-none hover:text-zinc-300 transition-colors duration-200 ${className}`}
      onClick={() => toggleSort(sortKeyName)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === sortKeyName ? "text-blue-400" : "opacity-40"}`} />
      </span>
    </TableHead>
  )

  return (
    <Card className="animate-fade-in stagger-3 bg-zinc-900/60 border-zinc-800/60 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Posiciones
          </CardTitle>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Buscar activo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-zinc-950 border-zinc-800 w-full sm:w-[160px] lg:w-[200px] text-zinc-300 focus-visible:ring-purple-500/30"
              />
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 flex-wrap">
              {FILTER_OPTIONS.map((opt) => {
                const disabled =
                  opt !== "Todos" && !typesWithData.has(opt)
                return (
                  <button
                    key={opt}
                    onClick={() => !disabled && setFilter(opt)}
                    disabled={disabled}
                    className={`px-3 py-1 text-xs rounded-lg font-medium transition-all duration-200 ${
                      filter === opt
                        ? "bg-zinc-700 text-white shadow-sm"
                        : disabled
                          ? "text-zinc-700 cursor-not-allowed"
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60"
                    }`}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
          
          <Button
            size="sm"
            onClick={() => setAddAssetOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white transition-colors duration-200"
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Añadir Activo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto min-h-[500px]">
          <Table>
            <TableHeader className="bg-zinc-950/40">
              <TableRow className="border-zinc-800/50 hover:bg-transparent">
                <SortableHeader label="Símbolo" sortKeyName="ticker" />
                <TableHead className="text-zinc-500 hidden md:table-cell">Nombre</TableHead>
                <SortableHeader label="Tipo" sortKeyName="tipo" />
                <SortableHeader label="Unidades" sortKeyName="unidades" className="text-right" />
                <TableHead className="text-zinc-500 text-right hidden lg:table-cell">P. Medio</TableHead>
                <TableHead className="text-zinc-500 text-right">Precio</TableHead>
                <TableHead className="text-zinc-500 text-right hidden xl:table-cell">Tendencia (7d)</TableHead>
                <SortableHeader label="Valor" sortKeyName="valor_actual" className="text-right" />
                <SortableHeader label="P&L" sortKeyName="pnl" className="text-right" />
                <SortableHeader label="P&L %" sortKeyName="pnl_percent" className="text-right hidden sm:table-cell" />
                <TableHead className="text-right text-zinc-500 w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))
              ) : filteredAndSorted.length === 0 ? (
                <TableRow className="border-zinc-800/50 hover:bg-transparent">
                  <TableCell
                    colSpan={11}
                    className="text-center text-zinc-600 py-16"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-zinc-800/60 flex items-center justify-center">
                        <Layers className="h-5 w-5 text-zinc-600" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-500">
                          {searchQuery.trim() !== ""
                            ? `No hay resultados para "${searchQuery}"`
                            : filter !== "Todos"
                              ? `Sin posiciones de tipo "${filter}"`
                              : "Tu cartera está vacía"}
                        </p>
                        <p className="text-xs text-zinc-600 mt-1">
                          Añade un activo y registra tu primera operación
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSorted.map((p) => {
                  const hasHistory = p.sparkline && p.sparkline.length > 1;
                  const sparklineColor = hasHistory 
                    ? (p.sparkline[p.sparkline.length - 1] >= p.sparkline[0] ? "#34d399" : "#fb7185")
                    : "#71717a";

                  return (
                    <TableRow
                      key={p.activo_id}
                      className="border-zinc-800/30 hover:bg-zinc-800/30 transition-colors duration-200 group"
                    >
                      <TableCell className="font-medium text-white font-tabular">
                        <Link href={`/activo/${p.activo_id}`} className="flex flex-col hover:text-amber-400 transition-colors">
                          <span>
                            {(p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario") 
                              ? (p.nombre?.split(' ')[0].toUpperCase() || "FONDO")
                              : p.ticker.split('.')[0]}
                            {p.ticker.includes('.') && p.tipo !== "Fondo Indexado" && p.tipo !== "Fondo Monetario" && (
                              <span className="text-zinc-500 text-xs">.{p.ticker.split('.').slice(1).join('.')}</span>
                            )}
                          </span>
                          {p.isin && (
                            <span className="text-[10px] text-zinc-500 tracking-wide font-normal mt-0.5">
                              {p.isin}
                            </span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="text-zinc-500 text-sm max-w-[160px] truncate hidden md:table-cell">
                        <Link href={`/activo/${p.activo_id}`} className="hover:text-zinc-300 transition-colors">
                          {p.nombre || "—"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            TIPO_BADGE_STYLES[p.tipo] ??
                            "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                          }
                        >
                          {p.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-tabular text-zinc-300">
                        {p.unidades > 0 ? formatUnits(p.unidades) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-tabular text-zinc-500 hidden lg:table-cell">
                        {p.precio_medio > 0
                          ? formatCurrency(p.precio_medio, p.moneda)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-tabular text-zinc-300">
                        {p.precio_actual_nativo !== null ? (
                          formatCurrency(p.precio_actual_nativo, p.original_currency || p.moneda)
                        ) : p.precio_actual !== null ? (
                          formatCurrency(p.precio_actual, 'EUR')
                        ) : (
                          <span className="text-zinc-600 text-xs">
                            pendiente
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right hidden xl:table-cell">
                        <div className="flex items-center justify-end gap-3 pr-2">
                          {hasHistory && p.sparkline[0] > 0 && (
                            <span className={`text-xs font-medium font-tabular ${sparklineColor === "#34d399" ? "text-emerald-400" : "text-rose-400"}`}>
                              {((p.sparkline[p.sparkline.length - 1] - p.sparkline[0]) / p.sparkline[0] * 100) > 0 ? "+" : ""}
                              {(((p.sparkline[p.sparkline.length - 1] - p.sparkline[0]) / p.sparkline[0]) * 100).toFixed(2)}%
                            </span>
                          )}
                          <Sparkline data={p.sparkline} color={sparklineColor} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-tabular text-white font-medium">
                        {p.valor_actual !== null
                          ? formatCurrency(p.valor_actual, 'EUR')
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <PnlDisplay value={p.pnl} type="currency" />
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        <PnlDisplay value={p.pnl_percent} type="percent" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEditAsset(p)}
                            title={`Editar activo — ${p.ticker}`}
                            className="h-7 w-7 text-zinc-600 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onAddTransaction(p)}
                            title={`Añadir transacción — ${p.ticker}`}
                            className="h-7 w-7 text-zinc-600 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                          >
                            <PlusCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <AddAssetModal open={addAssetOpen} onOpenChange={setAddAssetOpen} />
    </Card>
  )
}

