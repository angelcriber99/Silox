import { describe, expect, it } from 'vitest'

import {
  applyPortfolioAccounting,
  calculatePortfolioAccounting,
  type PortfolioAccountingTransaction,
} from '@/lib/domain/portfolio/accounting-engine'
import type { Posicion } from '@/lib/types'

const asset = { ticker: 'ASTS', tipo: 'Acción', moneda: 'USD' }
const transaction = (
  id: string,
  operation: string,
  quantity: number,
  price: number,
  date: string,
): PortfolioAccountingTransaction => ({
  id,
  activo_id: 'asts',
  tipo_operacion: operation,
  cantidad: quantity,
  precio_unitario: price,
  comision: 0,
  fecha: date,
  created_at: `${date}T12:00:00Z`,
  estado: 'Completada',
  tipo_cambio_eur: 1.2,
  activo: asset,
})

const position = (units: number): Posicion => ({
  activo_id: 'asts', ticker: 'ASTS', isin: null, nombre: 'AST SpaceMobile',
  tipo: 'Acción', estrategia: 'Satellite', moneda: 'USD', sector: 'Telecom',
  geografia: 'USA', unidades: units, coste_total: 0, comisiones_total: 0,
  num_operaciones: 3, ultima_operacion: '2026-07-22', notas: null,
})

describe('canonical portfolio accounting engine', () => {
  it('projects units, FIFO basis, funding and daily activity from one ledger', () => {
    const accounting = calculatePortfolioAccounting([
      transaction('buy-1', 'Compra', 10, 20, '2026-07-01'),
      transaction('sell-1', 'Venta', 4, 30, '2026-07-20'),
      transaction('buy-2', 'Compra', 2, 25, '2026-07-22'),
    ], '2026-07-22')

    expect(accounting.expectedUnits.get('asts')).toBe(8)
    expect(accounting.openBases.get('asts')?.performanceCost).toBe(170)
    expect(accounting.funding.netByCurrency.USD).toBe(130)
    expect(accounting.dailyActivity.get('asts')).toMatchObject({
      netUnits: 2,
      netFlowNative: 50,
    })
  })

  it('reconciles the database position against ledger-derived units', () => {
    const accounting = calculatePortfolioAccounting([
      transaction('buy', 'Compra', 10, 20, '2026-07-01'),
      transaction('sell', 'Venta', 4, 30, '2026-07-20'),
    ])

    expect(applyPortfolioAccounting([position(6)], accounting).issues).toEqual([])
    expect(applyPortfolioAccounting([position(5)], accounting).issues).toContainEqual({
      code: 'POSITION_UNIT_MISMATCH',
      assetId: 'asts',
      expectedUnits: 6,
      actualUnits: 5,
    })
  })

  it('ignores pending orders in every accounting projection', () => {
    const pending = transaction('pending', 'Compra', 100, 20, '2026-07-22')
    pending.estado = 'Pendiente'
    const accounting = calculatePortfolioAccounting([
      transaction('completed', 'Compra', 2, 20, '2026-07-01'),
      pending,
    ])

    expect(accounting.expectedUnits.get('asts')).toBe(2)
    expect(accounting.openBases.get('asts')?.performanceCost).toBe(40)
    expect(accounting.funding.netByCurrency.USD).toBe(40)
  })
})
