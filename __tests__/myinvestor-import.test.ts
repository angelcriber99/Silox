import { describe, expect, it, vi } from 'vitest'

import { isMyInvestorStatement, parseMyInvestorStatement } from '@/lib/domain/imports/myinvestor'

const rows = [
  ['Histórico de órdenes de fondos'],
  ['Fecha de la orden', 'ISIN', 'Fondo', 'Tipo de operación', 'Nº de participaciones', 'Importe estimado', 'Estado', 'Gastos', 'Divisa'],
  ['12/07/2026', 'IE00BYX5P602', 'MSCI World Index Fund', 'Suscripción', '85,125', '1.000,00', 'Finalizada', '0,25', 'EUR'],
  ['13/07/2026', 'IE00BYX5P602', 'MSCI World Index Fund', 'Reembolso', '5,5', '66,00', 'Ejecutada', '0', 'EUR'],
  ['14/07/2026', 'IE00B03HD191', 'Vanguard Global Stock', 'Suscripción', '10', '250,00', 'Pendiente', '0', 'EUR'],
]

describe('MyInvestor statement import', () => {
  it('detects an XLSX-style statement even with title rows before its header', () => {
    expect(isMyInvestorStatement(rows)).toBe(true)
  })

  it('imports only completed orders and derives unit prices', async () => {
    const resolver = vi.fn().mockResolvedValue({
      ticker: '0P0001AINF.F',
      name: 'MSCI World Index Fund',
      type: 'Fondo Indexado',
      currency: 'EUR',
    })

    const result = await parseMyInvestorStatement(rows, 'user-rebuild', resolver)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      user_id: 'user-rebuild',
      isin: 'IE00BYX5P602',
      ticker: '0P0001AINF.F',
      tipo_operacion: 'Compra',
      cantidad: 85.125,
      comision: 0.25,
    })
    expect(result[0].precio_unitario).toBeCloseTo(1000 / 85.125)
    expect(result[1]).toMatchObject({ tipo_operacion: 'Venta', cantidad: 5.5, precio_unitario: 12 })
    expect(resolver).toHaveBeenCalledTimes(1)
  })

  it('rejects rows without an ISIN instead of creating unpriceable assets', async () => {
    const resolver = vi.fn()
    const result = await parseMyInvestorStatement([
      rows[1],
      ['12/07/2026', '', 'Unknown', 'Suscripción', '4', '100', 'Finalizada'],
    ], 'user-rebuild', resolver)

    expect(result).toEqual([])
    expect(resolver).not.toHaveBeenCalled()
  })
})
