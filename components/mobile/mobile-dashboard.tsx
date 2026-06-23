"use client"

import { useMemo, useState, useRef } from "react"
import { Activity, LogOut, Eye, EyeOff, RefreshCw, BarChart2 } from "lucide-react"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
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
    
    // Simulate refresh wait
    await new Promise(r => setTimeout(r, 1500))
    
    setIsRefreshing(false)
    refreshControls.stop()
    refreshControls.set({ rotate: 0 })
    hapticFeedback.success()
  }

  // Sparkline data
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

  const bestPerformer = useMemo(() => {
    const withPercent = positions.filter(p => typeof p.change_percent_24h === 'number' && p.change_percent_24h > 0)
    if (withPercent.length === 0) return null
    return withPercent.reduce((prev, current) => (prev.change_percent_24h! > current.change_percent_24h! ? prev : current))
  }, [positions])

  const worstPerformer = useMemo(() => {
    const withPercent = positions.filter(p => typeof p.change_percent_24h === 'number' && p.change_percent_24h < 0)
    if (withPercent.length === 0) return null
    return withPercent.reduce((prev, current) => (prev.change_percent_24h! < current.change_percent_24h! ? prev : current))
  }, [positions])

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="px-5 pt-10 pb-24 space-y-6">
        <div className="flex justify-between items-center mb-8">
            <div className="h-10 w-32 bg-muted/60 rounded-2xl animate-pulse" />
            <div className="h-10 w-20 bg-muted/60 rounded-2xl animate-pulse" />
        </div>
        <div className="h-24 w-64 bg-muted/60 rounded-3xl animate-pulse mx-auto" />
        <div className="h-32 w-full bg-muted/40 rounded-3xl animate-pulse mt-8" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 w-full bg-muted/40 rounded-3xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`pb-28 flex flex-col ${zenMode ? 'justify-center min-h-[85vh]' : 'min-h-screen'} bg-background`}>
      
      {/* Pull to refresh visual hint */}
      <motion.div className="flex justify-center -mt-10 mb-4 h-10 items-end">
        <motion.button 
          onClick={handleRefresh}
          animate={refreshControls}
          className="bg-muted/30 p-2 rounded-full text-muted-foreground/50"
        >
          <RefreshCw className="w-5 h-5" />
        </motion.button>
      </motion.div>

      {/* ─── Cabecera Súper Limpia ──────────────────────── */}
      <motion.div className="px-5 pt-2 pb-2 sticky top-0 z-10 bg-background/90 backdrop-blur-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary p-2.5 rounded-2xl">
                <span className="text-xl">🚀</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Silox</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (soundEffects) playSound('click')
                hapticFeedback.light()
                setZenMode(!zenMode)
              }}
              className={`p-3 rounded-2xl flex items-center justify-center transition-all ${
                zenMode 
                  ? 'bg-primary/20 text-primary' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {zenMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
            <button
              onClick={async () => {
                hapticFeedback.heavy()
                const { createClient } = await import("@/lib/supabase/client")
                const supabase = createClient()
                await supabase.auth.signOut()
                window.location.href = "/login"
              }}
              className="p-3 rounded-2xl bg-muted/50 text-muted-foreground hover:bg-muted/80 active:scale-95 transition-all"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ─── El Gran Número (Súper Amigable) ────────────────── */}
        <motion.div style={{ scale: bigNumberScale, opacity: bigNumberOpacity }} className="text-center mt-6 mb-2">
          <p className="text-sm text-muted-foreground/80 font-bold uppercase tracking-wider mb-1">
            Dinero Total 💰
          </p>
          <div className={`font-black font-tabular tracking-tighter leading-none transition-all ${zenMode ? 'text-7xl my-10 text-foreground' : 'text-6xl text-foreground'}`}>
            <AnimatedNumber 
              value={totals.totalValue} 
              format="currency" 
              hide={hideBalances} 
            />
          </div>

          {totals.totalCost > 0 && (
            <div className="flex items-center justify-center mt-4">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-bold transition-colors ${
                  isPositive ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                }`}
              >
                <span className="text-lg">{isPositive ? '💚' : '💔'}</span>
                <span>
                  {isPositive ? 'Ganando' : 'Perdiendo'} <AnimatedNumber value={Math.abs(totals.totalPnl)} format="currency" hide={hideBalances} />
                </span>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* ─── Gráfico Suave de Fondo ─────────────── */}
      {portfolioSparkline.length > 1 && (
        <div className={`w-full transition-all relative z-0 ${zenMode ? 'h-56 mt-4' : 'h-24 mt-0 opacity-60'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={portfolioSparkline} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mobileAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={areaColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={areaColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Area
                type="monotone"
                dataKey="v"
                stroke={areaColor}
                strokeWidth={4}
                fill="url(#mobileAreaGrad)"
                isAnimationActive={true}
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── Resto del Dashboard ────────────────── */}
      {!zenMode && (
        <div className="animate-fade-in mt-4 relative z-10">
          
          {/* ─── Carrusel GIGANTE y Divertido ─────────────── */}
          <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar px-5 pb-8 gap-4 -mx-5 pl-5 pr-5">
            
            {/* Hucha */}
            <div className="snap-center shrink-0 w-[160px] bg-blue-500/10 border-2 border-blue-500/20 rounded-[28px] p-5 shadow-sm">
              <div className="text-3xl mb-2">🐷</div>
              <p className="text-xs text-blue-600/80 dark:text-blue-400/80 font-black uppercase tracking-wider mb-1">
                Tu Hucha
              </p>
              <p className="text-xl font-black font-tabular text-blue-700 dark:text-blue-300">
                <AnimatedNumber value={totals.totalCost} format="currency" hide={hideBalances} />
              </p>
            </div>
            
            {/* Mejor Acción */}
            {bestPerformer && (
              <div className="snap-center shrink-0 w-[160px] bg-emerald-500/10 border-2 border-emerald-500/20 rounded-[28px] p-5 shadow-sm">
                <div className="text-3xl mb-2">🚀</div>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-black uppercase tracking-wider mb-1">
                  Volando Hoy
                </p>
                <p className="text-lg font-black text-emerald-700 dark:text-emerald-300 truncate">
                  {bestPerformer.nombre || bestPerformer.ticker.split('.')[0]}
                </p>
                <p className="text-emerald-600 dark:text-emerald-400 font-bold font-tabular text-sm">
                  +{formatPercent(bestPerformer.change_percent_24h || 0)}
                </p>
              </div>
            )}

            {/* Peor Acción */}
            {worstPerformer && (
              <div className="snap-center shrink-0 w-[160px] bg-rose-500/10 border-2 border-rose-500/20 rounded-[28px] p-5 shadow-sm">
                <div className="text-3xl mb-2">📉</div>
                <p className="text-xs text-rose-600/80 dark:text-rose-400/80 font-black uppercase tracking-wider mb-1">
                  Flojita Hoy
                </p>
                <p className="text-lg font-black text-rose-700 dark:text-rose-300 truncate">
                  {worstPerformer.nombre || worstPerformer.ticker.split('.')[0]}
                </p>
                <p className="text-rose-600 dark:text-rose-400 font-bold font-tabular text-sm">
                  {formatPercent(worstPerformer.change_percent_24h || 0)}
                </p>
              </div>
            )}
          </div>

          {/* Botón de Detalles */}
          <div className="px-5 mb-8">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                hapticFeedback.light()
                setPerformanceOpen(true)
              }}
              className="w-full bg-foreground text-background rounded-3xl p-4 flex items-center justify-center gap-3 font-black text-lg shadow-lg transition-transform"
            >
              <BarChart2 className="w-6 h-6" />
              Ver Estadísticas
            </motion.button>
          </div>

          <PerformanceModal open={performanceOpen} onOpenChange={setPerformanceOpen} currentPnl24h={totals.totalPnl24h} currentTotalValue={totals.totalValue} />

          {/* ─── Lista de Cromos (Activos) ─────────────────── */}
          <div className="px-5 pb-4">
            <h2 className="text-xl font-black text-foreground mb-4">
              Mis Inversiones 💸
            </h2>
            
            <div className="space-y-3">
              {sortedPositions.length === 0 ? (
                <div className="text-center py-16 bg-muted/20 rounded-[32px] border-2 border-dashed border-border/50">
                  <div className="text-5xl mb-4">🌱</div>
                  <p className="font-black text-foreground text-xl">Sin nada por aquí</p>
                  <p className="text-muted-foreground font-medium mt-2 px-8">
                    Dale al botón <span className="font-bold text-primary">+</span> de abajo para plantar tu primera semilla.
                  </p>
                </div>
              ) : (
                sortedPositions.map((p) => (
                  <MobileAssetCard key={p.activo_id} position={p} />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
