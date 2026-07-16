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
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Volver</span>
          </Link>
          <div className="flex items-center gap-2.5">
             <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                Liquidez
             </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 pb-20">

        {/* HERO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 animate-fade-in">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                Efectivo Disponible
              </Badge>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12 animate-fade-in stagger-1">
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">Total Ingresado</p>
                  <p className="text-2xl font-bold tabular-nums">{formatCurrency(metrics.totalDepositos, 'EUR')}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <PiggyBank className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-rose-500/5 border-rose-500/20">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">Total Retirado</p>
                  <p className="text-2xl font-bold tabular-nums">{formatCurrency(metrics.totalRetiradas, 'EUR')}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-rose-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* HISTORIAL */}
        <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2 animate-fade-in stagger-2">
          <History className="h-6 w-6 text-primary" />
          Historial de Movimientos
        </h2>
        
        <div className="space-y-4 animate-fade-in stagger-3">
          {txTableData.length > 0 ? txTableData.map((tx) => {
            const isDeposit = tx.tipo_operacion === 'Compra' || tx.tipo_operacion === 'Depósito' || tx.tipo_operacion === 'Ingreso'
            return (
            <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/40 backdrop-blur-sm hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isDeposit ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">
                    {isDeposit ? 'Ingreso / Depósito' : 'Retirada / Venta'}
                    {tx.estado === 'Pendiente' && (
                      <span className="ml-2 inline-flex px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        Pendiente
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">{new Date(tx.fecha).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold tabular-nums ${isDeposit ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isDeposit ? '+' : '-'}{formatCurrency(tx.total, 'EUR')}
                </p>
              </div>
            </div>
            )
          }) : (
            <div className="text-center py-12 border border-dashed rounded-xl bg-card/20">
              <History className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground font-medium">No hay movimientos de efectivo todavía</p>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
