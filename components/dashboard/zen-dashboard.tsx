"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import type { EnrichedPosition } from '@/lib/types'
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { computePortfolioTotals } from "@/lib/api/assets"
import { motion } from "framer-motion"
import { usePreferences } from "@/lib/stores/use-preferences"
import { Minimize } from "lucide-react"

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
  glow = true
}: { 
  value: number; 
  formatter: (v: number) => string;
  className?: string;
  glow?: boolean;
}) {
  const [flash, setFlash] = useState<'up'|'down'|null>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      if (value > prevValue.current) {
        setFlash('up');
      } else {
        setFlash('down');
      }
      const t = setTimeout(() => setFlash(null), 1500);
      prevValue.current = value;
      return () => clearTimeout(t);
    }
  }, [value]);

  const flashClasses = flash === 'up' 
    ? `text-emerald-400 ${glow ? 'drop-shadow-[0_0_20px_rgba(52,211,153,0.8)]' : ''}` 
    : flash === 'down' 
      ? `text-rose-400 animate-pulse ${glow ? 'drop-shadow-[0_0_20px_rgba(251,113,133,0.8)]' : ''}` 
      : '';

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

  // Sort by absolute daily percentage change to show most volatile first
  const volatilePositions = [...positions]
    .filter(p => p.unidades > 0 && (p.valor_actual ?? 0) > 0)
    .sort((a, b) => {
      const valA = Math.abs(a.change_percent_24h ?? 0)
      const valB = Math.abs(b.change_percent_24h ?? 0)
      return valB - valA
    })

  return (
    <div className="flex flex-col w-full h-full min-h-[90vh] justify-center items-center p-8 animate-in fade-in duration-1000 relative overflow-hidden">
      
      {/* ABSTRACT BACKGROUND EFFECTS */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] z-10" /> {/* Subtle overlay so text remains readable */}
        <motion.div 
          className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-emerald-500/30 blur-[100px] mix-blend-screen"
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-500/30 blur-[100px] mix-blend-screen"
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
            scale: [1, 1.5, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute top-[30%] left-[40%] w-[30vw] h-[30vw] rounded-full bg-purple-500/30 blur-[100px] mix-blend-screen"
          animate={{
            x: [0, -50, 50, 0],
            y: [0, 100, -50, 0],
            scale: [1, 1.1, 0.9, 1],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* FOREGROUND CONTENT */}
      <div className="relative z-20 flex flex-col w-full max-w-4xl space-y-16 items-center">
        {/* EXIT ZEN MODE BUTTON */}
        <button 
          onClick={() => setZenMode(false)}
          className="fixed top-6 right-6 p-4 rounded-full bg-background/50 hover:bg-muted border border-border/50 backdrop-blur-md transition-all text-muted-foreground hover:text-foreground z-50 group"
          title="Salir del Modo Zen"
        >
          <Minimize className="w-6 h-6 group-hover:scale-90 transition-transform" />
        </button>

        {/* HEADER: HUGE NUMBERS */}
        <div className="flex flex-col items-center justify-center text-center space-y-4">
        <p className="text-muted-foreground tracking-widest uppercase font-semibold text-lg md:text-xl">
          Valor del Portfolio • {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        <motion.h1 
          className={`text-6xl md:text-[8rem] font-bold font-tabular tracking-tighter drop-shadow-2xl ${totals.totalPnl24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, type: "spring" }}
        >
          <ZenLiveValue value={totals.totalValue} formatter={formatCurrency} glow={true} />
        </motion.h1>
        
        <div className="flex items-center gap-6 mt-4">
          <p className={`text-4xl md:text-6xl font-bold font-tabular tracking-tight ${totals.totalPnl24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totals.totalPnl24h >= 0 ? '+' : ''}
            <ZenLiveValue value={totals.totalPnl24h} formatter={formatCurrency} glow={true} />
          </p>
          <div className={`px-4 py-2 rounded-full text-2xl md:text-3xl font-bold bg-background/50 border ${totals.totalPnl24h >= 0 ? 'border-emerald-400/30 text-emerald-400' : 'border-rose-400/30 text-rose-400'}`}>
            {totals.totalPnlPercent24h >= 0 ? '+' : ''}
            <ZenLiveValue value={totals.totalPnlPercent24h} formatter={(v) => formatPercent(v).replace('+', '')} glow={true} />
          </div>
        </div>
      </div>

      {/* BODY: LIST ONLY */}
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
        
        {/* PROFESSIONAL TERMINAL FEED */}
        <div className="flex flex-col w-full bg-background/20 rounded-xl border border-border/40 p-1">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-card/20">
            <h2 className="text-sm font-medium tracking-widest text-muted-foreground uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Monitor de Volatilidad
            </h2>
          </div>
          
          <div className="flex flex-col overflow-y-auto max-h-[450px] hide-scrollbar">
            {volatilePositions.map((p, i) => {
              const val = p.valor_actual ?? p.coste_total
              const pnl = val > 0 ? val - (val / (1 + (p.change_percent_24h ?? 0) / 100)) : 0
              const percent = p.change_percent_24h ?? 0
              const isPositive = pnl >= 0
              
              return (
                <div key={p.activo_id} className="flex items-center justify-between px-6 py-4 border-b border-border/20 hover:bg-card/40 transition-colors">
                  <div className="flex items-center gap-4 w-1/3">
                    <div className="w-1 h-full min-h-[24px] rounded-full" style={{ backgroundColor: TYPE_COLORS[p.tipo] ?? '#71717a' }} />
                    <div className="flex flex-col">
                      <h3 className="text-xl font-bold font-mono tracking-tight">{p.ticker || p.nombre}</h3>
                      <p className="text-xs text-muted-foreground uppercase tracking-widest">{p.tipo}</p>
                    </div>
                  </div>
                  
                  <div className="w-1/3 text-right">
                    <p className="text-lg font-mono font-medium">
                      <ZenLiveValue value={val} formatter={formatCurrency} glow={false} />
                    </p>
                  </div>
                  
                  <div className="w-1/3 flex flex-col items-end">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded bg-background/50 border ${isPositive ? 'border-emerald-500/20 text-emerald-400' : 'border-rose-500/20 text-rose-400'}`}>
                      <span className="text-sm font-mono font-bold flex items-center gap-0.5">
                        {isPositive ? '+' : ''}
                        <ZenLiveValue value={percent} formatter={(v) => formatPercent(v).replace('+', '')} glow={false} />
                      </span>
                    </div>
                    <p className={`text-sm font-mono mt-1 flex items-center gap-0.5 ${isPositive ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                      {isPositive ? '+' : ''}
                      <ZenLiveValue value={pnl} formatter={formatCurrency} glow={false} />
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        </div>
      </div>
    </div>
  )
}
