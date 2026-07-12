"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { History, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { useTransactions } from "@/lib/hooks/use-transactions"
import { formatCurrency, formatRelative, formatUnits } from "@/lib/utils/formatters"

export function RecentTransactions() {
  const { data: transactions, isLoading } = useTransactions(10)

  return (
    <Card className="animate-fade-in stagger-3 bg-card border-border backdrop-blur-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <History className="h-4 w-4" />
          Últimas Operaciones
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted animate-shimmer" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 rounded bg-muted animate-shimmer" />
                  <div className="h-2.5 w-32 rounded bg-muted animate-shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : !transactions?.length ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/60">
            <History className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Sin operaciones registradas</p>
            <p className="text-xs text-zinc-700 mt-1">
              Las transacciones aparecerán aquí
            </p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
            {transactions.filter(tx => !(tx.notas?.includes("[Auto-Cash:") || tx.notas?.includes("Auto-liquidez"))).map((tx) => {
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
              const ticker =
                tx.activo && typeof tx.activo === "object" && !Array.isArray(tx.activo)
                  ? (tx.activo.tipo === "Fondo Indexado" || tx.activo.tipo === "Fondo Monetario")
                    ? tx.activo.nombre?.split(' ')[0].toUpperCase() || "FONDO"
                    : tx.activo.ticker
                  : "—"
              
              const isFondo = tx.activo && typeof tx.activo === "object" && !Array.isArray(tx.activo) && (tx.activo.tipo === "Fondo Indexado" || tx.activo.tipo === "Fondo Monetario")

              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/30 transition-colors duration-200"
                >
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                      isCompra
                        ? "bg-emerald-500/10 text-emerald-400"
                        : isDividendo 
                          ? "bg-violet-500/10 text-violet-400"
                          : "bg-rose-500/10 text-rose-400"
                    }`}
                  >
                    {isCompra ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground/90">
                        {isCompra ? "Compra" : isDividendo ? "Dividendo" : "Venta"}
                      </span>
                      <span className="text-xs text-muted-foreground/80">·</span>
                      <span className="text-sm tabular-nums text-foreground/80">
                        {ticker.split('.')[0]}
                        {ticker.includes('.') && !isFondo && (
                          <span className="text-muted-foreground/80 text-[10px]">.{ticker.split('.').slice(1).join('.')}</span>
                        )}
                      </span>
                      {tx.estado === "Pendiente" && (
                        <span className="ml-1 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Pendiente
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground/80 mt-0.5 truncate">
                      {formatUnits(tx.cantidad)} uds. × {formatCurrency(tx.precio_unitario, tx.activo?.moneda || "EUR")}
                    </p>
                  </div>

                  {/* Value + date */}
                  <div className="text-right flex-shrink-0">
                    <p
                      className={`text-sm tabular-nums font-medium ${
                        isCompra ? "text-emerald-400" : isDividendo ? "text-violet-400" : "text-rose-400"
                      }`}
                    >
                      {isCompra ? "+" : "-"}
                      {formatCurrency(total, tx.activo?.moneda || "EUR")}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {formatRelative(tx.fecha)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
