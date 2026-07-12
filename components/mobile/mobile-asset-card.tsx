"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import type { EnrichedPosition } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { usePreferences } from "@/lib/stores/use-preferences"
import { useQuickAdd } from "@/lib/stores/use-quick-add"
import { ChevronRight, Plus } from "lucide-react"
import { motion, PanInfo, useMotionValue, useTransform, animate } from "framer-motion"
import { hapticFeedback } from "@/lib/utils/haptics"

interface MobileAssetCardProps {
  position: EnrichedPosition
  totalPortfolioValue: number
}

// Type configuration with wealth-teal-aware palette
const TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  "ETF":              { color: "oklch(0.60 0.17 270)", label: "ETF"       },
  "Fondo Indexado":   { color: "oklch(0.65 0.17 310)", label: "Fondo"     },
  "Fondo Monetario":  { color: "oklch(0.72 0.18 192)", label: "Monetario" },
  "Acción":           { color: "oklch(0.72 0.15 55)",  label: "Acción"    },
  "Crypto":           { color: "oklch(0.70 0.18 30)",  label: "Crypto"    },
  "Metal":            { color: "oklch(0.70 0.06 75)",  label: "Metal"     },
  "Liquidez":         { color: "oklch(0.60 0.016 230)",label: "Efectivo"  },
}

// How many px to swipe left before the action triggers
const SWIPE_THRESHOLD = 64
const MAX_SWIPE = 80

