interface CostBasisTransaction {
  activo_id: string
  tipo_operacion: string
  cantidad: number
  precio_unitario: number
  comision: number | null
  fecha: string
  created_at: string
}

interface OpenLot {
  quantity: number
  unitCost: number
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

export function calculateOpenCostBasis(
  transactions: CostBasisTransaction[],
): Map<string, number> {
  const lotsByAsset = new Map<string, OpenLot[]>()
  const orderedTransactions = transactions
    .slice()
    .sort((a, b) => `${a.fecha}:${a.created_at}`.localeCompare(`${b.fecha}:${b.created_at}`))

  for (const transaction of orderedTransactions) {
    const quantity = Number(transaction.cantidad)
    if (!Number.isFinite(quantity) || quantity <= EPSILON) continue

    const lots = lotsByAsset.get(transaction.activo_id) ?? []

    if (BUY_OPERATIONS.has(transaction.tipo_operacion)) {
      const fee = Math.max(0, Number(transaction.comision) || 0)
      const unitCost = ((quantity * transaction.precio_unitario) + fee) / quantity
      if (Number.isFinite(unitCost) && unitCost >= 0) {
        lots.push({ quantity, unitCost })
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
      lots.reduce((total, lot) => total + (lot.quantity * lot.unitCost), 0),
    ]),
  )
}
