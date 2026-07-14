"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import type { EnrichedPosition } from "@/lib/types"
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import { usePreferences } from "@/lib/stores/use-preferences"
import { useQuickAdd } from "@/lib/stores/use-quick-add"
import { Plus } from "lucide-react"
import { motion, PanInfo, useMotionValue, useTransform, animate } from "framer-motion"
import { hapticFeedback } from "@/lib/utils/haptics"

interface MobileAssetCardProps {
  position: EnrichedPosition
  totalPortfolioValue: number
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string; pill: string }> = {
  "ETF":             { color: "#0A84FF", bg: "rgba(10,132,255,0.13)",  label: "ETF",       pill: "rgba(10,132,255,0.20)"  },
  "Fondo Indexado":  { color: "#BF5AF2", bg: "rgba(191,90,242,0.13)", label: "Fondo",     pill: "rgba(191,90,242,0.20)"  },
  "Fondo Monetario": { color: "#32ADE6", bg: "rgba(50,173,230,0.13)", label: "Monetario", pill: "rgba(50,173,230,0.20)"  },
  "Acción":          { color: "#FFD60A", bg: "rgba(255,214,10,0.13)", label: "Acción",    pill: "rgba(255,214,10,0.20)"  },
  "Crypto":          { color: "#FF9F0A", bg: "rgba(255,159,10,0.13)", label: "Crypto",    pill: "rgba(255,159,10,0.20)"  },
  "Liquidez":        { color: "#98989D", bg: "rgba(152,152,157,0.13)",label: "Efectivo",  pill: "rgba(152,152,157,0.20)" },
}

const SWIPE_THRESHOLD = 64
const MAX_SWIPE = 80

