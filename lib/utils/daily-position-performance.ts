import { getMarketDateKey } from './market-performance'

interface DailyActivityTransaction {
  activo_id: string
  tipo_operacion: string
  cantidad: number
  precio_unitario: number
  comision?: number | null
  retencion_origen?: number | null
  retencion_destino?: number | null
  fecha: string
}

export interface DailyPositionActivity {
  netUnits: number
  netFlowNative: number
}

const BUY_OPERATIONS = new Set(['Compra', 'Traspaso Entrada'])
const SALE_OPERATIONS = new Set(['Venta', 'Traspaso Salida', 'Retirada'])

/**
 * Reconstructs today's unit and cash flows per asset. Prices and commissions
 * remain in the asset's native accounting currency; conversion is performed
 * together with the live quote later.
 */
export function calculateDailyPositionActivity(
  transactions: DailyActivityTransaction[],
  marketDate = getMarketDateKey(new Date()),
): Map<string, DailyPositionActivity> {
  const result = new Map<string, DailyPositionActivity>()

  for (const transaction of transactions) {
    if (String(transaction.fecha).slice(0, 10) !== marketDate) continue

    const quantity = Number(transaction.cantidad)
    const price = Number(transaction.precio_unitario)
    const commission = Math.max(0, Number(transaction.comision) || 0)
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(price) || price < 0) continue

    const gross = quantity * price
    const current = result.get(transaction.activo_id) ?? { netUnits: 0, netFlowNative: 0 }

    if (BUY_OPERATIONS.has(transaction.tipo_operacion)) {
      current.netUnits += quantity
      current.netFlowNative += gross + commission
    } else if (SALE_OPERATIONS.has(transaction.tipo_operacion)) {
      current.netUnits -= quantity
      current.netFlowNative -= gross - commission
    } else if (transaction.tipo_operacion === 'Dividendo') {
      const withholding = Math.max(0, Number(transaction.retencion_origen) || 0)
        + Math.max(0, Number(transaction.retencion_destino) || 0)
      current.netFlowNative -= gross - commission - withholding
    } else {
      continue
    }

    result.set(transaction.activo_id, current)
  }

  return result
}
