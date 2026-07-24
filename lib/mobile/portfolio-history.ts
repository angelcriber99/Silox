import {
  calculateNetInvestmentByCurrency,
  historicalFxKey,
  type InvestmentFlowTransaction,
} from '@/lib/domain/portfolio/contributions'
import type { ReconstructedPortfolioPoint } from '@/lib/domain/portfolio/historical-performance'

export type PortfolioHistorySource = 'snapshot' | 'transaction' | 'reconstructed'

export interface PersistedPortfolioHistoryPoint {
  timestamp: string
  total_value: number | null
  total_invested: number | null
}

export interface LegacyPortfolioSnapshot {
  date: string
  total_value: number | null
  total_invested: number | null
  updated_at?: string | null
}

export interface MobilePortfolioHistoryPoint {
  date: string
  value: string | null
  invested: string | null
  updatedAt: string | null
  /** A transaction point deliberately has no market valuation. */
  source: PortfolioHistorySource
}

export interface TransactionInvestmentHistory {
  points: MobilePortfolioHistoryPoint[]
  unresolvedFlowCount: number
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function day(value: string | null | undefined): string | null {
  const candidate = String(value ?? '').slice(0, 10)
  return ISO_DATE.test(candidate) ? candidate : null
}

function finiteNumber(value: number | null | undefined): number | null {
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null
}

function numberString(value: number | null): string | null {
  return value === null ? null : String(value)
}

/**
 * Rebuilds only the capital-added curve from the import ledger. Market value
 * is intentionally null: a transaction price is not a market close and must
 * never be presented as one.
 *
 * If a historic FX conversion cannot be resolved, the cumulative EUR figure
 * is no longer exact. The function therefore stops emitting transaction
 * points from that date onwards instead of silently using today's exchange
 * rate or an estimated one.
 */
export function buildTransactionInvestmentHistory(
  transactions: InvestmentFlowTransaction[],
  historicalRates: Record<string, number>,
): TransactionInvestmentHistory {
  const funding = calculateNetInvestmentByCurrency(transactions)
  const flows = funding.datedFlows
    .filter((flow) => day(flow.date) !== null)
    .sort((left, right) => left.date.localeCompare(right.date))

  const points: MobilePortfolioHistoryPoint[] = []
  let cumulativeInvested = 0
  let unresolvedFlowCount = 0
  let canContinue = true
  let currentDate: string | null = null

  for (const flow of flows) {
    const date = day(flow.date)!
    const rate = flow.currency === 'EUR'
      ? 1
      : flow.fixedRate ?? historicalRates[historicalFxKey(flow.currency, date)]

    if (!Number.isFinite(rate) || !rate || rate <= 0) {
      unresolvedFlowCount += 1
      canContinue = false
      continue
    }
    if (!canContinue) continue

    cumulativeInvested += flow.amount / rate
    if (currentDate === date && points.length > 0) {
      points[points.length - 1] = {
        ...points[points.length - 1],
        invested: numberString(cumulativeInvested),
      }
    } else {
      points.push({
        date,
        value: null,
        invested: numberString(cumulativeInvested),
        updatedAt: null,
        source: 'transaction',
      })
      currentDate = date
    }
  }

  return { points, unresolvedFlowCount }
}

/**
 * Merges exact valuations with the transaction-ledger fallback. Snapshot
 * valuations always win for their day. The fallback only fills missing days
 * with invested capital, never an invented historical portfolio value.
 */
export function buildMobilePortfolioHistory(
  history: PersistedPortfolioHistoryPoint[],
  legacySnapshots: LegacyPortfolioSnapshot[],
  transactions: InvestmentFlowTransaction[],
  historicalRates: Record<string, number>,
  range: { from?: string | null; to?: string | null } = {},
  reconstructed: ReconstructedPortfolioPoint[] = [],
): MobilePortfolioHistoryPoint[] {
  const snapshots = new Map<string, MobilePortfolioHistoryPoint>()

  const addSnapshot = (
    date: string | null,
    value: number | null,
    invested: number | null,
    updatedAt: string | null,
    replaceExisting: boolean,
  ) => {
    if (!date || (value === null && invested === null)) return
    if (!replaceExisting && snapshots.has(date)) return
    snapshots.set(date, {
      date,
      value: numberString(value),
      invested: numberString(invested),
      updatedAt,
      source: 'snapshot',
    })
  }

  // The current web and cron paths persist to portfolio_history. Keep the
  // older daily table as a read-only compatibility source for existing users.
  for (const snapshot of legacySnapshots) {
    addSnapshot(
      day(snapshot.date),
      finiteNumber(snapshot.total_value),
      finiteNumber(snapshot.total_invested),
      snapshot.updated_at ?? null,
      false,
    )
  }
  for (const snapshot of history) {
    addSnapshot(
      day(snapshot.timestamp),
      finiteNumber(snapshot.total_value),
      finiteNumber(snapshot.total_invested),
      snapshot.timestamp,
      true,
    )
  }

  const fallback = buildTransactionInvestmentHistory(transactions, historicalRates)
  const points = new Map(snapshots)
  for (const point of fallback.points) {
    const snapshot = points.get(point.date)
    if (!snapshot) {
      points.set(point.date, point)
      continue
    }
    // Older snapshots can contain a real portfolio valuation without the
    // capital column. The import ledger is authoritative for contributions,
    // so use it only to complete that missing series — never to fabricate a
    // historical market value or overwrite a persisted contribution.
    if (snapshot.invested === null && point.invested !== null) {
      points.set(point.date, { ...snapshot, invested: point.invested })
    }
  }

  // A reconstructed value is based on the transaction ledger, the historical
  // close of every open position, and the FX close for that same day. It is
  // therefore more representative than a later, sparse portfolio snapshot.
  for (const point of reconstructed) {
    const date = day(point.date)
    if (!date) continue
    const current = points.get(date)
    if (point.value !== null) {
      points.set(date, {
        date,
        value: numberString(point.value),
        invested: numberString(point.invested) ?? current?.invested ?? null,
        updatedAt: null,
        source: 'reconstructed',
      })
    } else if (point.invested !== null) {
      points.set(date, current
        ? { ...current, invested: numberString(point.invested) }
        : {
            date,
            value: null,
            invested: numberString(point.invested),
            updatedAt: null,
            source: 'transaction',
          })
    }
  }

  const from = day(range.from)
  const to = day(range.to)
  return Array.from(points.values())
    .filter((point) => (!from || point.date >= from) && (!to || point.date <= to))
    .sort((left, right) => left.date.localeCompare(right.date))
}
