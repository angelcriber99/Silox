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
import { usePreferences } from "@/lib/stores/use-preferences"
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

type SortKey = "ticker" | "tipo" | "unidades" | "valor_actual" | "pnl" | "pnl_percent" | "change_percent_24h"
type SortDir = "asc" | "desc"

function PnlDisplay({ value, type }: { value: number | null; type: "currency" | "percent" }) {
  const { hideBalances } = usePreferences()
  if (hideBalances) return <span className="text-muted-foreground/60">****</span>
  if (value === null) return <span className="text-muted-foreground/60">—</span>

  const color = value > 0 ? "text-emerald-400" : value < 0 ? "text-rose-400" : "text-muted-foreground"
  const formatted = type === "currency" ? formatPnl(value) : formatPercent(value)

  return (
    <span className={`inline-flex items-center gap-1 font-tabular ${color}`}>
      {value > 0 ? "+" : ""}{formatted.replace("+", "")}
    </span>
  )
}

function SkeletonRow() {
  return (
    <TableRow className="border-border/50">
      {Array.from({ length: 9 }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 w-16 rounded bg-muted animate-shimmer" />
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
  const { hideBalances } = usePreferences()
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
      className={`text-muted-foreground/80 cursor-pointer select-none hover:text-foreground/80 transition-colors duration-200 ${className}`}
      onClick={() => toggleSort(sortKeyName)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === sortKeyName ? "text-blue-400" : "opacity-40"}`} />
      </span>
    </TableHead>
  )

  return (
    <Card className="animate-fade-in stagger-3 bg-card border-border backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Posiciones
          </CardTitle>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground/80" />
              <Input
                placeholder="Buscar activo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-background border-border w-full sm:w-[160px] lg:w-[200px] text-foreground focus-visible:ring-primary/30"
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
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : disabled
                          ? "text-muted-foreground/40 cursor-not-allowed"
                          : "text-muted-foreground/80 hover:text-foreground/80 hover:bg-muted"
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
        {/* Desktop View (Table) */}
        <div className="hidden md:block overflow-x-auto min-h-[500px]">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border/50 hover:bg-transparent">
                <SortableHeader label="Símbolo" sortKeyName="ticker" />
                <TableHead className="text-muted-foreground/80 hidden md:table-cell">Nombre</TableHead>
                <SortableHeader label="Tipo" sortKeyName="tipo" />
                <SortableHeader label="Unidades" sortKeyName="unidades" className="text-right" />
                <TableHead className="text-muted-foreground/80 text-right hidden lg:table-cell">P. Medio</TableHead>
                <TableHead className="text-muted-foreground/80 text-right">Precio</TableHead>
                <TableHead className="text-muted-foreground/80 text-right pr-6 hidden xl:table-cell">Tendencia (7d) / 24h</TableHead>
                <SortableHeader label="Valor" sortKeyName="valor_actual" className="text-right" />
                <SortableHeader label="P&L" sortKeyName="pnl" className="text-right" />
                <SortableHeader label="P&L %" sortKeyName="pnl_percent" className="text-right hidden sm:table-cell" />
                <TableHead className="text-right text-muted-foreground/80 w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))
              ) : filteredAndSorted.length === 0 ? (
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableCell
                    colSpan={11}
                    className="text-center text-muted-foreground/60 py-16"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <Layers className="h-5 w-5 text-muted-foreground/60" />
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground/80">
                          {searchQuery.trim() !== ""
                            ? `No hay resultados para "${searchQuery}"`
                            : filter !== "Todos"
                              ? `Sin posiciones de tipo "${filter}"`
                              : "Tu cartera está vacía"}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
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
                      className="border-border/30 hover:bg-muted/30 transition-colors duration-200 group"
                    >
                      <TableCell className="font-medium text-foreground font-tabular">
                        <Link href={`/activo/${p.activo_id}`} className="flex flex-col hover:text-amber-500 transition-colors">
                          <span>
                            {(p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario") 
                              ? (p.nombre?.split(' ')[0].toUpperCase() || "FONDO")
                              : p.ticker.split('.')[0]}
                            {p.ticker.includes('.') && p.tipo !== "Fondo Indexado" && p.tipo !== "Fondo Monetario" && (
                              <span className="text-muted-foreground/80 text-xs">.{p.ticker.split('.').slice(1).join('.')}</span>
                            )}
                          </span>
                          {p.isin && (
                            <span className="text-[10px] text-muted-foreground/80 tracking-wide font-normal mt-0.5">
                              {p.isin}
                            </span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground/80 text-sm max-w-[160px] truncate hidden md:table-cell">
                        <Link href={`/activo/${p.activo_id}`} className="hover:text-foreground/80 transition-colors">
                          {p.nombre || "—"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            TIPO_BADGE_STYLES[p.tipo] ??
                            "bg-zinc-500/10 text-muted-foreground border-zinc-500/20"
                          }
                        >
                          {p.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-tabular text-foreground/80">
                        {p.unidades > 0 ? formatUnits(p.unidades) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-tabular text-muted-foreground/80 hidden lg:table-cell">
                        {p.precio_medio > 0
                          ? (hideBalances ? "****" : formatCurrency(p.precio_medio, p.moneda))
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-tabular text-foreground/80">
                        {hideBalances ? "****" : (p.precio_actual_nativo !== null ? (
                          formatCurrency(p.precio_actual_nativo, p.original_currency || p.moneda)
                        ) : p.precio_actual !== null ? (
                          formatCurrency(p.precio_actual, 'EUR')
                        ) : (
                          <span className="text-muted-foreground/60 text-xs">
                            pendiente
                          </span>
                        ))}
                      </TableCell>
                      <TableCell className="text-right hidden xl:table-cell">
                        <div className="flex items-center justify-end gap-4 pr-2">
                          <div className="flex items-center gap-3">
                            {hasHistory && p.sparkline[0] > 0 && !hideBalances && (
                              <span className={`text-xs font-medium font-tabular w-12 text-right ${sparklineColor === "#34d399" ? "text-emerald-400" : "text-rose-400"}`}>
                                {((p.sparkline[p.sparkline.length - 1] - p.sparkline[0]) / p.sparkline[0] * 100) > 0 ? "+" : ""}
                                {(((p.sparkline[p.sparkline.length - 1] - p.sparkline[0]) / p.sparkline[0]) * 100).toFixed(2)}%
                              </span>
                            )}
                            <Sparkline data={p.sparkline} color={sparklineColor} />
                          </div>
                          <div className="w-14 text-right">
                            <PnlDisplay value={p.change_percent_24h ?? null} type="percent" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-tabular text-foreground font-medium">
                        {hideBalances ? "****" : (p.valor_actual !== null
                          ? formatCurrency(p.valor_actual, 'EUR')
                          : "—")}
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
                            className="h-7 w-7 text-muted-foreground/60 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onAddTransaction(p)}
                            title={`Añadir transacción — ${p.ticker}`}
                            className="h-7 w-7 text-muted-foreground/60 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
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

        {/* Mobile View (Cards) */}
        <div className="md:hidden flex flex-col divide-y divide-zinc-800/60">
          {loading ? (
             Array.from({ length: 3 }).map((_, i) => (
               <div key={i} className="p-4 flex flex-col gap-3">
                 <div className="h-4 w-32 bg-muted animate-shimmer rounded" />
                 <div className="h-10 w-full bg-muted animate-shimmer rounded" />
               </div>
             ))
          ) : filteredAndSorted.length === 0 ? (
            <div className="text-center text-muted-foreground/60 py-16">
               <div className="flex flex-col items-center gap-3">
                 <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                   <Layers className="h-5 w-5 text-muted-foreground/60" />
                 </div>
                 <div>
                   <p className="font-medium text-muted-foreground/80">
                     {searchQuery.trim() !== ""
                       ? `No hay resultados`
                       : filter !== "Todos"
                         ? `Sin posiciones`
                         : "Tu cartera está vacía"}
                   </p>
                 </div>
               </div>
             </div>
          ) : (
            filteredAndSorted.map((p) => {
               const hasHistory = p.sparkline && p.sparkline.length > 1;
               const sparklineColor = hasHistory 
                 ? (p.sparkline[p.sparkline.length - 1] >= p.sparkline[0] ? "#34d399" : "#fb7185")
                 : "#71717a";

               return (
                 <div key={p.activo_id} className="p-4 flex flex-col gap-3 hover:bg-muted/30 transition-colors">
                   {/* Top: Title & Badge */}
                   <div className="flex items-center justify-between">
                     <Link href={`/activo/${p.activo_id}`} className="flex flex-col flex-1">
                        <span className="font-medium text-foreground">
                          {(p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario") 
                            ? (p.nombre?.split(' ')[0].toUpperCase() || "FONDO")
                            : p.ticker.split('.')[0]}
                        </span>
                        {p.nombre && (
                          <span className="text-xs text-muted-foreground/80 truncate max-w-[200px]">
                            {p.nombre}
                          </span>
                        )}
                     </Link>
                     <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0 h-5 ${
                          TIPO_BADGE_STYLES[p.tipo] ?? "bg-zinc-500/10 text-muted-foreground border-zinc-500/20"
                        }`}
                      >
                        {p.tipo}
                      </Badge>
                   </div>

                   {/* Middle: Units x Price -> Total Value */}
                   <div className="flex justify-between items-end">
                     <div className="flex flex-col">
                       <span className="text-xs text-muted-foreground/80 mb-0.5">Posición</span>
                       <span className="text-sm font-medium font-tabular text-foreground/80">
                         {p.unidades > 0 ? formatUnits(p.unidades) : "0"} <span className="text-muted-foreground/60">x</span> {p.precio_actual !== null ? formatCurrency(p.precio_actual, 'EUR') : "—"}
                       </span>
                     </div>
                     <div className="flex flex-col items-end">
                       <span className="text-xs text-muted-foreground/80 mb-0.5">Valor Actual</span>
                       <span className="text-base font-bold font-tabular text-foreground">
                         {p.valor_actual !== null ? formatCurrency(p.valor_actual, 'EUR') : "—"}
                       </span>
                     </div>
                   </div>

                   {/* Bottom: P&L and Actions */}
                   <div className="flex items-center justify-between mt-1 pt-3 border-t border-border/50">
                     <div className="flex flex-col">
                       <span className="text-xs text-muted-foreground/80 mb-0.5">Rentabilidad Total</span>
                       <div className="flex items-center gap-2">
                         <PnlDisplay value={p.pnl} type="currency" />
                         <span className="text-zinc-700 text-xs">|</span>
                         <PnlDisplay value={p.pnl_percent} type="percent" />
                       </div>
                     </div>
                     <div className="flex flex-col items-end mr-4">
                       <span className="text-xs text-muted-foreground/80 mb-0.5">Hoy (24h)</span>
                       <PnlDisplay value={p.change_percent_24h ?? null} type="percent" />
                     </div>
                     
                     <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditAsset(p)}
                          className="h-8 w-8 text-muted-foreground bg-muted/50 hover:text-white"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onAddTransaction(p)}
                          className="h-8 w-8 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
                        >
                          <PlusCircle className="h-4 w-4" />
                        </Button>
                     </div>
                   </div>
                 </div>
               )
            })
          )}
        </div>
      </CardContent>
      <AddAssetModal open={addAssetOpen} onOpenChange={setAddAssetOpen} />
    </Card>
  )
}

