export interface AssetPricePoint {
  date: string
  price: number
}

export interface AssetPeriodTransaction {
  id?: string
  fecha: string
  created_at?: string
  tipo_operacion: string
  cantidad: number
  precio_unitario: number
  comision?: number | null
  retencion_origen?: number | null
  retencion_destino?: number | null
  estado?: string | null
}

export interface AssetPeriodPerformance {
  absolute: number
  percent: number
  startValue: number
  endValue: number
  netFlow: number
}

const EPSILON = 0.00000001

function transactionTime(transaction: AssetPeriodTransaction): number {
  const primary = new Date(transaction.fecha).getTime()
  if (Number.isFinite(primary)) return primary
  return transaction.created_at ? new Date(transaction.created_at).getTime() : Number.NaN
}

function isCompleted(transaction: AssetPeriodTransaction): boolean {
  const state = transaction.estado?.trim().toLowerCase()
  return !state || state === "completada" || state === "completado" || state === "completed"
}

function transactionEffect(transaction: AssetPeriodTransaction): { units: number; flow: number } {
  const quantity = Number(transaction.cantidad) || 0
  const price = Number(transaction.precio_unitario) || 0
  const commission = Number(transaction.comision) || 0
  const withholding = (Number(transaction.retencion_origen) || 0) + (Number(transaction.retencion_destino) || 0)
  const gross = quantity * price

  switch (transaction.tipo_operacion) {
    case "Compra":
      return { units: quantity, flow: gross + commission }
    case "Traspaso Entrada":
    case "Aportación":
      return { units: quantity, flow: 0 }
    case "Venta":
      return { units: -quantity, flow: -(gross - commission - withholding) }
    case "Traspaso Salida":
    case "Retirada":
      return { units: -quantity, flow: 0 }
    case "Dividendo":
      return { units: 0, flow: -(gross - commission - withholding) }
    default:
      return { units: 0, flow: 0 }
  }
}

/** Flow-adjusted result for one asset and one chart interval. */
export function calculateAssetPeriodPerformance(
  prices: AssetPricePoint[],
  transactions: AssetPeriodTransaction[],
): AssetPeriodPerformance | null {
  const validPrices = prices
    .filter((point) => Number.isFinite(new Date(point.date).getTime()) && Number.isFinite(point.price) && point.price > 0)
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
  if (validPrices.length < 2) return null

  const startTime = new Date(validPrices[0].date).getTime()
  const endTime = new Date(validPrices.at(-1)!.date).getTime()
  const duration = Math.max(1, endTime - startTime)
  const orderedTransactions = transactions
    .filter(isCompleted)
    .map((transaction) => ({ transaction, time: transactionTime(transaction) }))
    .filter(({ time }) => Number.isFinite(time) && time <= endTime)
    .sort((left, right) => left.time - right.time)

  let startUnits = 0
  for (const { transaction, time } of orderedTransactions) {
    if (time >= startTime) break
    startUnits += transactionEffect(transaction).units
  }
  startUnits = Math.max(0, startUnits)

  let endUnits = startUnits
  let netFlow = 0
  let weightedFlows = 0
  for (const { transaction, time } of orderedTransactions) {
    if (time < startTime) continue
    const effect = transactionEffect(transaction)
    endUnits += effect.units
    netFlow += effect.flow
    weightedFlows += effect.flow * (Math.max(0, endTime - time) / duration)
  }

  if (startUnits <= EPSILON && endUnits <= EPSILON && Math.abs(netFlow) <= EPSILON) return null

  const startValue = startUnits * validPrices[0].price
  const endValue = Math.max(0, endUnits) * validPrices.at(-1)!.price
  const absolute = endValue - startValue - netFlow
  const denominator = startValue + weightedFlows

  return {
    absolute,
    percent: denominator > EPSILON ? (absolute / denominator) * 100 : 0,
    startValue,
    endValue,
    netFlow,
  }
}
