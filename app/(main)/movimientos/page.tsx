"use client"

import { useState, useMemo } from "react"
import { useTransactions, useDeleteTransaction } from "@/lib/hooks/use-transactions"
import { formatCurrency, formatUnits } from "@/lib/utils/formatters"
import { ArrowUpRight, ArrowDownRight, History, MoreHorizontal, Pencil, Trash2, Search, Filter, Scale } from "lucide-react"
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
        <div className="mobile-panel md:bg-transparent md:border-0 md:shadow-none flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 p-4 md:p-0">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "oklch(0.68 0.17 192 / 0.12)", border: "1px solid oklch(0.68 0.17 192 / 0.20)" }}
              >
                <History className="h-5 w-5" style={{ color: "var(--primary)" }} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-normal" style={{ color: "var(--foreground)" }}>
                Movimientos
              </h1>
            </div>
            <p className="text-xs md:text-sm pl-[52px]" style={{ color: "var(--muted-foreground)" }}>
              Historial completo de operaciones y contabilidad personal.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <ExportExcelButton 
              transactions={transactions || []} 
              positions={positions || []} 
            />
            <Link 
              href="/declarar" 
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all"
              style={{
                background: "oklch(0.68 0.17 192 / 0.10)",
                border: "1px solid oklch(0.68 0.17 192 / 0.25)",
                color: "var(--primary)",
              }}
            >
              <Scale className="h-4 w-4" />
              Declarar
            </Link>
          </div>
        </div>

        {/* ── Filters ──────────────────────────────────────────────── */}
        <div
          className="mobile-panel flex flex-col gap-3 p-3 md:p-4"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
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
              className="pl-10 w-full h-11 rounded-lg"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar w-full">
            {(["Todos", "Compra", "Venta", "Dividendo"] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setTypeFilter(opt)}
                className="flex-shrink-0 px-3.5 py-2 rounded-md text-xs font-black uppercase tracking-[0.04em] transition-all"
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
                   <div key={tx.id} className="space-y-2">
                   {showMonthHeader && (
                     <div className="flex items-center gap-2 px-1 pt-2">
                       <span className="mobile-caption">{monthLabel}</span>
                       <span className="h-px flex-1 bg-border/50" />
                     </div>
                   )}
                   <div className="mobile-panel relative flex items-center justify-between p-3.5 pl-4 transition-colors active:bg-muted/40">
                     <span
                       className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${isCompra ? "bg-emerald-500" : isDividendo ? "bg-violet-500" : "bg-rose-500"}`}
                     />
                     <div className="flex items-center gap-3 overflow-hidden">
                       <div className={`flex-shrink-0 h-11 w-11 rounded-lg flex items-center justify-center ${
                          isCompra ? "bg-emerald-500/10 text-emerald-400" : isDividendo ? "bg-violet-500/10 text-violet-400" : "bg-rose-500/10 text-rose-400"
                        }`}>
                          {isCompra ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-black text-foreground text-[15px] truncate">{ticker}</span>
                          <span className="text-[11px] font-bold text-muted-foreground/80 truncate">
                            {tx.tipo_operacion} • {date}
                            {tx.estado === "Pendiente" && (
                              <span className="ml-1.5 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                Pendiente
                              </span>
                            )}
                          </span>
                        </div>
                     </div>

                     <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <div className="flex flex-col items-end min-w-0">
                           <span className={`mobile-value text-[14px] font-black leading-tight truncate max-w-[112px] ${isCompra ? "text-foreground" : isDividendo ? "text-violet-400" : "text-emerald-400"}`}>
                             {hideBalances ? "****" : `${isCompra ? "-" : "+"}${formatCurrency(total, tx.activo?.moneda || "EUR")}`}
                           </span>
                           <span className="mobile-value text-[10px] font-bold text-muted-foreground/80 mt-0.5 truncate max-w-[112px]">
                             {hideBalances ? "****" : `${formatUnits(tx.cantidad)} × ${tx.precio_unitario.toLocaleString('es-ES', { maximumFractionDigits: 2 })}`}
                           </span>
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-1 hover:bg-muted rounded-md focus:outline-none flex items-center justify-center">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground/60" />
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
