import {
  calculateNetInvestmentByCurrency,
  historicalFxKey,
  type InvestmentFlowTransaction,
} from './contributions'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const UNIT_EPSILON = 0.00000001
const BUY_OPERATIONS = new Set(['Compra', 'Traspaso Entrada'])
const SELL_OPERATIONS = new Set(['Venta', 'Traspaso Salida', 'Retirada'])

export interface HistoricalQuote {
  date: string
  close: number
}

export interface HistoricalMarketSeries {
  /** Currency in which Yahoo (or the market source) quoted the close. */
  currency: string
  quotes: HistoricalQuote[]
}

export interface HistoricalPortfolioTransaction extends InvestmentFlowTransaction {
  activo_id: string
  estado?: string | null
  created_at?: string | null
  linked_transaction_id?: string | null
}

export interface ReconstructedPortfolioPoint {
  date: string
  value: number | null
  invested: number | null
}

export interface ReconstructedPortfolioHistory {
  points: ReconstructedPortfolioPoint[]
  unresolvedContributionCount: number
}

type Asset = {
  ticker: string
  tipo: string
  moneda: string
}

function day(value: string | null | undefined): string | null {
  const candidate = String(value ?? '').slice(0, 10)
  return ISO_DATE.test(candidate) ? candidate : null
}

function assetFor(transaction: HistoricalPortfolioTransaction): Asset | null {
  const asset = Array.isArray(transaction.activo) ? transaction.activo[0] : transaction.activo
  if (!asset || typeof asset !== 'object') return null
  const candidate = asset as Partial<Asset>
  if (!candidate.ticker || !candidate.tipo || !candidate.moneda) return null
  return {
    ticker: candidate.ticker,
    tipo: candidate.tipo,
    moneda: candidate.moneda,
  }
}

function isCompleted(transaction: HistoricalPortfolioTransaction): boolean {
  const status = transaction.estado?.trim().toLowerCase()
  return !status || status === 'completada' || status === 'completado' || status === 'completed'
}

function isCashAsset(asset: Asset): boolean {
  const ticker = asset.ticker.toUpperCase()
  const type = asset.tipo.toLowerCase()
  return ticker.startsWith('CASH')
    || ticker === 'REVOLUT'
    || type.includes('liquidez')
}

function operationUnits(transaction: HistoricalPortfolioTransaction): number {
  const quantity = Number(transaction.cantidad)
  if (!Number.isFinite(quantity) || quantity < 0) return Number.NaN
  if (BUY_OPERATIONS.has(transaction.tipo_operacion)) return quantity
  if (SELL_OPERATIONS.has(transaction.tipo_operacion)) return -quantity
  return 0
}

function addDays(date: string, count: number): string {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + count)
  return value.toISOString().slice(0, 10)
}

function inclusiveDays(from: string, to: string): string[] {
  const values: string[] = []
  for (let current = from; current <= to; current = addDays(current, 1)) values.push(current)
  return values
}

class DailyCloseCursor {
  private readonly quotes: HistoricalQuote[]
  private index = 0
  private latest: number | null = null

  constructor(quotes: HistoricalQuote[]) {
    this.quotes = quotes
      .filter((quote) => day(quote.date) && Number.isFinite(quote.close) && quote.close > 0)
      .map((quote) => ({ date: day(quote.date)!, close: quote.close }))
      .sort((left, right) => left.date.localeCompare(right.date))
  }

  value(onDate: string): number | null {
    while (this.index < this.quotes.length && this.quotes[this.index].date <= onDate) {
      this.latest = this.quotes[this.index].close
      this.index += 1
    }
    return this.latest
  }
}

/**
 * Replays the completed transaction ledger into an end-of-day portfolio
 * series. A value is emitted only when every active asset can be valued with
 * a real historical market close and that day's FX close. It never uses a
 * current quote, a 1:1 exchange rate, or a transaction amount as a proxy for
 * a later market valuation.
 */
