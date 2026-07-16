"use client"
import { useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, Wallet, PiggyBank, History, DollarSign } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils/formatters"
import type { EnrichedPosition } from '@/lib/types'
import { useAssetCalculations, RawTransaction } from './detail/use-asset-calculations'
import { Card, CardContent } from "@/components/ui/card"

interface LiquidityDetailClientProps {
  position: EnrichedPosition
  transactions: RawTransaction[]
}

export function LiquidityDetailClient({ position, transactions }: LiquidityDetailClientProps) {
  const { txTableData } = useAssetCalculations(position, transactions)

  // Calculemos las aportaciones totales y retiradas de efectivo
  const metrics = useMemo(() => {
    let totalDepositos = 0
    let totalRetiradas = 0

    transactions.forEach(tx => {
      const tipo = tx.tipo_operacion?.toLowerCase() || ''
      const isDeposit = tipo === 'compra' || tipo === 'deposito' || tipo === 'ingreso'
      const isWithdrawal = tipo === 'venta' || tipo === 'retiro' || tipo === 'retirada'
      
      const qty = Number(tx.cantidad) || 0
      const price = Number(tx.precio_unitario) || 0
      const amount = qty * price

      if (tx.estado !== 'Pendiente') {
        if (isDeposit) totalDepositos += amount
        if (isWithdrawal) totalRetiradas += amount
      }
    })

    return { totalDepositos, totalRetiradas }
  }, [transactions])

  return (
    <div className="min-h-screen bg-background selection:bg-emerald-500/30">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Volver</span>
          </Link>
          <div className="flex items-center gap-2.5">
             <span className="text-xs uppercase font-semibold text-muted-foreground tracking-widest text-emerald-500">
                Liquidez
             </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 pb-20">

        {/* HERO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 animate-fade-in">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
                Efectivo Disponible
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground mb-1">
              Cartera CASH
            </h1>
            <p className="text-lg text-muted-foreground font-medium">
              Dinero líquido listo para invertir
            </p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-sm text-muted-foreground uppercase font-bold tracking-wider mb-1">Saldo Actual</p>
            <p className="text-5xl font-bold text-foreground tabular-nums drop-shadow-md text-emerald-500">
              {formatCurrency(position.valor_actual || 0, 'EUR')}
            </p>
          </div>
        </div>

        {/* METRICS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border border border-border mb-12">
          <div className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Total Ingresado</p>
                <p className="text-2xl font-medium text-foreground tabular-nums">{formatCurrency(metrics.totalDepositos, 'EUR')}</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Total Retirado</p>
                <p className="text-2xl font-medium text-foreground tabular-nums">{formatCurrency(metrics.totalRetiradas, 'EUR')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* HISTORIAL */}
        <div className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Historial de Movimientos
          </h2>
          
          <div className="border-t border-border overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-muted-foreground text-[11px] uppercase tracking-widest font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-4 font-semibold">Tipo</th>
                  <th className="px-4 py-4 font-semibold">Fecha</th>
                  <th className="px-4 py-4 text-right font-semibold">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {txTableData.length > 0 ? txTableData.map((tx) => {
                  const isDeposit = tx.tipo_operacion === 'Compra' || tx.tipo_operacion === 'Depósito' || tx.tipo_operacion === 'Ingreso'
                  return (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4 text-foreground/80 whitespace-nowrap">
                        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: isDeposit ? "var(--positive)" : "var(--negative)" }}>
                          {isDeposit ? 'Ingreso / Depósito' : 'Retirada / Venta'}
                        </span>
                        {tx.estado === 'Pendiente' && (
                          <span className="ml-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-foreground/80">
                        {new Date(tx.fecha).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums font-medium text-foreground">
                        {isDeposit ? '+' : '-'}{formatCurrency(tx.total, 'EUR')}
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center">
                      <p className="text-muted-foreground font-medium text-sm">No hay movimientos de efectivo todavía</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  )
}
