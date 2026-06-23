"use client"

import { useMemo, useState, useRef } from "react"
import { Activity, LogOut, Eye, EyeOff, RefreshCw, BarChart2, TrendingUp, TrendingDown, ChevronRight, Bell } from "lucide-react"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import { MobileAssetCard } from "@/components/mobile/mobile-asset-card"
import { PriceAlerts } from "@/components/dashboard/price-alerts"
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
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const isPositive = totals.totalPnl >= 0
  const pnlColor = isPositive ? "text-emerald-500" : "text-rose-500"
  
  const dailyIsPositive = totals.totalPnl24h >= 0
  const dailyPnlColor = dailyIsPositive ? "text-emerald-500" : "text-rose-500"
  
  // Scroll animations
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll()
  const bigNumberScale = useTransform(scrollY, [0, 100], [1, 0.95])
  const bigNumberOpacity = useTransform(scrollY, [0, 100], [1, 0.6])
  
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

  const areaColor = isPositive ? "#10b981" : "#f43f5e"

  // Sort positions by value (descending)
  const sortedPositions = useMemo(
    () =>
      [...positions]
        .filter(p => p.unidades > 0)
        .sort((a, b) => (b.valor_actual ?? 0) - (a.valor_actual ?? 0)),
    [positions]
  )

  const bestPerformer = useMemo(() => {
    const withPercent = positions.filter(p => typeof p.change_percent_24h === 'number' && p.change_percent_24h > 0 && p.unidades > 0)
    if (withPercent.length === 0) return null
    return withPercent.reduce((prev, current) => (prev.change_percent_24h! > current.change_percent_24h! ? prev : current))
  }, [positions])

  const worstPerformer = useMemo(() => {
    const withPercent = positions.filter(p => typeof p.change_percent_24h === 'number' && p.change_percent_24h < 0 && p.unidades > 0)
    if (withPercent.length === 0) return null
    return withPercent.reduce((prev, current) => (prev.change_percent_24h! < current.change_percent_24h! ? prev : current))
  }, [positions])

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="px-5 pt-8 pb-24 space-y-6">
        <div className="flex justify-between items-center mb-6">
            <div className="h-6 w-24 bg-muted/60 rounded animate-pulse" />
            <div className="h-8 w-16 bg-muted/60 rounded animate-pulse" />
        </div>
        <div className="h-16 w-56 bg-muted/60 rounded-xl animate-pulse" />
        <div className="h-32 w-full bg-muted/40 rounded-xl animate-pulse mt-8" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 w-full bg-muted/40 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  const liquidezAmount = useMemo(() => {
    return positions.find(p => p.tipo === "Liquidez")?.valor_actual || 0
  }, [positions])

  return (
    <div ref={containerRef} className={`pb-28 flex flex-col ${zenMode ? 'justify-center min-h-[85vh]' : 'min-h-screen'} bg-background`}>
      
      {/* Pull to refresh visual hint */}
      <motion.div className="flex justify-center -mt-10 mb-2 h-10 items-end">
        <motion.button 
          onClick={handleRefresh}
          animate={refreshControls}
          className="bg-muted/30 p-2 rounded-full text-muted-foreground/50"
        >
          <RefreshCw className="w-4 h-4" />
        </motion.button>
      </motion.div>

      {/* ─── Cabecera Profesional ──────────────────────── */}
      <motion.div className="px-5 pt-2 pb-4 sticky top-0 z-10 bg-background/90 backdrop-blur-xl border-b border-border/40">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold tracking-wide text-foreground uppercase">Portfolio</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                hapticFeedback.light()
                setAlertsOpen(true)
              }}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted/50 transition-all"
            >
              <Bell className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (soundEffects) playSound('click')
                setZenMode(!zenMode)
              }}
              className={`p-2 rounded-lg flex items-center justify-center transition-all ${
                zenMode 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {zenMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={async () => {
                hapticFeedback.heavy()
                const { createClient } = await import("@/lib/supabase/client")
                const supabase = createClient()
                await supabase.auth.signOut()
                window.location.href = "/login"
              }}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted/50 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── KPIs Principales (Sleek & Data-rich) ────────────────── */}
        <motion.div style={{ scale: bigNumberScale, opacity: bigNumberOpacity }} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
              Valor del Portfolio
            </p>
            {liquidezAmount > 0 && !zenMode && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium tracking-widest uppercase">
                Liquidez: <AnimatedNumber value={liquidezAmount} format="currency" hide={hideBalances} />
              </span>
            )}
          </div>
          <div className={`font-semibold tracking-tight transition-all ${zenMode ? 'text-5xl my-10 text-foreground text-center' : 'text-4xl text-foreground'}`}>
            <AnimatedNumber 
              value={totals.totalValue} 
              format="currency" 
              hide={hideBalances} 
            />
          </div>

          {!zenMode && totals.totalCost > 0 && (
            <div className="flex flex-col gap-0.5 mt-1">
              <div className="flex items-center gap-2">
                <span className={`text-lg font-medium font-tabular ${pnlColor}`}>
                  {isPositive ? "+" : ""}<AnimatedNumber value={totals.totalPnl} format="currency" hide={hideBalances} />
                </span>
                <span className={`text-sm font-medium font-tabular ${pnlColor} opacity-80`}>
                  (<AnimatedNumber value={totals.totalPnlPercent} format="percent" hide={hideBalances} />)
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Hoy:</span>
                <span className={`font-medium font-tabular ${dailyPnlColor}`}>
                  {dailyIsPositive ? "+" : ""}<AnimatedNumber value={totals.totalPnl24h} format="currency" hide={hideBalances} />
                </span>
                <span className={`font-medium font-tabular ${dailyPnlColor} opacity-80`}>
                  (<AnimatedNumber value={totals.totalPnlPercent24h} format="percent" hide={hideBalances} />)
                </span>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* ─── Gráfico Nítido ─────────────── */}
      {portfolioSparkline.length > 1 && (
        <div className={`w-full transition-all relative z-0 ${zenMode ? 'h-56 mt-4' : 'h-28 mt-2 opacity-90'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={portfolioSparkline} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mobileAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={areaColor} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={areaColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Area
                type="monotone"
                dataKey="v"
                stroke={areaColor}
                strokeWidth={2}
                fill="url(#mobileAreaGrad)"
                isAnimationActive={true}
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── Resto del Dashboard ────────────────── */}
      {!zenMode && (
        <div className="animate-fade-in mt-2 relative z-10">
          
          {/* ─── Grid de Métricas (2x2) ─────────────── */}
          <div className="px-5 grid grid-cols-2 gap-3 mb-6">
            
            {/* Invertido */}
            <div className="bg-card/40 border border-border/50 rounded-xl p-3 shadow-sm">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Total Invertido
              </p>
              <p className="text-sm font-semibold font-tabular text-foreground">
                <AnimatedNumber value={totals.totalCost} format="currency" hide={hideBalances} />
              </p>
            </div>
            
            {/* Rentabilidad Hoy */}
            <div className="bg-card/40 border border-border/50 rounded-xl p-3 shadow-sm">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Rendimiento Hoy
              </p>
              <p className={`text-sm font-semibold font-tabular ${dailyPnlColor}`}>
                <AnimatedNumber value={totals.totalPnlPercent24h} format="percent" hide={hideBalances} />
              </p>
            </div>

            {/* Top Ganadora */}
            <div className="bg-card/40 border border-border/50 rounded-xl p-3 shadow-sm flex flex-col justify-between">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-500" /> Top Ganadora
              </p>
              {bestPerformer ? (
                <div>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {bestPerformer.nombre || bestPerformer.ticker.split('.')[0]}
                  </p>
                  <span className="text-emerald-400 font-tabular font-medium">
                    {formatPercent(bestPerformer.change_percent_24h || 0)}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">N/A</p>
              )}
            </div>

            {/* Top Perdedora */}
            <div className="bg-card/40 border border-border/50 rounded-xl p-3 shadow-sm flex flex-col justify-between">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-rose-500" /> Top Perdedora
              </p>
              {worstPerformer ? (
                <div>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {worstPerformer.nombre || worstPerformer.ticker.split('.')[0]}
                  </p>
                  <p className="text-rose-500 font-semibold font-tabular text-xs">
                    {formatPercent(worstPerformer.change_percent_24h || 0)}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">N/A</p>
              )}
            </div>
          </div>

          {/* Botón de Rendimiento */}
          <div className="px-5 mb-6">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                hapticFeedback.light()
                setPerformanceOpen(true)
              }}
              className="w-full bg-muted/40 hover:bg-muted/60 text-foreground text-xs font-semibold rounded-lg p-3 flex items-center justify-between border border-border/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-muted-foreground" />
                Ver Análisis Detallado
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </motion.button>
          </div>

          <PerformanceModal 
            open={performanceOpen} 
            onOpenChange={setPerformanceOpen} 
            currentPnl24h={totals.totalPnl24h} 
            currentTotalValue={totals.totalValue} 
          />

          <PriceAlerts 
            open={alertsOpen} 
            onOpenChange={setAlertsOpen} 
          />

          {/* ─── Lista de Activos (Profesional) ─────────────────── */}
          <div className="px-5 pb-2">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Posiciones ({sortedPositions.length})
            </h2>
          </div>
          
          <div className="border-t border-border/30 divide-y divide-border/20">
            {sortedPositions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground/60">
                <p className="text-sm">No tienes posiciones abiertas.</p>
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
