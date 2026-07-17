import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { RevolutSync } from '@/components/transactions/revolut-sync'
import { renderWithProviders } from '@/__tests__/test-utils'

describe('RevolutSync', () => {
  it('abre el selector de archivo al pulsar un botón de importación', () => {
    const openFilePicker = vi.spyOn(HTMLInputElement.prototype, 'click')

    renderWithProviders(
      <RevolutSync>
        <button type="button">Importar datos</button>
      </RevolutSync>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Importar datos' }))

    expect(openFilePicker).toHaveBeenCalledOnce()
    openFilePicker.mockRestore()
  })
})
