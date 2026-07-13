import { describe, expect, it } from 'vitest'
import { calculateCashMovement } from '@/lib/domain/transactions/cash-movement'

describe('cash movement', () => {
  it('withdraws purchase value and commission from cash', () => {
    expect(calculateCashMovement({
      operation: 'Compra', quantity: 2, unitPrice: 50, commission: 1,
    })).toEqual({ operation: 'Venta', amount: 101 })
  })

  it('deposits the net proceeds of a sale', () => {
    expect(calculateCashMovement({
      operation: 'Venta',
      quantity: 2,
      unitPrice: 50,
      commission: 1,
      withholdingOrigin: 2,
      withholdingDestination: 3,
    })).toEqual({ operation: 'Compra', amount: 94 })
  })

  it('uses the dividend amount without multiplying by quantity', () => {
    expect(calculateCashMovement({
      operation: 'Dividendo',
      quantity: 25,
      unitPrice: 20,
      withholdingOrigin: 3,
      withholdingDestination: 2,
    })).toEqual({ operation: 'Compra', amount: 15 })
  })

  it('ignores transfers and non-positive proceeds', () => {
    expect(calculateCashMovement({
      operation: 'Traspaso Entrada', quantity: 2, unitPrice: 50,
    })).toBeNull()
    expect(calculateCashMovement({
      operation: 'Venta', quantity: 1, unitPrice: 1, commission: 2,
    })).toBeNull()
  })
})
