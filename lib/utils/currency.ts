/** Tipos de cambio: cuántas unidades de moneda extranjera equivalen a 1 EUR */
export type FxRatesToEur = Record<string, number>

/**
 * Convierte un importe a EUR usando tipos de cambio de Yahoo (EURXXX=X).
 * Ej: EURUSD=X = 1.15 → 1 EUR = 1.15 USD → rates.USD = 1.15
 */
export function convertToEur(
  amount: number,
  fromCurrency: string,
  rates: FxRatesToEur
): number {
  const currency = fromCurrency.toUpperCase()
  if (currency === 'EUR') return amount

  const rate = rates[currency]
  if (!rate || rate <= 0) return amount

  return amount / rate
}

export function convertSeriesToEur(
  values: number[],
  fromCurrency: string,
  rates: FxRatesToEur
): number[] {
  return values.map((v) => convertToEur(v, fromCurrency, rates))
}

/** Pares Yahoo para obtener el tipo de cambio hacia EUR */
export const FX_PAIRS: Record<string, string> = {
  USD: 'EURUSD=X',
  GBP: 'EURGBP=X',
  CHF: 'EURCHF=X',
  JPY: 'EURJPY=X',
}

export function normalizeYahooCurrency(currency: string | undefined): string {
  if (!currency) return 'USD'
  const upper = currency.toUpperCase()
  if (upper === 'GBX' || upper === 'GBP') return 'GBP'
  return upper
}
