"use client"

import { useState, useEffect } from "react"
import { Loader2, ArrowUpRight, ArrowDownRight, Edit2 } from "lucide-react"
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
import { useUpdateTransaction } from "@/lib/hooks/use-transactions"
import { formatCurrency } from "@/lib/utils/formatters"
import type { Transaccion } from '@/lib/types'

interface EditTransactionModalProps {
  transaction: Transaccion | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type TipoOperacion = "Compra" | "Venta"

const inputClass =
  "bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50"

export function EditTransactionModal({
  transaction,
  open,
  onOpenChange,
}: EditTransactionModalProps) {
  const [tipoOperacion, setTipoOperacion] = useState<TipoOperacion>("Compra")
  const [cantidad, setCantidad] = useState("")
  const [precioUnitario, setPrecioUnitario] = useState("")
  const [comision, setComision] = useState("")
  const [fecha, setFecha] = useState("")
  const [notas, setNotas] = useState("")

  const updateTransaction = useUpdateTransaction()

  useEffect(() => {
    if (transaction && open) {
      setTipoOperacion(transaction.tipo_operacion)
      setCantidad(transaction.cantidad.toString())
      setPrecioUnitario(transaction.precio_unitario.toString())
      setComision(transaction.comision > 0 ? transaction.comision.toString() : "")
      // format date to YYYY-MM-DD
      const dateStr = transaction.fecha.split("T")[0]
      setFecha(dateStr)
      setNotas(transaction.notas || "")
    }
  }, [transaction, open])

  const handleClose = (v: boolean) => {
    onOpenChange(v)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transaction) return

    const cantidadNum = parseFloat(cantidad)
    const precioNum = parseFloat(precioUnitario)
    const comisionNum = comision ? parseFloat(comision) : 0

    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      toast.error("Cantidad inválida")
      return
    }
    if (isNaN(precioNum) || precioNum < 0) {
      toast.error("Precio inválido")
      return
    }

    try {
      await updateTransaction.mutateAsync({
        id: transaction.id,
        updates: {
          tipo_operacion: tipoOperacion,
          cantidad: cantidadNum,
          precio_unitario: precioNum,
          comision: comisionNum,
          fecha,
          notas: notas.trim() || undefined,
        }
      })

      const total = cantidadNum * precioNum
      toast.success(
        `Transacción actualizada`,
        {
          description: `${cantidadNum} uds. × ${formatCurrency(precioNum)} = ${formatCurrency(total)}`,
        }
      )

      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido"
      toast.error("Error al actualizar", { description: message })
    }
  }

  const cantidadNum = parseFloat(cantidad) || 0
  const precioNum = parseFloat(precioUnitario) || 0
  const totalEstimado = cantidadNum * precioNum

  const isCompra = tipoOperacion === "Compra"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Edit2 className="h-5 w-5 text-blue-400" />
            Editar Transacción
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {transaction ? (
              <>
                Modificando operación de{" "}
                <span className="font-semibold text-foreground/90">
                  {transaction.activo?.ticker}
                </span>
                {transaction.activo?.nombre && (
                  <span className="text-muted-foreground/80">
                    {" "}
                    — {transaction.activo?.nombre}
                  </span>
                )}
              </>
            ) : (
              "Selecciona una transacción"
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Buy/Sell toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(["Compra", "Venta"] as const).map((tipo) => {
              const active = tipoOperacion === tipo
              const isBuy = tipo === "Compra"
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setTipoOperacion(tipo)}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                    active
                      ? isBuy
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                        : "border-rose-500/50 bg-rose-500/10 text-rose-300"
                      : "border-border bg-muted text-muted-foreground hover:border-zinc-600"
                  }`}
                >
                  {isBuy ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  {tipo}
                </button>
              )
            })}
          </div>

          {/* Quantity + Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground/80">Cantidad</Label>
              <Input
                type="number"
                min="0.000001"
                step="any"
                placeholder="10"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                required
                className={inputClass}
                disabled={updateTransaction.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/80 flex items-center justify-between">
                Precio unitario
              </Label>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="82.30"
                value={precioUnitario}
                onChange={(e) => setPrecioUnitario(e.target.value)}
                required
                className={inputClass}
                disabled={updateTransaction.isPending}
              />
            </div>
          </div>

          {/* Commission + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground/80">
                Comisión{" "}
                <span className="text-muted-foreground/60 font-normal">(opc.)</span>
              </Label>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={comision}
                onChange={(e) => setComision(e.target.value)}
                className={inputClass}
                disabled={updateTransaction.isPending}
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
                disabled={updateTransaction.isPending}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-foreground/80">
              Notas{" "}
              <span className="text-muted-foreground/60 font-normal">(opc.)</span>
            </Label>
            <Input
              placeholder="Aportación mensual, DCA…"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className={inputClass}
              disabled={updateTransaction.isPending}
            />
          </div>

          {/* Estimated total */}
          {totalEstimado > 0 && (
            <div className="rounded-lg bg-muted/50 border border-border/40 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground/80">Valor total</span>
                <span
                  className={`text-lg font-bold font-tabular ${
                    isCompra ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {formatCurrency(totalEstimado)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={updateTransaction.isPending}
              className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updateTransaction.isPending || !transaction}
              className="bg-blue-600 hover:bg-blue-500 text-white min-w-[140px] font-medium transition-all duration-200"
            >
              {updateTransaction.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                `Guardar Cambios`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
