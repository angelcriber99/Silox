"use client"

import { useMemo, useState, useEffect, useRef } from "react"
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
import { PlusCircle, TrendingUp, TrendingDown, Minus, ArrowUpDown, Layers, Edit3, Search, Plus, BookOpen, Bell, Wallet } from "lucide-react"
import type { EnrichedPosition } from '@/lib/types'
import { formatCurrency, formatPercent, formatUnits, formatPnl } from "@/lib/utils/formatters"
import { Sparkline } from "@/components/asset/sparkline"
import { AddAssetModal } from "@/components/asset/add-asset-modal"
import { HelpGuideModal } from "@/components/dashboard/help-guide-modal"
import { PriceAlerts } from "@/components/dashboard/price-alerts"
import { usePreferences } from "@/lib/stores/use-preferences"
import { useAlerts } from "@/lib/hooks/use-alerts"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { WaveTrackerModal, parseAssetNotes } from "@/components/asset/wave-tracker-modal"
import { Waves } from "lucide-react"

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

const translateType = (type: string, t: any) => {
  const map: Record<string, string> = {
    "ETF": "type_etf",
    "Fondo Indexado": "type_index_fund",
    "Fondo Monetario": "type_money_market",
    "Acción": "type_stock",
    "Crypto": "type_crypto",
  }
  return map[type] ? t(map[type]) : type
}

type SortKey = "ticker" | "tipo" | "unidades" | "valor_actual" | "pnl" | "pnl_percent" | "change_percent_24h"
type SortDir = "asc" | "desc"

function PnlDisplay({ value, type }: { value: number | null; type: "currency" | "percent" }) {
  const { hideBalances } = usePreferences()
  const [flash, setFlash] = useState<'up'|'down'|null>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== null && prevValue.current !== null && value !== prevValue.current) {
      if (value > prevValue.current) {
        setFlash('up');
      } else {
        setFlash('down');
      }
      const t = setTimeout(() => setFlash(null), 1500);
      prevValue.current = value;
      return () => clearTimeout(t);
    }
    if (prevValue.current === null && value !== null) {
      prevValue.current = value;
    }
  }, [value]);

  if (hideBalances) return <span className="text-muted-foreground/60">****</span>
  if (value === null) return <span className="text-muted-foreground/60">—</span>

  const textColor = value > 0 ? "text-emerald-400" : value < 0 ? "text-rose-400" : "text-muted-foreground"
  const formatted = type === "currency" ? formatPnl(value) : formatPercent(value)

  const flashClasses = flash === 'up' 
    ? 'bg-emerald-500/20' 
    : flash === 'down' 
      ? 'bg-rose-500/20 animate-pulse' 
      : 'bg-transparent';

  return (
    <span className={`inline-flex items-center gap-1 font-tabular transition-colors duration-1000 rounded px-1.5 py-0.5 -mr-1.5 ${textColor} ${flashClasses}`}>
      {value > 0 ? "+" : ""}{formatted.replace("+", "")}
    </span>
  )
}

