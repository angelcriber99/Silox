"use client"

import { useState } from "react"
import { Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react"
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
import { formatCurrency } from "@/lib/utils/formatters"
import type { EnrichedPosition } from '@/lib/types'

interface AddTransactionModalProps {
  position: EnrichedPosition | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type TipoOperacion = "Compra" | "Venta" | "Dividendo"

const inputClass =
  "bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50"

export function AddTransactionModal({
  position,
  open,
  onOpenChange,
}: AddTransactionModalProps) {
  const [tipoOperacion, setTipoOperacion] = useState<TipoOperacion>("Compra")
  const [cantidad, setCantidad] = useState("")
  const [precioUnitario, setPrecioUnitario] = useState("")
  const [comision, setComision] = useState("")
  const [fecha, setFecha] = useState(
    () => new Date().toISOString().split("T")[0]
  )
  const [notas, setNotas] = useState("")

  const addTransaction = useAddTransaction()

  const resetForm = () => {
    setTipoOperacion("Compra")
    setCantidad("")
    setPrecioUnitario("")
    setComision("")
    setFecha(new Date().toISOString().split("T")[0])
    setNotas("")
  }

  const handleClose = (v: boolean) => {
    if (!v && !addTransaction.isPending) resetForm()
    onOpenChange(v)
  }

  // Prefill price with current market price
  const handlePrefillPrice = () => {
    if (position?.precio_actual) {
      setPrecioUnitario(position.precio_actual.toFixed(2))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!position) return

    const cantidadNum = parseFloat(cantidad)
    const precioNum = parseFloat(precioUnitario)
    const comisionNum = comision ? parseFloat(comision) : 0

    if (tipoOperacion !== "Dividendo" && (isNaN(cantidadNum) || cantidadNum <= 0)) {
      toast.error("Cantidad inválida")
      return
    }
    if (isNaN(precioNum) || precioNum < 0) {
      toast.error("Monto inválido")
      return
    }

    try {
      await addTransaction.mutateAsync({
        activo_id: position.activo_id,
        tipo_operacion: tipoOperacion,
        cantidad: tipoOperacion === "Dividendo" ? 1 : cantidadNum,
        precio_unitario: precioNum,
        comision: comisionNum,
        fecha,
        notas: notas.trim() || undefined,
      })

      const total = cantidadNum * precioNum
      toast.success(
        `${tipoOperacion} registrada — ${position.ticker}`,
        {
          description: `${cantidadNum} uds. × ${formatCurrency(precioNum)} = ${formatCurrency(total)}`,
        }
      )

      resetForm()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido"
      toast.error("Error al guardar", { description: message })
    }
  }

  const cantidadNum = parseFloat(cantidad) || 0
  const precioNum = parseFloat(precioUnitario) || 0
  const totalEstimado = cantidadNum * precioNum

  const isCompra = tipoOperacion === "Compra"
  const isVenta = tipoOperacion === "Venta"
  const isDividendo = tipoOperacion === "Dividendo"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {isCompra ? (
              <ArrowUpRight className="h-5 w-5 text-emerald-400" />
            ) : isVenta ? (
              <ArrowDownRight className="h-5 w-5 text-rose-400" />
            ) : (
              <span className="h-5 w-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-xs">%</span>
            )}
            Nueva Transacción
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {position ? (
              <>
                Registra una operación sobre{" "}
                <span className="font-semibold text-foreground/90">
                  {position.ticker}
                </span>
                {position.nombre && (
                  <span className="text-muted-foreground/80">
                    {" "}
                    — {position.nombre}
                  </span>
                )}
              </>
            ) : (
              "Selecciona un activo"
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Buy/Sell/Dividend toggle */}
          <div className="grid grid-cols-3 gap-2">
            {(["Compra", "Venta", "Dividendo"] as const).map((tipo) => {
              const active = tipoOperacion === tipo
              const isBuy = tipo === "Compra"
              const isSell = tipo === "Venta"
              const isDiv = tipo === "Dividendo"
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setTipoOperacion(tipo)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 ${
                    active
                      ? isBuy
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                        : isSell
                        ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                        : "border-violet-500/50 bg-violet-500/10 text-violet-300"
                      : "border-border bg-muted text-muted-foreground hover:border-zinc-600"
                  }`}
                >
                  {isBuy ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : isSell ? (
                    <ArrowDownRight className="h-4 w-4" />
                  ) : (
                    <span className="font-bold">%</span>
                  )}
                  {tipo}
                </button>
              )
            })}
          </div>

          {/* Quantity + Price */}
          <div className={`grid gap-4 ${isDividendo ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {!isDividendo && (
              <div className="space-y-2">
                <Label className="text-foreground/80">Cantidad</Label>
                <Input
                  type="number"
                  min="0.000001"
                  step="any"
                  placeholder="10"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  required={!isDividendo}
                  className={inputClass}
                  disabled={addTransaction.isPending}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-foreground/80 flex items-center justify-between">
                {isDividendo ? "Rendimiento Bruto" : "Precio unitario"}
                {position?.precio_actual && !isDividendo && (
                  <button
                    type="button"
                    onClick={handlePrefillPrice}
                    className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Usar actual
                  </button>
                )}
              </Label>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder={isDividendo ? "0.09" : "82.30"}
                value={precioUnitario}
                onChange={(e) => setPrecioUnitario(e.target.value)}
                required
                className={inputClass}
                disabled={addTransaction.isPending}
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
              disabled={addTransaction.isPending}
            />
          </div>

          {/* Estimated total */}
          {!isDividendo && totalEstimado > 0 && (
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
          {isDividendo && precioNum > 0 && (
            <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-violet-300/80">Rendimiento Neto</span>
                <span className="text-lg font-bold font-tabular text-violet-400">
                  {formatCurrency(precioNum - (parseFloat(comision) || 0))}
                </span>
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
              disabled={addTransaction.isPending || !position}
              className={`min-w-[140px] font-medium transition-all duration-200 ${
                isCompra
                  ? "bg-emerald-600 hover:bg-emerald-500 text-foreground"
                  : isVenta
                  ? "bg-rose-600 hover:bg-rose-500 text-foreground"
                  : "bg-violet-600 hover:bg-violet-500 text-foreground"
              }`}
            >
              {addTransaction.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                `Registrar ${tipoOperacion}`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
