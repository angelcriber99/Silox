import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/__tests__/test-utils'
import type { EnrichedPosition } from '@/lib/types'

const { mutateAsync } = vi.hoisted(() => ({ mutateAsync: vi.fn() }))

vi.mock('@/lib/hooks/use-transactions', () => ({
  useUpdateAsset: () => ({ mutateAsync, isPending: false }),
}))

import { WaveTrackerModal } from '@/components/asset/wave-tracker-modal'

const position = {
  activo_id: 'asset-1',
  ticker: 'AAPL',
  isin: null,
  nombre: 'Apple',
  tipo: 'Acción',
  estrategia: 'Core',
  moneda: 'USD',
  sector: 'Tecnología',
  geografia: 'Estados Unidos',
  unidades: 1,
  coste_total: 100,
  comisiones_total: 0,
  num_operaciones: 1,
  ultima_operacion: '2026-07-01',
  notas: JSON.stringify({ text: 'Mantener', waves: [] }),
  precio_actual: 200,
  precio_actual_nativo: 200,
  precio_actual_usd: 200,
  original_currency: 'USD',
  displayValue: { amount: 200, currency: 'EUR' },
  valor_actual_nativo: 200,
  displayCost: { amount: 100, currency: 'EUR' },
  pnl: 100,
  pnl_percent: 100,
  precio_medio: 100,
  sparkline: [],
  change_percent_24h: 0,
  daily_change_percent_24h: 0,
  displayDailyPnL: { amount: 0, currency: 'EUR' },
} as unknown as EnrichedPosition

describe('WaveTrackerModal', () => {
  it('guarda las notas mediante la mutación que invalida posiciones', async () => {
    mutateAsync.mockResolvedValue(position)
    const onOpenChange = vi.fn()
    renderWithProviders(
      <WaveTrackerModal position={position} open onOpenChange={onOpenChange} />,
    )

    expect(screen.getByDisplayValue('Mantener')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Olas' }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce())
    expect(mutateAsync).toHaveBeenCalledWith({
      id: 'asset-1',
      updates: { notas: JSON.stringify({ text: 'Mantener', waves: [] }) },
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
