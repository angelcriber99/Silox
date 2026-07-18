export const EXTERNAL_FLOW_NOTE_PREFIX = '[REVOLUT_EXTERNAL]'
export const NON_CASH_REWARD_NOTE_PREFIX = '[REVOLUT_REWARD]'

const EUR_AMOUNT_PATTERN = /\bEUR=([0-9]+(?:\.[0-9]+)?)/

export interface ExternalFlowTransaction {
  tipo_operacion: string
  notas?: string | null
}

export interface InvestmentFlowTransaction extends ExternalFlowTransaction {
  cantidad: number
  precio_unitario: number
  comision?: number | null
  retencion_origen?: number | null
  retencion_destino?: number | null
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
      || asset.tipo === 'Fondo Monetario'
      || asset.tipo === 'Liquidez'
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
    } else if (transaction.tipo_operacion === 'Dividendo') {
      const withholding = Math.max(0, Number(transaction.retencion_origen) || 0)
        + Math.max(0, Number(transaction.retencion_destino) || 0)
      flow = -(gross - commission - withholding)
    } else {
      continue
    }

    netByCurrency[asset.moneda] = (netByCurrency[asset.moneda] ?? 0) + flow
  }

  return { netByCurrency }
}

export function convertNetInvestmentToEur(
  funding: PortfolioFundingSummary | null | undefined,
  fxRates: Record<string, number> | null | undefined,
): number | null {
  if (!funding) return null

  let total = 0
  let found = false
  for (const [currency, amount] of Object.entries(funding.netByCurrency)) {
    const rate = currency === 'EUR' ? 1 : fxRates?.[currency]
    if (!Number.isFinite(rate) || !rate || rate <= 0) return null
    total += amount / rate
    found = true
  }

  return found ? total : null
}
