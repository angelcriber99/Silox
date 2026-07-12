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
import { useUpdateTransaction } from "@/lib/hooks/use-transactions"
import { formatCurrency } from "@/lib/utils/formatters"
import type { Transaccion } from '@/lib/types'

interface EditTransactionModalProps {
  transaction: Transaccion | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type TipoOperacion = "Compra" | "Venta" | "Dividendo"

const inputClass =
  "bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50"

export function EditTransactionModal({
  transaction,
  open,
  onOpenChange,
}: EditTransactionModalProps) {
  const [tipoOperacion, setTipoOperacion] = useState<
    "Compra" | "Venta" | "Dividendo" | "Traspaso Salida" | "Traspaso Entrada"
  >("Compra")
  const [estado, setEstado] = useState<"Completada" | "Pendiente">("Completada")
  const [cantidad, setCantidad] = useState("")
  const [precioUnitario, setPrecioUnitario] = useState("")
  const [precioMoneda, setPrecioMoneda] = useState<string>("EUR")
  const [comision, setComision] = useState("")
  const [comisionMoneda, setComisionMoneda] = useState<string>("EUR")
  const [fecha, setFecha] = useState("")
  const [notas, setNotas] = useState("")
  const [retencionOrigen, setRetencionOrigen] = useState("")
  const [retencionDestino, setRetencionDestino] = useState("")

  const updateTransaction = useUpdateTransaction()

  useEffect(() => {
    if (transaction && open) {
      setTipoOperacion(transaction.tipo_operacion)
      setEstado(transaction.estado || "Completada")
      setCantidad(transaction.cantidad.toString())
      setPrecioUnitario(transaction.precio_unitario.toString())
      setPrecioMoneda(transaction.activo?.moneda || "EUR")
      setComision(transaction.comision > 0 ? transaction.comision.toString() : "")
      setComisionMoneda(transaction.activo?.moneda || "EUR")
      setRetencionOrigen(transaction.retencion_origen && transaction.retencion_origen > 0 ? transaction.retencion_origen.toString() : "")
      setRetencionDestino(transaction.retencion_destino && transaction.retencion_destino > 0 ? transaction.retencion_destino.toString() : "")
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
    const retencionOrigenNum = retencionOrigen ? parseFloat(retencionOrigen) : 0
    const retencionDestinoNum = retencionDestino ? parseFloat(retencionDestino) : 0

    if (tipoOperacion !== "Dividendo" && (isNaN(cantidadNum) || cantidadNum <= 0)) {
      toast.error("Cantidad inválida")
      return
    }
    if (isNaN(precioNum) || precioNum < 0) {
      toast.error("Monto inválido")
      return
    }

    try {
      await updateTransaction.mutateAsync({
        id: transaction.id,
        updates: {
          tipo_operacion: tipoOperacion,
          estado: estado,
          cantidad: tipoOperacion === "Dividendo" ? 1 : cantidadNum,
          precio_unitario: precioNum,
          precio_moneda: tipoOperacion === "Dividendo" ? precioMoneda : undefined,
          comision: comisionNum,
          comision_moneda: comisionMoneda,
          retencion_origen: retencionOrigenNum,
          retencion_destino: retencionDestinoNum,
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
  const isVenta = tipoOperacion === "Venta"
  const isDividendo = tipoOperacion === "Dividendo"

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

          <div className="space-y-2">
            <Label className="text-foreground/80">Estado</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEstado("Completada")}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs sm:text-sm font-medium transition-all duration-200 ${
                  estado === "Completada"
                    ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
                    : "border-border bg-muted text-muted-foreground hover:border-zinc-600"
                }`}
              >
                Completada
              </button>
              <button
                type="button"
                onClick={() => setEstado("Pendiente")}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs sm:text-sm font-medium transition-all duration-200 ${
                  estado === "Pendiente"
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                    : "border-border bg-muted text-muted-foreground hover:border-zinc-600"
                }`}
              >
                Pendiente
              </button>
            </div>
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
                  disabled={updateTransaction.isPending}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-foreground/80 flex items-center justify-between">
                {tipoOperacion === "Dividendo" ? "Rendimiento Bruto" : "Precio unitario"}
              </Label>
              <div className={tipoOperacion === "Dividendo" ? "flex gap-2" : ""}>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder={tipoOperacion === "Dividendo" ? "0.09" : "82.30"}
                  value={precioUnitario}
                  onChange={(e) => setPrecioUnitario(e.target.value)}
                  required
                  className={inputClass}
                  disabled={updateTransaction.isPending}
                />
                {tipoOperacion === "Dividendo" && (
                  <Select value={precioMoneda} onValueChange={setPrecioMoneda}>
                    <SelectTrigger className={`w-[80px] ${inputClass}`}>
                      <SelectValue placeholder="Moneda" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      {transaction?.activo?.moneda && transaction.activo.moneda !== "EUR" && transaction.activo.moneda !== "USD" && (
                        <SelectItem value={transaction.activo.moneda}>{transaction.activo.moneda}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          {/* Commission + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground/80">
                Comisión{" "}
                <span className="text-muted-foreground/60 font-normal">(opc.)</span>
              </Label>
              <div className="flex gap-2">
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
                <Select value={comisionMoneda} onValueChange={setComisionMoneda}>
                  <SelectTrigger className={`w-[80px] ${inputClass}`}>
                    <SelectValue placeholder="Moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    {transaction?.activo?.moneda && transaction.activo.moneda !== "EUR" && transaction.activo.moneda !== "USD" && (
                      <SelectItem value={transaction.activo.moneda}>{transaction.activo.moneda}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
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

          {/* Retention fields for Dividends and Sales */}
          {(isDividendo || tipoOperacion === "Venta") && (
            <div className="grid grid-cols-2 gap-4 pb-2 border-b border-border/40 mb-2">
              <div className="space-y-2">
                <Label className="text-foreground/80 text-xs">Retención Origen (EEUU)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={retencionOrigen}
                    onChange={(e) => setRetencionOrigen(e.target.value)}
                    className={inputClass}
                    disabled={updateTransaction.isPending}
                  />
                  <div className="flex items-center text-xs text-muted-foreground bg-muted/50 px-2 rounded-md border border-border">
                    {precioMoneda}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/80 text-xs">Retención Destino (España)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={retencionDestino}
                    onChange={(e) => setRetencionDestino(e.target.value)}
                    className={inputClass}
                    disabled={updateTransaction.isPending}
                  />
                  <div className="flex items-center text-xs text-muted-foreground bg-muted/50 px-2 rounded-md border border-border">
                    {precioMoneda}
                  </div>
                </div>
              </div>
            </div>
          )}

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
          {!isDividendo && totalEstimado > 0 && (
            <div className="rounded-lg bg-muted/50 border border-border/40 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground/80">Valor total</span>
                <span
                  className={`text-lg font-bold tabular-nums ${
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
                <span className="text-lg font-bold tabular-nums text-violet-400">
                  {formatCurrency(precioNum - (parseFloat(comision) || 0) - (parseFloat(retencionOrigen) || 0) - (parseFloat(retencionDestino) || 0))}
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
