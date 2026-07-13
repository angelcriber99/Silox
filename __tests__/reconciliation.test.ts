import { describe, expect, it } from 'vitest'
import { reconcilePortfolio } from '@/lib/utils/reconciliation'
import type { EnrichedPosition, Transaccion } from '@/lib/types'

function position(overrides: Partial<EnrichedPosition>): EnrichedPosition {
  return {
    activo_id: 'cash-1',
    ticker: 'CASH',
    isin: null,
    nombre: 'Efectivo',
    tipo: 'Liquidez',
    estrategia: 'Liquidez',
    moneda: 'EUR',
    sector: 'Cash',
    geografia: 'Global',
    unidades: 100,
    coste_total: 100,
    comisiones_total: 0,
    num_operaciones: 1,
    ultima_operacion: null,
    notas: null,
    precio_actual: 1,
    precio_actual_nativo: 1,
    original_currency: 'EUR',
    valor_actual: 100,
    valor_actual_nativo: 100,
    coste_total_eur: 100,
    pnl: 0,
    pnl_percent: 0,
    precio_medio: 1,
    sparkline: [],
    change_percent_24h: null,
    daily_change_percent_24h: null,
    change_amount_24h: null,
    ...overrides,
  }
}

function tx(overrides: Partial<Transaccion>): Transaccion {
  return {
    id: 'tx-1',
    activo_id: 'asset-1',
    tipo_operacion: 'Compra',
    cantidad: 1,
    precio_unitario: 10,
    comision: 0,
    fecha: '2026-01-01',
    notas: null,
    created_at: '2026-01-01T00:00:00.000Z',
    activo: {
      ticker: 'ABC',
      nombre: 'ABC Corp',
      tipo: 'Acción',
      moneda: 'EUR',
    },
    ...overrides,
  }
}

describe('portfolio reconciliation', () => {
  it('warns when pending buys exceed available cash', () => {
    const issues = reconcilePortfolio({
      positions: [position({ valor_actual: 50, coste_total_eur: 50 })],
      transactions: [],
      pendingTxs: [tx({ estado: 'Pendiente', cantidad: 10, precio_unitario: 10 })],
    })

    expect(issues.some((issue) => issue.id === 'pending-cash-overuse')).toBe(true)
  })

  it('detects sales above available historical units', () => {
    const issues = reconcilePortfolio({
      positions: [],
      transactions: [
        tx({ id: 'buy-1', tipo_operacion: 'Compra', cantidad: 1, fecha: '2026-01-01' }),
        tx({ id: 'sell-1', tipo_operacion: 'Venta', cantidad: 2, fecha: '2026-01-02' }),
      ],
    })

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'oversold-asset-1', severity: 'critical' }),
    ]))
  })
})
