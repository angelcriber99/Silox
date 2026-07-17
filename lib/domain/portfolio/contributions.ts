export const EXTERNAL_FLOW_NOTE_PREFIX = '[REVOLUT_EXTERNAL]'

const EUR_AMOUNT_PATTERN = /\bEUR=([0-9]+(?:\.[0-9]+)?)/

export interface ExternalFlowTransaction {
  tipo_operacion: string
  notas?: string | null
}

export function externalFlowNote(eurAmount: number, description: string): string {
  return `${EXTERNAL_FLOW_NOTE_PREFIX} EUR=${eurAmount.toFixed(8)}; ${description}`
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
