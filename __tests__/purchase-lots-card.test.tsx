import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PurchaseLotsCard } from '@/components/asset/detail/purchase-lots-card'
import type { EnrichedPosition } from '@/lib/types'
import { renderWithProviders } from '@/__tests__/test-utils'

const position = {
  moneda: 'EUR',
  precio_actual: 30,
  precio_actual_nativo: 30,
  original_currency: 'EUR',
} as EnrichedPosition

describe('PurchaseLotsCard', () => {
  it('renders only the remaining FIFO purchase quantity and its performance', () => {
    renderWithProviders(
      <PurchaseLotsCard
        position={position}
        transactions={[
          {
            id: 'first-buy', fecha: '2026-01-01', created_at: '2026-01-01T10:00:00.000Z',
            tipo_operacion: 'Compra', cantidad: 10, precio_unitario: 10, comision: 0, notas: null, estado: 'Completada',
          },
          {
            id: 'second-buy', fecha: '2026-02-01', created_at: '2026-02-01T10:00:00.000Z',
            tipo_operacion: 'Compra', cantidad: 5, precio_unitario: 20, comision: 0, notas: null, estado: 'Completada',
          },
          {
            id: 'sale', fecha: '2026-03-01', created_at: '2026-03-01T10:00:00.000Z',
            tipo_operacion: 'Venta', cantidad: 12, precio_unitario: 25, comision: 0, notas: null, estado: 'Completada',
          },
        ]}
      />,
    )

    expect(screen.getByText('Rendimiento por compra')).toBeInTheDocument()
    expect(screen.getByText('3 abiertas de 5')).toBeInTheDocument()
    expect(screen.getByText('Parcial')).toBeInTheDocument()
    expect(screen.getByText('+50.00%')).toBeInTheDocument()
    expect(screen.queryByText('01 ene 2026')).not.toBeInTheDocument()
  })
})
