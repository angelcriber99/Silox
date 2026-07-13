"use client"

import { useState, useMemo } from "react"
import { ArrowRightLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFundTransfer } from "@/lib/hooks/use-transactions"
import { usePositions } from "@/lib/hooks/use-portfolio"
import type { EnrichedPosition } from '@/lib/types'

interface TraspasoModalProps {
  origen: EnrichedPosition | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const inputClass =
  "bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50"

export function TraspasoModal({
  origen,
  open,
  onOpenChange,
}: TraspasoModalProps) {
  const { data: positions } = usePositions()
  const createTransfer = useFundTransfer()

  const [destinoId, setDestinoId] = useState<string>("")
  const [cantidadOrigen, setCantidadOrigen] = useState("")
  const [valorTraspaso, setValorTraspaso] = useState("")
  const [cantidadDestino, setCantidadDestino] = useState("")
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0])

  const eligibleDestinations = useMemo(() => {
    if (!positions || !origen) return []
    return positions.filter(
      p => p.activo_id !== origen.activo_id && (p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario")
    )
  }, [positions, origen])

  const resetForm = () => {
    setDestinoId("")
    setCantidadOrigen("")
    setValorTraspaso("")
    setCantidadDestino("")
    setFecha(new Date().toISOString().split("T")[0])
  }

  const handleClose = (v: boolean) => {
    if (!v && !createTransfer.isPending) resetForm()
    onOpenChange(v)
  }

  const handlePrefillMax = () => {
    if (origen) {
      setCantidadOrigen(origen.unidades.toString())
      if (origen.precio_actual) {
        setValorTraspaso((origen.unidades * origen.precio_actual).toFixed(2))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!origen || !destinoId) {
      toast.error("Selecciona un fondo destino")
      return
    }

    const qtyOrigen = parseFloat(cantidadOrigen)
    const valTraspaso = parseFloat(valorTraspaso)
    const qtyDestino = parseFloat(cantidadDestino)

    if (isNaN(qtyOrigen) || qtyOrigen <= 0) {
      toast.error("Participaciones de origen inválidas")
      return
    }
    if (isNaN(valTraspaso) || valTraspaso <= 0) {
      toast.error("Valor de traspaso inválido")
      return
    }
    if (isNaN(qtyDestino) || qtyDestino <= 0) {
      toast.error("Participaciones de destino inválidas")
      return
    }

    const targetPosition = eligibleDestinations.find(d => d.activo_id === destinoId)
    const nombreDestino = targetPosition?.nombre || targetPosition?.ticker || "Destino"

    try {
      await createTransfer.mutateAsync({
        source: {
          activo_id: origen.activo_id,
          tipo_operacion: "Traspaso Salida",
          cantidad: qtyOrigen,
          precio_unitario: valTraspaso / qtyOrigen,
          comision: 0,
          fecha,
          notas: `Traspaso hacia ${nombreDestino}`,
        },
        destination: {
          activo_id: destinoId,
          tipo_operacion: "Traspaso Entrada",
          cantidad: qtyDestino,
          precio_unitario: valTraspaso / qtyDestino,
          comision: 0,
          fecha,
          notas: `Traspaso desde ${origen.nombre || origen.ticker}`,
        },
      })

      toast.success("Traspaso completado")
      handleClose(false)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error al realizar el traspaso"
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border shadow-2xl p-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500" />
        
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <DialogTitle className="text-xl">Traspaso de Fondo</DialogTitle>
                <DialogDescription className="text-muted-foreground mt-1">
                  Mueve capital sin peaje fiscal
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4">
            {/* Origen */}
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold">Origen</Label>
              <div className="p-3 bg-muted/50 rounded-lg border border-border">
                <p className="font-medium text-foreground">{origen?.nombre || origen?.ticker}</p>
                <p className="text-xs text-muted-foreground">{origen?.unidades} participaciones disponibles</p>
              </div>
            </div>

            {/* Destino */}
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold">Destino</Label>
              <Select value={destinoId} onValueChange={setDestinoId}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Selecciona el fondo destino" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleDestinations.map(d => (
                    <SelectItem key={d.activo_id} value={d.activo_id}>
                      {d.nombre || d.ticker}
                    </SelectItem>
                  ))}
                  {eligibleDestinations.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No hay otros fondos en tu cartera.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground font-semibold">Part. Salientes</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={cantidadOrigen}
                    onChange={(e) => setCantidadOrigen(e.target.value)}
                    className={inputClass}
                    required
                  />
                  <button
                    type="button"
                    onClick={handlePrefillMax}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold text-blue-500 hover:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded"
                  >
                    MAX
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground font-semibold">Valor (€)</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Importe"
                  value={valorTraspaso}
                  onChange={(e) => setValorTraspaso(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold">Part. Entrantes (Destino)</Label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="Participaciones compradas"
                value={cantidadDestino}
                onChange={(e) => setCantidadDestino(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold">Fecha</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>

          <DialogFooter className="p-6 pt-2 bg-muted/20 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              className="border-border hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createTransfer.isPending || !destinoId}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {createTransfer.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
