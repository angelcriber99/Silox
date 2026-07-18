import { describe, expect, it } from 'vitest'

import { nonCashRewardNote } from '@/lib/domain/portfolio/contributions'
import { calculateOpenCostBasis, calculateOpenPositionBases } from '@/lib/utils/open-cost-basis'

const transaction = (
  overrides: Partial<{
    activo_id: string
    tipo_operacion: 'Compra' | 'Venta' | 'Traspaso Entrada' | 'Traspaso Salida' | 'Retirada'
    cantidad: number
    precio_unitario: number
    comision: number
    fecha: string
    created_at: string
    notas: string | null
  }>,
) => ({
  activo_id: 'silver',
  tipo_operacion: 'Compra' as const,
  cantidad: 1,
  precio_unitario: 1,
  comision: 0,
  fecha: '2026-01-01',
  created_at: '2026-01-01T00:00:00.000Z',
  notas: null,
  ...overrides,
})

describe('calculateOpenCostBasis', () => {
  it('keeps only the FIFO cost of units that are still open', () => {
    const costs = calculateOpenCostBasis([
      transaction({ cantidad: 10, precio_unitario: 45, fecha: '2025-10-15' }),
      transaction({
        tipo_operacion: 'Venta',
        cantidad: 10,
        precio_unitario: 55,
        fecha: '2026-02-05',
      }),
      transaction({
        cantidad: 4.387916,
        precio_unitario: 64.183,
        fecha: '2026-03-25',
      }),
    ])

    expect(costs.get('silver')).toBeCloseTo(281.63, 2)
  })

  it('does not let prior realised gains turn a new position into a negative cost', () => {
    const costs = calculateOpenCostBasis([
      transaction({ cantidad: 1, precio_unitario: 40 }),
      transaction({ tipo_operacion: 'Venta', cantidad: 1, precio_unitario: 80, fecha: '2026-02-01' }),
      transaction({ cantidad: 1, precio_unitario: 60, fecha: '2026-03-01' }),
    ])

    expect(costs.get('silver')).toBe(60)
  })

  it('includes purchase commissions in the remaining cost basis', () => {
    const costs = calculateOpenCostBasis([
      transaction({ cantidad: 2, precio_unitario: 50, comision: 2 }),
      transaction({ tipo_operacion: 'Venta', cantidad: 1, precio_unitario: 70, fecha: '2026-02-01' }),
    ])

    expect(costs.get('silver')).toBe(51)
  })

  it('uses reward value for performance while excluding it from invested cash', () => {
    const bases = calculateOpenPositionBases([
      transaction({ cantidad: 2, precio_unitario: 100 }),
      transaction({
        cantidad: 1,
        precio_unitario: 120,
        fecha: '2026-02-01',
        notas: nonCashRewardNote('Recompensa de staking'),
      }),
    ])

    expect(bases.get('silver')).toEqual({
      performanceCost: 320,
      investedCost: 200,
    })
  })

  it('keeps both bases aligned when FIFO disposes paid and reward lots', () => {
    const bases = calculateOpenPositionBases([
      transaction({ cantidad: 2, precio_unitario: 100 }),
      transaction({
        cantidad: 2,
        precio_unitario: 120,
        fecha: '2026-02-01',
        notas: nonCashRewardNote('Recompensa gratis'),
      }),
      transaction({ tipo_operacion: 'Venta', cantidad: 3, precio_unitario: 150, fecha: '2026-03-01' }),
    ])

    expect(bases.get('silver')).toEqual({
      performanceCost: 120,
      investedCost: 0,
    })
  })
})
