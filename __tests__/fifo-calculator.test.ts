import { describe, expect, it } from 'vitest'

import type { Transaccion } from '@/lib/types'
import { calculateFIFO } from '@/lib/utils/fifo-calculator'

function transaction(overrides: Partial<Transaccion>): Transaccion {
  return {
    id: 'transaction',
    activo_id: 'asset',
    tipo_operacion: 'Compra',
    cantidad: 1,
    precio_unitario: 1,
    comision: 0,
    fecha: '2026-01-01',
    notas: null,
    created_at: '2026-01-01T00:00:00.000Z',
    activo: { ticker: 'TEST', nombre: 'Test', tipo: 'Acción', moneda: 'EUR' },
    ...overrides,
  }
}

describe('calculateFIFO', () => {
  it('consumes the oldest lots and includes buy and sale commissions', () => {
    const events = calculateFIFO([
      transaction({ id: 'buy-1', cantidad: 10, precio_unitario: 10, comision: 2, fecha: '2025-01-01' }),
      transaction({ id: 'buy-2', cantidad: 5, precio_unitario: 20, comision: 1, fecha: '2025-02-01' }),
      transaction({ id: 'sale', tipo_operacion: 'Venta', cantidad: 12, precio_unitario: 30, comision: 3, fecha: '2025-03-01' }),
    ])

    expect(events).toHaveLength(1)
    expect(events[0].ingresoVenta).toBe(357)
    expect(events[0].costeAdquisicion).toBeCloseTo(142.4, 8)
    expect(events[0].gananciaPatrimonial).toBeCloseTo(214.6, 8)
  })

  it('uses the source execution timestamp for same-day operations', () => {
    const events = calculateFIFO([
      transaction({
        id: 'later-buy',
        cantidad: 1,
        precio_unitario: 20,
        fecha: '2025-03-01',
        created_at: '2025-03-01T12:00:00.000Z',
      }),
      transaction({
        id: 'earlier-buy',
        cantidad: 1,
        precio_unitario: 10,
        fecha: '2025-03-01',
        created_at: '2025-03-01T08:00:00.000Z',
      }),
      transaction({
        id: 'sale',
        tipo_operacion: 'Venta',
        cantidad: 1,
        precio_unitario: 30,
        fecha: '2025-03-01',
        created_at: '2025-03-01T10:00:00.000Z',
      }),
    ])

    expect(events[0].costeAdquisicion).toBe(10)
    expect(events[0].gananciaPatrimonial).toBe(20)
  })
})
