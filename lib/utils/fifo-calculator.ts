import type { Transaccion } from '@/lib/types'

export function getAsset(tx: Transaccion) {
  return Array.isArray(tx.activo) ? tx.activo[0] : tx.activo;
}

export interface TaxEvent {
  activoId: string
  ticker: string
  nombre: string
  fechaVenta: string
  añoFiscal: number
  cantidadVendida: number
  ingresoVenta: number // EUR: (qty * price - comision) / FX de venta
  costeAdquisicion: number // EUR: suma de cada lote al FX de su compra
  gananciaPatrimonial: number // EUR: ingresoVenta - costeAdquisicion
  retencionDestino?: number
  retencionOrigen?: number
  detalles: string // Explicación de qué lotes se vendieron
  tipoActivo: string
  monedaOriginal: string
  tipoCambioVenta: number
  isWashSale?: boolean
  perdidaBloqueada?: number
}

interface BuyLot {
  id: string
  fecha: string
  qtyRemaining: number
  unitCostBasisEur: number
  currency: string
  exchangeRate: number
}

const FIFO_EPSILON = 0.000001

export interface DividendTaxAmounts {
  gross: number
  fees: number
  retOrigen: number
  retDestino: number
  baseImponible: number
  net: number
  currency: string
  exchangeRate: number
}

