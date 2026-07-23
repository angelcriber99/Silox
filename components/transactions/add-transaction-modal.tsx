"use client"

import { useState } from "react"
import { ArrowUpRight, ArrowDownRight, Loader2, Info, Check } from "lucide-react"
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
import { useAddTransaction, useAssetTransactions } from "@/lib/hooks/use-transactions"
import { formatCurrency } from "@/lib/utils/formatters"
import { checkPendingWashSale } from "@/lib/utils/wash-sale"
import type { EnrichedPosition } from '@/lib/types'

interface AddTransactionModalProps {
  position: EnrichedPosition | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const inputClass =
  "bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50"

export function AddTransactionModal({
  position,
  open,
  onOpenChange,
}: AddTransactionModalProps) {
  const [tipoOperacion, setTipoOperacion] = useState<
    "Compra" | "Venta" | "Dividendo" | "Traspaso Salida" | "Traspaso Entrada"
  >("Compra")
  const [estado, setEstado] = useState<"Completada" | "Pendiente">("Completada")
  const [cantidad, setCantidad] = useState("")
  const [precioUnitario, setPrecioUnitario] = useState("")
  const [precioMoneda, setPrecioMoneda] = useState<string>(position?.moneda || "EUR")
  const [retencionOrigen, setRetencionOrigen] = useState("")
  const [retencionDestino, setRetencionDestino] = useState("")
  const [comision, setComision] = useState("")
  const [comisionMoneda, setComisionMoneda] = useState<string>(position?.moneda || "EUR")
  const [fecha, setFecha] = useState(
    () => new Date().toISOString().split("T")[0]
  )
  const [notas, setNotas] = useState("")
  const [esTraspaso, setEsTraspaso] = useState(false)

  const addTransaction = useAddTransaction()
  const { data: assetTransactions } = useAssetTransactions(position?.activo_id)

  const resetForm = () => {
    setTipoOperacion("Compra")
    setEstado("Completada")
    setCantidad("")
    setPrecioUnitario("")
    setPrecioMoneda(position?.moneda || "EUR")
    setRetencionOrigen("")
    setRetencionDestino("")
    setComision("")
    setComisionMoneda(position?.moneda || "EUR")
    setFecha(new Date().toISOString().split("T")[0])
    setNotas("")
    setEsTraspaso(false)
  }

  const handleClose = (v: boolean) => {
    if (!v && !addTransaction.isPending) resetForm()
    onOpenChange(v)
  }

  // Prefill price with current market price
  const handlePrefillPrice = () => {
    const nativePrice = position?.precio_actual_nativo ?? position?.precio_actual
    if (nativePrice) {
      setPrecioUnitario(nativePrice.toFixed(nativePrice < 10 ? 4 : 2))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!position) return

    const cantidadNum = tipoOperacion === "Dividendo" ? 0 : parseFloat(cantidad)
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

    let finalTipoOperacion = tipoOperacion
    if (esTraspaso) {
      if (tipoOperacion === "Compra") finalTipoOperacion = "Traspaso Entrada"
      if (tipoOperacion === "Venta") finalTipoOperacion = "Traspaso Salida"
    }

    try {
      const res = await addTransaction.mutateAsync({
        activo_id: position.activo_id,
        tipo_operacion: finalTipoOperacion,
        estado: estado,
        cantidad: cantidadNum,
        precio_unitario: precioNum,
        precio_moneda: isDividendo ? precioMoneda : undefined,
        comision: comisionNum,
        comision_moneda: comisionMoneda,
        retencion_origen: retencionOrigenNum,
        retencion_destino: retencionDestinoNum,
        fecha,
        notas: notas.trim() || undefined,
      })

      if ((res as any)?.id === "ERROR") {
        throw new Error((res as any).notas)
      }

      const total = cantidadNum * precioNum

      toast.success(
        `${finalTipoOperacion} registrada — ${position.ticker}`,
        {
          description: isDividendo
            ? `Rendimiento Bruto: ${formatCurrency(precioNum, precioMoneda || 'EUR')}`
            : `${cantidadNum} uds. × ${formatCurrency(precioNum, position.moneda || 'EUR')} = ${formatCurrency(total, position.moneda || 'EUR')}`,
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
  const isTraspasable = ["Fondo Indexado", "Fondo Monetario", "ETF"].includes(position?.tipo || "")

  const washSaleWarning = isCompra && assetTransactions 
    ? checkPendingWashSale(assetTransactions, fecha) 
    : { hasWarning: false }

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

          {/* Es Traspaso Toggle (only for Buy/Sell and Traspasable assets) */}
          {(isCompra || isVenta) && isTraspasable && (
            <button
              type="button"
              onClick={() => setEsTraspaso(!esTraspaso)}
              disabled={addTransaction.isPending}
              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
                esTraspaso
                  ? "border-blue-500/50 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                  : "border-border bg-muted/30 hover:border-zinc-600 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div 
                  className={`mt-0.5 flex items-center justify-center w-5 h-5 rounded border transition-colors ${
                    esTraspaso 
                      ? "bg-blue-500 border-blue-500 text-white" 
                      : "border-zinc-600 bg-background"
                  }`}
                >
                  {esTraspaso && <Check className="w-3.5 h-3.5" />}
                </div>
                <div className="text-left">
                  <span className="block text-sm font-medium text-foreground/90">
                    Operación de Traspaso
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Evita el peaje fiscal de Hacienda (regla FIFO).
                  </span>
                </div>
              </div>
            </button>
          )}

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
              <div className={isDividendo ? "flex gap-2" : ""}>
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
                {isDividendo && (
                  <Select value={precioMoneda} onValueChange={setPrecioMoneda}>
                    <SelectTrigger className={`w-[80px] ${inputClass}`}>
                      <SelectValue placeholder="Moneda" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      {position?.moneda && position.moneda !== "EUR" && position.moneda !== "USD" && (
                        <SelectItem value={position.moneda}>{position.moneda}</SelectItem>
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
                Comisión <span className="text-muted-foreground/60 font-normal">(opc.)</span>
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
                  disabled={addTransaction.isPending}
                />
                <Select value={comisionMoneda} onValueChange={setComisionMoneda}>
                  <SelectTrigger className={`w-[80px] ${inputClass}`}>
                    <SelectValue placeholder="Moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    {position?.moneda && position.moneda !== "EUR" && position.moneda !== "USD" && (
                      <SelectItem value={position.moneda}>{position.moneda}</SelectItem>
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
                    disabled={addTransaction.isPending}
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
                    disabled={addTransaction.isPending}
                  />
                  <div className="flex items-center text-xs text-muted-foreground bg-muted/50 px-2 rounded-md border border-border">
                    {precioMoneda}
                  </div>
                </div>
              </div>
            </div>
          )}

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
                  {formatCurrency(totalEstimado, position?.moneda || 'EUR')}
                </span>
              </div>
            </div>
          )}
          {isDividendo && precioNum > 0 && (
            <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 px-4 py-3 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-violet-300/80">Rendimiento Neto</span>
                <span className="text-lg font-bold tabular-nums text-violet-400">
                  {formatCurrency(precioNum - (parseFloat(retencionOrigen) || 0) - (parseFloat(retencionDestino) || 0) - (parseFloat(comision) || 0), position?.moneda || 'EUR')}
                </span>
              </div>
            </div>
          )}

          {/* Wash Sale Warning */}
          {washSaleWarning.hasWarning && (
            <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 px-4 py-3 flex items-start gap-3 mt-2">
              <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
              <div className="text-sm text-orange-200/90 leading-relaxed">
                <p className="font-semibold text-orange-300 mb-1">Cuidado: Regla de homogeneización</p>
                <p>
                  Has vendido este activo con pérdidas recientemente (el {new Date(washSaleWarning.saleDate!).toLocaleDateString('es-ES')}). 
                  Si compras en esta fecha, la pérdida quedará fiscalmente bloqueada. Puedes comprar sin penalización a partir del <strong className="text-orange-300">{new Date(washSaleWarning.safeBuyDate!).toLocaleDateString('es-ES')}</strong>.
                </p>
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
                `Registrar ${esTraspaso ? "Traspaso" : tipoOperacion}`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
