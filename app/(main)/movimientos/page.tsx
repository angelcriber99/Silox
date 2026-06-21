"use client"

import { useState, useMemo } from "react"
import { useTransactions, useDeleteTransaction } from "@/lib/hooks/use-transactions"
import { formatCurrency, formatUnits } from "@/lib/utils/formatters"
import { ArrowUpRight, ArrowDownRight, History, MoreHorizontal, Pencil, Trash2, Search, Filter, Scale } from "lucide-react"
import { toast } from "sonner"
import type { Transaccion } from '@/lib/types'
import { EditTransactionModal } from "@/components/transactions/edit-transaction-modal"
import { Input } from "@/components/ui/input"
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
    <main className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <History className="h-8 w-8 text-blue-500" />
              Libro de Movimientos
            </h1>
            <p className="text-zinc-400">
              Historial completo de operaciones. Utiliza este registro para tu contabilidad.
            </p>
          </div>
          <Link 
            href="/declarar" 
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors border border-zinc-700"
          >
            <Scale className="h-4 w-4 text-blue-400" />
            Asistente de Declaración
          </Link>
        </div>

        {/* Filters Section */}
        <div className="flex flex-col sm:flex-row gap-4 items-center bg-zinc-900/40 border border-zinc-800/60 p-4 rounded-xl backdrop-blur-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input 
              placeholder="Buscar por activo o ticker..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-zinc-950 border-zinc-700 text-white w-full"
            />
          </div>
          <div className="flex flex-wrap gap-4 w-full md:w-auto md:flex-nowrap">
            <div className="relative min-w-[160px]">
              <select 
                className="appearance-none bg-zinc-950 border border-zinc-700 text-sm text-zinc-300 rounded-md pl-4 pr-10 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
              >
                <option value="Todos">Todas las operaciones</option>
                <option value="Compra">Solo Compras</option>
                <option value="Venta">Solo Ventas</option>
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500 whitespace-nowrap">Desde</span>
              <Input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)} 
                className="bg-zinc-950 border-zinc-700 text-zinc-300 w-auto min-w-[130px] [color-scheme:dark]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500 whitespace-nowrap">Hasta</span>
              <Input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)} 
                className="bg-zinc-950 border-zinc-700 text-zinc-300 w-auto min-w-[130px] [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="border border-zinc-800/60 bg-zinc-900/40 rounded-xl overflow-hidden backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-900/80 border-b border-zinc-800/60 text-zinc-400">
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
                      <td className="px-6 py-4"><div className="h-4 w-24 bg-zinc-800 animate-pulse rounded" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-20 bg-zinc-800 animate-pulse rounded" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-32 bg-zinc-800 animate-pulse rounded" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-16 bg-zinc-800 animate-pulse rounded ml-auto" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-20 bg-zinc-800 animate-pulse rounded ml-auto" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-16 bg-zinc-800 animate-pulse rounded ml-auto" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-24 bg-zinc-800 animate-pulse rounded ml-auto" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-8 bg-zinc-800 animate-pulse rounded mx-auto" /></td>
                    </tr>
                  ))
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <History className="h-10 w-10 text-zinc-600 mb-2" />
                        <p className="text-zinc-300 font-medium text-base">No se encontraron movimientos</p>
                        <p className="text-zinc-500 text-sm">Ajusta los filtros para ver más resultados.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isCompra = tx.tipo_operacion === "Compra"
                    const total = tx.cantidad * tx.precio_unitario + tx.comision
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
                      <tr key={tx.id} className="hover:bg-zinc-800/30 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap text-zinc-300">
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
                            <span className="font-medium text-zinc-200">{ticker}</span>
                            <span className="text-xs text-zinc-500 truncate max-w-[200px]">{tx.activo?.nombre}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-tabular text-zinc-300">
                          {formatUnits(tx.cantidad)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-tabular text-zinc-300">
                          {tx.precio_unitario.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-tabular text-zinc-500">
                          {tx.comision > 0 ? formatCurrency(tx.comision) : "0,00"}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-right font-tabular font-medium ${
                          isCompra ? "text-emerald-400" : "text-rose-400"
                        }`}>
                          {isCompra ? "-" : "+"}{formatCurrency(total)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-zinc-800 rounded-md focus:outline-none focus:opacity-100">
                              <MoreHorizontal className="h-4 w-4 text-zinc-400" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 text-zinc-200 min-w-[140px]">
                              <DropdownMenuItem 
                                onClick={() => handleEdit(tx)}
                                className="hover:bg-zinc-800 focus:bg-zinc-800 cursor-pointer flex items-center gap-2"
                              >
                                <Pencil className="h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(tx.id)}
                                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 focus:bg-rose-500/10 cursor-pointer flex items-center gap-2"
                              >
                                <Trash2 className="h-4 w-4" /> Eliminar
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