export function getTaxExchangeRate(transaction: Transaccion): number {
  const currency = getAsset(transaction)?.moneda?.toUpperCase()
  if (!currency) throw new Error(`La operación ${transaction.id} no tiene moneda`)
  if (currency === 'EUR') return 1

  const rate = Number(transaction.tipo_cambio_eur)
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Falta el cambio histórico ${currency}/EUR para ${transaction.fecha.slice(0, 10)}`)
  }
  return rate
}

export function convertTaxAmountToEur(amount: number, transaction: Transaccion): number {
  return amount / getTaxExchangeRate(transaction)
}

export function calculateDividendTaxAmounts(transaction: Transaccion): DividendTaxAmounts {
  const currency = getAsset(transaction)?.moneda?.toUpperCase() ?? 'EUR'
  const exchangeRate = getTaxExchangeRate(transaction)
  const gross = convertTaxAmountToEur(Number(transaction.precio_unitario) || 0, transaction)
  const fees = convertTaxAmountToEur(Math.max(0, Number(transaction.comision) || 0), transaction)
  const retOrigen = convertTaxAmountToEur(Math.max(0, Number(transaction.retencion_origen) || 0), transaction)
  const retDestino = convertTaxAmountToEur(Math.max(0, Number(transaction.retencion_destino) || 0), transaction)

  return {
    gross,
    fees,
    retOrigen,
    retDestino,
    baseImponible: gross - fees,
    net: gross - fees - retOrigen - retDestino,
    currency,
    exchangeRate,
  }
}

export function calculateFIFO(transactions: Transaccion[]): TaxEvent[] {
  const events: TaxEvent[] = []
  
  // Agrupar transacciones por activo (excluyendo Efectivo/CASH)
  const txByAsset = transactions.reduce((acc, tx) => {
    if (tx.estado && tx.estado !== 'Completada') return acc
    // Skip cash/efectivo completely from capital gains calculations
    if (
      getAsset(tx)?.tipo === 'Efectivo'
      || getAsset(tx)?.tipo === 'Liquidez'
      || getAsset(tx)?.ticker === 'EFECTIVO'
      || getAsset(tx)?.ticker?.startsWith('CASH')
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
        if (!Number.isFinite(tx.cantidad) || tx.cantidad <= FIFO_EPSILON) {
          throw new Error(`Cantidad de compra inválida para ${getAsset(tx)?.ticker ?? tx.activo_id} el ${tx.fecha.slice(0, 10)}`)
        }
        const exchangeRate = getTaxExchangeRate(tx)
        const unitCostBasisEur = convertTaxAmountToEur(
          (tx.cantidad * tx.precio_unitario + tx.comision) / tx.cantidad,
          tx,
        )
        buyLots.push({
          id: tx.id,
          fecha: tx.fecha,
          qtyRemaining: tx.cantidad,
          unitCostBasisEur,
          currency: getAsset(tx)?.moneda?.toUpperCase() ?? 'EUR',
          exchangeRate,
        })
      } else if (tx.tipo_operacion === "Venta" || tx.tipo_operacion === "Traspaso Salida") {
        let remainingToSell = tx.cantidad
        let totalCostBasis = 0
        const soldLotsDetails: string[] = []
        const soldLotsIds = new Set<string>()

        // Vender desde los lotes más antiguos (FIFO)
        while (remainingToSell > FIFO_EPSILON && buyLots.length > 0) {
          const oldestLot = buyLots[0]
          const qtyFromThisLot = Math.min(oldestLot.qtyRemaining, remainingToSell)
          
          totalCostBasis += qtyFromThisLot * oldestLot.unitCostBasisEur
          remainingToSell -= qtyFromThisLot
          oldestLot.qtyRemaining -= qtyFromThisLot

          const lotDate = new Date(oldestLot.fecha).toLocaleDateString("es-ES")
          const fxDetail = oldestLot.currency === 'EUR'
            ? ''
            : ` a 1 EUR = ${oldestLot.exchangeRate.toLocaleString('es-ES', { maximumFractionDigits: 6 })} ${oldestLot.currency}`
          soldLotsDetails.push(`${qtyFromThisLot.toLocaleString("es-ES", {maximumFractionDigits: 4})} uds. compradas el ${lotDate}${fxDetail}`)
          soldLotsIds.add(oldestLot.id)

          if (oldestLot.qtyRemaining <= FIFO_EPSILON) {
            buyLots.shift() // Eliminar lote agotado
          }
        }

        if (remainingToSell > FIFO_EPSILON) {
          throw new Error(
            `Faltan ${remainingToSell.toLocaleString('es-ES', { maximumFractionDigits: 8 })} unidades FIFO de ${getAsset(tx)?.ticker ?? tx.activo_id} para la salida del ${tx.fecha.slice(0, 10)}`,
          )
        }

        if (tx.tipo_operacion !== "Traspaso Salida") {
          const tipoCambioVenta = getTaxExchangeRate(tx)
          const ingresoVenta = convertTaxAmountToEur((tx.cantidad * tx.precio_unitario) - tx.comision, tx)
          const gananciaPatrimonial = ingresoVenta - totalCostBasis

          const isFondo = getAsset(tx)?.tipo === "Fondo Indexado" || getAsset(tx)?.tipo === "Fondo Monetario"
          const ticker = getAsset(tx) 
            ? (isFondo ? (getAsset(tx).nombre?.split(' ')[0].toUpperCase() || "") : getAsset(tx).ticker.split('.')[0])
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
                if (available > FIFO_EPSILON) {
                  const qtyToWash = Math.min(available, remainingLossShares)
                  washSaleUsedShares.set(otherTx.id, (washSaleUsedShares.get(otherTx.id) || 0) + qtyToWash)
                  
                  perdidaBloqueada += qtyToWash * lossPerShare
                  remainingLossShares -= qtyToWash
                  
                  if (remainingLossShares <= FIFO_EPSILON) break
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
          nombre: getAsset(tx)?.nombre || "Activo Desconocido",
          fechaVenta: tx.fecha,
          añoFiscal: new Date(tx.fecha).getFullYear(),
          cantidadVendida: tx.cantidad,
          ingresoVenta,
          costeAdquisicion: totalCostBasis,
          gananciaPatrimonial,
          retencionDestino: convertTaxAmountToEur(tx.retencion_destino || 0, tx),
          retencionOrigen: convertTaxAmountToEur(tx.retencion_origen || 0, tx),
          detalles: `Corresponde a: ${soldLotsDetails.join(" y ")}.`,
          tipoActivo: getAsset(tx)?.tipo || "Desconocido",
          monedaOriginal: getAsset(tx)?.moneda?.toUpperCase() ?? 'EUR',
          tipoCambioVenta,
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
