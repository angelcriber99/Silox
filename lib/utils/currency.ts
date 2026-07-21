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

/**
 * Converts between any two supported currencies through EUR.
 * Rates use the market convention stored by Silox: foreign units per 1 EUR.
 * When a rate is unavailable we keep the amount and its source currency rather
 * than silently applying a made-up exchange rate.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: FxRatesToEur,
): number | null {
  const from = fromCurrency.toUpperCase()
  const to = toCurrency.toUpperCase()
  if (from === to) return amount

  const fromRate = from === 'EUR' ? 1 : rates[from]
  const toRate = to === 'EUR' ? 1 : rates[to]
  if (!fromRate || fromRate <= 0 || !toRate || toRate <= 0) return null

  return (amount / fromRate) * toRate
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

/**
 * Yahoo expresa algunos valores de Londres en peniques (GBX/GBp), aunque la
 * divisa contable de la posición sea GBP. Normalizar solo la etiqueta provoca
 * un error de valoración de 100x, por lo que precio y divisa deben tratarse a
 * la vez.
 */
export function normalizeYahooPrice(
  amount: number,
  currency: string | undefined,
): number {
  return currency?.toUpperCase() === 'GBX' || currency === 'GBp'
    ? amount / 100
    : amount
}
