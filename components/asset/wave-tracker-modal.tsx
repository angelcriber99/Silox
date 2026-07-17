"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, Plus, Trash2, Waves, Target, Check, RefreshCw, Sparkles } from "lucide-react"
import type { EnrichedPosition } from "@/lib/types"
import { useUpdateAsset } from "@/lib/hooks/use-transactions"
import { toast } from "sonner"
import { calculatePurchasePoints } from "@/lib/utils/purchase-points"

interface WaveData {
  id: string
  price: number
  type: "BUY" | "SELL"
  active: boolean
  currency?: "USD"
  source?: "manual" | "model"
  confidence?: number
  rationale?: string
}

export interface AssetNotesData {
  text: string
  waves: WaveData[]
}

interface WaveTrackerModalProps {
  position: EnrichedPosition | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function parseAssetNotes(notas: string | null): AssetNotesData {
  if (!notas) return { text: "", waves: [] }
  try {
    const data = JSON.parse(notas)
    if (data && typeof data === 'object' && ('text' in data || 'waves' in data)) {
      return {
        text: data.text || "",
        waves: Array.isArray(data.waves) ? data.waves : []
      }
    }
  } catch {
    // Legacy format (just plain text)
  }
  return { text: notas, waves: [] }
}

export function WaveTrackerModal({ position, open, onOpenChange, onSuccess }: WaveTrackerModalProps) {
  const updateAsset = useUpdateAsset()
  const [notesData, setNotesData] = useState<AssetNotesData>(() => parseAssetNotes(position?.notas ?? null))
  const [newWavePrice, setNewWavePrice] = useState("")
  const [newWaveType, setNewWaveType] = useState<"BUY" | "SELL">("SELL")
  const [isCalculating, setIsCalculating] = useState(false)

  const handleAddWave = () => {
    const price = parseFloat(newWavePrice.replace(",", "."))
    if (isNaN(price) || price <= 0) {
      toast.error("El precio debe ser un número válido")
      return
    }

    const newWave: WaveData = {
      id: crypto.randomUUID(),
      price,
      type: newWaveType,
      active: true,
      currency: "USD",
      source: "manual",
    }

    setNotesData(prev => ({
      ...prev,
      waves: [...prev.waves, newWave].sort((a, b) => b.price - a.price)
    }))
    
    setNewWavePrice("")
  }

  const toggleWaveActive = (id: string) => {
    setNotesData(prev => ({
      ...prev,
      waves: prev.waves.map(w => w.id === id ? { ...w, active: !w.active } : w)
    }))
  }

  const deleteWave = (id: string) => {
    setNotesData(prev => ({
      ...prev,
      waves: prev.waves.filter(w => w.id !== id)
    }))
  }

  const handleSave = async () => {
    if (!position) return
    try {
      const finalNotesData = { ...notesData }
      
      // Auto-add wave if user typed something but forgot to click '+'
      if (newWavePrice) {
        const price = parseFloat(newWavePrice.replace(",", "."))
        if (!isNaN(price) && price > 0) {
          const newWave: WaveData = {
            id: crypto.randomUUID(),
            price,
            type: newWaveType,
            active: true,
            currency: "USD",
            source: "manual",
          }
          finalNotesData.waves = [...finalNotesData.waves, newWave].sort((a, b) => b.price - a.price)
        }
      }

      const notasJson = JSON.stringify(finalNotesData)
      await updateAsset.mutateAsync({
        id: position.activo_id,
        updates: { notas: notasJson },
      })
      toast.success("Olas y notas guardadas correctamente")
      onSuccess?.()
      onOpenChange(false)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Error al guardar")
    }
  }

  if (!position) return null

  const currentPrice = position.precio_actual_usd ?? 0
  const currencySymbol = '$'

  const calculateLevels = async () => {
    if (!currentPrice) {
      toast.error("No hay una cotización USD actual para calcular niveles")
      return
    }
    setIsCalculating(true)
    try {
      const response = await fetch(`/api/market/${encodeURIComponent(position.ticker)}?range=1y&type=${encodeURIComponent(position.tipo)}`)
      if (!response.ok) throw new Error("No se pudo cargar el histórico")
      const payload = await response.json()
      const nativePrice = position.precio_actual_nativo ?? 0
      const usdPerNative = nativePrice > 0 ? currentPrice / nativePrice : 1
      const chart = (payload.chart ?? []).map((point: { date: string; price: number }) => ({
        date: point.date,
        price: Number(point.price) * usdPerNative,
      }))
      const levels = calculatePurchasePoints(chart, currentPrice)
      if (levels.length === 0) throw new Error("No hay suficiente historial para calcular soportes")

      const generated: WaveData[] = levels.map((level) => ({
        id: crypto.randomUUID(),
        price: level.price,
        type: "BUY",
        active: true,
        currency: "USD",
        source: "model",
        confidence: level.confidence,
        rationale: level.rationale,
      }))
      setNotesData((previous) => ({
        ...previous,
        waves: [...previous.waves.filter((wave) => wave.source !== "model"), ...generated]
          .sort((left, right) => right.price - left.price),
      }))
      toast.success("Puntos de compra recalculados en USD")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron calcular los puntos")
    } finally {
      setIsCalculating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Waves className="w-5 h-5 text-primary" />
            Estrategia y Olas de {position.ticker}
          </DialogTitle>
          <DialogDescription>
            Apunta notas sobre el activo y define precios objetivos (Waves). El sistema te avisará cuando el precio alcance tus metas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          
          {/* Precio Actual Info */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
            <span className="text-sm font-medium text-muted-foreground">Precio actual en USD</span>
            <span className="tabular-nums font-bold text-lg">
              {currencySymbol}{currentPrice.toFixed(currentPrice < 10 ? 4 : 2)}
            </span>
          </div>

          {/* Waves Tracker */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              Gestor de Olas (Targets)
            </Label>
            <Button type="button" variant="outline" className="w-full justify-center gap-2" onClick={calculateLevels} disabled={isCalculating}>
              {isCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Calcular 3 puntos de compra en USD
            </Button>
            
            {/* Add new wave */}
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Input 
                  placeholder="Ej: 45.50" 
                  value={newWavePrice} 
                  onChange={e => setNewWavePrice(e.target.value)}
                  className="tabular-nums pr-8"
                  type="number"
                  step="0.01"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  {currencySymbol}
                </span>
              </div>
              <select 
                value={newWaveType} 
                onChange={(e) => setNewWaveType(e.target.value as "BUY" | "SELL")}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background"
              >
                <option value="SELL">Vender</option>
                <option value="BUY">Comprar</option>
              </select>
              <Button onClick={handleAddWave} size="icon" variant="secondary" className="shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Waves List */}
            <div className="space-y-2 mt-4 max-h-[200px] overflow-y-auto pr-1">
              {notesData.waves.length === 0 ? (
                <p className="text-sm text-muted-foreground/50 text-center py-4 bg-muted/20 rounded-md border border-dashed border-border/50">
                  No hay olas configuradas. Añade un precio objetivo arriba.
                </p>
              ) : (
                notesData.waves.map(wave => {
                  const isSell = wave.type === "SELL"
                  const isHit = isSell ? currentPrice >= wave.price : currentPrice <= wave.price
                  const distance = currentPrice > 0 ? ((wave.price / currentPrice) - 1) * 100 : 0
                  
                  return (
                    <div 
                      key={wave.id} 
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                        !wave.active 
                          ? 'opacity-50 bg-background border-border/40 grayscale' 
                          : isHit 
                            ? isSell ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'
                            : 'bg-card border-border/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => toggleWaveActive(wave.id)}
                          className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                            !wave.active ? 'border-muted-foreground/30' : 'bg-primary border-primary text-primary-foreground'
                          }`}
                        >
                          {wave.active && <Check className="w-3 h-3" />}
                        </button>
                        <div className="flex flex-col">
                          <span className={`text-xs font-bold uppercase tracking-wider ${isSell ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {isSell ? 'Toma de Beneficios' : 'Comprar Caída'}
                          </span>
                          <span className="tabular-nums font-semibold">
                            {currencySymbol}{wave.price.toFixed(wave.price < 10 ? 4 : 2)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {distance >= 0 ? "+" : ""}{distance.toFixed(2)}% desde hoy
                            {wave.confidence ? ` · confianza ${wave.confidence}%` : ""}
                          </span>
                          {wave.rationale && <span className="max-w-[230px] text-[10px] leading-snug text-muted-foreground/70">{wave.rationale}</span>}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {wave.active && isHit && (
                          <span className="text-[10px] font-bold uppercase bg-background px-2 py-0.5 rounded-full border border-border shadow-sm flex items-center gap-1 animate-pulse">
                            <RefreshCw className="w-3 h-3" />
                            ¡Alcanzado!
                          </span>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-muted-foreground hover:text-rose-400 hover:bg-rose-400/10" 
                          onClick={() => deleteWave(wave.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Text Notes */}
          <div className="space-y-2">
            <Label>Notas del Activo (Libre)</Label>
            <Textarea 
              placeholder="Ej: Si ZETA rompe los $40, vender la mitad de la posición..."
              className="min-h-[100px] resize-none"
              value={notesData.text}
              onChange={e => setNotesData({ ...notesData, text: e.target.value })}
            />
          </div>

        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border/20">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateAsset.isPending} className="min-w-[120px]">
            {updateAsset.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Olas"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
