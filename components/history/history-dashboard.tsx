import { useMemo } from "react"
import { formatCurrency, formatPercent } from "@/lib/utils/formatters"
import { Transaccion } from "@/lib/types"
import { TaxEvent } from "@/lib/utils/fifo-calculator"
import { ArrowDownRight, ArrowUpRight, Coins, Wallet, BarChart3, TrendingUp } from "lucide-react"
import { MonthlyChart } from "./monthly-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface HistoryDashboardProps {
  transactions: Transaccion[]
  taxEvents: TaxEvent[]
  year: number
}

export function HistoryDashboard({ transactions, taxEvents, year }: HistoryDashboardProps) {
  // Filter for the selected year
  const yearTxs = useMemo(() => 
    transactions.filter(tx => new Date(tx.fecha).getFullYear() === year),
  [transactions, year])

  const yearTaxEvents = useMemo(() => 
    taxEvents.filter(ev => ev.añoFiscal === year),
  [taxEvents, year])

  // Calculate KPIs
  const kpis = useMemo(() => {
    let invertido = 0
    let retirado = 0
    let dividendos = 0

    yearTxs.forEach(tx => {
      const total = tx.cantidad * tx.precio_unitario
      if (tx.tipo_operacion === 'Compra') invertido += total + (tx.comision || 0)
      if (tx.tipo_operacion === 'Venta') retirado += total - (tx.comision || 0)
      if (tx.tipo_operacion === 'Dividendo') {
        dividendos += total
          - (tx.comision || 0)
          - (tx.retencion_origen || 0)
          - (tx.retencion_destino || 0)
      }
    })

    let ganancias = 0
    yearTaxEvents.forEach(ev => {
      ganancias += ev.gananciaPatrimonial
    })

    return { invertido, retirado, dividendos, ganancias }
  }, [yearTxs, yearTaxEvents])

  // Calculate Asset breakdown
  const assetBreakdown = useMemo(() => {
    const map = new Map<string, {
      ticker: string
      nombre: string
      tipo: string
      comprado: number
      vendido: number
      dividendos: number
      gananciaRealizada: number
    }>()

    // Process transactions for bought/sold/dividends
    yearTxs.forEach(tx => {
      if (!tx.activo) return
      
      const id = tx.activo_id
      if (!map.has(id)) {
        const isFondo = tx.activo.tipo === "Fondo Indexado" || tx.activo.tipo === "Fondo Monetario"
        const ticker = isFondo ? (tx.activo.nombre?.split(' ')[0].toUpperCase() || "") : tx.activo.ticker.split('.')[0]
        
        map.set(id, {
          ticker,
          nombre: tx.activo.nombre || "Desconocido",
          tipo: tx.activo.tipo,
          comprado: 0,
          vendido: 0,
          dividendos: 0,
          gananciaRealizada: 0
        })
      }

      const entry = map.get(id)!
      const total = tx.cantidad * tx.precio_unitario
      
      if (tx.tipo_operacion === 'Compra') entry.comprado += total + (tx.comision || 0)
      if (tx.tipo_operacion === 'Venta') entry.vendido += total - (tx.comision || 0)
      if (tx.tipo_operacion === 'Dividendo') {
        entry.dividendos += total
          - (tx.comision || 0)
          - (tx.retencion_origen || 0)
          - (tx.retencion_destino || 0)
      }
    })

    // Process tax events for realized gains
    yearTaxEvents.forEach(ev => {
      const id = ev.activoId
      if (map.has(id)) {
        map.get(id)!.gananciaRealizada += ev.gananciaPatrimonial
      }
    })

    return Array.from(map.values()).sort((a, b) => (b.comprado + b.vendido) - (a.comprado + a.vendido))
  }, [yearTxs, yearTaxEvents])

  return (
    <div className="space-y-8 animate-slide-up stagger-1">
      
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Invertido</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-md">
              <ArrowUpRight className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatCurrency(kpis.invertido)}</div>
            <p className="text-xs text-muted-foreground mt-1">Capital aportado</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Retirado</CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-md">
              <ArrowDownRight className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatCurrency(kpis.retirado)}</div>
            <p className="text-xs text-muted-foreground mt-1">Ventas brutas</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ganancia Realizada</CardTitle>
            <div className="p-2 bg-emerald-500/10 rounded-md">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold tabular-nums ${kpis.ganancias >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {kpis.ganancias > 0 ? "+" : ""}{formatCurrency(kpis.ganancias)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Beneficio neto en ventas (FIFO)</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dividendos</CardTitle>
            <div className="p-2 bg-amber-500/10 rounded-md">
              <Coins className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-amber-400">
              +{formatCurrency(kpis.dividendos)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ingresos pasivos</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="bg-card/40 border-border/50 backdrop-blur-sm p-1 animate-slide-up stagger-2">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-400" />
            Actividad Mensual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <MonthlyChart transactions={yearTxs} year={year} />
          </div>
        </CardContent>
      </Card>

      {/* Asset Breakdown */}
      <div className="space-y-4 animate-slide-up stagger-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Wallet className="h-5 w-5 text-blue-400" />
          Activos Operados en {year}
        </h3>
        
        {assetBreakdown.length === 0 ? (
          <div className="text-center py-12 border border-border border-dashed rounded-xl bg-muted/20">
            <p className="text-muted-foreground">No hubo actividad en este año.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {assetBreakdown.map(asset => {
              const totalGain = asset.gananciaRealizada + asset.dividendos
              const isPositive = totalGain >= 0
              
              return (
                <div key={asset.ticker} className="bg-card/40 backdrop-blur-md border border-white/5 p-5 rounded-2xl flex flex-col justify-between h-full hover:bg-card/60 hover:border-white/10 transition-all shadow-sm group">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-extrabold text-foreground tracking-tight">{asset.ticker}</h4>
                          <span className="text-[9px] uppercase font-bold tracking-wider bg-white/5 border border-white/10 text-muted-foreground px-2 py-0.5 rounded-full">
                            {asset.tipo}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground/60 truncate max-w-[200px] mt-0.5" title={asset.nombre}>{asset.nombre}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest">Comprado</span>
                        <span className="tabular-nums font-semibold text-[15px]">{formatCurrency(asset.comprado)}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest">Vendido</span>
                        <span className="tabular-nums font-semibold text-[15px]">{formatCurrency(asset.vendido)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-white/5 mt-auto">
                    <span className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-widest">Beneficio</span>
                    <span className={`tabular-nums font-bold text-[15px] ${totalGain > 0 ? 'text-emerald-400' : totalGain < 0 ? 'text-rose-400' : 'text-muted-foreground'}`}>
                      {totalGain > 0 ? "+" : ""}{formatCurrency(totalGain)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
