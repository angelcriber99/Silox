"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import { Activity, TrendingUp, TrendingDown, LogOut, BarChart2, Eye, EyeOff, RefreshCw } from "lucide-react"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import { formatPercent, formatPnl } from "@/lib/utils/formatters"
import { MobileAssetCard } from "@/components/mobile/mobile-asset-card"
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts"
import { usePreferences } from "@/lib/stores/use-preferences"
import { playSound } from "@/lib/utils/sounds"
import { hapticFeedback } from "@/lib/utils/haptics"
import { PerformanceModal } from "@/components/dashboard/performance-modal"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { motion, useScroll, useTransform, useAnimation } from "framer-motion"

interface MobileDashboardProps {
  positions: EnrichedPosition[]
  totals: PortfolioTotals
  isLoading: boolean
}

export function MobileDashboard({
  positions,
  totals,
  isLoading,
}: MobileDashboardProps) {
  const { zenMode, setZenMode, soundEffects, hideBalances } = usePreferences()
  const [performanceOpen, setPerformanceOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const isPositive = totals.totalPnl >= 0
  const pnlColor = isPositive ? "text-emerald-400" : "text-rose-400"
  const PnlIcon = isPositive ? TrendingUp : TrendingDown

  // Scroll animations
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll()
  const bigNumberScale = useTransform(scrollY, [0, 100], [1, 0.9])
  const bigNumberOpacity = useTransform(scrollY, [0, 100], [1, 0.4])
  
  // Pull to refresh animation
  const refreshControls = useAnimation()

  const handleRefresh = async () => {
    if (isRefreshing) return
    hapticFeedback.medium()
    setIsRefreshing(true)
    refreshControls.start({ rotate: 360, transition: { repeat: Infinity, duration: 1, ease: "linear" } })
    
    // Simulate refresh (In real life, this would call mutate() from SWR/ReactQuery or router.refresh())
    await new Promise(r => setTimeout(r, 1500))
    
    setIsRefreshing(false)
    refreshControls.stop()
    refreshControls.set({ rotate: 0 })
    hapticFeedback.success()
  }

  // Build a simple portfolio sparkline from all positions
  const portfolioSparkline = useMemo(() => {
    if (positions.length === 0) return []
    const maxLen = Math.max(...positions.map((p) => p.sparkline?.length ?? 0))
    if (maxLen < 2) return []

    const combined: number[] = []
    for (let i = 0; i < maxLen; i++) {
      let sum = 0
      for (const p of positions) {
        if (p.unidades > 0 && p.sparkline && p.sparkline.length > 0) {
          const idx = Math.floor((i / maxLen) * p.sparkline.length)
          const priceAtIdx = p.sparkline[Math.min(idx, p.sparkline.length - 1)]
          sum += priceAtIdx * p.unidades
        }
      }
      combined.push(sum)
    }
    return combined.map((v, i) => ({ i, v }))
  }, [positions])

  const areaColor = isPositive ? "#34d399" : "#fb7185"

  // Sort positions by value (descending)
  const sortedPositions = useMemo(
    () =>
      [...positions].sort(
        (a, b) => (b.valor_actual ?? 0) - (a.valor_actual ?? 0)
      ),
    [positions]
  )

  const dailyPnlInfo = {
    percent: totals.totalPnlPercent24h,
    amount: totals.totalPnl24h,
    isPositive: totals.totalPnl24h >= 0
  }

  const bestPerformer = useMemo(() => {
    const withPercent = positions.filter(p => typeof p.change_percent_24h === 'number')
    if (withPercent.length === 0) return null
    return withPercent.reduce((prev, current) => (prev.change_percent_24h! > current.change_percent_24h! ? prev : current))
  }, [positions])

  const worstPerformer = useMemo(() => {
    const withPercent = positions.filter(p => typeof p.change_percent_24h === 'number')
    if (withPercent.length === 0) return null
    return withPercent.reduce((prev, current) => (prev.change_percent_24h! < current.change_percent_24h! ? prev : current))
  }, [positions])

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="px-5 pt-6 pb-24 space-y-6">
        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
        <div className="h-12 w-48 bg-muted rounded animate-pulse mx-auto" />
        <div className="h-32 w-full bg-muted/50 rounded-2xl animate-pulse" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 w-full bg-muted/50 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`pb-28 flex flex-col ${zenMode ? 'justify-center min-h-[85vh]' : 'min-h-screen'} bg-background/50`}>
      
      {/* Pull to refresh visual hint */}
      <motion.div 
        className="flex justify-center -mt-10 mb-4 h-10 items-end"
      >
        <motion.button 
          onClick={handleRefresh}
          animate={refreshControls}
          className="bg-muted/30 p-2 rounded-full text-muted-foreground/50"
        >
          <RefreshCw className="w-5 h-5" />
        </motion.button>
      </motion.div>

      {/* ─── Header ──────────────────────── */}
      <motion.div 
        className="px-5 pt-2 pb-2 sticky top-0 z-10 bg-background/80 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.div 
              whileTap={{ scale: 0.9 }}
              className="h-10 w-10 rounded-[14px] bg-primary flex items-center justify-center shadow-lg shadow-primary/30 transition-colors"
            >
              <Activity className="h-5 w-5 text-primary-foreground" />
            </motion.div>
            <div>
              <p className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-widest">Portfolio</p>
              <p className="text-sm font-bold text-foreground">Resumen Global</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (soundEffects) playSound('click')
                hapticFeedback.light()
                setZenMode(!zenMode)
              }}
              className={`h-10 w-10 rounded-[14px] flex items-center justify-center transition-all ${
                zenMode 
                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-inner' 
                  : 'bg-card/50 backdrop-blur-md border border-border/50 text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {zenMode ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
            </button>
            <button
              onClick={async () => {
                hapticFeedback.heavy()
                const { createClient } = await import("@/lib/supabase/client")
                const supabase = createClient()
                await supabase.auth.signOut()
                window.location.href = "/login"
              }}
              className="h-10 w-10 rounded-[14px] bg-card/50 backdrop-blur-md border border-border/50 flex items-center justify-center text-muted-foreground active:scale-95 transition-all"
            >
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {/* ─── Big Number ────────────────── */}
        <motion.div style={{ scale: bigNumberScale, opacity: bigNumberOpacity }} className="text-center mb-2">
          <p className="text-[10px] text-muted-foreground/80 uppercase tracking-widest font-semibold mb-2">
            Valor Total
          </p>
          <div className={`font-extrabold font-tabular text-foreground tracking-tight leading-none transition-all ${zenMode ? 'text-6xl my-8' : 'text-[42px]'}`}>
            <AnimatedNumber 
              value={totals.totalValue} 
              format="currency" 
              hide={hideBalances} 
            />
          </div>

          {totals.totalCost > 0 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <div
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  isPositive
                    ? "bg-emerald-500/15 text-emerald-500"
                    : "bg-rose-500/15 text-rose-500"
                }`}
              >
                <PnlIcon className="h-[14px] w-[14px]" />
                <AnimatedNumber value={totals.totalPnl} format="pnl" hide={hideBalances} />
              </div>
              <span className={`text-sm font-bold font-tabular opacity-90 ${pnlColor}`}>
                (<AnimatedNumber value={totals.totalPnlPercent} format="percent" hide={hideBalances} />)
              </span>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* ─── Portfolio Chart ─────────────── */}
      {portfolioSparkline.length > 1 && (
        <div className={`w-full transition-all relative z-0 ${zenMode ? 'h-56 mt-4' : 'h-32 mt-2'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={portfolioSparkline} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mobileAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={areaColor} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={areaColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Area
                type="monotone"
                dataKey="v"
                stroke={areaColor}
                strokeWidth={3}
                fill="url(#mobileAreaGrad)"
                isAnimationActive={true}
                animationDuration={1500}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Conditionally hide the rest if Zen Mode is on */}
      {!zenMode && (
        <div className="animate-fade-in mt-2">
          
          {/* ─── Snap Carousel Quick Stats ─────────────── */}
          <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar px-5 pb-6 gap-3 -mx-5 pl-5 pr-5">
            {/* Invertido */}
            <div className="snap-center shrink-0 w-[140px] bg-card/60 backdrop-blur-xl border border-border/50 rounded-[20px] p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full blur-xl -mr-8 -mt-8" />
              <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold">
                Invertido
              </p>
              <p className="text-xl font-bold font-tabular text-foreground mt-2">
                <AnimatedNumber value={totals.totalCost} format="currency" hide={hideBalances} />
              </p>
            </div>
            
            {/* Rentabilidad Hoy */}
            <div className="snap-center shrink-0 w-[140px] bg-card/60 backdrop-blur-xl border border-border/50 rounded-[20px] p-4 shadow-sm relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-16 h-16 rounded-full blur-xl -mr-8 -mt-8 ${dailyPnlInfo.isPositive ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`} />
              <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold">
                Rent. Hoy
              </p>
              <p className={`text-xl font-bold font-tabular mt-2 ${dailyPnlInfo.isPositive ? "text-emerald-500" : "text-rose-500"}`}>
                <AnimatedNumber value={dailyPnlInfo.percent} format="percent" hide={hideBalances} />
              </p>
            </div>

            {/* Top Ganadora */}
            {bestPerformer && (
              <div className="snap-center shrink-0 w-[150px] bg-card/60 backdrop-blur-xl border border-border/50 rounded-[20px] p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl -mr-8 -mt-8" />
                <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-500" /> Ganadora
                </p>
                <div>
                  <p className="text-sm font-bold text-foreground truncate mt-1">{bestPerformer.nombre || bestPerformer.ticker.split('.')[0]}</p>
                  <p className="text-emerald-500 font-bold font-tabular text-xs">{formatPercent(bestPerformer.change_percent_24h || 0)}</p>
                </div>
              </div>
            )}

            {/* Top Perdedora */}
            {worstPerformer && (
              <div className="snap-center shrink-0 w-[150px] bg-card/60 backdrop-blur-xl border border-border/50 rounded-[20px] p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 rounded-full blur-xl -mr-8 -mt-8" />
                <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-rose-500" /> Perdedora
                </p>
                <div>
                  <p className="text-sm font-bold text-foreground truncate mt-1">{worstPerformer.nombre || worstPerformer.ticker.split('.')[0]}</p>
                  <p className="text-rose-500 font-bold font-tabular text-xs">{formatPercent(worstPerformer.change_percent_24h || 0)}</p>
                </div>
              </div>
            )}
          </div>

          <div className="px-5 mb-6">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                hapticFeedback.light()
                setPerformanceOpen(true)
              }}
              className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 rounded-[16px] p-3.5 flex items-center justify-center gap-2 font-semibold transition-colors"
            >
              <BarChart2 className="w-5 h-5" />
              Rendimiento Detallado
            </motion.button>
          </div>

          <PerformanceModal open={performanceOpen} onOpenChange={setPerformanceOpen} />

          {/* ─── Position List ─────────────────── */}
          <div className="px-5 pb-4 mt-2">
            <h2 className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest">
              Tus Activos
            </h2>
          </div>

          <div className="bg-card/40 border-y border-border/30 divide-y divide-border/20 backdrop-blur-sm">
            {sortedPositions.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground/60">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Activity className="h-8 w-8 text-primary/60" />
                </div>
                <p className="font-semibold text-foreground text-lg">Sin posiciones</p>
                <p className="text-sm mt-1 px-10">
                  Pulsa el botón <strong>+</strong> abajo para empezar tu imperio
                </p>
              </div>
            ) : (
              sortedPositions.map((p) => (
                <MobileAssetCard key={p.activo_id} position={p} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
