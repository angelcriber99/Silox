"use client"

import { useMemo, useState, useEffect, useRef, memo } from "react"
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
import { PlusCircle, TrendingUp, TrendingDown, Minus, ArrowUpDown, Layers, Edit3, Search, Plus, BookOpen, Bell, Wallet, PiggyBank } from "lucide-react"
import type { EnrichedPosition } from '@/lib/types'
import { formatCurrency, formatPercent, formatUnits, formatPnl } from "@/lib/utils/formatters"
import { Sparkline } from "@/components/asset/sparkline"
import { AddAssetModal } from "@/components/asset/add-asset-modal"
import { RevolutSync } from "@/components/transactions/revolut-sync"
import { HelpGuideModal } from "@/components/dashboard/help-guide-modal"
import { usePreferences } from "@/lib/stores/use-preferences"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { WaveTrackerModal, parseAssetNotes } from "@/components/asset/wave-tracker-modal"
import { Waves } from "lucide-react"
import { AssetLogo } from "@/components/ui/asset-logo"
import { useDisplayCurrency } from "@/lib/hooks/use-display-currency"

interface PositionsTableProps {
  positions: EnrichedPosition[]
  loading: boolean
  onAddTransaction: (position: EnrichedPosition) => void
  onEditAsset: (position: EnrichedPosition) => void
}

const TIPO_BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  ETF: { bg: "rgba(10,132,255,0.12)", color: "#0A84FF" },
  "Fondo Indexado": { bg: "rgba(191,90,242,0.12)", color: "#BF5AF2" },
  "Fondo Monetario": { bg: "rgba(50,173,230,0.12)", color: "#32ADE6" },
  Acción: { bg: "rgba(255,214,10,0.12)", color: "#FFD60A" },
  Crypto: { bg: "rgba(255,159,10,0.12)", color: "#FF9F0A" },
  Metal: { bg: "rgba(152,152,157,0.12)", color: "#98989D" },
}

const FILTER_OPTIONS = [
  "Todos",
  "ETF",
  "Fondo Indexado",
  "Fondo Monetario",
  "Acción",
  "Crypto",
  "Metal",
] as const

