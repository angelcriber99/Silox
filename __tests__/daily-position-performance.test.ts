import { describe, expect, it } from 'vitest'

import { calculateDailyPositionActivity } from '@/lib/utils/daily-position-performance'

describe('daily position activity', () => {
  it('combines purchases, sales, commissions and dividends for the selected market day', () => {
    const activity = calculateDailyPositionActivity([
      {
        activo_id: 'asts', tipo_operacion: 'Compra', cantidad: 10, precio_unitario: 100,
        comision: 2, fecha: '2026-07-18',
      },
      {
        activo_id: 'asts', tipo_operacion: 'Venta', cantidad: 4, precio_unitario: 110,
        comision: 1, fecha: '2026-07-18',
      },
      {
        activo_id: 'asts', tipo_operacion: 'Dividendo', cantidad: 1, precio_unitario: 8,
        comision: 0, retencion_origen: 1, retencion_destino: 0.5, fecha: '2026-07-18',
      },
      {
        activo_id: 'asts', tipo_operacion: 'Compra', cantidad: 100, precio_unitario: 1,
        comision: 0, fecha: '2026-07-17',
      },
    ], '2026-07-18').get('asts')

    expect(activity?.netUnits).toBe(6)
    expect(activity?.netFlowNative).toBeCloseTo(556.5)
  })
})