export const MobileAssetCard = React.memo(function MobileAssetCard({
  position: p,
  totalPortfolioValue,
}: MobileAssetCardProps) {
  const { hideBalances, compactView } = usePreferences()
  const { openWithAsset } = useQuickAdd()
  const [isSwiped, setIsSwiped] = useState(false)
  const [imgError, setImgError] = useState(false)
  const x = useMotionValue(0)
  const actionOpacity = useTransform(x, [-MAX_SWIPE, -SWIPE_THRESHOLD / 2], [1, 0])
  const actionScale  = useTransform(x, [-MAX_SWIPE, -SWIPE_THRESHOLD], [1, 0.8])

  const pnlPercent    = p.pnl_percent ?? 0
  const isPositive    = pnlPercent >= 0
  const change24h     = p.change_percent_24h ?? 0
  const is24hPositive = change24h >= 0

  const cfg = TYPE_CONFIG[p.tipo] ?? { color: "#98989D", bg: "rgba(152,152,157,0.13)", label: p.tipo, pill: "rgba(152,152,157,0.20)" }

  const weight =
    totalPortfolioValue > 0 && p.valor_actual !== null
      ? Math.min(100, (p.valor_actual / totalPortfolioValue) * 100)
      : 0

  const displayTicker =
    p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario"
      ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
      : p.ticker.split(".")[0]

  const logoTicker = displayTicker.includes("-") ? displayTicker.split("-")[0] : displayTicker

  const displayName =
    p.nombre
      ?.replace(/\b(fund|index|world|acc|eur|hedged|p-acc)\b/gi, "")
      .trim() || displayTicker

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) {
      animate(x, -MAX_SWIPE, { type: "spring", stiffness: 400, damping: 30 })
      setIsSwiped(true)
      hapticFeedback.medium()
    } else {
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

  // ─── Compact mode ───────────────────────────────────────────────────────
  if (compactView) {
    return (
      <Link href={`/activo/${p.activo_id}`} className="block">
        <div
          className="flex items-center gap-3 px-4 py-2.5 transition-colors active:opacity-70"
          style={{ borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}
        >
          <div
            className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-[11px] overflow-hidden"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.pill}` }}
          >
            {imgError ? (
              displayTicker.slice(0, 2)
            ) : (
              <img
                src={`https://companiesmarketcap.com/img/company-logos/64/${logoTicker}.png`}
                alt={logoTicker}
                className="w-full h-full object-contain p-1"
                onError={() => setImgError(true)}
              />
            )}
          </div>
          <span className="text-[13px] font-semibold flex-1 truncate" style={{ color: "var(--foreground)" }}>
            {displayTicker}
          </span>
          <div className="flex flex-col items-end">
            <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
              {hideBalances ? "••••" : formatCurrency(p.valor_actual ?? 0)}
            </span>
            <span
              className="text-[10px] font-semibold tabular-nums"
              style={{ color: is24hPositive ? "#30D158" : "#FF453A" }}
            >
              {hideBalances ? "•••" : formatPercent(change24h)}
            </span>
          </div>
        </div>
      </Link>
    )
  }

  // ─── Full card ─────────────────────────────────────────────────────────
  return (
    <div className="relative overflow-hidden mx-4 mb-2.5">
      {/* Swipe action reveal */}
      <motion.div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center rounded-2xl"
        style={{
          background: "rgba(48,209,88,0.12)",
          opacity: actionOpacity,
          width: MAX_SWIPE + 20,
        }}
        onClick={handleActionPress}
      >
        <motion.div className="flex flex-col items-center gap-1" style={{ scale: actionScale }}>
          <div
            className="h-10 w-10 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, oklch(0.68 0.17 192), oklch(0.65 0.19 155))",
              boxShadow: "0 4px 14px rgba(48,209,88,0.40)",
            }}
          >
            <Plus className="w-5 h-5" style={{ color: "#FFFFFF" }} strokeWidth={3} />
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
      >
        <Link
          href={isSwiped ? "#" : `/activo/${p.activo_id}`}
          className="block"
          onClick={isSwiped ? (e) => { e.preventDefault(); handleSnapBack() } : undefined}
        >
          <motion.div
            whileTap={isSwiped ? undefined : { scale: 0.98, opacity: 0.90 }}
            className="px-4 py-4 rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "0.5px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex items-center gap-3.5">
              {/* Avatar */}
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-[15px] overflow-hidden relative"
                style={{
                  background: cfg.bg,
                  color: cfg.color,
                  border: `1.5px solid ${cfg.pill}`,
                  letterSpacing: "-0.02em",
                }}
              >
                {imgError ? (
                  displayTicker.slice(0, 2)
                ) : (
                  <img
                    src={`https://companiesmarketcap.com/img/company-logos/64/${logoTicker}.png`}
                    alt={logoTicker}
                    className="w-full h-full object-contain p-1.5 drop-shadow-md"
                    onError={() => setImgError(true)}
                  />
                )}
              </div>

              {/* Name + type + weight bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-[15px] font-bold tracking-tight"
                    style={{ color: "var(--foreground)", letterSpacing: "-0.01em" }}
                  >
                    {displayTicker}
                  </span>
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-[2px] rounded-md flex-shrink-0"
                    style={{ color: cfg.color, background: cfg.bg }}
                  >
                    {cfg.label}
                  </span>
                </div>

                {/* Full name (truncated) */}
                <p
                  className="text-[11px] font-medium truncate mb-2"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {displayName}
                </p>

                {/* Weight bar */}
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 h-[3px] rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.07)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${weight}%`,
                        background: `linear-gradient(90deg, ${cfg.color}, color-mix(in oklch, ${cfg.color} 60%, oklch(0.70 0.21 155)))`,
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-semibold flex-shrink-0 tabular-nums"
                    style={{ color: "rgba(255,255,255,0.30)" }}
                  >
                    {weight.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Right: value + change */}
              <div className="flex flex-col items-end flex-shrink-0 gap-1.5">
                <span
                  className="text-[16px] font-extrabold tabular-nums leading-tight"
                  style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}
                >
                  {hideBalances
                    ? "••••"
                    : p.valor_actual !== null
                    ? formatCurrency(p.valor_actual)
                    : "—"}
                </span>

                {/* 24h change badge */}
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg"
                  style={{
                    background: is24hPositive ? "rgba(48,209,88,0.12)" : "rgba(255,69,58,0.12)",
                  }}
                >
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{ color: is24hPositive ? "#30D158" : "#FF453A" }}
                  >
                    {hideBalances ? "•••" : (
                      <>
                        {p.change_amount_24h != null && p.change_amount_24h !== 0
                          ? `${formatPnl(p.change_amount_24h)} `
                          : ""}
                        {formatPercent(change24h)}
                      </>
                    )}
                  </span>
                </div>

                {/* Total PnL */}
                <span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{ color: isPositive ? "rgba(48,209,88,0.7)" : "rgba(255,69,58,0.7)" }}
                >
                  {hideBalances ? "•••" : formatPnl(p.pnl ?? 0)}
                </span>
              </div>
            </div>
          </motion.div>
        </Link>
      </motion.div>
    </div>
  )
})
