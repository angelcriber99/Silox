import type { Transaccion } from '@/lib/types'

export interface TaxEvent {
  activoId: string
  ticker: string
  nombre: string
  fechaVenta: string
  añoFiscal: number
  cantidadVendida: number
  ingresoVenta: number // (qty * price) - comision
  costeAdquisicion: number // sum of (qty * buyPrice + buyComision) of sold lots
  gananciaPatrimonial: number // ingresoVenta - costeAdquisicion
  retencionDestino?: number
  retencionOrigen?: number
  detalles: string // Explicación de qué lotes se vendieron
  tipoActivo: string
}

interface BuyLot {
  fecha: string
  qtyRemaining: number
  unitCostBasis: number // (qty * price + comision) / qty
}

export function calculateFIFO(transactions: Transaccion[]): TaxEvent[] {
  const events: TaxEvent[] = []
  
  // Agrupar transacciones por activo (excluyendo Efectivo/CASH)
  const txByAsset = transactions.reduce((acc, tx) => {
    // Skip cash/efectivo completely from capital gains calculations
    if (tx.activo?.tipo === 'Efectivo' || tx.activo?.ticker === 'EFECTIVO' || tx.activo?.ticker === 'CASH') {
      return acc
    }
    
    const id = tx.activo_id
    if (!acc[id]) acc[id] = []
    acc[id].push(tx)
    return acc
  }, {} as Record<string, Transaccion[]>)

  for (const [activoId, txs] of Object.entries(txByAsset)) {
    // Sort asc by date
    const sorted = [...txs].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    
    let buyLots: BuyLot[] = []

    for (const tx of sorted) {
      if (tx.tipo_operacion === "Compra" || tx.tipo_operacion === "Traspaso Entrada") {
        const unitCostBasis = (tx.cantidad * tx.precio_unitario + tx.comision) / tx.cantidad
        buyLots.push({
          fecha: tx.fecha,
          qtyRemaining: tx.cantidad,
          unitCostBasis,
        })
      } else if (tx.tipo_operacion === "Venta" || tx.tipo_operacion === "Traspaso Salida") {
        let remainingToSell = tx.cantidad
        let totalCostBasis = 0
        const soldLotsDetails: string[] = []

        // Vender desde los lotes más antiguos (FIFO)
        while (remainingToSell > 0.000001 && buyLots.length > 0) {
          const oldestLot = buyLots[0]
          const qtyFromThisLot = Math.min(oldestLot.qtyRemaining, remainingToSell)
          
          totalCostBasis += qtyFromThisLot * oldestLot.unitCostBasis
          remainingToSell -= qtyFromThisLot
          oldestLot.qtyRemaining -= qtyFromThisLot

          const lotDate = new Date(oldestLot.fecha).toLocaleDateString("es-ES")
          soldLotsDetails.push(`${qtyFromThisLot.toLocaleString("es-ES", {maximumFractionDigits: 4})} uds. compradas el ${lotDate}`)

          if (oldestLot.qtyRemaining <= 0.000001) {
            buyLots.shift() // Eliminar lote agotado
          }
        }

        if (tx.tipo_operacion !== "Traspaso Salida") {
          const ingresoVenta = (tx.cantidad * tx.precio_unitario) - tx.comision
          const gananciaPatrimonial = ingresoVenta - totalCostBasis

          const isFondo = tx.activo?.tipo === "Fondo Indexado" || tx.activo?.tipo === "Fondo Monetario"
          const ticker = tx.activo 
            ? (isFondo ? (tx.activo.nombre?.split(' ')[0].toUpperCase() || "") : tx.activo.ticker.split('.')[0])
            : "—"

          events.push({
          activoId: tx.activo_id,
          ticker: ticker,
          nombre: tx.activo?.nombre || "Activo Desconocido",
          fechaVenta: tx.fecha,
          añoFiscal: new Date(tx.fecha).getFullYear(),
          cantidadVendida: tx.cantidad,
          ingresoVenta,
          costeAdquisicion: totalCostBasis,
          gananciaPatrimonial,
          retencionDestino: tx.retencion_destino || 0,
          retencionOrigen: tx.retencion_origen || 0,
          detalles: `Corresponde a: ${soldLotsDetails.join(" y ")}.`,
          tipoActivo: tx.activo?.tipo || "Desconocido"
        })
        } // close if (tx.tipo_operacion !== "Traspaso Salida")
      }
    }
  }

  // Sort events by date descending
  return events.sort((a, b) => new Date(b.fechaVenta).getTime() - new Date(a.fechaVenta).getTime())
}
