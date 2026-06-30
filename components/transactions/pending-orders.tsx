"use client"

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
import { Clock, Trash2, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Transaccion } from "@/lib/types"
import { formatCurrency, formatUnits } from "@/lib/utils/formatters"
import { usePreferences } from "@/lib/stores/use-preferences"

interface PendingOrdersProps {
  transactions: Transaccion[]
}

export function PendingOrders({ transactions }: PendingOrdersProps) {
  const { hideBalances } = usePreferences()

  if (!transactions || transactions.length === 0) {
    return null
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
                  <TableCell className="text-right font-tabular">
                    {hideBalances ? "****" : formatUnits(tx.cantidad)}
                  </TableCell>
                  <TableCell className="text-right font-tabular text-muted-foreground">
                    {hideBalances ? "****" : formatCurrency(tx.precio_unitario, tx.activo?.moneda || 'USD')}
                  </TableCell>
                  <TableCell className="text-right pr-6 font-tabular">
                    {hideBalances ? "****" : formatCurrency(tx.cantidad * tx.precio_unitario, tx.activo?.moneda || 'USD')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
