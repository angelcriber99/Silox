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

  // State for modals
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedTx, setSelectedTx] = useState<Transaccion | null>(null)

  // State for filters
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<"Todos" | "Compra" | "Venta">("Todos")
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
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <History className="h-8 w-8 text-blue-500" />
              Libro de Movimientos
            </h1>
            <p className="text-muted-foreground">
              Historial completo de operaciones. Utiliza este registro para tu contabilidad.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ExportExcelButton 
              transactions={transactions || []} 
              positions={positions || []} 
            />
            <Link 
              href="/declarar" 
              className="flex items-center gap-2 bg-muted hover:bg-zinc-700 text-foreground px-4 py-2.5 rounded-lg font-medium transition-colors border border-border whitespace-nowrap"
            >
              <Scale className="h-4 w-4 text-blue-400" />
              Asistente de Declaración
            </Link>
          </div>
        </div>

        {/* Filters Section */}
        <div className="flex flex-col gap-3 bg-card/40 border border-border p-3 md:p-4 rounded-xl backdrop-blur-sm">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/80" />
            <Input 
              placeholder="Buscar por activo o ticker..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background border-border text-foreground w-full h-10"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar w-full">
            <select 
              className="flex-shrink-0 appearance-none bg-background border border-border text-sm text-foreground/80 rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500/50 cursor-pointer"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="Todos">Todas las operaciones</option>
              <option value="Compra">Solo Compras</option>
              <option value="Venta">Solo Ventas</option>
            </select>
            
            <div className="flex items-center gap-2 flex-shrink-0 bg-background border border-border rounded-lg px-3 py-2">
              <span className="text-xs text-muted-foreground/80">Desde</span>
              <input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)} 
                className="bg-transparent text-sm text-foreground/80 outline-none w-auto [color-scheme:dark]"
              />
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0 bg-background border border-border rounded-lg px-3 py-2">
              <span className="text-xs text-muted-foreground/80">Hasta</span>
              <input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)} 
                className="bg-transparent text-sm text-foreground/80 outline-none w-auto [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="border border-border bg-card/40 rounded-xl overflow-hidden backdrop-blur-sm">
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
              <tbody className="divide-y divide-zinc-800/60">
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
                    const total = isCompra 
                      ? tx.cantidad * tx.precio_unitario + tx.comision 
                      : tx.cantidad * tx.precio_unitario - tx.comision
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
                            isCompra ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                          }`}>
                            {isCompra ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {tx.tipo_operacion}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground/90">{ticker}</span>
                            <span className="text-xs text-muted-foreground/80 truncate max-w-[200px]">{tx.activo?.nombre}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-tabular text-foreground/80">
                          {formatUnits(tx.cantidad)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-tabular text-foreground/80">
                          {tx.precio_unitario.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-tabular text-muted-foreground/80">
                          {tx.comision > 0 ? formatCurrency(tx.comision) : "0,00"}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-right font-tabular font-medium ${
                          isCompra ? "text-emerald-400" : "text-rose-400"
                        }`}>
                          {isCompra ? "-" : "+"}{formatCurrency(total)}
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
          <div className="md:hidden flex flex-col divide-y divide-zinc-800/40">
            {isLoading ? (
               Array.from({ length: 4 }).map((_, i) => (
                 <div key={i} className="p-4 flex flex-col gap-3">
                   <div className="flex justify-between">
                     <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                     <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                   </div>
                   <div className="h-10 w-full bg-muted animate-pulse rounded" />
                 </div>
               ))
            ) : filteredTransactions.length === 0 ? (
               <div className="text-center text-muted-foreground/60 py-16">
                 <div className="flex flex-col items-center gap-3">
                   <History className="h-10 w-10 text-muted-foreground/60 mb-2 opacity-50" />
                   <p className="font-medium text-muted-foreground">No se encontraron movimientos</p>
                 </div>
               </div>
            ) : (
              filteredTransactions.map((tx) => {
                 const isCompra = tx.tipo_operacion === "Compra"
                 const total = isCompra 
                   ? tx.cantidad * tx.precio_unitario + tx.comision 
                   : tx.cantidad * tx.precio_unitario - tx.comision
                 const date = new Date(tx.fecha).toLocaleDateString('es-ES', {
                   month: 'short',
                   day: 'numeric'
                 })

                 const isFondo = tx.activo?.tipo === "Fondo Indexado" || tx.activo?.tipo === "Fondo Monetario"
                 const ticker = tx.activo 
                   ? (isFondo ? tx.activo.nombre?.split(' ')[0].toUpperCase() : tx.activo.ticker.split('.')[0])
                   : "—"

                 return (
                   <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                     <div className="flex items-center gap-3 overflow-hidden">
                       <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                          isCompra ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        }`}>
                          {isCompra ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-foreground text-[15px] truncate">{ticker}</span>
                          <span className="text-xs font-medium text-muted-foreground/80 truncate">{isCompra ? "Compra" : "Venta"} • {date}</span>
                        </div>
                     </div>

                     <div className="flex items-center gap-2 flex-shrink-0">
                       <div className="flex flex-col items-end">
                          <span className={`text-[15px] font-bold font-tabular leading-tight ${isCompra ? "text-foreground" : "text-emerald-400"}`}>
                            {isCompra ? "-" : "+"}{formatCurrency(total)}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground/80 font-tabular mt-0.5">
                            {formatUnits(tx.cantidad)} a {tx.precio_unitario.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}€
                          </span>
                       </div>
                       
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-1.5 -mr-1.5 hover:bg-muted rounded-md focus:outline-none flex items-center justify-center">
                            <MoreHorizontal className="h-5 w-5 text-muted-foreground/60" />
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
