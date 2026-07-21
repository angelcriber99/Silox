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
  isWashSale?: boolean
  perdidaBloqueada?: number
}

interface BuyLot {
  id: string
  fecha: string
  qtyRemaining: number
  unitCostBasis: number // (qty * price + comision) / qty
}

export function calculateFIFO(transactions: Transaccion[]): TaxEvent[] {
  const events: TaxEvent[] = []
  
  // Agrupar transacciones por activo (excluyendo Efectivo/CASH)
  const txByAsset = transactions.reduce((acc, tx) => {
    // Skip cash/efectivo completely from capital gains calculations
    if (
      tx.activo?.tipo === 'Efectivo'
      || tx.activo?.tipo === 'Liquidez'
      || tx.activo?.ticker === 'EFECTIVO'
      || tx.activo?.ticker?.startsWith('CASH')
    ) {
      return acc
    }
    
    const id = tx.activo_id
    if (!acc[id]) acc[id] = []
    acc[id].push(tx)
    return acc
  }, {} as Record<string, Transaccion[]>)

  for (const txs of Object.values(txByAsset)) {
    // Preserve the broker execution order for operations that share a date.
    const sorted = [...txs].sort((a, b) => {
      const byDate = a.fecha.localeCompare(b.fecha)
      if (byDate !== 0) return byDate

      const byCreation = (a.created_at || '').localeCompare(b.created_at || '')
      if (byCreation !== 0) return byCreation

      return (a.id || '').localeCompare(b.id || '')
    })
    
    const buyLots: BuyLot[] = []
    const washSaleUsedShares = new Map<string, number>()

    for (const tx of sorted) {
      if (tx.tipo_operacion === "Compra" || tx.tipo_operacion === "Traspaso Entrada") {
        const unitCostBasis = (tx.cantidad * tx.precio_unitario + tx.comision) / tx.cantidad
        buyLots.push({
          id: tx.id,
          fecha: tx.fecha,
          qtyRemaining: tx.cantidad,
          unitCostBasis,
        })
      } else if (tx.tipo_operacion === "Venta" || tx.tipo_operacion === "Traspaso Salida") {
        let remainingToSell = tx.cantidad
        let totalCostBasis = 0
        const soldLotsDetails: string[] = []
        const soldLotsIds = new Set<string>()

        // Vender desde los lotes más antiguos (FIFO)
        while (remainingToSell > 0.000001 && buyLots.length > 0) {
          const oldestLot = buyLots[0]
          const qtyFromThisLot = Math.min(oldestLot.qtyRemaining, remainingToSell)
          
          totalCostBasis += qtyFromThisLot * oldestLot.unitCostBasis
          remainingToSell -= qtyFromThisLot
          oldestLot.qtyRemaining -= qtyFromThisLot

          const lotDate = new Date(oldestLot.fecha).toLocaleDateString("es-ES")
          soldLotsDetails.push(`${qtyFromThisLot.toLocaleString("es-ES", {maximumFractionDigits: 4})} uds. compradas el ${lotDate}`)
          soldLotsIds.add(oldestLot.id)

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

          let isWashSale = false
          let perdidaBloqueada = 0

          if (gananciaPatrimonial < -0.01) {
            const saleDate = new Date(tx.fecha).getTime()
            const sixtyDays = 60 * 24 * 60 * 60 * 1000
            let remainingLossShares = tx.cantidad
            const lossPerShare = -gananciaPatrimonial / tx.cantidad

            for (const otherTx of sorted) {
              if (otherTx.tipo_operacion !== "Compra" && otherTx.tipo_operacion !== "Traspaso Entrada") continue
              if (soldLotsIds.has(otherTx.id)) continue // Cannot use the exact same shares we just sold as replacement shares

              const otherDate = new Date(otherTx.fecha).getTime()
              const diffDays = Math.abs(saleDate - otherDate)
              
              if (diffDays <= sixtyDays) {
                const available = otherTx.cantidad - (washSaleUsedShares.get(otherTx.id) || 0)
                if (available > 0.000001) {
                  const qtyToWash = Math.min(available, remainingLossShares)
                  washSaleUsedShares.set(otherTx.id, (washSaleUsedShares.get(otherTx.id) || 0) + qtyToWash)
                  
                  perdidaBloqueada += qtyToWash * lossPerShare
                  remainingLossShares -= qtyToWash
                  
                  if (remainingLossShares <= 0.000001) break
                }
              }
            }
            if (perdidaBloqueada > 0.01) {
              isWashSale = true
            }
          }

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
          tipoActivo: tx.activo?.tipo || "Desconocido",
          isWashSale,
          perdidaBloqueada
        })
        } // close if (tx.tipo_operacion !== "Traspaso Salida")
      }
    }
  }

  // Sort events by date descending
  return events.sort((a, b) => new Date(b.fechaVenta).getTime() - new Date(a.fechaVenta).getTime())
}
