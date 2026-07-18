import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import RadarPage from '@/app/(main)/radar/page'
import { renderWithProviders } from '@/__tests__/test-utils'

const radarResponse = {
  data: {
    assets: [
      { id: 'asts-id', ticker: 'ASTS', name: 'AST SpaceMobile', type: 'Acción', currency: 'USD' },
      { id: 'nvo-id', ticker: 'NVO', name: 'Novo Nordisk', type: 'Acción', currency: 'USD' },
    ],
    events: [{
      id: 'asts-launch',
      assetId: 'asts-id',
      ticker: 'ASTS',
      date: '2026-08-01T12:00:00.000Z',
      endDate: '2026-08-15T12:00:00.000Z',
      datePrecision: 'range',
      type: 'CATALYST',
      title: 'Lanzamiento o misión relevante',
      description: 'BlueBirds 11, 12 y 13 durante la primera quincena de agosto.',
      certainty: 'scheduled',
      impact: 'high',
      sourceName: 'Business Wire',
      sourceUrl: 'https://example.com/asts-launch',
    }],
    news: [
      {
        id: 'asts-news',
        title: 'AST SpaceMobile prepara su siguiente misión',
        source: 'Business Wire',
        publishedAt: '2026-07-17T12:00:00.000Z',
        url: 'https://example.com/asts-news',
        ticker: 'ASTS',
      },
      {
        id: 'nvo-news',
        title: 'Novo Nordisk amplía capacidad de producción',
        source: 'Reuters',
        publishedAt: '2026-07-16T12:00:00.000Z',
        url: 'https://example.com/nvo-news',
        ticker: 'NVO',
      },
    ],
    updatedAt: '2026-07-18T12:00:00.000Z',
  },
}

describe('RadarPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(radarResponse), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('previsualiza el día al hacer hover y fija el detalle al hacer click', async () => {
    renderWithProviders(<RadarPage />)

    const dayButton = await screen.findByRole('button', { name: '5 de agosto: 1 eventos' })
    fireEvent.mouseEnter(dayButton)

    const tooltip = screen.getByRole('tooltip')
    expect(within(tooltip).getByText('ASTS')).toBeInTheDocument()
    expect(within(tooltip).getByText('Lanzamiento o misión relevante')).toBeInTheDocument()
    expect(within(tooltip).getByText('Haz click para fijar el detalle debajo.')).toBeInTheDocument()

    fireEvent.click(dayButton)

    await waitFor(() => expect(dayButton).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByRole('heading', { name: 'Eventos del 5 de agosto' })).toBeInTheDocument()
  })

  it('muestra noticias de todos los activos recibidos', async () => {
    renderWithProviders(<RadarPage />)

    expect(await screen.findByText('AST SpaceMobile prepara su siguiente misión')).toBeInTheDocument()
    expect(screen.getByText('Novo Nordisk amplía capacidad de producción')).toBeInTheDocument()
  })
})
