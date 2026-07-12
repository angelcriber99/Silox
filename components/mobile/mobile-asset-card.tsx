"use client"

import React, { useState } from "react"
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

const TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  "ETF":              { color: "var(--mobile-blue)",     label: "ETF"       },
  "Fondo Indexado":   { color: "var(--mobile-positive)", label: "Fondo"     },
  "Fondo Monetario":  { color: "var(--mobile-amber)",    label: "Monetario" },
  "Acción":           { color: "var(--mobile-ink)",      label: "Acción"    },
  "Crypto":           { color: "var(--mobile-negative)", label: "Crypto"    },
  "Metal":            { color: "var(--mobile-metal)",    label: "Metal"     },
  "Liquidez":         { color: "var(--mobile-muted)",    label: "Efectivo"  },
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

  const cfg = TYPE_CONFIG[p.tipo] ?? { color: "var(--mobile-muted)", label: p.tipo }

  // Portfolio weight (0–100)
  const weight =
    totalPortfolioValue > 0 && p.valor_actual !== null
      ? Math.min(100, (p.valor_actual / totalPortfolioValue) * 100)
      : 0

  const displayTicker =
    p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario"
      ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
      : p.ticker.split(".")[0]

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

  if (compactView) {
    return (
      <Link href={`/activo/${p.activo_id}`} className="block">
        <div
          className="flex items-center gap-3 border-b border-[var(--mobile-line)] bg-[var(--mobile-canvas)] px-5 py-2.5 transition-colors active:bg-[var(--mobile-paper)]"
        >
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center border font-black text-[10px]"
            style={{
              background: "var(--mobile-paper)",
              color: cfg.color,
              borderColor: "var(--mobile-line)",
            }}
          >
            {displayTicker.slice(0, 2)}
          </div>

          <span
            className="flex-1 truncate text-[13px] font-black text-[var(--mobile-ink)]"
          >
            {displayTicker}
          </span>

          <div className="flex flex-col items-end">
            <span className="font-tabular text-[13px] font-black text-[var(--mobile-ink)]">
              {hideBalances ? "••••" : formatCurrency(p.valor_actual ?? 0)}
            </span>
            <span
              className="font-tabular text-[10px] font-bold"
              style={{ color: is24hPositive ? "var(--mobile-positive)" : "var(--mobile-negative)" }}
            >
              {hideBalances ? "•••" : formatPercent(change24h)}
            </span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="relative overflow-hidden border-b border-[var(--mobile-line)] bg-[var(--mobile-canvas)]">
      <motion.div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center px-4"
        style={{
          background: "linear-gradient(90deg, transparent, color-mix(in oklch, var(--mobile-positive) 18%, transparent))",
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
            className="flex h-10 w-10 items-center justify-center"
            style={{
              background: "var(--mobile-positive)",
              boxShadow: "0 8px 18px color-mix(in oklch, var(--mobile-positive) 28%, transparent)",
            }}
          >
            <Plus className="h-5 w-5 text-white" strokeWidth={3} />
          </div>
          <span className="text-[9px] font-black uppercase text-[var(--mobile-positive)]">
            Añadir
          </span>
        </motion.div>
      </motion.div>

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
            className="relative bg-[var(--mobile-canvas)] px-5 py-3.5 transition-colors active:bg-[var(--mobile-paper)]"
          >
            <div className="flex items-center gap-3.5">
              <div
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center border font-black text-[13px]"
                style={{
                  background: "var(--mobile-paper)",
                  color: cfg.color,
                  borderColor: "var(--mobile-line)",
                }}
              >
                {displayTicker.slice(0, 2)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="truncate text-[15px] font-black text-[var(--mobile-ink)]"
                  >
                    {displayTicker}
                  </span>
                  <span
                    className="flex-shrink-0 border border-[var(--mobile-line)] bg-[var(--mobile-paper)] px-1.5 py-0.5 text-[9px] font-black uppercase"
                    style={{
                      color: cfg.color,
                    }}
                  >
                    {cfg.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="h-1 flex-1 overflow-hidden bg-[var(--mobile-line)]"
                  >
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${weight}%`,
                        background: cfg.color,
                      }}
                    />
                  </div>
                  <span
                    className="flex-shrink-0 font-tabular text-[9px] font-bold text-[var(--mobile-muted)]"
                  >
                    {weight.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end flex-shrink-0 gap-1">
                <span
                  className="font-tabular text-[15px] font-black leading-tight text-[var(--mobile-ink)]"
                >
                  {hideBalances
                    ? "••••"
                    : p.valor_actual !== null
                    ? formatCurrency(p.valor_actual)
                    : "—"}
                </span>

                <div
                  className="flex items-center gap-1 border px-2 py-0.5"
                  style={{
                    background: "var(--mobile-paper)",
                    borderColor: "var(--mobile-line)",
                  }}
                >
                  <span
                    className="font-tabular text-[11px] font-black"
                    style={{
                      color: is24hPositive ? "var(--mobile-positive)" : "var(--mobile-negative)",
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
                style={{ color: "var(--mobile-muted)", opacity: 0.45 }}
              />
            </div>
          </motion.div>
        </Link>
      </motion.div>
    </div>
  )
})
