import { historicalFxKey } from './contributions'

export interface HistoricalFxTransaction {
  id?: string
  fecha: string
  tipo_cambio_eur?: number | null
  activo?: { moneda?: string | null } | Array<{ moneda?: string | null }> | null
}

export interface HistoricalFxRequest {
  currency: string
  date: string
}

function hasValidRate(value: unknown): boolean {
  const rate = Number(value)
  return Number.isFinite(rate) && rate > 0
}

function transactionCurrency(transaction: HistoricalFxTransaction): string | undefined {
  const asset = Array.isArray(transaction.activo) ? transaction.activo[0] : transaction.activo
  return asset?.moneda?.toUpperCase()
}

/**
 * Identifies every foreign-currency ledger row that needs its own historical
 * EUR rate. This deliberately includes non-cash rewards: they have no
 * out-of-pocket contribution, but their performance basis still needs the
 * exchange rate at the time they were received.
 */
export function missingHistoricalFxRequests(
  transactions: HistoricalFxTransaction[],
): HistoricalFxRequest[] {
  const unique = new Map<string, HistoricalFxRequest>()

  for (const transaction of transactions) {
    const currency = transactionCurrency(transaction)
    if (!currency || currency === 'EUR' || hasValidRate(transaction.tipo_cambio_eur)) continue

    const date = String(transaction.fecha).slice(0, 10)
    if (!date) continue
    unique.set(historicalFxKey(currency, date), { currency, date })
  }

  return Array.from(unique.values())
}

/** Applies fetched historical rates without falling back to today's FX rate. */
export function applyHistoricalFxRates<T extends HistoricalFxTransaction>(
  transactions: T[],
  rates: Record<string, number>,
): T[] {
  return transactions.map((transaction) => {
    if (hasValidRate(transaction.tipo_cambio_eur)) return transaction

    const currency = transactionCurrency(transaction)
    if (!currency || currency === 'EUR') return transaction

    const rate = rates[historicalFxKey(currency, String(transaction.fecha).slice(0, 10))]
    return hasValidRate(rate) ? { ...transaction, tipo_cambio_eur: rate } : transaction
  })
}
