import { describe, expect, it } from 'vitest'
import {
  buildTransactionGroups,
  getTransactionCandidates,
} from '@/lib/domain/imports/transaction-index'

describe('transaction import index', () => {
  const transactions = [
    { id: '1', activo_id: 'asset-a', tipo_operacion: 'Compra', fecha: '2026-07-01' },
    { id: '2', activo_id: 'asset-a', tipo_operacion: 'Compra', fecha: '2026-07-01' },
    { id: '3', activo_id: 'asset-a', tipo_operacion: 'Venta', fecha: '2026-07-01' },
    { id: '4', activo_id: 'asset-b', tipo_operacion: 'Compra', fecha: '2026-07-01' },
  ]

  it('returns only transactions from the requested asset, operation and date', () => {
    const groups = buildTransactionGroups(transactions)

    expect(getTransactionCandidates(groups, 'asset-a', 'Compra', '2026-07-01'))
      .toEqual(transactions.slice(0, 2))
    expect(getTransactionCandidates(groups, 'asset-a', 'Venta', '2026-07-01'))
      .toEqual([transactions[2]])
  })

  it('returns an empty collection for an unknown group', () => {
    const groups = buildTransactionGroups(transactions)

    expect(getTransactionCandidates(groups, 'missing', 'Compra', '2026-07-01'))
      .toEqual([])
  })
})
