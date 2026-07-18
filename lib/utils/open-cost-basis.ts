import { isNonCashReward } from '@/lib/domain/portfolio/contributions'

interface CostBasisTransaction {
  id?: string
  activo_id: string
  tipo_operacion: string
  cantidad: number
  precio_unitario: number
  comision: number | null
  fecha: string
  created_at: string
  notas?: string | null
}

interface OpenLot {
  quantity: number
  performanceUnitCost: number
  investedUnitCost: number
}

export interface OpenPositionBasis {
  performanceCost: number
  investedCost: number
}

const BUY_OPERATIONS = new Set([
  'Compra',
  'Traspaso Entrada',
])

const SALE_OPERATIONS = new Set([
  'Venta',
  'Traspaso Salida',
  'Retirada',
])

const EPSILON = 0.00000001

export function calculateOpenPositionBases(
  transactions: CostBasisTransaction[],
): Map<string, OpenPositionBasis> {
  const lotsByAsset = new Map<string, OpenLot[]>()
  const orderedTransactions = transactions
    .slice()
    .sort((a, b) => {
      const left = `${a.fecha}:${a.created_at}:${a.id ?? ''}`
      const right = `${b.fecha}:${b.created_at}:${b.id ?? ''}`
      return left.localeCompare(right)
    })

  for (const transaction of orderedTransactions) {
    const quantity = Number(transaction.cantidad)
    if (!Number.isFinite(quantity) || quantity <= EPSILON) continue

    const lots = lotsByAsset.get(transaction.activo_id) ?? []

    if (BUY_OPERATIONS.has(transaction.tipo_operacion)) {
      const fee = Math.max(0, Number(transaction.comision) || 0)
      const unitCost = ((quantity * transaction.precio_unitario) + fee) / quantity
      if (Number.isFinite(unitCost) && unitCost >= 0) {
        lots.push({
          quantity,
          performanceUnitCost: unitCost,
          investedUnitCost: isNonCashReward(transaction) ? 0 : unitCost,
        })
        lotsByAsset.set(transaction.activo_id, lots)
      }
      continue
    }

    if (!SALE_OPERATIONS.has(transaction.tipo_operacion)) continue

    let quantityToDispose = quantity
    while (quantityToDispose > EPSILON && lots.length > 0) {
      const oldestLot = lots[0]
      const consumed = Math.min(oldestLot.quantity, quantityToDispose)
      oldestLot.quantity -= consumed
      quantityToDispose -= consumed

      if (oldestLot.quantity <= EPSILON) lots.shift()
    }

    lotsByAsset.set(transaction.activo_id, lots)
  }

  return new Map(
    Array.from(lotsByAsset, ([assetId, lots]) => [
      assetId,
      {
        performanceCost: lots.reduce((total, lot) => total + (lot.quantity * lot.performanceUnitCost), 0),
        investedCost: lots.reduce((total, lot) => total + (lot.quantity * lot.investedUnitCost), 0),
      },
    ]),
  )
}

export function calculateOpenCostBasis(
  transactions: CostBasisTransaction[],
): Map<string, number> {
  return new Map(
    Array.from(calculateOpenPositionBases(transactions), ([assetId, basis]) => [
      assetId,
      basis.performanceCost,
    ]),
  )
}