const translateType = (type: string, t: (key: string) => string) => {
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

function formatNavDate(value?: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit' }).format(date)
}

type SortKey = "ticker" | "tipo" | "unidades" | "displayValue" | "displayPnl" | "pnl_percent" | "displayDailyPnL"
type SortDir = "asc" | "desc"

function PnlDisplay({ value, type }: { value: number | null; type: "currency" | "percent" }) {
  const { hideBalances } = usePreferences()
  const { displayCurrency, convert } = useDisplayCurrency()
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

  const textColor = value > 0 ? "#30D158" : value < 0 ? "#FF453A" : "var(--muted-foreground)"
  const formatted = type === "currency" ? formatPnl(convert(value), displayCurrency) : formatPercent(value)

  const flashStyle = flash === 'up'
    ? { background: "rgba(48,209,88,0.2)" }
    : flash === 'down'
      ? { background: "rgba(255,69,58,0.2)" }
      : { background: "transparent" }

  return (
    <span 
      className={`inline-flex items-center gap-1 tabular-nums transition-colors duration-1000 rounded px-1.5 py-0.5 -mr-1.5 ${flash === 'down' ? 'animate-pulse' : ''}`}
      style={{ color: textColor, ...flashStyle }}
    >
      {value > 0 ? "+" : ""}{formatted.replace("+", "")}
    </span>
  )
}

function LivePrice({ 
  value, 
  currency, 
  hideBalances,
  isStale,
  decimals

}: { 
  value: number | null;
  currency?: string;
  hideBalances: boolean;
  isStale?: boolean;
  decimals?: number;
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

  const baseClasses = "transition-colors duration-1000 rounded px-1.5 py-0.5 tabular-nums inline-block -mr-1.5";
  const flashStyle = flash === 'up'
    ? { background: "rgba(48,209,88,0.2)", color: "#30D158" }
    : flash === 'down'
      ? { background: "rgba(255,69,58,0.2)", color: "#FF453A" }
      : { background: "transparent", color: "rgba(255,255,255,0.8)" }

  return (
    <div className="flex items-center justify-end gap-2">
      <span 
        className={`${baseClasses} ${flash === 'down' ? 'animate-pulse' : ''}`}
        style={flashStyle}
      >
        {formatCurrency(value, currency || 'EUR', decimals)}
      </span>
      <div className="w-1.5 h-1.5 shrink-0 flex items-center justify-center">
        {isStale && (
          <div 
            className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" 
            title="El precio no se ha actualizado recientemente."
          />
        )}
      </div>
    </div>
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

const PositionRow = memo(function PositionRow({
  p,
  t,
  hideBalances,
  cellPadding,
  showPnlPercentOnly,
  onAddTransaction,
  onEditAsset,
  setWaveAsset,
  setWaveModalOpen
}: any) {
  const { format: formatDisplay } = useDisplayCurrency()
  const hasHistory = p.sparkline && p.sparkline.length > 1;
  const sparklineColor = hasHistory
    ? (p.sparkline[p.sparkline.length - 1] >= p.sparkline[0] ? "#34d399" : "#fb7185")
    : "#71717a";

  const displaySymbol = (p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario") 
    ? (p.nombre?.split(' ')[0].toUpperCase() || "FONDO")
    : (p.ticker.length > 6 && p.nombre) ? p.nombre.split(' ')[0].toUpperCase() : p.ticker.split('.')[0];

  const assetNotes = parseAssetNotes(p.notas);
  const hasActiveWaves = assetNotes.waves.some(w => w.active);
  const hasTriggeredWave = hasActiveWaves && assetNotes.waves.some(w => {
    const currentPrice = w.currency === "USD"
      ? (p.precio_actual_usd ?? 0)
      : (p.precio_actual_nativo ?? p.precio_actual ?? 0);
    return w.active && ((w.type === "SELL" && currentPrice >= w.price) || (w.type === "BUY" && currentPrice <= w.price));
  });

  return (
    <TableRow
      className={`transition-all duration-500 group relative ${
        hasTriggeredWave
          ? "bg-amber-500/20 hover:bg-amber-500/30 border-y-2 border-y-amber-500 z-10 animate-pulse"
          : "border-b border-border/30 hover:bg-muted/30"
      }`}
      style={hasTriggeredWave ? { boxShadow: "inset 8px 0 0 0 rgb(245 158 11), 0 0 20px rgba(245, 158, 11, 0.4)" } : undefined}
    >
      <TableCell className={`font-medium text-foreground tabular-nums pl-4 sm:pl-6 ${cellPadding}`}>
        <Link href={`/activo/${p.activo_id}`} className="flex items-center gap-3 hover:text-amber-500 transition-colors">
          <AssetLogo 
            ticker={p.ticker} 
            name={p.nombre} 
            type={p.tipo} 
            size={28}
            className="hidden sm:flex"
          />
          <div className="flex flex-col">
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
          </div>
        </Link>
      </TableCell>
      <TableCell className={`text-muted-foreground/80 text-sm max-w-[160px] truncate hidden xl:table-cell ${cellPadding}`}>
        <Link href={`/activo/${p.activo_id}`} className="hover:text-foreground/80 transition-colors">
          {p.nombre || "—"}
        </Link>
      </TableCell>
      <TableCell className={`hidden xl:table-cell ${cellPadding}`}>
        <Badge
          variant="outline"
          className="border-none"
          style={TIPO_BADGE_STYLES[p.tipo] || { background: "rgba(161,161,170,0.1)", color: "#a1a1aa" }}
        >
          {translateType(p.tipo, t)}
        </Badge>
      </TableCell>
      <TableCell className={`text-right tabular-nums text-foreground/80 hidden xl:table-cell ${cellPadding}`}>
        {p.unidades > 0 ? formatUnits(p.unidades) : "—"}
      </TableCell>
      <TableCell className={`text-right tabular-nums text-muted-foreground/80 hidden xl:table-cell ${cellPadding}`}>
        {p.precio_medio > 0
          ? (hideBalances ? "****" : formatCurrency(p.precio_medio, p.moneda, p.tipo === "Fondo Indexado" ? 4 : 2))
          : "—"}
      </TableCell>
      <TableCell className={`text-right tabular-nums ${cellPadding}`}>
        <div className="flex flex-col items-end gap-0.5">
          <LivePrice
            value={p.precio_actual_nativo !== null ? p.precio_actual_nativo : p.precio_actual}
            currency={p.precio_actual_nativo !== null ? (p.original_currency || p.moneda) : 'EUR'}
            hideBalances={hideBalances}
            isStale={p.price_is_stale}
            decimals={p.tipo === "Fondo Indexado" ? 4 : 2}
          />
          {p.price_kind === 'NAV' && (
            <span className="text-[10px] font-medium text-muted-foreground/70">
              NAV{formatNavDate(p.price_updated_at) ? ` · ${formatNavDate(p.price_updated_at)}` : ''}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className={`text-right tabular-nums text-foreground font-medium hidden xl:table-cell ${cellPadding}`}>
        <div className="flex flex-col items-end gap-1">
          <span>
            {hideBalances ? "****" : ((p.displayValue?.amount ?? null) !== null
              ? formatDisplay((p.displayValue?.amount ?? null))
              : "—")}
          </span>
          {!hideBalances && ((p.displayInvested?.amount ?? null) ?? p.displayCost.amount) > 0 && (
            <span className="text-[10px] text-muted-foreground/70 font-normal">
              Inv: {formatDisplay((p.displayInvested?.amount ?? null) ?? p.displayCost.amount)}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className={`text-right ${cellPadding}`}>
        <PnlDisplay 
          value={(p.displayDailyPnL?.amount ?? null)}
          type="currency" 
        />
      </TableCell>
      {!showPnlPercentOnly && (
        <TableCell className={`text-right ${cellPadding}`}>
          <PnlDisplay value={(p.displayPnl?.amount ?? null)} type="currency" />
        </TableCell>
      )}
      <TableCell className={`text-right ${showPnlPercentOnly ? "" : "hidden xl:table-cell"} ${cellPadding}`}>
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
}, (prev, next) => {
  return (
    prev.p.precio_actual === next.p.precio_actual &&
    prev.p.displayDailyPnL?.amount === next.p.displayDailyPnL?.amount &&
    prev.p.displayPnl?.amount === next.p.displayPnl?.amount &&
    prev.p.unidades === next.p.unidades &&
    prev.hideBalances === next.hideBalances &&
    prev.showPnlPercentOnly === next.showPnlPercentOnly &&
    prev.cellPadding === next.cellPadding
  )
})

const PositionCard = memo(function PositionCard({
  p,
  t,
  hideBalances,
  onAddTransaction,
  onEditAsset,
  setWaveAsset,
  setWaveModalOpen
}: any) {
  const { format: formatDisplay } = useDisplayCurrency()
  const hasHistory = p.sparkline && p.sparkline.length > 1;
  const sparklineColor = hasHistory
    ? (p.sparkline[p.sparkline.length - 1] >= p.sparkline[0] ? "#34d399" : "#fb7185")
    : "#71717a";

  const displaySymbol = (p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario") 
    ? (p.nombre?.split(' ')[0].toUpperCase() || "FONDO")
    : (p.ticker.length > 6 && p.nombre) ? p.nombre.split(' ')[0].toUpperCase() : p.ticker.split('.')[0];

  return (
    <div className="p-4 flex flex-col gap-3 hover:bg-muted/30 transition-colors">
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
          <span className="text-sm font-medium tabular-nums text-foreground/80 flex items-center gap-1">
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
            <span className="text-base font-bold tabular-nums text-foreground">
              {(p.displayValue?.amount ?? null) !== null ? formatDisplay((p.displayValue?.amount ?? null)) : "—"}
            </span>
            {((p.displayInvested?.amount ?? null) ?? p.displayCost.amount) > 0 && (
              <span className="text-[10px] text-muted-foreground/70 font-normal -mt-1">
                Inv: {formatDisplay((p.displayInvested?.amount ?? null) ?? p.displayCost.amount)}
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
            <PnlDisplay value={(p.displayPnl?.amount ?? null)} type="currency" />
            <span className="text-zinc-700 text-xs">|</span>
            <PnlDisplay value={p.pnl_percent} type="percent" />
          </div>
        </div>
        <div className="flex flex-col items-end mr-4">
          <span className="text-xs text-muted-foreground/80 mb-0.5">Hoy</span>
          <PnlDisplay 
            value={(p.displayDailyPnL?.amount ?? null)}
            type="currency" 
          />
        </div>
        
        <div className="flex items-center gap-2">
          {(() => {
            const assetNotes = parseAssetNotes(p.notas);
            const hasActiveWaves = assetNotes.waves.some(w => w.active);
            const hasTriggeredWave = hasActiveWaves && assetNotes.waves.some(w => {
              const currentPrice = w.currency === "USD"
                ? (p.precio_actual_usd ?? 0)
                : (p.precio_actual_nativo ?? p.precio_actual ?? 0);
              return w.active && ((w.type === "SELL" && currentPrice >= w.price) || (w.type === "BUY" && currentPrice <= w.price));
            });
            
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
}, (prev, next) => {
  return (
    prev.p.precio_actual === next.p.precio_actual &&
    prev.p.displayDailyPnL?.amount === next.p.displayDailyPnL?.amount &&
    prev.p.displayPnl?.amount === next.p.displayPnl?.amount &&
    prev.p.unidades === next.p.unidades &&
    prev.hideBalances === next.hideBalances
  )
})

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
  const [sortKey, setSortKey] = useState<SortKey>("displayValue")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    try {
      const savedKey = localStorage.getItem("silox_sortKey") as SortKey
      const savedDir = localStorage.getItem("silox_sortDir") as SortDir
      if (savedKey) setSortKey(savedKey)
      if (savedDir) setSortDir(savedDir)
    } catch (e) {}
  }, [])
  const [addAssetOpen, setAddAssetOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [waveModalOpen, setWaveModalOpen] = useState(false)
  const [waveAsset, setWaveAsset] = useState<EnrichedPosition | null>(null)

  const toggleSort = (key: SortKey) => {
    let newKey = key;
    let newDir = "desc" as SortDir;
    if (sortKey === key) {
      newDir = sortDir === "asc" ? "desc" : "asc";
      setSortDir(newDir);
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    try {
      localStorage.setItem("silox_sortKey", newKey)
      localStorage.setItem("silox_sortDir", newDir)
    } catch (e) {}
  }

  const filteredAndSorted = useMemo(() => {
    let list = positions.filter(p => 
      p.unidades > 0 && 
      !p.ticker.startsWith('CASH') && 
      !p.nombre?.toLowerCase().includes('efectivo') &&
      p.tipo !== 'Fondo Monetario'
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
      let av: number | string = -Infinity
      let bv: number | string = -Infinity
      
      if (sortKey === 'displayValue' || sortKey === 'displayPnl' || sortKey === 'displayDailyPnL') {
        av = a[sortKey]?.amount ?? -Infinity
        bv = b[sortKey]?.amount ?? -Infinity
      } else {
        av = a[sortKey] ?? -Infinity
        bv = b[sortKey] ?? -Infinity
      }

      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number)
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [positions, filter, searchQuery, sortKey, sortDir])

  const typesWithData = useMemo(() => {
    const types = new Set(positions.filter(p => p.tipo !== 'Fondo Monetario').map((p) => p.tipo))
    return types
  }, [positions])

  const sortableHeader = ({
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
        <ArrowUpDown
          className="h-3 w-3"
          style={{ color: sortKey === sortKeyName ? "var(--primary)" : undefined, opacity: sortKey === sortKeyName ? 1 : 0.4 }}
        />
      </span>
    </TableHead>
  )





  return (
    <Card className="animate-fade-in stagger-3 glass-card overflow-hidden w-full h-full flex flex-col relative z-10">
      <CardHeader className="p-2 md:p-3 flex flex-row flex-wrap items-center justify-between 2xl:justify-start gap-y-3 gap-x-2 border-b border-border/20 shrink-0">
        {/* 1. Title */}
        <CardTitle className="text-base font-medium text-foreground flex items-center gap-2 shrink-0">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="tracking-tight">{t('positions')}</span>
        </CardTitle>

        {/* 2. Buttons (Right aligned on narrow, far right on wide) */}
        <div className="flex items-center gap-1.5 shrink-0 2xl:order-4 2xl:ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setHelpOpen(true)}
            className="h-7 px-2 bg-transparent border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-200"
            title="Guía de uso"
          >
            <BookOpen className="h-3.5 w-3.5" />
          </Button>

          <RevolutSync>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 bg-transparent border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-200"
              title="Sincronizar extracto (CSV/Excel)"
            >
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:mr-1.5 shrink-0">
                <path d="M14.6541 21.0118H9.33644V14.1611H5L12 3L19 14.1611H14.6541V21.0118Z" fill="currentColor"/>
              </svg>
              <span className="text-[11px] hidden sm:inline">Importar</span>
            </Button>
          </RevolutSync>

          <Button
            size="sm"
            onClick={() => setAddAssetOpen(true)}
            className="h-7 px-2.5 transition-colors duration-200 text-white shadow-sm"
            style={{
              background: "linear-gradient(135deg, oklch(0.68 0.17 192), oklch(0.65 0.19 155))",
            }}
          >
            <Plus className="sm:mr-1.5 h-3.5 w-3.5" />
            <span className="text-[11px] hidden sm:inline">{t('add_asset')}</span>
          </Button>
        </div>

        {/* 3. Force line break on narrow screens */}
        <div className="w-full h-0 2xl:hidden order-3" />

        {/* 4. Search and Filters */}
        <div className="flex items-center gap-2 w-full 2xl:w-auto 2xl:flex-1 min-w-0 order-4 2xl:order-2">
          <div className="relative w-full sm:w-[150px] lg:w-[180px] shrink-0">
            <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-muted-foreground/60 transition-colors group-focus-within:text-primary/70" />
            <Input
              placeholder={t('search_asset')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-7 text-xs bg-muted/20 border-border/40 w-full rounded-md text-foreground focus-visible:ring-primary/30 focus-visible:bg-background transition-all hover:bg-muted/30"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto hide-scrollbar flex-1 items-center pb-0.5">
            {FILTER_OPTIONS.map((opt) => {
              const optText = opt === "Todos" ? t('filter_all') : translateType(opt, t);
              const disabled = opt !== "Todos" && !typesWithData.has(opt);
              return (
                <button
                  key={opt}
                  onClick={() => !disabled && setFilter(optText)}
                  disabled={disabled}
                  className={`px-2.5 py-1 text-xs rounded-full font-medium transition-all duration-200 border whitespace-nowrap ${
                    filter === opt
                      ? "bg-primary text-primary-foreground shadow-sm border-primary"
                      : disabled
                        ? "text-muted-foreground/30 border-transparent cursor-not-allowed hidden sm:block"
                        : "bg-transparent text-muted-foreground/80 border-border/50 hover:text-foreground hover:bg-muted/50 hover:border-border"
                  }`}
                >
                  {optText}
                </button>
              )
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-auto min-h-0 relative">
        {/* Desktop View (Table) */}
        <div className="hidden md:block w-full h-full">
          <Table className="w-full relative">
            <TableHeader className="bg-muted/40 sticky top-0 z-10 shadow-sm">
              <TableRow className="border-border/50 hover:bg-transparent">
                {sortableHeader({ label: t('symbol'), sortKeyName: "ticker", className: "pl-4 sm:pl-6" })}
                <TableHead className="text-muted-foreground/80 hidden xl:table-cell">{t('name')}</TableHead>
                {sortableHeader({ label: t('dist_type'), sortKeyName: "tipo", className: "hidden xl:table-cell" })}
                {sortableHeader({ label: t('units'), sortKeyName: "unidades", className: "text-right hidden xl:table-cell" })}
                <TableHead className="text-muted-foreground/80 text-right hidden xl:table-cell">{t('purchase_price')}</TableHead>
                <TableHead className="text-muted-foreground/80 text-right">{t('current_price')}</TableHead>
                {sortableHeader({ label: t('value'), sortKeyName: "displayValue", className: "text-right whitespace-nowrap hidden xl:table-cell" })}
                {sortableHeader({ label: t('today'), sortKeyName: "displayDailyPnL", className: "text-right" })}
                {!showPnlPercentOnly && sortableHeader({ label: "P&L", sortKeyName: "displayPnl", className: "text-right" })}
                {sortableHeader({ label: "P&L %", sortKeyName: "pnl_percent", className: `text-right ${showPnlPercentOnly ? "" : "hidden xl:table-cell"}` })}
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
                filteredAndSorted.map((p) => (
                  <PositionRow
                    key={p.activo_id}
                    p={p}
                    t={t}
                    hideBalances={hideBalances}
                    cellPadding={cellPadding}
                    showPnlPercentOnly={showPnlPercentOnly}
                    onAddTransaction={onAddTransaction}
                    onEditAsset={onEditAsset}
                    setWaveAsset={setWaveAsset}
                    setWaveModalOpen={setWaveModalOpen}
                  />
                ))
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
            filteredAndSorted.map((p) => (
              <PositionCard
                key={p.activo_id}
                p={p}
                t={t}
                hideBalances={hideBalances}
                onAddTransaction={onAddTransaction}
                onEditAsset={onEditAsset}
                setWaveAsset={setWaveAsset}
                setWaveModalOpen={setWaveModalOpen}
              />
            ))
          )}
        </div>
      </CardContent>
      <AddAssetModal open={addAssetOpen} onOpenChange={setAddAssetOpen} />
      <HelpGuideModal open={helpOpen} onOpenChange={setHelpOpen} />

      <WaveTrackerModal open={waveModalOpen} onOpenChange={setWaveModalOpen} position={waveAsset} onSuccess={() => {
        // Trigger a refresh of the page or let SWR handle it if needed
        window.location.reload()
      }} />
    </Card>
  )
}