function LivePrice({ 
  value, 
  currency, 
  hideBalances 
}: { 
  value: number | null;
  currency?: string;
  hideBalances: boolean;
}) {
  const [flash, setFlash] = useState<'up'|'down'|null>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== null && prevValue.current !== null && value !== prevValue.current) {
      if (value > prevValue.current) {
        setFlash('up');
      } else {
        setFlash('down');
      }
      const t = setTimeout(() => setFlash(null), 1500);
      prevValue.current = value;
      return () => clearTimeout(t);
    }
    if (prevValue.current === null && value !== null) {
      prevValue.current = value;
    }
  }, [value]);

  if (hideBalances) return <span>****</span>;
  if (value === null) return <span className="text-muted-foreground/60 text-xs">pendiente</span>;

  const baseClasses = "transition-colors duration-1000 rounded px-1.5 py-0.5 font-tabular inline-block -mr-1.5";
  const flashClasses = flash === 'up' 
    ? 'bg-emerald-500/20 text-emerald-400' 
    : flash === 'down' 
      ? 'bg-rose-500/20 text-rose-400 animate-pulse' 
      : 'bg-transparent text-foreground/80';

  return (
    <span className={`${baseClasses} ${flashClasses}`}>
      {formatCurrency(value, currency || 'EUR')}
    </span>
  );
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
  const { hideBalances, tableDensity, showPnlPercentOnly } = usePreferences()
  const t = useTranslations('Dashboard')
  
  const cellPadding = tableDensity === "compact" ? "py-1.5" : "py-4"
  const [filter, setFilter] = useState(t('filter_all'))
  const [searchQuery, setSearchQuery] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("valor_actual")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [addAssetOpen, setAddAssetOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [waveModalOpen, setWaveModalOpen] = useState(false)
  const [waveAsset, setWaveAsset] = useState<EnrichedPosition | null>(null)
  const { alerts } = useAlerts()

  const hasTriggeredAlerts = alerts.some(a => a.triggered)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const filteredAndSorted = useMemo(() => {
    let list = positions.filter(p => 
      p.unidades > 0 && 
      !p.ticker.startsWith('CASH') && 
      !p.nombre?.toLowerCase().includes('efectivo')
    )
    if (searchQuery.trim() !== "") {
      const lowerQuery = searchQuery.toLowerCase()
      list = list.filter(p => 
        p.ticker.toLowerCase().includes(lowerQuery) || 
        (p.nombre && p.nombre.toLowerCase().includes(lowerQuery)) ||
        (p.isin && p.isin.toLowerCase().includes(lowerQuery))
      )
    }
    if (filter !== t('filter_all')) {
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

  const liquidezAmount = useMemo(() => {
    return positions
      .filter(p => p.ticker.startsWith('CASH') || p.tipo === 'Liquidez')
      .reduce((acc, p) => acc + (p.valor_actual ?? 0), 0)
  }, [positions])

  return (
    <Card className="animate-fade-in stagger-3 bg-card/40 border-border/40 backdrop-blur-md shadow-sm overflow-hidden">
      <CardHeader className="p-4 md:p-6 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span>{t('positions')}</span>
          </CardTitle>

          {liquidezAmount > 0 && (
            <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-card/60 border border-border/40 text-[13px] font-medium shadow-sm hidden sm:flex">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Liquidez:</span>
              <span className="font-semibold text-foreground">{hideBalances ? "••••" : formatCurrency(liquidezAmount)}</span>
            </div>
          )}

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground/80" />
              <Input
                placeholder={t('search_asset')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-background border-border w-full sm:w-[160px] lg:w-[200px] text-foreground focus-visible:ring-primary/30"
              />
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 flex-wrap">
              {FILTER_OPTIONS.map((opt) => {
                const optText = opt === "Todos" ? t('filter_all') : translateType(opt, t);
                const disabled =
                  opt !== "Todos" && !typesWithData.has(opt)
                return (
                  <button
                    key={opt}
                    onClick={() => !disabled && setFilter(optText)}
                    disabled={disabled}
                    className={`px-3 py-1 text-xs rounded-lg font-medium transition-all duration-200 ${
                      filter === opt
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : disabled
                          ? "text-muted-foreground/40 cursor-not-allowed"
                          : "text-muted-foreground/80 hover:text-foreground/80 hover:bg-muted"
                    }`}
                  >
                    {optText}
                  </button>
                )
              })}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setHelpOpen(true)}
              className="bg-transparent border-border text-muted-foreground hover:text-foreground transition-colors duration-200"
              title="Guía de uso"
            >
              <BookOpen className="h-4 w-4" />
            </Button>
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAlertsOpen(true)}
                className="bg-transparent border-border text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                <Bell className="h-4 w-4 mr-2" />
                {t('alerts')}
              </Button>
              {hasTriggeredAlerts && (
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-rose-500 border-2 border-background animate-pulse" />
              )}
            </div>
            <Button
              size="sm"
              onClick={() => setAddAssetOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white transition-colors duration-200"
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              {t('add_asset')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Desktop View (Table) */}
        <div className="hidden md:block overflow-x-auto hide-scrollbar w-full">
          <Table className="w-full">
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border/50 hover:bg-transparent">
                <SortableHeader label={t('symbol')} sortKeyName="ticker" />
                <TableHead className="text-muted-foreground/80 hidden md:table-cell">{t('name')}</TableHead>
                <SortableHeader label={t('dist_type')} sortKeyName="tipo" />
                <SortableHeader label={t('units')} sortKeyName="unidades" className="text-right" />
                <TableHead className="text-muted-foreground/80 text-right hidden lg:table-cell">{t('purchase_price')}</TableHead>
                <TableHead className="text-muted-foreground/80 text-right">{t('current_price')}</TableHead>
                <SortableHeader label={t('value')} sortKeyName="valor_actual" className="text-right whitespace-nowrap min-w-[120px]" />
                <SortableHeader label={t('today')} sortKeyName="change_percent_24h" className="text-right hidden sm:table-cell" />
                {!showPnlPercentOnly && <SortableHeader label="P&L" sortKeyName="pnl" className="text-right" />}
                <SortableHeader label="P&L %" sortKeyName="pnl_percent" className={`text-right ${showPnlPercentOnly ? "" : "hidden sm:table-cell"}`} />
                <TableHead className="text-right text-muted-foreground/80 min-w-[100px] w-[100px] pr-8" />
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
                    colSpan={12}
                    className="text-center text-muted-foreground/60 py-16"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <Layers className="h-5 w-5 text-muted-foreground/60" />
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground/80">
                          {searchQuery.trim() !== ""
                            ? `${t('no_results')} "${searchQuery}"`
                            : filter !== t('filter_all')
                              ? `${t('no_results')} "${filter}"`
                              : t('empty_portfolio')}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {t('add_first_asset')}
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

                  const displaySymbol = (p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario") 
                    ? (p.nombre?.split(' ')[0].toUpperCase() || "FONDO")
                    : (p.ticker.length > 6 && p.nombre) ? p.nombre.split(' ')[0].toUpperCase() : p.ticker.split('.')[0];

                  const assetNotes = parseAssetNotes(p.notas);
                  const currentPrice = p.precio_actual_nativo !== null ? p.precio_actual_nativo : (p.precio_actual || 0);
                  const hasActiveWaves = assetNotes.waves.some(w => w.active);
                  const hasTriggeredWave = hasActiveWaves && assetNotes.waves.some(w => 
                    w.active && ((w.type === "SELL" && currentPrice >= w.price) || (w.type === "BUY" && currentPrice <= w.price))
                  );

                  return (
                    <TableRow
                      key={p.activo_id}
                      className={`transition-all duration-500 group relative ${
                        hasTriggeredWave
                          ? "bg-amber-500/20 hover:bg-amber-500/30 border-y-2 border-y-amber-500 z-10 animate-pulse"
                          : "border-b border-border/30 hover:bg-muted/30"
                      }`}
                      style={hasTriggeredWave ? { boxShadow: "inset 8px 0 0 0 rgb(245 158 11), 0 0 20px rgba(245, 158, 11, 0.4)" } : undefined}
                    >
                      <TableCell className={`font-medium text-foreground font-tabular ${cellPadding}`}>
                        <Link href={`/activo/${p.activo_id}`} className="flex flex-col hover:text-amber-500 transition-colors">
                          <span>
                            {displaySymbol}
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
                      <TableCell className={`text-muted-foreground/80 text-sm max-w-[160px] truncate hidden md:table-cell ${cellPadding}`}>
                        <Link href={`/activo/${p.activo_id}`} className="hover:text-foreground/80 transition-colors">
                          {p.nombre || "—"}
                        </Link>
                      </TableCell>
                      <TableCell className={cellPadding}>
                        <Badge
                          variant="outline"
                          className={
                            TIPO_BADGE_STYLES[p.tipo] ??
                            "bg-zinc-500/10 text-muted-foreground border-zinc-500/20"
                          }
                        >
                          {translateType(p.tipo, t)}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-tabular text-foreground/80 ${cellPadding}`}>
                        {p.unidades > 0 ? formatUnits(p.unidades) : "—"}
                      </TableCell>
                      <TableCell className={`text-right font-tabular text-muted-foreground/80 hidden lg:table-cell ${cellPadding}`}>
                        {p.precio_medio > 0
                          ? (hideBalances ? "****" : formatCurrency(p.precio_medio, p.moneda))
                          : "—"}
                      </TableCell>
                      <TableCell className={`text-right font-tabular ${cellPadding}`}>
                        <LivePrice 
                          value={p.precio_actual_nativo !== null ? p.precio_actual_nativo : p.precio_actual}
                          currency={p.precio_actual_nativo !== null ? (p.original_currency || p.moneda) : 'EUR'}
                          hideBalances={hideBalances}
                        />
                      </TableCell>
                      <TableCell className={`text-right font-tabular text-foreground font-medium ${cellPadding}`}>
                        <div className="flex flex-col items-end gap-1">
                          <span>
                            {hideBalances ? "****" : (p.valor_actual !== null
                              ? formatCurrency(p.valor_actual, 'EUR')
                              : "—")}
                          </span>
                          {!hideBalances && p.coste_total_eur > 0 && (
                            <span className="text-[10px] text-muted-foreground/70 font-normal">
                              Inv: {formatCurrency(p.coste_total_eur, 'EUR')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={`text-right hidden sm:table-cell ${cellPadding}`}>
                        <PnlDisplay 
                          value={p.valor_actual !== null && p.change_percent_24h !== null 
                            ? p.valor_actual - (p.valor_actual / (1 + p.change_percent_24h / 100)) 
                            : null} 
                          type="currency" 
                        />
                      </TableCell>
                      {!showPnlPercentOnly && (
                        <TableCell className={`text-right ${cellPadding}`}>
                          <PnlDisplay value={p.pnl} type="currency" />
                        </TableCell>
                      )}
                      <TableCell className={`text-right ${showPnlPercentOnly ? "" : "hidden sm:table-cell"} ${cellPadding}`}>
                        <PnlDisplay value={p.pnl_percent} type="percent" />
                      </TableCell>
                      <TableCell className={`text-right min-w-[100px] w-[100px] ${cellPadding}`}>
                        <div className="flex items-center justify-end gap-1 pr-6 transition-opacity duration-200">
                          {(() => {
                            const showWavesPermanently = hasActiveWaves || hasTriggeredWave;
                            
                            return (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => { setWaveAsset(p); setWaveModalOpen(true); }}
                                  title={`Olas (Waves) — ${p.ticker}`}
                                  className={`h-7 w-7 transition-all duration-200 ${
                                    showWavesPermanently ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                  } ${
                                    hasTriggeredWave 
                                      ? "text-amber-400 bg-amber-500/20" 
                                      : hasActiveWaves 
                                        ? "text-muted-foreground/80 bg-muted/40 hover:text-amber-400 hover:bg-amber-500/10" 
                                        : "text-muted-foreground/60 hover:text-amber-400 hover:bg-amber-500/10"
                                  }`}
                                >
                                  <Waves className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onEditAsset(p)}
                                  title={`Editar activo — ${p.ticker}`}
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-amber-400 hover:bg-amber-500/10 transition-all duration-200"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onAddTransaction(p)}
                                  title={`Añadir transacción — ${p.ticker}`}
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-blue-400 hover:bg-blue-500/10 transition-all duration-200"
                                >
                                  <PlusCircle className="h-4 w-4" />
                                </Button>
                              </>
                            );
                          })()}
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

               const displaySymbol = (p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario") 
                 ? (p.nombre?.split(' ')[0].toUpperCase() || "FONDO")
                 : (p.ticker.length > 6 && p.nombre) ? p.nombre.split(' ')[0].toUpperCase() : p.ticker.split('.')[0];

               return (
                 <div key={p.activo_id} className="p-4 flex flex-col gap-3 hover:bg-muted/30 transition-colors">
                   {/* Top: Title & Badge */}
                   <div className="flex items-center justify-between">
                     <Link href={`/activo/${p.activo_id}`} className="flex flex-col flex-1">
                        <span className="font-medium text-foreground">
                          {displaySymbol}
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
                        {translateType(p.tipo, t)}
                      </Badge>
                   </div>

                   {/* Middle: Units x Price -> Total Value */}
                   <div className="flex justify-between items-end">
                     <div className="flex flex-col">
                       <span className="text-xs text-muted-foreground/80 mb-0.5">Posición</span>
                       <span className="text-sm font-medium font-tabular text-foreground/80 flex items-center gap-1">
                         {p.unidades > 0 ? formatUnits(p.unidades) : "0"} <span className="text-muted-foreground/60">x</span>
                         <LivePrice 
                          value={p.precio_actual}
                          currency="EUR"
                          hideBalances={hideBalances}
                         />
                       </span>
                     </div>
                     <div className="flex flex-col items-end">
                       <span className="text-xs text-muted-foreground/80 mb-0.5">Valor Actual</span>
                       <div className="flex flex-col items-end">
                         <span className="text-base font-bold font-tabular text-foreground">
                           {p.valor_actual !== null ? formatCurrency(p.valor_actual, 'EUR') : "—"}
                         </span>
                         {p.coste_total_eur > 0 && (
                           <span className="text-[10px] text-muted-foreground/70 font-normal -mt-1">
                             Inv: {formatCurrency(p.coste_total_eur, 'EUR')}
                           </span>
                         )}
                       </div>
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
                       <span className="text-xs text-muted-foreground/80 mb-0.5">Hoy</span>
                       <PnlDisplay 
                          value={p.valor_actual !== null && p.change_percent_24h !== null 
                            ? p.valor_actual - (p.valor_actual / (1 + p.change_percent_24h / 100)) 
                            : null} 
                          type="currency" 
                        />
                     </div>
                     
                     <div className="flex items-center gap-2">
                        {(() => {
                          const assetNotes = parseAssetNotes(p.notas);
                          const currentPrice = p.precio_actual_nativo !== null ? p.precio_actual_nativo : (p.precio_actual || 0);
                          const hasActiveWaves = assetNotes.waves.some(w => w.active);
                          const hasTriggeredWave = hasActiveWaves && assetNotes.waves.some(w => 
                            w.active && ((w.type === "SELL" && currentPrice >= w.price) || (w.type === "BUY" && currentPrice <= w.price))
                          );
                          
                          return (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setWaveAsset(p); setWaveModalOpen(true); }}
                              className={`h-8 w-8 transition-colors ${
                                hasTriggeredWave 
                                  ? "text-amber-400 bg-amber-500/20" 
                                  : hasActiveWaves 
                                    ? "text-muted-foreground/80 bg-muted/40 hover:text-amber-400 hover:bg-amber-500/10" 
                                    : "text-muted-foreground bg-muted/50 hover:text-amber-400 hover:bg-amber-500/10"
                              }`}
                            >
                              <Waves className="h-4 w-4" />
                            </Button>
                          );
                        })()}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditAsset(p)}
                          className="h-8 w-8 text-muted-foreground bg-muted/50 hover:text-foreground"
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
      <HelpGuideModal open={helpOpen} onOpenChange={setHelpOpen} />
      <PriceAlerts open={alertsOpen} onOpenChange={setAlertsOpen} />
      <WaveTrackerModal open={waveModalOpen} onOpenChange={setWaveModalOpen} position={waveAsset} onSuccess={() => {
        // Trigger a refresh of the page or let SWR handle it if needed
        window.location.reload()
      }} />
    </Card>
  )
}

