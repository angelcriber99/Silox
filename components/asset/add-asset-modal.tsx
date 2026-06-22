"use client"

import { useState } from "react"
import { Loader2, Plus, ArrowUpRight, Search } from "lucide-react"
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
import { useAddInvestment } from "@/lib/hooks/use-transactions"
import { formatCurrency } from "@/lib/utils/formatters"

interface AddAssetModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TIPOS = [
  "ETF",
  "Fondo Indexado",
  "Fondo Monetario",
  "Acción",
  "Crypto",
] as const

const ESTRATEGIAS = ["Core", "Satellite"] as const
const MONEDAS = ["EUR", "USD", "GBP"] as const

const inputClass =
  "bg-zinc-950 border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50"

const selectClass =
  "w-full h-10 px-3 rounded-md bg-zinc-950 border border-border text-foreground text-sm transition-colors duration-200 hover:border-zinc-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"

export function AddAssetModal({ open, onOpenChange }: AddAssetModalProps) {
  // Instrument
  const [ticker, setTicker] = useState("")
  const [isin, setIsin] = useState("")
  const [nombre, setNombre] = useState("")
  const [tipo, setTipo] = useState<string>("ETF")
  const [estrategia, setEstrategia] = useState<string>("Satellite")
  const [moneda, setMoneda] = useState<string>("EUR")

  const [isSearching, setIsSearching] = useState(false)

  // First purchase
  const [cantidad, setCantidad] = useState("")
  const [precioUnitario, setPrecioUnitario] = useState("")
  const [comision, setComision] = useState("")
  const [fecha, setFecha] = useState(
    () => new Date().toISOString().split("T")[0]
  )

  const addInvestment = useAddInvestment()

  const resetForm = () => {
    setTicker("")
    setIsin("")
    setNombre("")
    setTipo("ETF")
    setEstrategia("Satellite")
    setMoneda("EUR")
    setCantidad("")
    setPrecioUnitario("")
    setComision("")
    setFecha(new Date().toISOString().split("T")[0])
  }

  const handleClose = (v: boolean) => {
    if (!v && !addInvestment.isPending) resetForm()
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
        if (data.name && !nombre) setNombre(data.name)
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
    const tickerClean = ticker.trim().toUpperCase()

    if (!tickerClean) {
      toast.error("Ticker requerido")
      return
    }

    const cantidadNum = parseFloat(cantidad)
    const precioNum = parseFloat(precioUnitario)
    const comisionNum = comision ? parseFloat(comision) : 0

    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      toast.error("Cantidad inválida", {
        description: "Indica cuántas unidades has comprado.",
      })
      return
    }

    if (isNaN(precioNum) || precioNum < 0) {
      toast.error("Precio inválido", {
        description: "Indica el precio unitario de compra.",
      })
      return
    }

    try {
      await addInvestment.mutateAsync({
        activo: {
          ticker: tickerClean,
          isin: isin.trim() || undefined,
          nombre: nombre.trim() || undefined,
          tipo,
          estrategia,
          moneda,
        },
        transaccion: {
          tipo_operacion: "Compra",
          cantidad: cantidadNum,
          precio_unitario: precioNum,
          comision: comisionNum,
          fecha,
        },
      })

      const total = cantidadNum * precioNum
      toast.success(`${tickerClean} añadido a tu cartera`, {
        description: `${cantidadNum} uds. × ${formatCurrency(precioNum, moneda)} = ${formatCurrency(total, moneda)}`,
      })

      resetForm()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido"
      if (message.includes("duplicate") || message.includes("unique")) {
        toast.error("Este activo ya existe", {
          description: `${tickerClean} ya está en tu cartera. Usa el botón + en la tabla para añadir más operaciones.`,
        })
      } else {
        toast.error("Error al añadir inversión", { description: message })
      }
    }
  }

  const cantidadNum = parseFloat(cantidad) || 0
  const precioNum = parseFloat(precioUnitario) || 0
  const totalEstimado = cantidadNum * precioNum

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Plus className="h-5 w-5 text-blue-400" />
            Nueva Inversión
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Añade un activo y registra tu compra. El valor se sincronizará
            automáticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* ── Section: Instrument ──────────────── */}
          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
              Instrumento
            </p>

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
                  disabled={addInvestment.isPending || isSearching}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">Moneda</Label>
                <select
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value)}
                  className={selectClass}
                  disabled={addInvestment.isPending || isSearching}
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
                  disabled={addInvestment.isPending || isSearching}
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
                      <span className="text-[10px]">Autocompletar</span>
                    </button>
                  )}
                </Label>
                <Input
                  placeholder="IE00BK5BQT80"
                  value={isin}
                  onChange={(e) => setIsin(e.target.value.toUpperCase())}
                  className={inputClass}
                  disabled={addInvestment.isPending || isSearching}
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
                  disabled={addInvestment.isPending}
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
                  disabled={addInvestment.isPending}
                >
                  {ESTRATEGIAS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── Divider ─────────────────────────── */}
          <div className="border-t border-border" />

          {/* ── Section: Purchase ────────────────── */}
          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              Datos de compra
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">
                  Cantidad <span className="text-rose-400">*</span>
                </Label>
                <Input
                  type="number"
                  min="0.000001"
                  step="any"
                  placeholder="15"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  required
                  className={inputClass}
                  disabled={addInvestment.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">
                  Precio unitario <span className="text-rose-400">*</span>
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
                  disabled={addInvestment.isPending}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">
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
                  disabled={addInvestment.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 text-xs">Fecha</Label>
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                  className={`${inputClass} [color-scheme:dark]`}
                  disabled={addInvestment.isPending}
                />
              </div>
            </div>
          </div>

          {/* ── Total preview ───────────────────── */}
          {totalEstimado > 0 && (
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Inversión total</span>
                <span className="text-lg font-bold font-tabular text-emerald-400">
                  {formatCurrency(totalEstimado, moneda)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={addInvestment.isPending}
              className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={addInvestment.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white min-w-[140px] transition-colors duration-200"
            >
              {addInvestment.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Añadir Inversión"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
