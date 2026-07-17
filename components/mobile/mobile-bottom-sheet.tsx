"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence, PanInfo } from "framer-motion"
import { X, ArrowUpRight, ArrowDownRight, Loader2, Search, Plus, FileUp } from "lucide-react"
import { RevolutSync } from "@/components/transactions/revolut-sync"
import { AssetLogo } from "@/components/ui/asset-logo"
import { useAddTransaction, useAddInvestment } from "@/lib/hooks/use-transactions"
import { formatCurrency } from "@/lib/utils/formatters"
import { toast } from "sonner"
import type { EnrichedPosition } from "@/lib/types"

interface MobileBottomSheetProps {
  open: boolean
  onClose: () => void
  positions: EnrichedPosition[]
  preselectedAsset?: EnrichedPosition | null
}

const TIPOS = ["ETF", "Fondo Indexado", "Fondo Monetario", "Acción", "Crypto"] as const
const MONEDAS = ["EUR", "USD", "GBP"] as const

function toPriceInput(value: number) {
  return value.toFixed(value < 10 ? 4 : 2).replace(/0+$/, '').replace(/\.$/, '')
}

export function MobileBottomSheet({
  open,
  onClose,
  positions,
  preselectedAsset,
}: MobileBottomSheetProps) {
  const [activeTab, setActiveTab] = useState<"operacion" | "nuevo" | "importar">("operacion")
  
  // Tab 1: Registrar Operación (existing)
  const [selectedAsset, setSelectedAsset] = useState<EnrichedPosition | null>(null)
  const [step, setStep] = useState<"select" | "form">("select")
  const [tipoOp, setTipoOp] = useState<"Compra" | "Venta">("Compra")
  const [cantidad, setCantidad] = useState("")
  const [precio, setPrecio] = useState("")
  const [comision, setComision] = useState("")
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0])

  // Tab 2: Nuevo Activo
  const [ticker, setTicker] = useState("")
  const [isin, setIsin] = useState("")
  const [nombre, setNombre] = useState("")
  const [tipo, setTipo] = useState<string>("ETF")
  const [estrategia, setEstrategia] = useState<string>("Satellite")
  const [moneda, setMoneda] = useState<string>("EUR")
  const [isSearching, setIsSearching] = useState(false)
  const [newAssetStep, setNewAssetStep] = useState<"search" | "details">("search")

  const addTx = useAddTransaction()
  const addInvestment = useAddInvestment()

  const resetForm = useCallback(() => {
    // Reset Tab 1
    setSelectedAsset(null)
    setStep("select")
    setTipoOp("Compra")
    setCantidad("")
    setPrecio("")
    setComision("")
    setFecha(new Date().toISOString().split("T")[0])
    
    // Reset Tab 2
    setNewAssetStep("search")
    setTicker("")
    setIsin("")
    setNombre("")
    setTipo("ETF")
    setEstrategia("Satellite")
    setMoneda("EUR")
  }, [])

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (open) return
    const resetTimer = window.setTimeout(resetForm, 300)
    return () => window.clearTimeout(resetTimer)
  }, [open, resetForm])

  // Auto-select asset if preselectedAsset changes while sheet opens
  useEffect(() => {
    if (!open || !preselectedAsset) return
    const selectTimer = window.setTimeout(() => {
      setActiveTab("operacion")
      setSelectedAsset(preselectedAsset)
      setStep("form")
      const nativePrice = preselectedAsset.precio_actual_nativo ?? preselectedAsset.precio_actual
      if (nativePrice) setPrecio(toPriceInput(nativePrice))
    }, 0)
    return () => window.clearTimeout(selectTimer)
  }, [open, preselectedAsset])

  // ==============================
  // TAB 1 LOGIC
  // ==============================
  const handleSelectAsset = (p: EnrichedPosition) => {
    setSelectedAsset(p)
    setStep("form")
    const nativePrice = p.precio_actual_nativo ?? p.precio_actual
    if (nativePrice) setPrecio(toPriceInput(nativePrice))
  }

  const handleSubmitTx = async () => {
    if (!selectedAsset) return
    const cantNum = parseFloat(cantidad)
    const precioNum = parseFloat(precio)
    if (isNaN(cantNum) || cantNum <= 0 || isNaN(precioNum) || precioNum < 0) {
      toast.error("Por favor, revisa la cantidad y el precio")
      return
    }

    try {
      await addTx.mutateAsync({
        activo_id: selectedAsset.activo_id,
        tipo_operacion: tipoOp,
        cantidad: cantNum,
        precio_unitario: precioNum,
        comision: comision ? parseFloat(comision) : 0,
        precio_moneda: selectedAsset.original_currency || selectedAsset.moneda,
        comision_moneda: selectedAsset.original_currency || selectedAsset.moneda,
        fecha,
      })
      toast.success(`${tipoOp} de ${selectedAsset.ticker} registrada correctamente`)
      onClose()
    } catch {
      toast.error("Error al guardar la transacción")
    }
  }

  // ==============================
  // TAB 2 LOGIC
  // ==============================
  const handleSearchTicker = async () => {
    if (!ticker.trim() && !isin.trim()) {
       toast.error("Introduce un Ticker o ISIN")
       return
    }
    const query = ticker.trim() || isin.trim()
    setIsSearching(true)
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      if (res.ok && data.ticker) {
        setTicker(data.ticker)
        if (data.name) setNombre(data.name)
        setNewAssetStep("details") // move to next step
      } else {
        toast.error(data.error || "No se encontró el activo en Yahoo Finance")
      }
    } catch {
      toast.error("Error al buscar el activo")
    } finally {
      setIsSearching(false)
    }
  }

  const handleSubmitNewAsset = async () => {
    const tickerClean = ticker.trim().toUpperCase()
    if (!tickerClean) {
      toast.error("El Ticker es obligatorio")
      return
    }
    const cantNum = parseFloat(cantidad)
    const precioNum = parseFloat(precio)

    if (isNaN(cantNum) || cantNum <= 0 || isNaN(precioNum) || precioNum < 0) {
      toast.error("Revisa la cantidad y el precio inicial")
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
          cantidad: cantNum,
          precio_unitario: precioNum,
          comision: comision ? parseFloat(comision) : 0,
          precio_moneda: moneda,
          comision_moneda: moneda,
          fecha,
        },
      })

      toast.success(`${tickerClean} añadido a tu cartera exitosamente`)
      onClose()
    } catch (error: unknown) {
       const msg = error instanceof Error ? error.message : ""
       if (msg.includes("duplicate") || msg.includes("unique")) {
         toast.error("Este activo ya existe en tu cartera")
       } else {
         toast.error("Error al añadir la inversión")
       }
    }
  }

  // Framer Motion Drag-to-close handler
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose()
    }
  }

  const totalEst = (parseFloat(cantidad) || 0) * (parseFloat(precio) || 0)
  const operationCurrency = selectedAsset?.original_currency || selectedAsset?.moneda || "EUR"
  const isCompra = tipoOp === "Compra"
  const isPending = addTx.isPending || addInvestment.isPending

  // Premium Input Style
  const premiumInputClass = "w-full bg-card border border-border rounded-xl px-4 py-4 text-foreground text-xl font-bold tabular-nums placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all"
  const labelClass = "block text-[11px] font-bold text-muted-foreground/80 uppercase tracking-wider mb-2"
  const selectClass = "w-full bg-card border border-border rounded-xl px-4 py-4 text-foreground text-sm font-semibold focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all appearance-none"

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="md:hidden fixed bottom-0 left-0 right-0 z-[70] flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl border-t border-border bg-background shadow-2xl"
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-4 pb-2 w-full touch-none cursor-grab active:cursor-grabbing">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Content Container (Scrollable) */}
            <div className="overflow-y-auto overflow-x-hidden flex-1 pb-[env(safe-area-inset-bottom,24px)]">
              
              {/* Header & Tabs */}
              <div className="px-5 pb-4">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">Añadir</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">Registra una operación sin salir de la cartera.</p>
                  </div>
                  <button type="button" onClick={onClose} className="touch-target rounded-full text-muted-foreground active:bg-muted" aria-label="Cerrar">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Segmented Control */}
                {(step === "select" && newAssetStep === "search") && (
                  <div className="flex rounded-xl border border-border bg-card p-1">
                    <button 
                      onClick={() => { setActiveTab("operacion"); resetForm() }} 
                      className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${activeTab === "operacion" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                    >
                      Mis activos
                    </button>
                    <button 
                      onClick={() => { setActiveTab("nuevo"); resetForm() }} 
                      className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${activeTab === "nuevo" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                    >
                      Nuevo
                    </button>
                    <button 
                      onClick={() => { setActiveTab("importar"); resetForm() }} 
                      className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${activeTab === "importar" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                    >
                      Importar
                    </button>
                  </div>
                )}
              </div>

              {/* ========================================================= */}
              {/* TAB: IMPORTAR */}
              {/* ========================================================= */}
              {activeTab === "importar" && (
                <div className="px-5 pb-6 animate-fade-in space-y-6">
                  <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl border border-border bg-card p-5 text-center">
                    <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <FileUp className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground">Importar Archivo</h3>
                    <p className="text-sm text-muted-foreground">Sube un CSV o Excel con tus transacciones de Revolut o MyInvestor.</p>
                    
                    <div className="pt-4 w-full">
                      <RevolutSync className="w-full">
                        <div className="w-full bg-primary text-primary-foreground font-bold rounded-xl py-4 flex items-center justify-center gap-2">
                          <FileUp className="w-5 h-5" />
                          Seleccionar Documento
                        </div>
                      </RevolutSync>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 1: OPERACIÓN (Mis Activos) */}
              {/* ========================================================= */}
              {activeTab === "operacion" && (
                <div className="px-5">
                  {step === "select" && (
                    <div className="space-y-3 pb-6">
                      {positions.length === 0 ? (
                         <div className="text-center py-10">
                            <p className="text-muted-foreground/80 text-sm">No tienes activos aún.</p>
                            <button onClick={() => setActiveTab("nuevo")} className="mt-4 text-sm font-bold text-primary">Buscar nuevo activo</button>
                         </div>
                      ) : (
                        positions.filter((position) => position.unidades > 0).map((p) => {
                          const displayTicker = p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario" ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO" : p.ticker.split(".")[0]
                          return (
                            <motion.button
                              whileTap={{ scale: 0.96 }}
                              key={p.activo_id}
                              onClick={() => handleSelectAsset(p)}
                              className="flex w-full items-center gap-3 border-b border-border/60 px-1 py-3 text-left transition-colors last:border-b-0 active:bg-muted/50"
                            >
                              <AssetLogo ticker={p.ticker} name={p.nombre} type={p.tipo} size={40} />
                              <div className="flex-1 overflow-hidden">
                                <p className="truncate text-sm font-semibold text-foreground">{displayTicker}</p>
                                <p className="text-xs text-muted-foreground/80 truncate">{p.nombre}</p>
                              </div>
                              <div className="flex-shrink-0 text-right">
                                <p className="text-sm font-semibold text-foreground tabular-nums">{(p.precio_actual_nativo ?? p.precio_actual) ? formatCurrency(p.precio_actual_nativo ?? p.precio_actual ?? 0, p.original_currency || p.moneda) : "—"}</p>
                              </div>
                            </motion.button>
                          )
                        })
                      )}
                    </div>
                  )}

                  {step === "form" && selectedAsset && (
                    <div className="space-y-6 pb-6">
                       <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                          <AssetLogo ticker={selectedAsset.ticker} name={selectedAsset.nombre} type={selectedAsset.tipo} size={38} />
                          <div className="flex-1 min-w-0">
                             <p className="text-sm font-bold text-foreground truncate">{selectedAsset.ticker}</p>
                             <p className="text-xs text-muted-foreground/80 truncate">{selectedAsset.nombre}</p>
                          </div>
                          <button onClick={() => setStep("select")} className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">Cambiar</button>
                       </div>

                       {/* Buy/Sell */}
                       <div className="grid grid-cols-2 gap-3">
                         {(["Compra", "Venta"] as const).map((tipo) => (
                           <motion.button
                             whileTap={{ scale: 0.95 }}
                             key={tipo}
                             onClick={() => setTipoOp(tipo)}
                             className={`flex flex-col items-center justify-center gap-1 rounded-2xl border py-4 transition-all ${tipoOp === tipo ? (tipo === "Compra" ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-rose-500/50 bg-rose-500/10 text-rose-400") : "border-border bg-card/50 text-muted-foreground/80"}`}
                           >
                              {tipo === "Compra" ? <ArrowDownRight className="h-6 w-6" /> : <ArrowUpRight className="h-6 w-6" />}
                              <span className="font-bold text-sm">{tipo}</span>
                           </motion.button>
                         ))}
                       </div>

                       <div className="space-y-5">
                          <div>
                            <label className={labelClass}>Cantidad (unidades)</label>
                            <input type="number" inputMode="decimal" placeholder="0" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={premiumInputClass} />
                          </div>
                          <div>
                            <label className={labelClass}>Precio unitario ({operationCurrency})</label>
                            <input type="number" inputMode="decimal" placeholder="0.00" value={precio} onChange={(e) => setPrecio(e.target.value)} className={premiumInputClass} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div>
                               <label className={labelClass}>Comisión ({operationCurrency})</label>
                               <input type="number" inputMode="decimal" placeholder="0.00" value={comision} onChange={(e) => setComision(e.target.value)} className={`${premiumInputClass} !text-base !py-3`} />
                             </div>
                             <div>
                               <label className={labelClass}>Fecha</label>
                               <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${premiumInputClass} !text-sm !py-3 [color-scheme:dark]`} />
                             </div>
                          </div>
                       </div>

                       <motion.button 
                          whileTap={{ scale: 0.97 }}
                          onClick={handleSubmitTx}
                          disabled={isPending}
                          className={`w-full py-4 rounded-2xl text-lg font-bold flex flex-col items-center justify-center transition-opacity disabled:opacity-50 ${isCompra ? "bg-emerald-600 text-foreground" : "bg-rose-600 text-foreground"}`}
                        >
                           {isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                             <>
                               <span>{isCompra ? "Confirmar Compra" : "Confirmar Venta"}</span>
                               {totalEst > 0 && <span className="text-xs font-medium opacity-80 mt-0.5">Total: {formatCurrency(totalEst, operationCurrency)}</span>}
                             </>
                           )}
                        </motion.button>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 2: NUEVO ACTIVO */}
              {/* ========================================================= */}
              {activeTab === "nuevo" && (
                <div className="px-5">
                  {newAssetStep === "search" && (
                     <div className="space-y-6 pb-6">
                       <p className="text-muted-foreground text-sm">Busca el activo por su Ticker o ISIN para añadirlo a tu cartera.</p>
                       <div className="space-y-4">
                          <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/80" />
                            <input 
                              type="text" 
                              placeholder="Ej: AAPL, VWCE.DE..." 
                              value={ticker} 
                              onChange={(e) => setTicker(e.target.value.toUpperCase())} 
                            className="w-full rounded-2xl border border-border bg-card py-4 pl-12 pr-4 text-lg font-bold text-foreground transition-all placeholder:font-medium placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
                            />
                          </div>
                          
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={handleSearchTicker}
                            disabled={!ticker.trim() || isSearching}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground disabled:opacity-50"
                          >
                            {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                            Buscar Activo
                          </motion.button>
                       </div>
                     </div>
                  )}

                  {newAssetStep === "details" && (
                     <div className="space-y-6 pb-6">
                        <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/10 p-4">
                          <div className="flex-1 overflow-hidden pr-2">
                             <p className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">Activo encontrado</p>
                             <p className="text-foreground text-lg font-bold leading-tight truncate">{ticker}</p>
                             <p className="text-muted-foreground text-sm truncate">{nombre || "—"}</p>
                          </div>
                          <button onClick={() => setNewAssetStep("search")} className="text-muted-foreground text-xs bg-card px-3 py-1.5 rounded-full font-semibold flex-shrink-0">Editar</button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className={labelClass}>Tipo</label>
                              <div className="relative">
                                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectClass}>
                                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/80 text-xs">▼</div>
                              </div>
                           </div>
                           <div>
                              <label className={labelClass}>Moneda</label>
                              <div className="relative">
                                <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className={selectClass}>
                                  {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/80 text-xs">▼</div>
                              </div>
                           </div>
                        </div>

                        {/* Compra inicial */}
                        <div className="pt-4 border-t border-border">
                          <p className="text-foreground font-bold mb-4 flex items-center gap-2">
                             <Plus className="h-5 w-5 text-emerald-400" />
                             Primera Inversión
                          </p>
                          <div className="space-y-5">
                            <div>
                              <label className={labelClass}>Cantidad</label>
                              <input type="number" inputMode="decimal" placeholder="0" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={premiumInputClass} />
                            </div>
                            <div>
                              <label className={labelClass}>Precio Unitario</label>
                              <input type="number" inputMode="decimal" placeholder="0.00" value={precio} onChange={(e) => setPrecio(e.target.value)} className={premiumInputClass} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                               <div>
                                 <label className={labelClass}>Fecha</label>
                                 <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${premiumInputClass} !text-sm !py-3 [color-scheme:dark]`} />
                               </div>
                            </div>
                          </div>
                        </div>

                        <motion.button 
                          whileTap={{ scale: 0.97 }}
                          onClick={handleSubmitNewAsset}
                          disabled={isPending}
                          className="w-full py-4 rounded-2xl text-lg font-bold flex flex-col items-center justify-center transition-opacity disabled:opacity-50 bg-emerald-600 text-foreground"
                        >
                           {isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                             <>
                               <span>Guardar Activo e Inversión</span>
                               {totalEst > 0 && <span className="text-xs font-medium opacity-80 mt-0.5">Total: {formatCurrency(totalEst, moneda)}</span>}
                             </>
                           )}
                        </motion.button>
                     </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
