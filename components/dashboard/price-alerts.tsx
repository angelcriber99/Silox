"use client"

import { useEffect, useState } from "react"
import { useAlerts } from "@/lib/hooks/use-alerts"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { Bell, BellRing, Plus, Trash2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { formatCurrency } from "@/lib/utils/formatters"
import { playSound } from "@/lib/utils/sounds"
import { usePreferences } from "@/lib/stores/use-preferences"

interface PriceAlertsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PriceAlerts({ open, onOpenChange }: PriceAlertsProps) {
  const { alerts, addAlert, removeAlert, markTriggered } = useAlerts()
  const { positions } = usePortfolio()
  const { soundEffects } = usePreferences()
  const [ticker, setTicker] = useState("")
  const [targetPrice, setTargetPrice] = useState("")
  const [condition, setCondition] = useState<'above' | 'below'>('above')

  // Check alerts
  useEffect(() => {
    if (!positions || positions.length === 0) return

    let triggeredCount = 0

    alerts.forEach((alert) => {
      if (alert.triggered) return

      const pos = positions.find(p => p.ticker.toUpperCase() === alert.ticker.toUpperCase())
      if (!pos || pos.precio_actual === null) return

      const currentPrice = pos.precio_actual_nativo !== null ? pos.precio_actual_nativo : pos.precio_actual
      if (currentPrice === null) return

      let shouldTrigger = false
      if (alert.condition === 'above' && currentPrice >= alert.target_price) {
        shouldTrigger = true
      } else if (alert.condition === 'below' && currentPrice <= alert.target_price) {
        shouldTrigger = true
      }

      if (shouldTrigger) {
        markTriggered(alert.id)
        triggeredCount++
        
        // Browser native notification
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("¡Alerta de Silox!", {
            body: `${alert.ticker} ha cruzado tu objetivo de ${formatCurrency(alert.target_price, pos.moneda || 'EUR')}. Precio actual: ${formatCurrency(currentPrice, pos.moneda || 'EUR')}`,
            icon: '/icon-192.png'
          })
        }
      }
    })

    if (triggeredCount > 0 && soundEffects) {
      playSound('celebration') // or a specific alert sound if available
    }

  }, [positions, alerts, markTriggered, soundEffects])

  const handleAdd = () => {
    if (!ticker || !targetPrice) return
    addAlert({
      ticker: ticker.toUpperCase(),
      target_price: parseFloat(targetPrice),
      condition
    })
    setTicker("")
    setTargetPrice("")
    
    // Request permission on first add
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-background border-l border-border/50 sm:max-w-md w-[90vw] p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b border-border/50">
          <SheetTitle className="text-xl font-bold flex items-center gap-2">
            <Bell className="h-5 w-5 text-violet-400" />
            Alertas de Precio
          </SheetTitle>
          <SheetDescription>
            Añade alertas y recibe notificaciones cuando un activo cruce el precio objetivo.
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Form */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Nueva Alerta</h4>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 text-sm">
                <select
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  className="w-1/3 bg-muted border border-border rounded-md px-3 py-2 uppercase"
                >
                  <option value="" disabled>Ticker</option>
                  {positions.map(p => (
                    <option key={p.ticker} value={p.ticker}>{p.ticker}</option>
                  ))}
                </select>
                <select 
                  value={condition} 
                  onChange={(e) => setCondition(e.target.value as 'above'|'below')}
                  className="bg-muted border border-border rounded-md px-3 py-2"
                >
                  <option value="above">suba a &ge;</option>
                  <option value="below">baje a &le;</option>
                </select>
                <div className="relative w-1/3">
                  <input 
                    type="number" 
                    placeholder="Precio" 
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 pr-10"
                  />
                  {ticker && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 font-medium pointer-events-none">
                      {positions.find(p => p.ticker === ticker)?.moneda || 'EUR'}
                    </span>
                  )}
                </div>
              </div>
              <Button onClick={handleAdd} className="w-full bg-violet-600 hover:bg-violet-500 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Añadir Alerta
              </Button>
            </div>
          </div>

          <div className="h-px bg-border/50 w-full" />

          {/* List */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Tus Alertas</h4>
            <div className="space-y-2">
              {alerts.length === 0 && (
                <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed border-border">
                  <BellRing className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Sin alertas activas</p>
                </div>
              )}
              {alerts.map(a => {
                const pos = positions?.find(p => p.ticker.toUpperCase() === a.ticker.toUpperCase())
                const currency = pos?.moneda || 'EUR'
                return (
                  <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${a.triggered ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-card border-border/50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${a.triggered ? 'bg-emerald-500/20' : 'bg-muted'}`}>
                        {a.triggered ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <BellRing className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{a.ticker}</span>
                          {a.triggered && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm bg-emerald-500/20 text-emerald-400">Completada</span>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {a.condition === 'above' ? 'Sube a' : 'Baja a'} <strong className="text-foreground">{formatCurrency(a.target_price, currency)}</strong>
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10" onClick={() => removeAlert(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
