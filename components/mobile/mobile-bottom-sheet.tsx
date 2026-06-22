"use client"

import { useState, useEffect, useRef } from "react"
import { X, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react"
import { useAddTransaction } from "@/lib/hooks/use-transactions"
import { formatCurrency } from "@/lib/utils/formatters"
import { toast } from "sonner"
import type { EnrichedPosition } from "@/lib/types"

interface MobileBottomSheetProps {
  open: boolean
  onClose: () => void
  positions: EnrichedPosition[]
}

export function MobileBottomSheet({
  open,
  onClose,
  positions,
}: MobileBottomSheetProps) {
  const [selectedAsset, setSelectedAsset] = useState<EnrichedPosition | null>(null)
  const [step, setStep] = useState<"select" | "form">("select")
  const [tipoOp, setTipoOp] = useState<"Compra" | "Venta">("Compra")
  const [cantidad, setCantidad] = useState("")
  const [precio, setPrecio] = useState("")
  const [comision, setComision] = useState("")
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0])

  const addTx = useAddTransaction()
  const sheetRef = useRef<HTMLDivElement>(null)

  // Reset on close
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setSelectedAsset(null)
        setStep("select")
        setTipoOp("Compra")
        setCantidad("")
        setPrecio("")
        setComision("")
        setFecha(new Date().toISOString().split("T")[0])
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [open])

  const handleSelectAsset = (p: EnrichedPosition) => {
    setSelectedAsset(p)
    setStep("form")
    if (p.precio_actual) setPrecio(p.precio_actual.toFixed(2))
  }

  const handleSubmit = async () => {
    if (!selectedAsset) return
    const cantNum = parseFloat(cantidad)
    const precioNum = parseFloat(precio)
    if (isNaN(cantNum) || cantNum <= 0 || isNaN(precioNum)) {
      toast.error("Revisa los campos")
      return
    }

    try {
      await addTx.mutateAsync({
        activo_id: selectedAsset.activo_id,
        tipo_operacion: tipoOp,
        cantidad: cantNum,
        precio_unitario: precioNum,
        comision: comision ? parseFloat(comision) : 0,
        fecha,
      })
      toast.success(`${tipoOp} registrada — ${selectedAsset.ticker}`)
      onClose()
    } catch {
      toast.error("Error al guardar")
    }
  }

  const totalEst = (parseFloat(cantidad) || 0) * (parseFloat(precio) || 0)
  const isCompra = tipoOp === "Compra"

  const inputClass =
    "w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3.5 text-white text-base font-tabular placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-colors"

  return (
    <>
      {/* Backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`md:hidden fixed bottom-0 left-0 right-0 z-[70] transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-[#111113] rounded-t-3xl border-t border-zinc-800/60 max-h-[85vh] overflow-y-auto pb-[env(safe-area-inset-bottom,16px)]">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-zinc-600" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-4 border-b border-zinc-800/40">
            <h2 className="text-lg font-bold text-white">
              {step === "select" ? "Selecciona un activo" : "Nueva Transacción"}
            </h2>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 active:bg-zinc-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Step 1: Asset Selector */}
          {step === "select" && (
            <div className="px-5 pt-4 pb-6 space-y-2">
              {positions.map((p) => {
                const displayTicker =
                  p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario"
                    ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO"
                    : p.ticker.split(".")[0]

                return (
                  <button
                    key={p.activo_id}
                    onClick={() => handleSelectAsset(p)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/40 text-left active:scale-[0.98] transition-transform"
                  >
                    <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-violet-400">
                        {displayTicker.slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">
                        {displayTicker}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {p.nombre}
                      </p>
                    </div>
                    {p.precio_actual && (
                      <span className="text-sm font-tabular text-zinc-400">
                        {formatCurrency(p.precio_actual)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Step 2: Transaction Form */}
          {step === "form" && selectedAsset && (
            <div className="px-5 pt-5 pb-6 space-y-5">
              {/* Selected asset header */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/40">
                <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-violet-400">
                    {selectedAsset.ticker.slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {selectedAsset.ticker.split(".")[0]}
                  </p>
                  <p className="text-xs text-zinc-500">{selectedAsset.nombre}</p>
                </div>
                <button
                  onClick={() => setStep("select")}
                  className="ml-auto text-xs text-violet-400 font-medium"
                >
                  Cambiar
                </button>
              </div>

              {/* Buy / Sell Toggle */}
              <div className="grid grid-cols-2 gap-3">
                {(["Compra", "Venta"] as const).map((tipo) => {
                  const active = tipoOp === tipo
                  const isBuy = tipo === "Compra"
                  return (
                    <button
                      key={tipo}
                      onClick={() => setTipoOp(tipo)}
                      className={`flex items-center justify-center gap-2 rounded-2xl border py-4 text-base font-semibold transition-all duration-200 ${
                        active
                          ? isBuy
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                          : "border-zinc-700 bg-zinc-900 text-zinc-500"
                      }`}
                    >
                      {isBuy ? (
                        <ArrowUpRight className="h-5 w-5" />
                      ) : (
                        <ArrowDownRight className="h-5 w-5" />
                      )}
                      {tipo}
                    </button>
                  )
                })}
              </div>

              {/* Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2">
                    Cantidad (unidades)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="10"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2">
                    Precio unitario (€)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="82.30"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2">
                      Comisión
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={comision}
                      onChange={(e) => setComision(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2">
                      Fecha
                    </label>
                    <input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className={`${inputClass} [color-scheme:dark]`}
                    />
                  </div>
                </div>
              </div>

              {/* Total estimate */}
              {totalEst > 0 && (
                <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-500">Total estimado</span>
                    <span
                      className={`text-2xl font-extrabold font-tabular ${
                        isCompra ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {formatCurrency(totalEst)}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={addTx.isPending}
                className={`w-full py-4 rounded-2xl text-base font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 ${
                  isCompra
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                    : "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20"
                }`}
              >
                {addTx.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Guardando...
                  </span>
                ) : (
                  `Registrar ${tipoOp}`
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
