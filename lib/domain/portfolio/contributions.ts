export const EXTERNAL_FLOW_NOTE_PREFIX = '[REVOLUT_EXTERNAL]'
export const NON_CASH_REWARD_NOTE_PREFIX = '[REVOLUT_REWARD]'

const EUR_AMOUNT_PATTERN = /\bEUR=([0-9]+(?:\.[0-9]+)?)/

export interface ExternalFlowTransaction {
  tipo_operacion: string
  notas?: string | null
}

export interface InvestmentFlowTransaction extends ExternalFlowTransaction {
  id?: string
  fecha?: string
  cantidad: number
  precio_unitario: number
  comision?: number | null
  retencion_origen?: number | null
  retencion_destino?: number | null
  tipo_cambio_eur?: number | null
  activo?: {
    ticker: string
    tipo: string
    moneda: string
  } | Array<{
    ticker: string
    tipo: string
    moneda: string
  }> | null
}

export interface PortfolioFundingSummary {
  netByCurrency: Record<string, number>
  datedFlows: DatedInvestmentFlow[]
}

export interface DatedInvestmentFlow {
  transactionId?: string
  date: string
  currency: string
  amount: number
  fixedRate: number | null
}

export function historicalFxKey(currency: string, date: string): string {
  return `${currency.toUpperCase()}:${date.slice(0, 10)}`
}

export function externalFlowNote(eurAmount: number, description: string): string {
  return `${EXTERNAL_FLOW_NOTE_PREFIX} EUR=${eurAmount.toFixed(8)}; ${description}`
}

export function nonCashRewardNote(description: string): string {
  return `${NON_CASH_REWARD_NOTE_PREFIX} ${description}`
}

export function isNonCashReward(transaction: ExternalFlowTransaction): boolean {
  return transaction.notas?.startsWith(NON_CASH_REWARD_NOTE_PREFIX) ?? false
}

export function calculateNetContributions(
  transactions: ExternalFlowTransaction[],
): number | null {
  let total = 0
  let found = false

  for (const transaction of transactions) {
    if (!transaction.notas?.startsWith(EXTERNAL_FLOW_NOTE_PREFIX)) continue

    const amount = Number(transaction.notas.match(EUR_AMOUNT_PATTERN)?.[1])
    if (!Number.isFinite(amount) || amount <= 0) continue

    if (transaction.tipo_operacion === 'Compra') total += amount
    else if (transaction.tipo_operacion === 'Venta' || transaction.tipo_operacion === 'Retirada') total -= amount
    else continue

    found = true
  }

  return found ? total : null
}
export function calculateNetInvestmentByCurrency(
  transactions: InvestmentFlowTransaction[],
): PortfolioFundingSummary {
  const netByCurrency: Record<string, number> = {}
  const datedFlows: DatedInvestmentFlow[] = []

  for (const transaction of transactions) {
    if (isNonCashReward(transaction)) continue

    const asset = Array.isArray(transaction.activo)
      ? transaction.activo[0]
      : transaction.activo
    if (!asset) continue

    const ticker = asset.ticker.toUpperCase()
    if (
      ticker.startsWith('CASH')
      || ticker === 'REVOLUT'
    ) continue

    const quantity = Number(transaction.cantidad)
    const price = Number(transaction.precio_unitario)
    const commission = Math.max(0, Number(transaction.comision) || 0)
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(price) || price < 0) continue

    const gross = quantity * price
    let flow = 0
    if (transaction.tipo_operacion === 'Compra' || transaction.tipo_operacion === 'Traspaso Entrada') {
      flow = gross + commission
    } else if (
      transaction.tipo_operacion === 'Venta'
      || transaction.tipo_operacion === 'Traspaso Salida'
      || transaction.tipo_operacion === 'Retirada'
    ) {
      flow = -(gross - commission)
    } else {
      continue
    }

    netByCurrency[asset.moneda] = (netByCurrency[asset.moneda] ?? 0) + flow
    datedFlows.push({
      transactionId: transaction.id,
      date: String(transaction.fecha ?? '').slice(0, 10),
      currency: asset.moneda.toUpperCase(),
      amount: flow,
      fixedRate: Number.isFinite(Number(transaction.tipo_cambio_eur))
        && Number(transaction.tipo_cambio_eur) > 0
        ? Number(transaction.tipo_cambio_eur)
        : null,
    })
  }

  return {
    netByCurrency,
    datedFlows,
  }
}

/**
 * Calculates invested capital in EUR without ever applying today's FX rate to
 * past cash flows. Every native-currency flow is converted with its
 * persisted/historical rate.
 */
export function calculateFixedNetInvestmentEur(
  funding: PortfolioFundingSummary | null | undefined,
  historicalRates: Record<string, number> = {},
): number | null {
  if (!funding) return null

  let total = 0
  let found = false
  for (const flow of funding.datedFlows) {
    let rate = flow.currency === 'EUR'
      ? 1
      : flow.fixedRate ?? historicalRates[historicalFxKey(flow.currency, flow.date)]
    if (!Number.isFinite(rate) || !rate || rate <= 0) {
      rate = 1.0 // Fallback to 1:1 if rate is completely missing to prevent entire portfolio calculation crash
    }
    total += flow.amount / rate
    found = true
  }

  return found ? total : null
}
