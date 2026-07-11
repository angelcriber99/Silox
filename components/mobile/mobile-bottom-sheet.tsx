"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence, PanInfo } from "framer-motion"
import { X, ArrowUpRight, ArrowDownRight, Loader2, Search, Plus, FileUp } from "lucide-react"
import { RevolutSync } from "@/components/transactions/revolut-sync"
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
const ESTRATEGIAS = ["Core", "Satellite"] as const
const MONEDAS = ["EUR", "USD", "GBP"] as const

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

  const resetForm = () => {
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
  }

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      // Reset state if needed when opening
      if (step !== "select" && !selectedAsset) resetForm()
    } else {
      document.body.style.overflow = ''
      // Small delay before resetting so animation finishes
      setTimeout(resetForm, 300)
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Auto-select asset if preselectedAsset changes while sheet opens
  useEffect(() => {
    if (open && preselectedAsset) {
      setActiveTab("operacion")
      setSelectedAsset(preselectedAsset)
      setStep("form")
      if (preselectedAsset.precio_actual) setPrecio(preselectedAsset.precio_actual.toFixed(2))
    }
  }, [open, preselectedAsset])

  // ==============================
  // TAB 1 LOGIC
  // ==============================
  const handleSelectAsset = (p: EnrichedPosition) => {
    setSelectedAsset(p)
    setStep("form")
    if (p.precio_actual) setPrecio(p.precio_actual.toFixed(2))
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
    } catch (err) {
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
          fecha,
        },
      })

      toast.success(`${tickerClean} añadido a tu cartera exitosamente`)
      onClose()
    } catch (err: any) {
       const msg = err?.message || ""
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
  const isCompra = tipoOp === "Compra"
  const isPending = addTx.isPending || addInvestment.isPending

  // Premium Input Style
  const premiumInputClass = "w-full bg-card border border-border rounded-xl px-4 py-4 text-foreground text-xl font-bold font-tabular placeholder:text-muted-foreground/60 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
  const labelClass = "block text-[11px] font-bold text-muted-foreground/80 uppercase tracking-wider mb-2"
  const selectClass = "w-full bg-card border border-border rounded-xl px-4 py-4 text-foreground text-sm font-semibold focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"

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
            className="md:hidden fixed bottom-0 left-0 right-0 z-[70] bg-background rounded-t-3xl border-t border-border max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-4 pb-2 w-full touch-none cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full bg-zinc-700" />
            </div>

            {/* Content Container (Scrollable) */}
            <div className="overflow-y-auto overflow-x-hidden flex-1 pb-[env(safe-area-inset-bottom,24px)]">
              
              {/* Header & Tabs */}
              <div className="px-5 pb-4">
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-xl font-extrabold text-foreground">Añadir</h2>
                  <button onClick={onClose} className="p-2 bg-card rounded-full text-muted-foreground active:scale-95 transition-transform">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Segmented Control */}
                {(step === "select" && newAssetStep === "search") && (
                  <div className="flex p-1 bg-card rounded-xl">
                    <button 
                      onClick={() => { setActiveTab("operacion"); resetForm() }} 
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "operacion" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground/80"}`}
                    >
                      Mis Activos
                    </button>
                    <button 
                      onClick={() => { setActiveTab("nuevo"); resetForm() }} 
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "nuevo" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground/80"}`}
                    >
                      Buscar Nuevo
                    </button>
                    <button 
                      onClick={() => { setActiveTab("importar"); resetForm() }} 
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "importar" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground/80"}`}
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
                  <div className="bg-card border border-border p-5 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500 mb-2">
                      <FileUp className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground">Importar Archivo</h3>
                    <p className="text-sm text-muted-foreground">Sube un archivo CSV o Excel con tus transacciones de brokers como Revolut, DeGiro, etc.</p>
                    
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
                            <button onClick={() => setActiveTab("nuevo")} className="mt-4 text-blue-400 font-bold text-sm">Buscar Nuevo Activo</button>
                         </div>
                      ) : (
                        positions.map((p) => {
                          const displayTicker = p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario" ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO" : p.ticker.split(".")[0]
                          return (
                            <motion.button
                              whileTap={{ scale: 0.96 }}
                              key={p.activo_id}
                              onClick={() => handleSelectAsset(p)}
                              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card/40 border border-border text-left active:bg-muted/50 transition-colors"
                            >
                              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-base font-bold text-blue-400">{displayTicker.slice(0, 2)}</span>
                              </div>
                              <div className="flex-1 overflow-hidden">
                                <p className="text-base font-bold text-foreground truncate">{displayTicker}</p>
                                <p className="text-xs text-muted-foreground/80 truncate">{p.nombre}</p>
                              </div>
                              <div className="flex-shrink-0 text-right">
                                <p className="text-sm font-bold text-foreground font-tabular">{p.precio_actual ? formatCurrency(p.precio_actual) : "—"}</p>
                              </div>
                            </motion.button>
                          )
                        })
                      )}
                    </div>
                  )}

                  {step === "form" && selectedAsset && (
                    <div className="space-y-6 pb-6">
                       <div className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border">
                          <div className="flex-1 min-w-0">
                             <p className="text-sm font-bold text-foreground truncate">{selectedAsset.ticker}</p>
                             <p className="text-xs text-muted-foreground/80 truncate">{selectedAsset.nombre}</p>
                          </div>
                          <button onClick={() => setStep("select")} className="text-xs font-bold text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full">Cambiar</button>
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
                            <label className={labelClass}>Precio Unitario (€)</label>
                            <input type="number" inputMode="decimal" placeholder="0.00" value={precio} onChange={(e) => setPrecio(e.target.value)} className={premiumInputClass} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div>
                               <label className={labelClass}>Comisión (€)</label>
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
                               {totalEst > 0 && <span className="text-xs font-medium opacity-80 mt-0.5">Total: {formatCurrency(totalEst)}</span>}
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
                              className="w-full bg-card border border-border rounded-2xl pl-12 pr-4 py-4 text-foreground text-lg font-bold placeholder:text-muted-foreground/60 placeholder:font-medium focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                            />
                          </div>
                          
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={handleSearchTicker}
                            disabled={!ticker.trim() || isSearching}
                            className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-base font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                            Buscar Activo
                          </motion.button>
                       </div>
                     </div>
                  )}

                  {newAssetStep === "details" && (
                     <div className="space-y-6 pb-6">
                        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex justify-between items-center">
                          <div className="flex-1 overflow-hidden pr-2">
                             <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">Activo Encontrado</p>
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
                               {totalEst > 0 && <span className="text-xs font-medium opacity-80 mt-0.5">Total: {formatCurrency(totalEst)}</span>}
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
