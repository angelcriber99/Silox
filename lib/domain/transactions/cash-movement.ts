export interface CashMovementInput {
  operation: string
  quantity: number
  unitPrice: number
  commission?: number
  withholdingOrigin?: number
  withholdingDestination?: number
}

export interface CashMovement {
  operation: 'Compra' | 'Venta'
  amount: number
}

export function calculateCashMovement(
  input: CashMovementInput,
): CashMovement | null {
  const commission = input.commission ?? 0
  const withholdingOrigin = input.withholdingOrigin ?? 0
  const withholdingDestination = input.withholdingDestination ?? 0
  let operation: CashMovement['operation']
  let amount: number

  switch (input.operation) {
    case 'Compra':
      operation = 'Venta'
      amount = input.quantity * input.unitPrice + commission
      break
    case 'Venta':
      operation = 'Compra'
      amount = input.quantity * input.unitPrice
        - withholdingOrigin
        - withholdingDestination
        - commission
      break
    case 'Dividendo':
      operation = 'Compra'
      amount = input.unitPrice
        - withholdingOrigin
        - withholdingDestination
        - commission
      break
    default:
      return null
  }

  if (!Number.isFinite(amount) || amount <= 0) return null

  return { operation, amount }
}
