"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Clock, Trash2, Loader2, MoreHorizontal, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Transaccion } from "@/lib/types"
import { formatCurrency, formatUnits } from "@/lib/utils/formatters"
import { usePreferences } from "@/lib/stores/use-preferences"
import { useDeleteTransaction, useUpdateTransaction } from "@/lib/hooks/use-transactions"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EditTransactionModal } from "./edit-transaction-modal"

interface PendingOrdersProps {
  transactions: Transaccion[]
}

export function PendingOrders({ transactions }: PendingOrdersProps) {
  const { hideBalances } = usePreferences()
  const deleteTransaction = useDeleteTransaction()
  const updateTransaction = useUpdateTransaction()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingTx, setEditingTx] = useState<Transaccion | null>(null)

  if (!transactions || transactions.length === 0) {
    return null
  }

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id)
      await deleteTransaction.mutateAsync(id)
      toast.success("Operación rechazada y eliminada")
    } catch (error) {
      toast.error("Error al cancelar la operación")
      console.error(error)
    } finally {
      setDeletingId(null)
    }
  }

  const handleComplete = async (id: string) => {
    try {
      setDeletingId(id) // use same loading state indicator
      await updateTransaction.mutateAsync({ id, updates: { estado: "Completada" } })
      toast.success("Operación completada correctamente")
    } catch (error) {
      toast.error("Error al completar la operación")
      console.error(error)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card className="bg-card/50 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden mb-6">
      <CardHeader className="border-b border-border/20 px-6 py-4 flex flex-row items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          <CardTitle className="text-lg">Órdenes Pendientes</CardTitle>
          <Badge variant="outline" className="ml-2 bg-amber-500/10 text-amber-500 border-amber-500/20">
            {transactions.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border/20 hover:bg-transparent">
                <TableHead className="w-[200px]">Activo</TableHead>
                <TableHead>Operación</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio Límite</TableHead>
                <TableHead className="text-right pr-6">Coste Total</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id} className="border-border/10 hover:bg-muted/10 transition-colors">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{tx.activo?.ticker}</span>
                      <span className="text-xs text-muted-foreground hidden sm:inline">{tx.activo?.nombre}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                      {tx.tipo_operacion}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {hideBalances ? "****" : formatUnits(tx.cantidad)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {hideBalances ? "****" : formatCurrency(tx.precio_unitario, tx.activo?.moneda || 'USD')}
                  </TableCell>
                  <TableCell className="text-right pr-6 tabular-nums">
                    {hideBalances ? "****" : formatCurrency(tx.cantidad * tx.precio_unitario, tx.activo?.moneda || 'USD')}
                  </TableCell>
                  <TableCell>
                    {deletingId === tx.id ? (
                      <div className="p-2 flex justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px]">
                          <DropdownMenuItem onClick={() => setEditingTx(tx)} className="cursor-pointer">
                            <Edit2 className="mr-2 h-4 w-4 text-blue-500" />
                            <span>Editar</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleComplete(tx.id)} className="cursor-pointer">
                            <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
                            <span>Completar</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(tx.id)} className="text-rose-500 cursor-pointer">
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Rechazar</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      
      {editingTx && (
        <EditTransactionModal 
          transaction={editingTx} 
          open={!!editingTx} 
          onOpenChange={(o) => !o && setEditingTx(null)} 
        />
      )}
    </Card>
  )
}
