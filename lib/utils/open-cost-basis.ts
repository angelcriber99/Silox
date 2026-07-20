import { isNonCashReward } from '@/lib/domain/portfolio/contributions'

export interface CostBasisTransaction {
  id?: string
  activo_id?: string
  tipo_operacion: string
  cantidad: number
  precio_unitario: number
  comision: number | null
  fecha: string
  created_at: string
  notas?: string | null
  estado?: string | null
  tipo_cambio_eur?: number | null
}

export interface OpenPurchaseLot {
  transactionId?: string
  date: string
  createdAt: string
  operation: string
  originalQuantity: number
  remainingQuantity: number
  purchasePrice: number
  commission: number
  performanceUnitCost: number
  investedUnitCost: number
  performanceUnitCostEur: number
  investedUnitCostEur: number
  notes?: string | null
}

export interface OpenPositionBasis {
  performanceCost: number
  investedCost: number
  performanceCostEur: number
  investedCostEur: number
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

function isCompletedTransaction(transaction: CostBasisTransaction): boolean {
  if (!transaction.estado) return true
  return transaction.estado.toLowerCase() === 'completada'
}

export function calculateOpenPurchaseLots(
  transactions: CostBasisTransaction[],
): OpenPurchaseLot[] {
  const lots: OpenPurchaseLot[] = []
  const orderedTransactions = transactions
    .filter(isCompletedTransaction)
    .slice()
    .sort((a, b) => {
      const left = `${a.fecha}:${a.created_at}:${a.id ?? ''}`
      const right = `${b.fecha}:${b.created_at}:${b.id ?? ''}`
      return left.localeCompare(right)
    })

  for (const transaction of orderedTransactions) {
    const quantity = Number(transaction.cantidad)
    if (!Number.isFinite(quantity) || quantity <= EPSILON) continue

    if (BUY_OPERATIONS.has(transaction.tipo_operacion)) {
      const purchasePrice = Number(transaction.precio_unitario)
      const commission = Math.max(0, Number(transaction.comision) || 0)
      const performanceUnitCost = ((quantity * purchasePrice) + commission) / quantity
      
      const rate = Number.isFinite(Number(transaction.tipo_cambio_eur)) && Number(transaction.tipo_cambio_eur) > 0 
        ? Number(transaction.tipo_cambio_eur) 
        : 1
      const performanceUnitCostEur = performanceUnitCost / rate
      const investedUnitCostEur = (isNonCashReward(transaction) ? 0 : performanceUnitCost) / rate

      if (Number.isFinite(performanceUnitCost) && performanceUnitCost >= 0) {
        lots.push({
          transactionId: transaction.id,
          date: transaction.fecha,
          createdAt: transaction.created_at,
          operation: transaction.tipo_operacion,
          originalQuantity: quantity,
          remainingQuantity: quantity,
          purchasePrice,
          commission,
          performanceUnitCost,
          investedUnitCost: isNonCashReward(transaction) ? 0 : performanceUnitCost,
          performanceUnitCostEur,
          investedUnitCostEur,
          notes: transaction.notas,
        })
      }
      continue
    }

    if (!SALE_OPERATIONS.has(transaction.tipo_operacion)) continue

    let quantityToDispose = quantity
    while (quantityToDispose > EPSILON && lots.length > 0) {
      const oldestLot = lots[0]
      const consumed = Math.min(oldestLot.remainingQuantity, quantityToDispose)
      oldestLot.remainingQuantity -= consumed
      quantityToDispose -= consumed

      if (oldestLot.remainingQuantity <= EPSILON) lots.shift()
    }
  }

  return lots
}

export function calculateOpenPositionBases(
  transactions: CostBasisTransaction[],
): Map<string, OpenPositionBasis> {
  const transactionsByAsset = new Map<string, CostBasisTransaction[]>()
  for (const transaction of transactions) {
    if (!transaction.activo_id) continue
    const assetTransactions = transactionsByAsset.get(transaction.activo_id) ?? []
    assetTransactions.push(transaction)
    transactionsByAsset.set(transaction.activo_id, assetTransactions)
  }

  return new Map(
    Array.from(transactionsByAsset, ([assetId, assetTransactions]) => {
      const lots = calculateOpenPurchaseLots(assetTransactions)
      return [
        assetId,
        {
          performanceCost: lots.reduce((total, lot) => total + (lot.remainingQuantity * lot.performanceUnitCost), 0),
          investedCost: lots.reduce((total, lot) => total + (lot.remainingQuantity * lot.investedUnitCost), 0),
          performanceCostEur: lots.reduce((total, lot) => total + (lot.remainingQuantity * lot.performanceUnitCostEur), 0),
          investedCostEur: lots.reduce((total, lot) => total + (lot.remainingQuantity * lot.investedUnitCostEur), 0),
        },
      ]
    }),
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
