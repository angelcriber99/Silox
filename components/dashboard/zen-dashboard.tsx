"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import type { EnrichedPosition } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { computePortfolioTotals } from "@/lib/api/assets"
import { motion, AnimatePresence } from "framer-motion"
import { usePreferences } from "@/lib/stores/use-preferences"
import { Minimize, TrendingUp, TrendingDown, Minus, Clock } from "lucide-react"

const TYPE_COLORS: Record<string, string> = {
  ETF: "#3b82f6",
  "Fondo Indexado": "#8b5cf6",
  "Fondo Monetario": "#06b6d4",
  Acción: "#f59e0b",
  Crypto: "#f97316",
  Liquidez: "#a1a1aa",
}

interface ZenDashboardProps {
  positions: EnrichedPosition[]
}

function ZenLiveValue({
  value,
  formatter,
  className = "",
  glow = true,
}: {
  value: number
  formatter: (v: number) => string
  className?: string
  glow?: boolean
}) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null)
  const prevValue = useRef(value)

  useEffect(() => {
    if (value !== prevValue.current) {
      setFlash(value > prevValue.current ? "up" : "down")
      const t = setTimeout(() => setFlash(null), 1500)
      prevValue.current = value
      return () => clearTimeout(t)
    }
  }, [value])

  const flashClasses =
    flash === "up"
      ? `text-emerald-400 ${glow ? "drop-shadow-[0_0_30px_rgba(52,211,153,0.6)]" : ""}`
      : flash === "down"
        ? `text-rose-400 ${glow ? "drop-shadow-[0_0_30px_rgba(251,113,133,0.6)]" : ""}`
        : ""

  return (
    <span className={`transition-all duration-1000 ${className} ${flashClasses}`}>
      {formatter(value)}
    </span>
  )
}

