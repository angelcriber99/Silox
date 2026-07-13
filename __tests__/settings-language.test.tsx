import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@/__tests__/test-utils'
import { usePreferences } from '@/lib/stores/use-preferences'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh,
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/settings',
  useSearchParams: () => new URLSearchParams(),
}))

import SettingsPage from '@/app/(main)/settings/page'

describe('Settings language', () => {
  beforeEach(() => {
    refresh.mockReset()
    usePreferences.setState({ language: 'es' })
    document.cookie = 'NEXT_LOCALE=es; path=/'
  })

  afterEach(() => {
    usePreferences.setState({ language: 'es' })
  })

  it('actualiza el idioma sin recargar toda la ventana', () => {
    renderWithProviders(<SettingsPage />)

    fireEvent.change(screen.getByDisplayValue(/Español/), { target: { value: 'en' } })

    expect(usePreferences.getState().language).toBe('en')
    expect(document.cookie).toContain('NEXT_LOCALE=en')
    expect(refresh).toHaveBeenCalledOnce()
  })
})
