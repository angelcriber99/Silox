"use client"

import { useState, useMemo } from "react"
import { useTransactions, useDeleteTransaction } from "@/lib/hooks/use-transactions"
import { formatCurrency, formatUnits } from "@/lib/utils/formatters"
import { ArrowUpRight, ArrowDownRight, History, MoreHorizontal, Pencil, Search, Filter, Scale } from "lucide-react"
import { toast } from "sonner"
import type { Transaccion } from '@/lib/types'
import { EditTransactionModal } from "@/components/transactions/edit-transaction-modal"
import { ExportExcelButton } from "@/components/transactions/export-excel-button"
import { Input } from "@/components/ui/input"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import Link from "next/link"
import { usePreferences } from "@/lib/stores/use-preferences"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function MovimientosPage() {
  const { data: transactions, isLoading } = useTransactions(1000)
  const deleteTransaction = useDeleteTransaction()
  const { positions } = usePortfolio()
  const { hideBalances } = usePreferences()

  // State for modals
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedTx, setSelectedTx] = useState<Transaccion | null>(null)

  // State for filters
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<"Todos" | "Compra" | "Venta" | "Dividendo">("Todos")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const handleDelete = async (id: string) => {
    if (window.confirm("¿Seguro que deseas eliminar esta transacción de forma permanente?")) {
      try {
        await deleteTransaction.mutateAsync(id)
        toast.success("Transacción eliminada")
      } catch (err) {
        toast.error("Error al eliminar la transacción")
      }
    }
  }

  const handleEdit = (tx: Transaccion) => {
    setSelectedTx(tx)
    setEditModalOpen(true)
  }

  // Filter logic
  const filteredTransactions = useMemo(() => {
    if (!transactions) return []

    const now = new Date()
    const currentYear = now.getFullYear()

    return transactions.filter((tx) => {
      // 0. Exclude Efectivo/CASH (since they clutter the view when buying assets)
      if (
        tx.notas?.includes("[Auto-Cash:") || 
        tx.notas?.includes("Auto-liquidez") ||
        tx.activo?.ticker?.startsWith('CASH') ||
        tx.activo?.nombre?.toLowerCase().includes('efectivo')
      ) {
        return false
      }
      // 1. Text Search (Asset name or ticker)
      const matchesSearch = searchQuery === "" || 
        tx.activo?.nombre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.activo?.ticker?.toLowerCase().includes(searchQuery.toLowerCase())

      // 2. Type Filter
      const matchesType = typeFilter === "Todos" || tx.tipo_operacion === typeFilter

      // 3. Date Filter
      let matchesDate = true
      const txDate = new Date(tx.fecha)
      if (dateFrom) {
        matchesDate = matchesDate && txDate >= new Date(dateFrom)
      }
      if (dateTo) {
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999)
        matchesDate = matchesDate && txDate <= toDate
      }

      return matchesSearch && matchesType && matchesDate
    })
  }, [transactions, searchQuery, typeFilter, dateFrom, dateTo])

  return (
    <main className="mobile-screen min-h-full text-foreground flex flex-col md:bg-background">
      <div className="flex-1 max-w-7xl mx-auto w-full px-3 md:px-6 pb-10 space-y-5 md:space-y-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 18px)' }}>
        
        {/* ── Page Header ────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 md:items-center">
          <div className="min-w-0">
            <p className="mobile-caption mb-1">Historial financiero</p>
            <h1 className="text-[32px] font-black leading-tight tracking-normal text-foreground sm:text-4xl">
              Movimientos
            </h1>
            <p className="mt-1 max-w-[240px] text-xs font-semibold text-muted-foreground md:max-w-none md:text-sm">
              Operaciones, dividendos y contabilidad personal.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ExportExcelButton 
              transactions={transactions || []} 
              positions={positions || []} 
            />
            <Link 
              href="/declarar" 
              className="mobile-focus-ring inline-flex h-10 w-10 items-center justify-center rounded-lg font-bold transition-all md:h-auto md:w-auto md:gap-2 md:px-4 md:py-2.5"
              style={{
                background: "oklch(0.68 0.17 192 / 0.10)",
                border: "1px solid oklch(0.68 0.17 192 / 0.25)",
                color: "var(--primary)",
              }}
            >
              <Scale className="h-4 w-4" />
              <span className="hidden md:inline">Declarar</span>
            </Link>
          </div>
        </div>

        {/* ── Filters ──────────────────────────────────────────────── */}
        <div className="mobile-panel-muted flex flex-col gap-3 p-2.5 md:p-4">
          {/* Search */}
          <div className="relative w-full">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: "var(--muted-foreground)", opacity: 0.6 }}
            />
            <Input 
              placeholder="Buscar por activo o ticker..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 w-full rounded-lg pl-10 pr-11 font-semibold"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
            <Filter
              className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: "var(--muted-foreground)", opacity: 0.7 }}
            />
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar w-full">
            {(["Todos", "Compra", "Venta", "Dividendo"] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setTypeFilter(opt)}
                className="flex-shrink-0 rounded-md px-3.5 py-2 text-xs font-black uppercase tracking-[0.04em] transition-all"
                style={{
                  background: typeFilter === opt ? "oklch(0.68 0.17 192 / 0.12)" : "var(--muted)",
                  border: typeFilter === opt ? "1px solid oklch(0.68 0.17 192 / 0.30)" : "1px solid transparent",
                  color: typeFilter === opt ? "var(--primary)" : "var(--muted-foreground)",
                }}
              >
                {opt === "Todos" ? "Todas" : opt === "Compra" ? "Compras" : opt === "Venta" ? "Ventas" : "Dividendos"}
              </button>
            ))}

            <div
              className="flex items-center gap-2 flex-shrink-0 rounded-md px-3 py-2"
              style={{ background: "var(--muted)", border: "1px solid transparent" }}
            >
              <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>Desde</span>
              <input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)} 
                className="bg-transparent text-sm outline-none w-auto [color-scheme:dark]"
                style={{ color: "var(--foreground)" }}
              />
            </div>
            
            <div
              className="flex items-center gap-2 flex-shrink-0 rounded-md px-3 py-2"
              style={{ background: "var(--muted)", border: "1px solid transparent" }}
            >
              <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>Hasta</span>
              <input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)} 
                className="bg-transparent text-sm outline-none w-auto [color-scheme:dark]"
                style={{ color: "var(--foreground)" }}
              />
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="md:border md:border-border md:bg-card/40 md:rounded-xl overflow-hidden md:backdrop-blur-sm">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-card/80 border-b border-border text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Fecha</th>
                  <th className="px-6 py-4 font-medium">Operación</th>
                  <th className="px-6 py-4 font-medium">Activo</th>
                  <th className="px-6 py-4 font-medium text-right">Unidades</th>
                  <th className="px-6 py-4 font-medium text-right">Precio</th>
                  <th className="px-6 py-4 font-medium text-right">Comisión</th>
                  <th className="px-6 py-4 font-medium text-right">Total</th>
                  <th className="px-4 py-4 font-medium text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4"><div className="h-4 w-24 bg-muted animate-pulse rounded" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-20 bg-muted animate-pulse rounded" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-32 bg-muted animate-pulse rounded" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-20 bg-muted animate-pulse rounded ml-auto" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-24 bg-muted animate-pulse rounded ml-auto" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-8 bg-muted animate-pulse rounded mx-auto" /></td>
                    </tr>
                  ))
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <History className="h-10 w-10 text-muted-foreground/60 mb-2" />
                        <p className="text-foreground/80 font-medium text-base">No se encontraron movimientos</p>
                        <p className="text-muted-foreground/80 text-sm">Ajusta los filtros para ver más resultados.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isCompra = tx.tipo_operacion === "Compra"
                    const isDividendo = tx.tipo_operacion === "Dividendo"
                    let total = 0
                    if (isCompra) {
                      total = tx.cantidad * tx.precio_unitario + tx.comision
                    } else if (isDividendo) {
                      total = tx.precio_unitario - tx.comision - (tx.retencion_origen || 0) - (tx.retencion_destino || 0)
                    } else {
                      total = tx.cantidad * tx.precio_unitario - tx.comision
                    }
                    const date = new Date(tx.fecha).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })

                    const isFondo = tx.activo?.tipo === "Fondo Indexado" || tx.activo?.tipo === "Fondo Monetario"
                    const ticker = tx.activo 
                      ? (isFondo ? tx.activo.nombre?.split(' ')[0].toUpperCase() : tx.activo.ticker.split('.')[0])
                      : "—"

                    return (
                      <tr key={tx.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap text-foreground/80">
                          {date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            isCompra ? "bg-emerald-500/10 text-emerald-400" : isDividendo ? "bg-violet-500/10 text-violet-400" : "bg-rose-500/10 text-rose-400"
                          }`}>
                            {isCompra ? <ArrowUpRight className="h-3 w-3" /> : isDividendo ? <ArrowDownRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {tx.tipo_operacion}
                          </span>
                          {tx.estado === "Pendiente" && (
                            <span className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground/90">{ticker}</span>
                            <span className="text-xs text-muted-foreground/80 truncate max-w-[200px]">{tx.activo?.nombre}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-tabular text-foreground/80">
                          {hideBalances ? "****" : formatUnits(tx.cantidad)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-tabular text-foreground/80">
                          {hideBalances ? "****" : tx.precio_unitario.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-tabular text-muted-foreground/80">
                          {hideBalances ? "****" : (tx.comision > 0 ? formatCurrency(tx.comision, tx.activo?.moneda || "EUR") : "0,00")}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-right font-tabular font-medium ${
                          isCompra ? "text-emerald-400" : isDividendo ? "text-violet-400" : "text-rose-400"
                        }`}>
                          {hideBalances ? "****" : `${isCompra ? "-" : "+"}${formatCurrency(total, tx.activo?.moneda || "EUR")}`}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-muted rounded-md focus:outline-none focus:opacity-100">
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card border-border text-foreground/90 min-w-[140px]">
                              <DropdownMenuItem 
                                onClick={() => handleEdit(tx)}
                                className="hover:bg-muted focus:bg-muted cursor-pointer flex items-center gap-2"
                              >
                                <Pencil className="h-4 w-4" /> Editar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden flex flex-col gap-2">
            {isLoading ? (
               Array.from({ length: 4 }).map((_, i) => (
                 <div key={i} className="mobile-panel p-4 flex flex-col gap-3">
                   <div className="flex justify-between">
                     <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                     <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                   </div>
                   <div className="h-10 w-full bg-muted animate-pulse rounded" />
                 </div>
               ))
            ) : filteredTransactions.length === 0 ? (
               <div className="mobile-panel text-center text-muted-foreground/60 py-16">
                 <div className="flex flex-col items-center gap-3">
                   <History className="h-10 w-10 text-muted-foreground/60 mb-2 opacity-50" />
                   <p className="font-medium text-muted-foreground">No se encontraron movimientos</p>
                 </div>
               </div>
            ) : (
              filteredTransactions.map((tx, index) => {
                 const isCompra = tx.tipo_operacion === "Compra"
                 const isDividendo = tx.tipo_operacion === "Dividendo"
                 let total = 0
                 if (isCompra) {
                   total = tx.cantidad * tx.precio_unitario + tx.comision
                 } else if (isDividendo) {
                   total = tx.precio_unitario - tx.comision - (tx.retencion_origen || 0) - (tx.retencion_destino || 0)
                 } else {
                   total = tx.cantidad * tx.precio_unitario - tx.comision
                 }
                 const date = new Date(tx.fecha).toLocaleDateString('es-ES', {
                   month: 'short',
                   day: 'numeric'
                 })
                 const monthLabel = new Date(tx.fecha).toLocaleDateString('es-ES', {
                   month: 'long',
                   year: 'numeric'
                 })
                 const previousMonthLabel = index > 0
                   ? new Date(filteredTransactions[index - 1].fecha).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                   : null
                 const showMonthHeader = monthLabel !== previousMonthLabel

                 const isFondo = tx.activo?.tipo === "Fondo Indexado" || tx.activo?.tipo === "Fondo Monetario"
                 const ticker = tx.activo 
                   ? (isFondo ? tx.activo.nombre?.split(' ')[0].toUpperCase() : tx.activo.ticker.split('.')[0])
                   : "—"

                 return (
                   <div key={tx.id}>
                     {showMonthHeader && (
                       <div className="grid grid-cols-[54px_1fr] items-center pt-3">
                         <div className="flex justify-center">
                           <span className="h-2 w-2 rounded-full bg-primary" />
                         </div>
                         <div className="flex items-center gap-2">
                           <span className="mobile-caption">{monthLabel}</span>
                           <span className="h-px flex-1 bg-border/50" />
                         </div>
                       </div>
                     )}
                     <div className="grid grid-cols-[54px_1fr]">
                       <div className="relative flex justify-center">
                         <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/60" />
                         <span
                           className={`relative mt-4 flex h-10 w-10 items-center justify-center rounded-lg border ${
                            isCompra ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" : isDividendo ? "border-violet-500/25 bg-violet-500/10 text-violet-400" : "border-rose-500/25 bg-rose-500/10 text-rose-400"
                          }`}
                         >
                           {isCompra ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                         </span>
                       </div>

                       <div className="mobile-panel mb-3 p-3.5 transition-colors active:bg-muted/40">
                         <div className="mb-3 flex items-start justify-between gap-3">
                           <div className="min-w-0">
                             <div className="flex items-center gap-2">
                               <span className="truncate text-[15px] font-black text-foreground">{ticker}</span>
                               <span
                                 className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${
                                  isCompra ? "bg-emerald-500/10 text-emerald-400" : isDividendo ? "bg-violet-500/10 text-violet-400" : "bg-rose-500/10 text-rose-400"
                                }`}
                               >
                                 {tx.tipo_operacion}
                               </span>
                             </div>
                             <p className="mt-1 truncate text-[11px] font-semibold text-muted-foreground/80">
                               {tx.activo?.nombre || "Activo"} • {date}
                             </p>
                           </div>

                           <DropdownMenu>
                             <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted focus:outline-none">
                               <MoreHorizontal className="h-4 w-4 text-muted-foreground/70" />
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end" className="bg-card border-border text-foreground/90 min-w-[140px]">
                               <DropdownMenuItem
                                 onClick={() => handleEdit(tx)}
                                 className="hover:bg-muted focus:bg-muted cursor-pointer flex items-center gap-2"
                               >
                                 <Pencil className="h-4 w-4" /> Editar
                               </DropdownMenuItem>
                             </DropdownMenuContent>
                           </DropdownMenu>
                         </div>

                         <div className="flex items-end justify-between gap-3">
                           <div>
                             <p className="mobile-caption">Unidades</p>
                             <p className="mobile-value mt-0.5 text-[12px] font-black text-foreground">
                               {hideBalances ? "****" : formatUnits(tx.cantidad)}
                             </p>
                           </div>
                           <div className="min-w-0 text-right">
                             <p className="mobile-caption">Importe</p>
                             <p className={`mobile-value mt-0.5 truncate text-[16px] font-black ${isCompra ? "text-foreground" : isDividendo ? "text-violet-400" : "text-emerald-400"}`}>
                               {hideBalances ? "****" : `${isCompra ? "-" : "+"}${formatCurrency(total, tx.activo?.moneda || "EUR")}`}
                             </p>
                             <p className="mobile-value mt-0.5 truncate text-[10px] font-bold text-muted-foreground/80">
                               {hideBalances ? "****" : `${tx.precio_unitario.toLocaleString('es-ES', { maximumFractionDigits: 2 })} / ud.`}
                             </p>
                           </div>
                         </div>

                         {tx.estado === "Pendiente" && (
                           <div className="mt-3 inline-flex rounded bg-amber-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-500 ring-1 ring-amber-500/20">
                             Pendiente
                           </div>
                         )}
                       </div>
                     </div>
                   </div>
                 )
              })
            )}
          </div>
        </div>
      </div>
      
      <EditTransactionModal 
        transaction={selectedTx} 
        open={editModalOpen} 
        onOpenChange={setEditModalOpen} 
      />
    </main>
  )
}
