"use client"

import { useState, useRef } from "react"
import { Share2, Loader2, Eye, EyeOff, Check, Layers, TrendingUp } from "lucide-react"
import html2canvas from "html2canvas"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"
import { useDisplayCurrency } from "@/lib/hooks/use-display-currency"
import { formatPercent } from "@/lib/utils/formatters"
import { hapticFeedback } from "@/lib/utils/haptics"

interface SharePortfolioModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  positions: EnrichedPosition[]
  totals: PortfolioTotals
}

export function SharePortfolioModal({ open, onOpenChange, positions, totals }: SharePortfolioModalProps) {
  const [hideBalances, setHideBalances] = useState(false)
  const [showPositions, setShowPositions] = useState(true)
  const [showPositionPnl, setShowPositionPnl] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  
  const cardRef = useRef<HTMLDivElement>(null)
  const { format: formatDisplay } = useDisplayCurrency()

  const primaryCost = totals.netContributionsMoney?.amount ?? totals.costMoney.amount
  const displayPnl = totals.valueMoney.amount - primaryCost
  const pnlPercent = primaryCost > 0 ? (displayPnl / primaryCost) * 100 : 0
  
  const activePositions = positions
    .filter((p) => p.unidades > 0)
    .sort((a, b) => ((b.displayValue?.amount ?? 0)) - ((a.displayValue?.amount ?? 0)))
    .slice(0, 5)

  const handleExport = async () => {
    if (!cardRef.current || isExporting) return
    setIsExporting(true)
    
    try {
      hapticFeedback.light()
      
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        backgroundColor: null,
        useCORS: true,
        logging: false
      })
      
      const dataUrl = canvas.toDataURL("image/png")
      
      if (navigator.share && /iPad|iPhone|iPod|Android/.test(navigator.userAgent)) {
        const response = await fetch(dataUrl)
        const blob = await response.blob()
        const file = new File([blob], "silox-portfolio.png", { type: "image/png" })
        
        await navigator.share({
          files: [file],
          title: "Mi Cartera",
        })
      } else {
        const link = document.createElement("a")
        link.download = "silox-portfolio.png"
        link.href = dataUrl
        link.click()
      }
      
      hapticFeedback.success()
    } catch (error) {
      console.error("Error sharing image:", error)
      hapticFeedback.error()
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-[32px] p-6 bg-[#F5F5F7] dark:bg-zinc-950 sm:max-w-md [&>button]:hidden">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold">Compartir Cartera</DialogTitle>
        </DialogHeader>

        <div className="mb-6 space-y-3">
          <button
            onClick={() => setHideBalances(!hideBalances)}
            className="flex w-full items-center justify-between rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                {hideBalances ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </div>
              <span className="font-medium text-sm">Ocultar saldos totales</span>
            </div>
            {hideBalances && <Check className="h-5 w-5 text-primary" />}
          </button>

          <button
            onClick={() => setShowPositions(!showPositions)}
            className="flex w-full items-center justify-between rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <Layers className="h-5 w-5" />
              </div>
              <span className="font-medium text-sm">Mostrar Top 5 Posiciones</span>
            </div>
            {showPositions && <Check className="h-5 w-5 text-primary" />}
          </button>

          {showPositions && (
            <button
              onClick={() => setShowPositionPnl(!showPositionPnl)}
              className="flex w-full items-center justify-between rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <span className="font-medium text-sm">Mostrar beneficio por posición</span>
              </div>
              {showPositionPnl && <Check className="h-5 w-5 text-primary" />}
            </button>
          )}
        </div>

        <div className="relative mb-6 overflow-hidden rounded-[32px] border border-border/10 shadow-xl bg-black">
          <div 
            ref={cardRef} 
            className="w-full bg-black text-white p-8 relative overflow-hidden"
          >
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/30 blur-[80px]" />
            <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-blue-500/20 blur-[80px]" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-white text-black font-black text-sm">
                    S
                  </div>
                  <span className="font-bold tracking-tight">Silox</span>
                </div>
                <span className="text-xs font-medium text-white/50 tracking-widest uppercase">Portfolio</span>
              </div>

              <div className="mb-8">
                <p className="text-sm font-medium text-white/60 mb-1">Patrimonio Total</p>
                <p className="text-[40px] font-bold leading-none tracking-tight mb-3">
                  {hideBalances ? "••••••" : formatDisplay(totals.valueMoney.amount)}
                </p>
                
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${displayPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {displayPnl >= 0 ? "+" : ""}{hideBalances ? "••••" : formatDisplay(displayPnl)}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${displayPnl >= 0 ? "bg-emerald-400/20 text-emerald-400" : "bg-rose-400/20 text-rose-400"}`}>
                    {displayPnl >= 0 ? "+" : ""}{formatPercent(pnlPercent)}
                  </span>
                </div>
              </div>

              {showPositions && activePositions.length > 0 && (
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/40 border-b border-white/10 pb-2">
                    Top Posiciones
                  </p>
                  <div className="space-y-3">
                    {activePositions.map((p) => {
                      const posCost = p.displayCost?.amount ?? 0
                      const posValue = p.displayValue?.amount ?? 0
                      const posPnl = posValue - posCost
                      const posPnlPercent = posCost > 0 ? (posPnl / posCost) * 100 : 0
                      
                      return (
                        <div key={p.activo_id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs text-white">
                              {p.ticker.slice(0, 2)}
                            </div>
                            <span className="font-semibold text-sm">{p.ticker}</span>
                          </div>
                          
                          <div className="text-right">
                            <p className="font-semibold text-sm">
                              {hideBalances ? "••••" : formatDisplay(posValue)}
                            </p>
                            {showPositionPnl && (
                              <p className={`text-xs font-medium ${posPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {posPnl >= 0 ? "+" : ""}{formatPercent(posPnlPercent)}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full rounded-full bg-primary py-4 font-bold text-primary-foreground flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-70"
        >
          {isExporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />}
          {isExporting ? "Generando..." : "Compartir Cartera"}
        </button>
      </DialogContent>
    </Dialog>
  )
}
