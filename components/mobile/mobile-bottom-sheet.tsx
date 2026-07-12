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

const TIPOS = ["ETF", "Fondo Indexado", "Fondo Monetario", "Acción", "Crypto", "Metal"] as const
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
          fecha,
        },
      })

      toast.success(`${tickerClean} añadido a tu cartera exitosamente`)
      onClose()
    } catch (err: unknown) {
       const msg = err instanceof Error ? err.message : ""
       if (msg.includes("duplicate") || msg.includes("unique")) {
         toast.error("Este activo ya existe en tu cartera")
       } else {
         toast.error("Error al añadir la inversión")
       }
    }
  }

  // Framer Motion Drag-to-close handler
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose()
    }
  }

  const totalEst = (parseFloat(cantidad) || 0) * (parseFloat(precio) || 0)
  const isCompra = tipoOp === "Compra"
  const isPending = addTx.isPending || addInvestment.isPending

  const premiumInputClass = "w-full border border-[var(--mobile-line)] bg-[var(--mobile-paper)] px-4 py-4 font-tabular text-xl font-black text-[var(--mobile-ink)] placeholder:text-[var(--mobile-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--mobile-amber)]/25 transition-all"
  const labelClass = "mb-2 block text-[10px] font-black uppercase text-[var(--mobile-muted)]"
  const selectClass = "w-full appearance-none border border-[var(--mobile-line)] bg-[var(--mobile-paper)] px-4 py-4 text-sm font-black text-[var(--mobile-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--mobile-amber)]/25 transition-all"

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px] md:hidden"
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
            className="fixed bottom-0 left-0 right-0 z-[70] flex max-h-[90vh] flex-col overflow-hidden border-t border-[var(--mobile-line)] bg-[var(--mobile-canvas)] shadow-2xl md:hidden"
          >
            <div className="flex justify-center pt-4 pb-2 w-full touch-none cursor-grab active:cursor-grabbing">
              <div className="h-1 w-12 bg-[var(--mobile-line)]" />
            </div>

            <div className="overflow-y-auto overflow-x-hidden flex-1 pb-[env(safe-area-inset-bottom,24px)]">
              <div className="px-5 pb-4">
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <p className="text-[10px] font-black uppercase text-[var(--mobile-muted)]">Silox</p>
                    <h2 className="text-2xl font-black leading-none text-[var(--mobile-ink)]">Añadir operación</h2>
                  </div>
                  <button onClick={onClose} className="mobile-icon-button" aria-label="Cerrar">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {(step === "select" && newAssetStep === "search") && (
                  <div className="grid grid-cols-3 border border-[var(--mobile-line)] bg-[var(--mobile-paper)] p-1">
                    <button 
                      onClick={() => { setActiveTab("operacion"); resetForm() }} 
                      className={`py-2 text-[11px] font-black uppercase transition-colors ${activeTab === "operacion" ? "bg-[var(--mobile-ink)] text-[var(--mobile-canvas)]" : "text-[var(--mobile-muted)]"}`}
                    >
                      Activos
                    </button>
                    <button 
                      onClick={() => { setActiveTab("nuevo"); resetForm() }} 
                      className={`py-2 text-[11px] font-black uppercase transition-colors ${activeTab === "nuevo" ? "bg-[var(--mobile-ink)] text-[var(--mobile-canvas)]" : "text-[var(--mobile-muted)]"}`}
                    >
                      Nuevo
                    </button>
                    <button 
                      onClick={() => { setActiveTab("importar"); resetForm() }} 
                      className={`py-2 text-[11px] font-black uppercase transition-colors ${activeTab === "importar" ? "bg-[var(--mobile-ink)] text-[var(--mobile-canvas)]" : "text-[var(--mobile-muted)]"}`}
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
                  <div className="flex flex-col items-center justify-center space-y-3 border border-[var(--mobile-line)] bg-[var(--mobile-paper)] p-5 text-center">
                    <div className="mb-2 flex h-16 w-16 items-center justify-center border border-[var(--mobile-line)] text-[var(--mobile-amber)]">
                      <FileUp className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-black text-[var(--mobile-ink)]">Importar archivo</h3>
                    <p className="text-sm text-[var(--mobile-muted)]">Sube un archivo CSV o Excel con tus transacciones de brokers como Revolut, DeGiro, etc.</p>
                    
                    <div className="pt-4 w-full">
                      <RevolutSync className="w-full">
                        <div className="flex w-full items-center justify-center gap-2 bg-[var(--mobile-ink)] py-4 font-black text-[var(--mobile-canvas)]">
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
                            <p className="text-sm text-[var(--mobile-muted)]">No tienes activos aún.</p>
                            <button onClick={() => setActiveTab("nuevo")} className="mt-4 text-sm font-black text-[var(--mobile-amber)]">Buscar nuevo activo</button>
                         </div>
                      ) : (
                        positions.map((p) => {
                          const displayTicker = p.tipo === "Fondo Indexado" || p.tipo === "Fondo Monetario" ? p.nombre?.split(" ")[0]?.toUpperCase() || "FONDO" : p.ticker.split(".")[0]
                          return (
                            <motion.button
                              whileTap={{ scale: 0.96 }}
                              key={p.activo_id}
                              onClick={() => handleSelectAsset(p)}
                              className="flex w-full items-center gap-4 border border-[var(--mobile-line)] bg-[var(--mobile-paper)] p-4 text-left transition-colors active:bg-[var(--mobile-line)]/25"
                            >
                              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center border border-[var(--mobile-line)] bg-[var(--mobile-canvas)]">
                                <span className="text-base font-black text-[var(--mobile-ink)]">{displayTicker.slice(0, 2)}</span>
                              </div>
                              <div className="flex-1 overflow-hidden">
                                <p className="truncate text-base font-black text-[var(--mobile-ink)]">{displayTicker}</p>
                                <p className="truncate text-xs text-[var(--mobile-muted)]">{p.nombre}</p>
                              </div>
                              <div className="flex-shrink-0 text-right">
                                <p className="font-tabular text-sm font-black text-[var(--mobile-ink)]">{p.precio_actual ? formatCurrency(p.precio_actual) : "—"}</p>
                              </div>
                            </motion.button>
                          )
                        })
                      )}
                    </div>
                  )}

                  {step === "form" && selectedAsset && (
                    <div className="space-y-6 pb-6">
                       <div className="flex items-center gap-3 border border-[var(--mobile-line)] bg-[var(--mobile-paper)] p-4">
                          <div className="flex-1 min-w-0">
                             <p className="truncate text-sm font-black text-[var(--mobile-ink)]">{selectedAsset.ticker}</p>
                             <p className="truncate text-xs text-[var(--mobile-muted)]">{selectedAsset.nombre}</p>
                          </div>
                          <button onClick={() => setStep("select")} className="border border-[var(--mobile-line)] bg-[var(--mobile-canvas)] px-3 py-1.5 text-xs font-black text-[var(--mobile-ink)]">Cambiar</button>
                       </div>

                       {/* Buy/Sell */}
                       <div className="grid grid-cols-2 gap-3">
                         {(["Compra", "Venta"] as const).map((tipo) => (
                           <motion.button
                             whileTap={{ scale: 0.95 }}
                             key={tipo}
                             onClick={() => setTipoOp(tipo)}
                             className={`flex flex-col items-center justify-center gap-1 border py-4 transition-all ${tipoOp === tipo ? (tipo === "Compra" ? "border-[var(--mobile-positive)] bg-[var(--mobile-positive)] text-white" : "border-[var(--mobile-negative)] bg-[var(--mobile-negative)] text-white") : "border-[var(--mobile-line)] bg-[var(--mobile-paper)] text-[var(--mobile-muted)]"}`}
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
                               <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${premiumInputClass} !text-sm !py-3`} />
                             </div>
                          </div>
                       </div>

                       <motion.button 
                          whileTap={{ scale: 0.97 }}
                          onClick={handleSubmitTx}
                          disabled={isPending}
                          className={`flex w-full flex-col items-center justify-center py-4 text-lg font-black text-white transition-opacity disabled:opacity-50 ${isCompra ? "bg-[var(--mobile-positive)]" : "bg-[var(--mobile-negative)]"}`}
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
                       <p className="text-sm text-[var(--mobile-muted)]">Busca el activo por su Ticker o ISIN para añadirlo a tu cartera.</p>
                       <div className="space-y-4">
                          <div className="relative">
                            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--mobile-muted)]" />
                            <input 
                              type="text" 
                              placeholder="Ej: AAPL, VWCE.DE..." 
                              value={ticker} 
                              onChange={(e) => setTicker(e.target.value.toUpperCase())} 
                              className="w-full border border-[var(--mobile-line)] bg-[var(--mobile-paper)] py-4 pl-12 pr-4 text-lg font-black text-[var(--mobile-ink)] placeholder:font-medium placeholder:text-[var(--mobile-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--mobile-amber)]/25"
                            />
                          </div>
                          <div>
                            <label className={labelClass}>ISIN opcional</label>
                            <input
                              type="text"
                              placeholder="ES0000000000"
                              value={isin}
                              onChange={(e) => setIsin(e.target.value.toUpperCase())}
                              className={`${premiumInputClass} !text-base !py-3`}
                            />
                          </div>
                          
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={handleSearchTicker}
                            disabled={!ticker.trim() || isSearching}
                            className="flex w-full items-center justify-center gap-2 bg-[var(--mobile-ink)] py-4 text-base font-black text-[var(--mobile-canvas)] disabled:opacity-50"
                          >
                            {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                            Buscar Activo
                          </motion.button>
                       </div>
                     </div>
                  )}

                  {newAssetStep === "details" && (
                     <div className="space-y-6 pb-6">
                        <div className="flex items-center justify-between border border-[var(--mobile-line)] bg-[var(--mobile-paper)] p-4">
                          <div className="flex-1 overflow-hidden pr-2">
                             <p className="mb-1 text-xs font-black uppercase text-[var(--mobile-amber)]">Activo encontrado</p>
                             <p className="truncate text-lg font-black leading-tight text-[var(--mobile-ink)]">{ticker}</p>
                             <p className="truncate text-sm text-[var(--mobile-muted)]">{nombre || "—"}</p>
                          </div>
                          <button onClick={() => setNewAssetStep("search")} className="flex-shrink-0 border border-[var(--mobile-line)] bg-[var(--mobile-canvas)] px-3 py-1.5 text-xs font-black text-[var(--mobile-muted)]">Editar</button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className={labelClass}>Tipo</label>
                              <div className="relative">
                                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectClass}>
                                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[var(--mobile-muted)]">▼</div>
                              </div>
                           </div>
                           <div>
                              <label className={labelClass}>Moneda</label>
                              <div className="relative">
                                <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className={selectClass}>
                                  {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[var(--mobile-muted)]">▼</div>
                              </div>
                           </div>
                        </div>

                        <div>
                          <label className={labelClass}>Estrategia</label>
                          <div className="relative">
                            <select value={estrategia} onChange={(e) => setEstrategia(e.target.value)} className={selectClass}>
                              {ESTRATEGIAS.map((e) => <option key={e} value={e}>{e}</option>)}
                            </select>
                            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[var(--mobile-muted)]">▼</div>
                          </div>
                        </div>

                        {/* Compra inicial */}
                        <div className="border-t border-[var(--mobile-line)] pt-4">
                          <p className="mb-4 flex items-center gap-2 font-black text-[var(--mobile-ink)]">
                             <Plus className="h-5 w-5 text-[var(--mobile-positive)]" />
                             Primera inversión
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
                                 <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${premiumInputClass} !text-sm !py-3`} />
                               </div>
                            </div>
                          </div>
                        </div>

                        <motion.button 
                          whileTap={{ scale: 0.97 }}
                          onClick={handleSubmitNewAsset}
                          disabled={isPending}
                          className="flex w-full flex-col items-center justify-center bg-[var(--mobile-positive)] py-4 text-lg font-black text-white transition-opacity disabled:opacity-50"
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