export function reconstructPortfolioHistory(
  transactions: HistoricalPortfolioTransaction[],
  marketSeriesByAsset: Record<string, HistoricalMarketSeries>,
  fxSeriesByCurrency: Record<string, HistoricalQuote[]>,
  contributionFxRates: Record<string, number>,
  asOf: string,
): ReconstructedPortfolioHistory {
  const completed = transactions
    .filter(isCompleted)
    .map((transaction) => ({ transaction, date: day(transaction.fecha) }))
    .filter((entry): entry is { transaction: HistoricalPortfolioTransaction; date: string } => entry.date !== null)
    .sort((left, right) => left.date.localeCompare(right.date)
      || String(left.transaction.created_at ?? '').localeCompare(String(right.transaction.created_at ?? ''))
      || String(left.transaction.id ?? '').localeCompare(String(right.transaction.id ?? '')))

  const firstDate = completed[0]?.date
  const endDate = day(asOf)
  if (!firstDate || !endDate || firstDate > endDate) {
    return { points: [], unresolvedContributionCount: 0 }
  }

  const transactionsByDate = new Map<string, HistoricalPortfolioTransaction[]>()
  for (const entry of completed) {
    const items = transactionsByDate.get(entry.date) ?? []
    items.push(entry.transaction)
    transactionsByDate.set(entry.date, items)
  }

  const marketCursors = new Map<string, DailyCloseCursor>()
  for (const [assetId, series] of Object.entries(marketSeriesByAsset)) {
    marketCursors.set(assetId, new DailyCloseCursor(series.quotes))
  }
  const fxCursors = new Map<string, DailyCloseCursor>()
  for (const [currency, quotes] of Object.entries(fxSeriesByCurrency)) {
    fxCursors.set(currency.toUpperCase(), new DailyCloseCursor(quotes))
  }

  const fxRate = (currency: string, date: string): number | null => {
    const normalized = currency.toUpperCase()
    if (normalized === 'EUR') return 1
    return fxCursors.get(normalized)?.value(date) ?? null
  }

  const funding = calculateNetInvestmentByCurrency(completed.map(({ transaction }) => transaction))
  const flowsByDate = new Map<string, typeof funding.datedFlows>()
  for (const flow of funding.datedFlows) {
    const flowDate = day(flow.date)
    if (!flowDate) continue
    const flows = flowsByDate.get(flowDate) ?? []
    flows.push({ ...flow, date: flowDate })
    flowsByDate.set(flowDate, flows)
  }

  const holdings = new Map<string, { asset: Asset; units: number }>()
  const points: ReconstructedPortfolioPoint[] = []
  let invested = 0
  let contributionsRemainExact = true
  let unresolvedContributionCount = 0

  for (const currentDate of inclusiveDays(firstDate, endDate)) {
    for (const transaction of transactionsByDate.get(currentDate) ?? []) {
      const asset = assetFor(transaction)
      if (!asset) continue
      const delta = operationUnits(transaction)
      if (!Number.isFinite(delta)) continue
      const holding = holdings.get(transaction.activo_id) ?? { asset, units: 0 }
      holding.units += delta
      holdings.set(transaction.activo_id, holding)
    }

    for (const flow of flowsByDate.get(currentDate) ?? []) {
      const rate = flow.currency === 'EUR'
        ? 1
        : flow.fixedRate ?? contributionFxRates[historicalFxKey(flow.currency, currentDate)]
      if (!Number.isFinite(rate) || !rate || rate <= 0) {
        contributionsRemainExact = false
        unresolvedContributionCount += 1
        continue
      }
      if (contributionsRemainExact) invested += flow.amount / rate
    }

    let totalValue = 0
    let valuationIsExact = true
    for (const [assetId, holding] of holdings) {
      if (Math.abs(holding.units) <= UNIT_EPSILON) continue
      if (holding.units < 0) {
        valuationIsExact = false
        break
      }

      const priceCurrency = isCashAsset(holding.asset)
        ? holding.asset.moneda
        : marketSeriesByAsset[assetId]?.currency
      const conversionRate = priceCurrency ? fxRate(priceCurrency, currentDate) : null
      const nativePrice = isCashAsset(holding.asset)
        ? 1
        : marketCursors.get(assetId)?.value(currentDate) ?? null

      if (!nativePrice || !conversionRate) {
        valuationIsExact = false
        break
      }
      totalValue += (holding.units * nativePrice) / conversionRate
    }

    points.push({
      date: currentDate,
      value: valuationIsExact ? totalValue : null,
      invested: contributionsRemainExact ? invested : null,
    })
  }

  return { points, unresolvedContributionCount }
}