export function ZenDashboard({ positions }: ZenDashboardProps) {
  const { setZenMode } = usePreferences()
  const totals = useMemo(() => computePortfolioTotals(positions), [positions])
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const isPositive = totals.totalPnl24h >= 0

  // Sort positions: most volatile first, hide zero-movement
  const activePositions = useMemo(() => {
    return [...positions]
      .filter(p => p.unidades > 0 && (p.valor_actual ?? 0) > 0)
      .sort((a, b) => Math.abs(b.change_percent_24h ?? 0) - Math.abs(a.change_percent_24h ?? 0))
  }, [positions])

  const getDisplayTicker = (p: EnrichedPosition) => {
    if (p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario") {
      return p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
    }
    return p.ticker.split(".")[0]
  }

  return (
    <div className="flex flex-col w-full h-full min-h-[90vh] justify-center items-center animate-in fade-in duration-1000 relative overflow-hidden">

      {/* ── Background orbs ─────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0 bg-background/85 z-10" />
        <motion.div
          className="absolute top-[-15%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px]"
          style={{ background: isPositive
            ? "radial-gradient(circle, rgba(52,211,153,0.15) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(251,113,133,0.15) 0%, transparent 70%)"
          }}
          animate={{ x: [0, 80, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute bottom-[-15%] right-[-10%] w-[45vw] h-[45vw] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)" }}
          animate={{ x: [0, -60, 0], y: [0, -40, 0], scale: [1, 1.3, 1] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute top-[35%] left-[45%] w-[30vw] h-[30vw] rounded-full blur-[100px]"
          style={{ background: isPositive
            ? "radial-gradient(circle, rgba(52,211,153,0.08) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(251,113,133,0.08) 0%, transparent 70%)"
          }}
          animate={{ x: [0, -40, 30, 0], y: [0, 60, -30, 0], scale: [1, 1.1, 0.95, 1] }}
          transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* ── Exit button ─────────────────────────────────────────────── */}
      <motion.button
        onClick={() => setZenMode(false)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed top-5 right-5 p-3 rounded-2xl bg-card/40 hover:bg-card/70 border border-border/30 backdrop-blur-xl transition-all text-muted-foreground/50 hover:text-foreground z-50"
        title="Salir del Modo Zen"
      >
        <Minimize className="w-5 h-5" />
      </motion.button>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="relative z-20 flex flex-col w-full max-w-5xl items-center px-6">

        {/* Time */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 text-muted-foreground/40 mb-6"
        >
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium tracking-widest font-tabular">
            {time.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </motion.div>

        {/* Portfolio value — the hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="text-center mb-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">
            Valor del Portfolio
          </p>
          <h1 className="text-6xl md:text-[7rem] lg:text-[8.5rem] font-bold font-tabular tracking-tighter leading-none text-foreground">
            <ZenLiveValue value={totals.totalValue} formatter={formatCurrency} glow={true} />
          </h1>
        </motion.div>

        {/* Daily P&L */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-4 mb-12"
        >
          <div className={`flex items-center gap-2 text-2xl md:text-4xl font-bold font-tabular ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
            {isPositive ? <TrendingUp className="w-6 h-6 md:w-8 md:h-8" /> : <TrendingDown className="w-6 h-6 md:w-8 md:h-8" />}
            <ZenLiveValue
              value={totals.totalPnl24h}
              formatter={(v) => `${v >= 0 ? "+" : ""}${formatCurrency(v)}`}
              glow={true}
            />
          </div>
          <div className={`px-4 py-2 rounded-2xl text-lg md:text-2xl font-bold font-tabular border backdrop-blur-sm ${
            isPositive
              ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/5 border-rose-500/20 text-rose-400"
          }`}>
            <ZenLiveValue
              value={totals.totalPnlPercent24h}
              formatter={formatPercent}
              glow={false}
            />
          </div>
        </motion.div>

        {/* ── Positions feed ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-4xl"
        >
          <div className="bg-card/15 backdrop-blur-xl rounded-2xl border border-border/20 overflow-hidden">
            {/* Feed header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border/15">
              <div className="flex items-center gap-2 text-muted-foreground/40">
                <span className={`w-2 h-2 rounded-full ${isPositive ? "bg-emerald-400" : "bg-rose-400"} animate-pulse`} />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em]">Posiciones activas</span>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground/30 uppercase tracking-widest">
                {activePositions.length} activos
              </span>
            </div>

            {/* Position rows */}
            <div className="max-h-[400px] overflow-y-auto hide-scrollbar">
              {activePositions.map((p, i) => {
                const val = p.valor_actual ?? p.coste_total
                const percent = p.change_percent_24h ?? 0
                const pnl24h = val > 0 ? val - val / (1 + percent / 100) : 0
                const isPosPositive = percent >= 0

                const TrendIcon = percent > 0.01 ? TrendingUp : percent < -0.01 ? TrendingDown : Minus

                return (
                  <motion.div
                    key={p.activo_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.05 }}
                    className="flex items-center justify-between px-6 py-4 border-b border-border/10 last:border-0 hover:bg-card/20 transition-colors"
                  >
                    {/* Left: color bar + ticker */}
                    <div className="flex items-center gap-3 w-[180px]">
                      <div
                        className="w-1 h-8 rounded-full flex-shrink-0"
                        style={{ backgroundColor: TYPE_COLORS[p.tipo] ?? "#71717a" }}
                      />
                      <div>
                        <p className="text-[15px] font-bold tracking-tight text-foreground">
                          {getDisplayTicker(p)}
                        </p>
                        <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">
                          {p.tipo}
                        </p>
                      </div>
                    </div>

                    {/* Center: value */}
                    <div className="flex-1 text-right px-4">
                      <p className="text-[15px] font-semibold font-tabular text-foreground/80">
                        <ZenLiveValue value={val} formatter={formatCurrency} glow={false} />
                      </p>
                    </div>

                    {/* Right: change */}
                    <div className="flex items-center gap-3 w-[200px] justify-end">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border backdrop-blur-sm ${
                        isPosPositive
                          ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-400"
                          : "bg-rose-500/5 border-rose-500/15 text-rose-400"
                      }`}>
                        <TrendIcon className="w-3.5 h-3.5" />
                        <span className="text-[13px] font-bold font-tabular">
                          {formatPercent(percent)}
                        </span>
                      </div>
                      <span className={`text-[12px] font-medium font-tabular w-[80px] text-right ${isPosPositive ? "text-emerald-400/70" : "text-rose-400/70"}`}>
                        {pnl24h >= 0 ? "+" : ""}{formatCurrency(pnl24h)}
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
