"use client"

import { useState, useEffect } from "react"
import { Loader2, Edit3, Search } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUpdateAsset } from "@/lib/hooks/use-transactions"
import type { EnrichedPosition } from '@/lib/types'

interface EditAssetModalProps {
  position: EnrichedPosition | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TIPOS = [
  "ETF",
  "Fondo Indexado",
  "Fondo Monetario",
  "Acción",
  "Crypto",
  "Metal",
] as const

const ESTRATEGIAS = ["Core", "Satellite"] as const
const MONEDAS = ["EUR", "USD", "GBP"] as const

const inputClass =
  "bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50"

const selectClass =
  "w-full h-10 px-3 rounded-md bg-background border border-border text-foreground text-sm transition-colors duration-200 hover:border-zinc-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"

export function EditAssetModal({ position, open, onOpenChange }: EditAssetModalProps) {
  const [ticker, setTicker] = useState("")
  const [isin, setIsin] = useState("")
  const [nombre, setNombre] = useState("")
  const [tipo, setTipo] = useState<string>("ETF")
  const [estrategia, setEstrategia] = useState<string>("Satellite")
  const [moneda, setMoneda] = useState<string>("EUR")

  const [isSearching, setIsSearching] = useState(false)
  const updateAsset = useUpdateAsset()

  // Reset form when position changes
  useEffect(() => {
    if (!position || !open) return
    const syncTimer = window.setTimeout(() => {
      setTicker(position.ticker || "")
      setIsin(position.isin || "")
      setNombre(position.nombre || "")
      setTipo(position.tipo || "ETF")
      setEstrategia(position.estrategia || "Satellite")
      setMoneda(position.moneda || "EUR")
    }, 0)
    return () => window.clearTimeout(syncTimer)
  }, [position, open])

  const handleClose = (v: boolean) => {
    onOpenChange(v)
  }

  const handleSearchIsin = async () => {
    if (!isin.trim()) return
    setIsSearching(true)
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: isin.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.ticker) {
        setTicker(data.ticker)
        if (data.name) setNombre(data.name)
        toast.success(`Ticker encontrado: ${data.ticker}`)
      } else {
        toast.error(data.error || "No se encontró el ticker")
      }
    } catch (err) {
      toast.error("Error al buscar el ticker en Yahoo Finance")
    } finally {
      setIsSearching(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!position) return

    const tickerClean = ticker.trim().toUpperCase()
    if (!tickerClean) {
      toast.error("Ticker requerido")
      return
    }

    try {
      await updateAsset.mutateAsync({
        id: position.activo_id,
        updates: {
          ticker: tickerClean,
          isin: isin.trim() || undefined,
          nombre: nombre.trim() || undefined,
          tipo,
          estrategia,
          moneda,
        },
      })

      toast.success("Activo actualizado correctamente")
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido"
      toast.error("Error al actualizar activo", { description: message })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Edit3 className="h-5 w-5 text-blue-400" />
            Editar Activo
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Modifica la configuración de {position?.ticker}. El Ticker debe ser exacto al de Yahoo Finance (incluyendo sufijos como .PA o .MC). Nosotros nos encargaremos de ocultarlo visualmente en la tabla para que quede más limpio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">
                  Ticker <span className="text-rose-400">*</span>
                </Label>
                <Input
                  placeholder="VWCE.DE, AAPL…"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  className={inputClass}
                  required
                  disabled={updateAsset.isPending || isSearching}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">Moneda</Label>
                <select
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value)}
                  className={selectClass}
                  disabled={updateAsset.isPending || isSearching}
                >
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">Nombre (opcional)</Label>
                <Input
                  placeholder="Vanguard FTSE All-World UCITS ETF"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className={inputClass}
                  disabled={updateAsset.isPending || isSearching}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs flex items-center justify-between">
                  <span>ISIN (opcional)</span>
                  {isin.trim() && (
                    <button
                      type="button"
                      onClick={handleSearchIsin}
                      disabled={isSearching}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors bg-blue-500/10 px-1.5 py-0.5 rounded"
                    >
                      {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                      <span className="text-[10px]">Buscar Ticker</span>
                    </button>
                  )}
                </Label>
                <Input
                  placeholder="IE00BK5BQT80"
                  value={isin}
                  onChange={(e) => setIsin(e.target.value.toUpperCase())}
                  className={inputClass}
                  disabled={updateAsset.isPending || isSearching}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">Tipo</Label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className={selectClass}
                  disabled={updateAsset.isPending}
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">Estrategia</Label>
                <select
                  value={estrategia}
                  onChange={(e) => setEstrategia(e.target.value)}
                  className={selectClass}
                  disabled={updateAsset.isPending}
                >
                  {ESTRATEGIAS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={updateAsset.isPending}
              className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updateAsset.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white min-w-[140px] transition-colors duration-200"
            >
              {updateAsset.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
