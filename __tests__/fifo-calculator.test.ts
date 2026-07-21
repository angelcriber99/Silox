import { describe, expect, it } from 'vitest'

import type { Transaccion } from '@/lib/types'
import { calculateDividendTaxAmounts, calculateFIFO } from '@/lib/utils/fifo-calculator'

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
    activo: { ticker: 'TEST', isin: null, nombre: 'Test', tipo: 'Acción', moneda: 'EUR' },
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

  it('converts every FIFO lot and the sale with their own historical EUR rates', () => {
    const events = calculateFIFO([
      transaction({
        id: 'usd-buy',
        cantidad: 10,
        precio_unitario: 100,
        comision: 10,
        fecha: '2025-01-10',
        tipo_cambio_eur: 1.25,
        activo: { ticker: 'USD', isin: null, nombre: 'USD Asset', tipo: 'Acción', moneda: 'USD' },
      }),
      transaction({
        id: 'usd-sale',
        tipo_operacion: 'Venta',
        cantidad: 4,
        precio_unitario: 150,
        comision: 6,
        fecha: '2025-03-10',
        tipo_cambio_eur: 1.20,
        activo: { ticker: 'USD', isin: null, nombre: 'USD Asset', tipo: 'Acción', moneda: 'USD' },
      }),
    ])

    expect(events[0].ingresoVenta).toBeCloseTo(495, 8)
    expect(events[0].costeAdquisicion).toBeCloseTo(323.2, 8)
    expect(events[0].gananciaPatrimonial).toBeCloseTo(171.8, 8)
    expect(events[0].monedaOriginal).toBe('USD')
    expect(events[0].tipoCambioVenta).toBe(1.20)
  })

  it('converts dividends, fees and withholdings to EUR consistently', () => {
    const amounts = calculateDividendTaxAmounts(transaction({
      tipo_operacion: 'Dividendo',
      cantidad: 0,
      precio_unitario: 12,
      comision: 1.2,
      retencion_origen: 1.8,
      retencion_destino: 0.6,
      tipo_cambio_eur: 1.2,
      activo: { ticker: 'USD', isin: null, nombre: 'USD Asset', tipo: 'Acción', moneda: 'USD' },
    }))

    expect(amounts.gross).toBeCloseTo(10, 8)
    expect(amounts.fees).toBeCloseTo(1, 8)
    expect(amounts.retOrigen).toBeCloseTo(1.5, 8)
    expect(amounts.retDestino).toBeCloseTo(0.5, 8)
    expect(amounts.baseImponible).toBeCloseTo(9, 8)
    expect(amounts.net).toBeCloseTo(7, 8)
  })

  it('never treats a missing foreign historical rate as EUR', () => {
    expect(() => calculateFIFO([
      transaction({
        activo: { ticker: 'USD', isin: null, nombre: 'USD Asset', tipo: 'Acción', moneda: 'USD' },
        tipo_cambio_eur: null,
      }),
    ])).toThrow(/cambio histórico USD\/EUR/)
  })

  it('fails instead of reporting a false gain when purchase lots are missing', () => {
    expect(() => calculateFIFO([
      transaction({
        id: 'orphan-sale',
        tipo_operacion: 'Venta',
        cantidad: 2,
        precio_unitario: 25,
      }),
    ])).toThrow(/Faltan 2 unidades FIFO/)
  })

  it('ignores pending operations in the tax report', () => {
    expect(calculateFIFO([
      transaction({ estado: 'Pendiente' }),
      transaction({ tipo_operacion: 'Venta', estado: 'Pendiente' }),
    ])).toHaveLength(0)
  })
})
