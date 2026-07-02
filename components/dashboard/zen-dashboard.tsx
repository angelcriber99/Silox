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
  marketState?: string
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

export function ZenDashboard({ positions, marketState }: ZenDashboardProps) {
  const { setZenMode } = usePreferences()
  const totals = useMemo(() => computePortfolioTotals(positions), [positions])
  const [time, setTime] = useState(new Date())
  const [memeMode, setMemeMode] = useState(false)

  const memeConfigs = useMemo(() => {
    return [
      "🚀", "🦄", "🎉", "💎🙌", "🦍", "🍾", "📈", "🌈", "🍗", "🤡", "✨", "💸", "🔥", "🚀", "🦍", "🦄", "🍾", "📈", "💸",
      "/memes/stonks.gif",
      "/memes/doge.gif",
      "/memes/nyan.gif",
      "/memes/catjam.gif"
    ].map(emoji => ({
      emoji,
      startX: `${Math.random() * 100}vw`,
      midX: `${Math.random() * 100}vw`,
      endX: `${Math.random() * 100}vw`,
      startY: `${Math.random() * 100}vh`,
      midY: `${Math.random() * 100}vh`,
      endY: `${Math.random() * 100}vh`,
      duration: 20 + Math.random() * 20
    }))
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const isPositive = totals.totalPnl24h >= 0

  // Sort positions: most volatile first, hide zero-movement
  const activePositions = useMemo(() => {
    return [...positions]
      .filter(p => p.unidades > 0 && (p.valor_actual ?? 0) > 0 && p.tipo !== 'Liquidez' && p.ticker !== 'CASH')
      .sort((a, b) => Math.abs(b.change_percent_24h ?? 0) - Math.abs(a.change_percent_24h ?? 0))
  }, [positions])

  const getDisplayTicker = (p: EnrichedPosition) => {
    if (p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario") {
      return p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
    }
    return p.ticker.split(".")[0]
  }

  const isMarketOpen = marketState === "REGULAR" || marketState === "PRE" || marketState === "POST"

  return (
    <div className="flex flex-col w-full h-full min-h-[90vh] justify-center items-center animate-in fade-in duration-1000 relative overflow-hidden">

      {/* ── Background orbs ─────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0 bg-background/85 z-10" />
        <motion.div
          className="absolute top-[-15%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px]"
          style={{ background: memeMode 
            ? "radial-gradient(circle, rgba(255,215,0,0.4) 0%, transparent 70%)"
            : isPositive
              ? "radial-gradient(circle, rgba(52,211,153,0.15) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(251,113,133,0.15) 0%, transparent 70%)"
          }}
          animate={{ x: [0, 80, 0], y: [0, 40, 0], scale: [1, 1.15, 1], rotate: memeMode ? [0, 360] : 0 }}
          transition={{ duration: memeMode ? 5 : 25, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute bottom-[-15%] right-[-10%] w-[45vw] h-[45vw] rounded-full blur-[120px]"
          style={{ background: memeMode
            ? "radial-gradient(circle, rgba(255,105,180,0.4) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)" 
          }}
          animate={{ x: [0, -60, 0], y: [0, -40, 0], scale: [1, 1.3, 1], rotate: memeMode ? [360, 0] : 0 }}
          transition={{ duration: memeMode ? 7 : 30, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute top-[35%] left-[45%] w-[30vw] h-[30vw] rounded-full blur-[100px]"
          style={{ background: memeMode
            ? "radial-gradient(circle, rgba(0,255,255,0.4) 0%, transparent 70%)"
            : isPositive
              ? "radial-gradient(circle, rgba(52,211,153,0.08) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(251,113,133,0.08) 0%, transparent 70%)"
          }}
          animate={{ x: [0, -40, 30, 0], y: [0, 60, -30, 0], scale: [1, 1.1, 0.95, 1], rotate: memeMode ? [0, -360] : 0 }}
          transition={{ duration: memeMode ? 4 : 35, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* ── Meme Emojis ─────────────────────────────────────────────── */}
      {memeMode && (
        <div className="absolute inset-0 pointer-events-none z-15 overflow-hidden">
          {memeConfigs.map((config, i) => (
              <motion.div
                key={i}
                className={`absolute opacity-60 flex items-center justify-center ${config.emoji.includes("/") ? "" : "drop-shadow-[0_0_20px_rgba(255,255,255,0.7)]"}`}
                style={{ willChange: "transform" }}
                initial={{ x: config.startX, y: config.startY, scale: 0 }}
                animate={{ 
                  x: [config.startX, config.midX, config.endX, config.midX, config.startX],
                  y: [config.startY, config.midY, config.endY, config.midY, config.startY],
                  rotate: config.emoji.includes("/") ? 0 : [0, 90, 180, 270, 360],
                  scale: config.emoji.includes("/") ? [0.8, 1.2, 0.8, 1.2, 0.8] : [0.8, 1.5, 0.8, 1.5, 0.8]
                }}
                transition={{ duration: config.duration, repeat: Infinity, ease: "linear" }}
              >
                {config.emoji.includes("/") ? (
                  <img src={config.emoji} className="w-32 h-32 md:w-48 md:h-48 object-contain" alt="meme" />
                ) : (
                  <span className="text-5xl md:text-7xl">{config.emoji}</span>
                )}
              </motion.div>
          ))}
        </div>
      )}

      {/* ── Mode buttons ─────────────────────────────────────────────── */}
      <div className="fixed top-5 right-5 flex items-center gap-3 z-50">
        <motion.button
          onClick={() => setMemeMode(!memeMode)}
          whileHover={{ scale: 1.1, rotate: memeMode ? -10 : 10 }}
          whileTap={{ scale: 0.9 }}
          className={`p-3 rounded-2xl border border-border/30 backdrop-blur-xl transition-all shadow-lg ${
            memeMode 
              ? "bg-gradient-to-r from-amber-500/30 to-rose-500/30 text-white border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.4)]" 
              : "bg-card/40 hover:bg-card/70 text-muted-foreground/50 hover:text-foreground"
          }`}
          title="Modo Locura"
        >
          <span className="text-xl leading-none block">🦄</span>
        </motion.button>

        <motion.button
          onClick={() => setZenMode(false)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="p-3 rounded-2xl bg-card/40 hover:bg-card/70 border border-border/30 backdrop-blur-xl transition-all text-muted-foreground/50 hover:text-foreground"
          title="Salir del Modo Zen"
        >
          <Minimize className="w-5 h-5" />
        </motion.button>
      </div>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="relative z-20 flex flex-col w-full max-w-5xl items-center px-6">

        {/* Time and Market Status */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-4 mb-6"
        >
          <div className="flex items-center gap-2 text-muted-foreground/40">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium tracking-widest font-tabular">
              {time.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
          {marketState && (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
              isMarketOpen 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                : "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isMarketOpen ? "bg-emerald-400 animate-pulse" : "bg-zinc-400"}`} />
              {marketState === "REGULAR" ? "Mercado Abierto" : marketState === "PRE" ? "Pre-Market" : marketState === "POST" ? "After-Hours" : "Mercado Cerrado"}
            </div>
          )}
        </motion.div>

        {/* Portfolio value — the hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="text-center mb-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">
            {memeMode ? "🚀 TO THE MOON PORTFOLIO 🚀" : "Valor del Portfolio"}
          </p>
          <h1 className={`text-6xl md:text-[7rem] lg:text-[8.5rem] font-bold font-tabular tracking-tighter leading-none ${isPositive ? 'text-emerald-400' : 'text-rose-400'} ${memeMode ? 'drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]' : ''}`}>
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

        {/* ── Positions feeds ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-xl mx-auto"
        >
          {/* Daily Movers Feed */}
          <motion.div 
            className={`backdrop-blur-xl rounded-2xl border overflow-hidden flex flex-col h-[400px] ${memeMode ? 'bg-card/30' : 'bg-card/15 border-border/20'}`}
            animate={memeMode ? { 
              boxShadow: [
                "0 0 20px 0px rgba(255,0,0,0.5)",
                "0 0 20px 0px rgba(255,165,0,0.5)",
                "0 0 20px 0px rgba(255,255,0,0.5)",
                "0 0 20px 0px rgba(0,128,0,0.5)",
                "0 0 20px 0px rgba(0,0,255,0.5)",
                "0 0 20px 0px rgba(75,0,130,0.5)",
                "0 0 20px 0px rgba(238,130,238,0.5)",
                "0 0 20px 0px rgba(255,0,0,0.5)"
              ],
              borderColor: [
                "rgba(255,0,0,1)", "rgba(255,165,0,1)", "rgba(255,255,0,1)", 
                "rgba(0,128,0,1)", "rgba(0,0,255,1)", "rgba(75,0,130,1)", 
                "rgba(238,130,238,1)", "rgba(255,0,0,1)"
              ]
            } : { boxShadow: "none", borderColor: "rgba(255,255,255,0.1)" }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            {/* Feed header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border/15 shrink-0">
              <div className="flex items-center gap-2 text-muted-foreground/40">
                <span className={`w-2 h-2 rounded-full ${isPositive ? "bg-emerald-400" : "bg-rose-400"} animate-pulse`} />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em]">Movimientos 24h</span>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground/30 uppercase tracking-widest">
                Top Volatilidad
              </span>
            </div>

            {/* Position rows */}
            <div className="flex-1 overflow-y-auto hide-scrollbar">
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
                    <div className="flex items-center gap-3 w-[150px]">
                      <div
                        className="w-1 h-8 rounded-full flex-shrink-0"
                        style={{ backgroundColor: TYPE_COLORS[p.tipo] ?? "#71717a" }}
                      />
                      <div>
                        <p className="text-[15px] font-bold tracking-tight text-foreground truncate max-w-[120px]">
                          {getDisplayTicker(p)}
                        </p>
                        <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">
                          {p.tipo}
                        </p>
                      </div>
                    </div>

                    {/* Right: change */}
                    <div className="flex items-center gap-3 justify-end flex-1">
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
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
