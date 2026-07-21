import type { Posicion } from '@/lib/types'
import { calculateDailyPositionActivity, type DailyPositionActivity } from '@/lib/utils/daily-position-performance'
import { calculateOpenPositionBases, type CostBasisTransaction, type OpenPositionBasis } from '@/lib/utils/open-cost-basis'
import { calculateNetInvestmentByCurrency, type InvestmentFlowTransaction, type PortfolioFundingSummary } from './contributions'

const UNIT_TOLERANCE = 0.000001
const BUY_OPERATIONS = new Set(['Compra', 'Traspaso Entrada'])
const SALE_OPERATIONS = new Set(['Venta', 'Traspaso Salida', 'Retirada'])

export type PortfolioAccountingTransaction = CostBasisTransaction & InvestmentFlowTransaction & {
  activo_id: string
  estado?: string | null
}

export interface AccountingIssue {
  code: 'INVALID_QUANTITY' | 'NEGATIVE_UNITS' | 'POSITION_UNIT_MISMATCH'
  assetId: string
  expectedUnits?: number
  actualUnits?: number
  transactionId?: string
}

export interface PortfolioAccountingResult {
  openBases: Map<string, OpenPositionBasis>
  dailyActivity: Map<string, DailyPositionActivity>
  expectedUnits: Map<string, number>
  funding: PortfolioFundingSummary
  issues: AccountingIssue[]
}

function isCompleted(transaction: PortfolioAccountingTransaction): boolean {
  return !transaction.estado || transaction.estado.toLowerCase() === 'completada'
}

/** Canonical accounting projection shared by web, mobile and server jobs. */
export function calculatePortfolioAccounting(
  transactions: PortfolioAccountingTransaction[],
  marketDate?: string,
): PortfolioAccountingResult {
  const completed = transactions.filter(isCompleted)
  const expectedUnits = new Map<string, number>()
  const issues: AccountingIssue[] = []

  for (const transaction of completed) {
    const quantity = Number(transaction.cantidad)
    if (!Number.isFinite(quantity) || quantity < 0) {
      issues.push({
        code: 'INVALID_QUANTITY',
        assetId: transaction.activo_id,
        transactionId: transaction.id,
      })
      continue
    }

    const direction = BUY_OPERATIONS.has(transaction.tipo_operacion)
      ? 1
      : SALE_OPERATIONS.has(transaction.tipo_operacion)
        ? -1
        : 0
    if (direction === 0) continue

    const units = (expectedUnits.get(transaction.activo_id) ?? 0) + (direction * quantity)
    expectedUnits.set(transaction.activo_id, Math.abs(units) <= UNIT_TOLERANCE ? 0 : units)
    if (units < -UNIT_TOLERANCE) {
      issues.push({
        code: 'NEGATIVE_UNITS',
        assetId: transaction.activo_id,
        expectedUnits: units,
        transactionId: transaction.id,
      })
    }
  }

  return {
    openBases: calculateOpenPositionBases(completed),
    dailyActivity: calculateDailyPositionActivity(completed, marketDate),
    expectedUnits,
    funding: calculateNetInvestmentByCurrency(completed),
    issues,
  }
}

export function applyPortfolioAccounting(
  positions: Posicion[],
  accounting: PortfolioAccountingResult,
): { positions: Posicion[]; issues: AccountingIssue[] } {
  const issues = [...accounting.issues]
  const enriched = positions.map((position) => {
    const openBasis = accounting.openBases.get(position.activo_id)
    const activity = accounting.dailyActivity.get(position.activo_id)
    const expectedUnits = accounting.expectedUnits.get(position.activo_id) ?? 0
    const hasUnitMismatch = Math.abs(Number(position.unidades) - expectedUnits) > UNIT_TOLERANCE
    if (hasUnitMismatch) {
      issues.push({
        code: 'POSITION_UNIT_MISMATCH',
        assetId: position.activo_id,
        expectedUnits,
        actualUnits: Number(position.unidades),
      })
    }

    return {
      ...position,
      ...(openBasis ? {
        coste_total: openBasis.performanceCost,
        dinero_invertido: openBasis.investedCost,
        coste_total_eur_historico: openBasis.performanceCostEur,
        dinero_invertido_eur_historico: openBasis.investedCostEur,
      } : {}),
      has_daily_activity: Boolean(activity),
      daily_net_units: activity?.netUnits ?? 0,
      daily_net_flow_nativo: activity?.netFlowNative ?? 0,
      daily_net_flow_eur: activity?.netFlowEur ?? null,
      accounting_unit_mismatch: hasUnitMismatch,
    }
  })

  return { positions: enriched, issues }
}
