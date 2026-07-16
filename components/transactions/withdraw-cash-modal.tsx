"use client"

import { useState } from "react"
import { Loader2, ArrowDownRight, Wallet } from "lucide-react"
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
import { useAddTransaction } from "@/lib/hooks/use-transactions"

interface WithdrawCashModalProps {
  cashAssetId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceAssetType?: string
  liquidezAssetId?: string
}

const inputClass =
  "bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50"

export function WithdrawCashModal({
  cashAssetId,
  open,
  onOpenChange,
  sourceAssetType,
  liquidezAssetId,
}: WithdrawCashModalProps) {
  const [cantidad, setCantidad] = useState("")
  const [fecha, setFecha] = useState(
    () => new Date().toISOString().split("T")[0]
  )
  const [transferToLiquidez, setTransferToLiquidez] = useState(true)
  const addTransaction = useAddTransaction()

  const resetForm = () => {
    setCantidad("")
    setFecha(new Date().toISOString().split("T")[0])
  }

  const handleClose = (v: boolean) => {
    if (!v && !addTransaction.isPending) resetForm()
    onOpenChange(v)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cashAssetId) return

    const cantidadNum = parseFloat(cantidad)

    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      toast.error("Cantidad inválida")
      return
    }

    try {
      await addTransaction.mutateAsync({
        activo_id: cashAssetId,
        tipo_operacion: "Retirada",
        cantidad: cantidadNum,
        precio_unitario: 1, // Cash price is always 1
        comision: 0,
        fecha,
        notas: transferToLiquidez && sourceAssetType === 'Fondo Monetario' 
          ? "Traspaso a Liquidez" 
          : "Retirada de efectivo",
      })

      if (transferToLiquidez && sourceAssetType === 'Fondo Monetario' && liquidezAssetId) {
        await addTransaction.mutateAsync({
          activo_id: liquidezAssetId,
          tipo_operacion: "Ingreso",
          cantidad: cantidadNum,
          precio_unitario: 1, // Cash price is always 1
          comision: 0,
          fecha,
          notas: "Traspaso desde Fondo Monetario",
        })
      }

      toast.success(
        "Retirada registrada",
        {
          description: transferToLiquidez && sourceAssetType === 'Fondo Monetario'
            ? `Se han transferido ${cantidadNum.toFixed(2)} € a Liquidez`
            : `Has retirado ${cantidadNum.toFixed(2)} € de la cartera`,
        }
      )

      resetForm()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido"
      toast.error("Error al guardar", { description: message })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <ArrowDownRight className="h-5 w-5 text-rose-400" />
            Retirar Efectivo
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Registra una retirada de efectivo desde tu cartera hacia tu cuenta bancaria.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-foreground/80">Cantidad a retirar (€)</Label>
            <Input
              type="number"
              min="0.01"
              step="any"
              placeholder="100.00"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              required
              className={inputClass}
              disabled={addTransaction.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground/80">Fecha</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className={`${inputClass} [color-scheme:dark]`}
              disabled={addTransaction.isPending}
            />
          </div>

          {sourceAssetType === 'Fondo Monetario' && liquidezAssetId && (
            <div className="space-y-3 pt-2">
              <Label className="text-foreground/80">Destino de los fondos</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTransferToLiquidez(true)}
                  disabled={addTransaction.isPending}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                    transferToLiquidez 
                      ? "border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/50" 
                      : "border-border bg-card/50 hover:bg-muted/50 hover:border-border/80"
                  }`}
                >
                  <span className={`font-semibold text-sm ${transferToLiquidez ? "text-blue-400" : "text-foreground"}`}>
                    Transferir a Liquidez
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Mantiene el dinero en el broker para invertir después.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTransferToLiquidez(false)}
                  disabled={addTransaction.isPending}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                    !transferToLiquidez 
                      ? "border-rose-500/50 bg-rose-500/10 ring-1 ring-rose-500/50" 
                      : "border-border bg-card/50 hover:bg-muted/50 hover:border-border/80"
                  }`}
                >
                  <span className={`font-semibold text-sm ${!transferToLiquidez ? "text-rose-400" : "text-foreground"}`}>
                    Retirar de la Cartera
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Para enviar a tu cuenta bancaria (ocio, gastos...).
                  </span>
                </button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={addTransaction.isPending}
              className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={addTransaction.isPending || !cashAssetId}
              className="min-w-[140px] font-medium transition-all duration-200 bg-rose-600 hover:bg-rose-500 text-foreground"
            >
              {addTransaction.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Confirmar Retirada"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
