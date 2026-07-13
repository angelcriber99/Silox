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
const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  "ETF":              { color: "#0A84FF", bg: "rgba(10,132,255,0.12)",  label: "ETF"       },
  "Fondo Indexado":   { color: "#BF5AF2", bg: "rgba(191,90,242,0.12)", label: "Fondo"     },
  "Fondo Monetario":  { color: "#32ADE6", bg: "rgba(50,173,230,0.12)", label: "Monetario" },
  "Acción":           { color: "#FFD60A", bg: "rgba(255,214,10,0.12)", label: "Acción"    },
  "Crypto":           { color: "#FF9F0A", bg: "rgba(255,159,10,0.12)", label: "Crypto"    },
  "Liquidez":         { color: "#98989D", bg: "rgba(152,152,157,0.12)",label: "Efectivo"  },
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

  const pnlPercent    = p.pnl_percent ?? 0
  const isPositive    = pnlPercent >= 0
  const change24h     = p.change_percent_24h ?? 0
  const is24hPositive = change24h >= 0

  const cfg = TYPE_CONFIG[p.tipo] ?? { color: "#98989D", bg: "rgba(152,152,157,0.12)", label: p.tipo }

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

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
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
          className="flex items-center gap-3 px-4 py-2.5 transition-colors active:opacity-70"
          style={{ borderBottom: "1px solid oklch(0.165 0.016 238 / 0.4)" }}
        >
          {/* Avatar dot */}
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-[10px]"
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
            <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
              {hideBalances ? "••••" : formatCurrency(p.valor_actual ?? 0)}
            </span>
            <span
              className="text-[10px] font-semibold tabular-nums"
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
    <div className="relative overflow-hidden" style={{ borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
      {/* Swipe-left action reveal layer */}
      <motion.div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center px-4"
        style={{
          background: "rgba(48,209,88,0.15)",
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
            className="h-10 w-10 rounded-2xl flex items-center justify-center"
            style={{
              background: "#30D158",
              boxShadow: "0 4px 14px rgba(48,209,88,0.45)",
            }}
          >
            <Plus className="w-5 h-5" style={{ color: "#000000" }} strokeWidth={3} />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#30D158" }}>
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
            className="px-4 py-3.5 transition-colors relative"
            style={{ background: "var(--background)" }}
          >
            <div className="flex items-center gap-3.5">
              {/* Asset avatar — colored by type */}
              <div
                className="h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold text-[13px]"
                style={{
                  background: cfg.bg,
                  color: cfg.color,
                  border: `1.5px solid ${cfg.bg}`,
                }}
              >
                {displayTicker.slice(0, 2)}
              </div>

              {/* Name + type badge */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-[15px] font-bold tracking-tight truncate"
                    style={{ color: "var(--foreground)" }}
                  >
                    {displayTicker}
                  </span>
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md flex-shrink-0"
                    style={{
                      color: cfg.color,
                      background: cfg.bg,
                    }}
                  >
                    {cfg.label}
                  </span>
                </div>

                {/* Weight bar */}
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="flex-1 h-1 rounded-full overflow-hidden"
                    style={{ background: "var(--muted)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${weight}%`,
                        background: `linear-gradient(90deg, ${cfg.color}, color-mix(in oklch, ${cfg.color} 70%, oklch(0.70 0.21 155)))`,
                      }}
                    />
                  </div>
                  <span
                    className="text-[9px] font-semibold flex-shrink-0"
                    style={{ color: "var(--muted-foreground)", opacity: 0.55 }}
                  >
                    {weight.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Value + 24h change */}
              <div className="flex flex-col items-end flex-shrink-0 gap-1">
                <span
                  className="text-[15px] font-bold tabular-nums leading-tight"
                  style={{ color: "var(--foreground)" }}
                >
                  {hideBalances
                    ? "••••"
                    : p.valor_actual !== null
                    ? formatCurrency(p.valor_actual)
                    : "—"}
                </span>

                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg"
                  style={{
                    background: is24hPositive ? "rgba(48,209,88,0.12)" : "rgba(255,69,58,0.12)",
                  }}
                >
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{
                      color: is24hPositive ? "#30D158" : "#FF453A",
                    }}
                  >
                    {hideBalances ? "•••" : (
                      <>
                        {p.change_amount_24h !== undefined && p.change_amount_24h !== null && p.change_amount_24h !== 0
                          ? `${p.change_amount_24h > 0 ? "+" : ""}${formatCurrency(p.change_amount_24h)} `
                          : ""}
                        {formatPercent(change24h)}
                      </>
                    )}
                  </span>
                </div>
              </div>

              <ChevronRight
                className="w-4 h-4 flex-shrink-0"
                style={{ color: "var(--muted-foreground)", opacity: 0.25 }}
              />
            </div>
          </motion.div>
        </Link>
      </motion.div>
    </div>
  )
})