export const MobileAssetCard = React.memo(function MobileAssetCard({
  position: p,
  totalPortfolioValue,
}: MobileAssetCardProps) {
  const { hideBalances, compactView } = usePreferences()
  const { openWithAsset } = useQuickAdd()
  const [isSwiped, setIsSwiped] = useState(false)
  const x = useMotionValue(0)
  const actionOpacity = useTransform(x, [-MAX_SWIPE, -SWIPE_THRESHOLD / 2], [1, 0])
  const actionScale = useTransform(x, [-MAX_SWIPE, -SWIPE_THRESHOLD], [1, 0.8])

  const change24h     = p.change_percent_24h ?? 0
  const is24hPositive = change24h >= 0

  const cfg = TYPE_CONFIG[p.tipo] ?? { color: "oklch(0.60 0.016 230)", label: p.tipo }

  // Portfolio weight (0–100)
  const weight =
    totalPortfolioValue > 0 && p.valor_actual !== null
      ? Math.min(100, (p.valor_actual / totalPortfolioValue) * 100)
      : 0

  const displayTicker =
    p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario"
      ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
      : p.ticker.split(".")[0]

  const displayName =
    p.nombre
      ?.replace(/\b(fund|index|world|acc|eur|hedged|p-acc)\b/gi, "")
      .trim() || displayTicker

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) {
      // Snap to revealed position
      animate(x, -MAX_SWIPE, { type: "spring", stiffness: 400, damping: 30 })
      setIsSwiped(true)
      hapticFeedback.medium()
    } else {
      // Snap back
      animate(x, 0, { type: "spring", stiffness: 400, damping: 30 })
      setIsSwiped(false)
    }
  }

  const handleSnapBack = () => {
    animate(x, 0, { type: "spring", stiffness: 400, damping: 30 })
    setIsSwiped(false)
  }

  const handleActionPress = () => {
    hapticFeedback.heavy()
    handleSnapBack()
    openWithAsset(p)
  }

  // Compact mode (unchanged)
  if (compactView) {
    return (
      <Link href={`/activo/${p.activo_id}`} className="block">
        <div
          className="mx-3 mb-2 flex items-center gap-3 rounded-lg border border-border/60 bg-card/70 px-3 py-2.5 transition-colors active:opacity-70"
        >
          {/* Avatar dot */}
          <div
            className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 font-bold text-[10px]"
            style={{
              background: `${cfg.color.replace(")", " / 0.12)")}`,
              color: cfg.color,
              border: `1px solid ${cfg.color.replace(")", " / 0.20)")}`,
            }}
          >
            {displayTicker.slice(0, 2)}
          </div>

          <span
            className="text-[13px] font-semibold flex-1 truncate"
            style={{ color: "var(--foreground)" }}
          >
            {displayTicker}
          </span>

          <div className="flex flex-col items-end">
            <span className="text-[13px] font-bold font-tabular" style={{ color: "var(--foreground)" }}>
              {hideBalances ? "••••" : formatCurrency(p.valor_actual ?? 0)}
            </span>
            <span
              className="text-[10px] font-semibold font-tabular"
              style={{ color: is24hPositive ? "oklch(0.70 0.21 155)" : "oklch(0.65 0.22 22)" }}
            >
              {hideBalances ? "•••" : formatPercent(change24h)}
            </span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="relative mx-3 mb-2 overflow-hidden rounded-lg">
      {/* Swipe-left action reveal layer */}
      <motion.div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center px-4"
        style={{
          background: "linear-gradient(90deg, transparent, color-mix(in oklch, var(--primary) 18%, transparent))",
          opacity: actionOpacity,
          width: MAX_SWIPE + 20,
        }}
        onClick={handleActionPress}
      >
        <motion.div
          className="flex flex-col items-center gap-1"
          style={{ scale: actionScale }}
        >
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{
              background: "var(--primary)",
              boxShadow: "0 4px 14px color-mix(in oklch, var(--primary) 38%, transparent)",
            }}
          >
            <Plus className="w-5 h-5 text-primary-foreground" strokeWidth={3} />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--primary)" }}>
            Añadir
          </span>
        </motion.div>
      </motion.div>

      {/* Card content — draggable */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -MAX_SWIPE, right: 0 }}
        dragElastic={0.05}
        onDragEnd={handleDragEnd}
        onClick={isSwiped ? handleSnapBack : undefined}
        style={{ x }}
        className="relative"
      >
        <Link href={isSwiped ? "#" : `/activo/${p.activo_id}`} className="block" onClick={isSwiped ? (e) => { e.preventDefault(); handleSnapBack() } : undefined}>
          <motion.div
            whileTap={isSwiped ? undefined : { scale: 0.97, opacity: 0.85 }}
            className="mobile-panel relative overflow-hidden px-3.5 py-3.5 transition-colors"
          >
            <div
              className="absolute left-0 top-0 h-full w-1"
              style={{ background: cfg.color }}
            />

            <div className="flex items-start gap-3">
              {/* Asset avatar — colored by type */}
              <div
                className="h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0 font-extrabold text-[13px]"
                style={{
                  background: `color-mix(in oklch, ${cfg.color} 13%, var(--card))`,
                  color: cfg.color,
                  border: `1px solid color-mix(in oklch, ${cfg.color} 28%, transparent)`,
                }}
              >
                {displayTicker.slice(0, 2)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="truncate text-[15px] font-extrabold tracking-normal"
                        style={{ color: "var(--foreground)" }}
                      >
                        {displayTicker}
                      </span>
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.08em]"
                        style={{
                          color: cfg.color,
                          background: `color-mix(in oklch, ${cfg.color} 10%, transparent)`,
                        }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
                      {displayName}
                    </p>
                  </div>
                  <ChevronRight
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: "var(--muted-foreground)", opacity: 0.35 }}
                  />
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="mobile-caption">Valor</p>
                    <p
                      className="mobile-value mt-0.5 truncate text-[17px] font-extrabold leading-none"
                      style={{ color: "var(--foreground)" }}
                    >
                      {hideBalances
                        ? "••••"
                        : p.valor_actual !== null
                        ? formatCurrency(p.valor_actual)
                        : "—"}
                    </p>
                  </div>

                  <div className="flex flex-col items-end">
                    <p className="mobile-caption">Hoy</p>
                    <div
                      className="mt-0.5 rounded px-2 py-1"
                      style={{
                        background: is24hPositive
                          ? "color-mix(in oklch, var(--positive) 12%, transparent)"
                          : "color-mix(in oklch, var(--negative) 12%, transparent)",
                      }}
                    >
                      <span
                        className="mobile-value text-[12px] font-extrabold"
                        style={{
                          color: is24hPositive ? "var(--positive)" : "var(--negative)",
                        }}
                      >
                        {hideBalances ? "•••" : formatPercent(change24h)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
                  <div
                    className="h-1.5 overflow-hidden rounded-full"
                    style={{ background: "color-mix(in oklch, var(--muted) 72%, transparent)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${weight}%`,
                        background: cfg.color,
                      }}
                    />
                  </div>
                  <span
                    className="mobile-value text-[10px] font-bold"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {weight.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </Link>
      </motion.div>
    </div>
  )
})
