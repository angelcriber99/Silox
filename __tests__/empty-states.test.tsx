import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { PositionsTable } from '@/components/transactions/positions-table'
import { AllocationChart } from '@/components/dashboard/allocation-chart'
import { PortfolioSummary } from '@/components/dashboard/portfolio-summary'
import { MobileDashboard } from '@/components/mobile/mobile-dashboard'
import { DashboardErrorState } from '@/components/dashboard/dashboard-error-state'
import type { EnrichedPosition, PortfolioTotals } from '@/lib/types'
import { renderWithProviders } from '@/__tests__/test-utils'

// Mocks to avoid external library errors in JSDOM
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => children,
  PieChart: () => <div data-testid="pie-chart" />,
  Pie: () => <div />,
  Cell: () => <div />,
  Tooltip: () => <div />
}))

describe('Empty States UI Verification', () => {
  const emptyPositions: EnrichedPosition[] = []
  const emptyTotals: PortfolioTotals = {
    valueMoney: { amount: 0, currency: 'EUR' },
    costMoney: { amount: 0, currency: 'EUR' },
    pnlMoney: { amount: 0, currency: 'EUR' },
    pnl24hMoney: { amount: 0, currency: 'EUR' },
    sessionPnlMoney: { amount: 0, currency: 'EUR' },
    totalPnlPercent: 0,
    totalPnlPercent24h: 0,
    totalDailyPnlPercent: 0,
    dailyPerformancePositionCount: 0,
    positionCount: 0,
    hasAllPrices: true,
    estimatedPositionCount: 0,
  }

  describe('PositionsTable', () => {
    it('renders empty state correctly on desktop and mobile', () => {
      renderWithProviders(
        <PositionsTable
          positions={emptyPositions}
          loading={false}
          onAddTransaction={vi.fn()}
          onEditAsset={vi.fn()}
        />
      )

      // It should display "Tu cartera está vacía" when there are no positions
      const emptyMessages = screen.getAllByText('Tu cartera está vacía')
      expect(emptyMessages.length).toBeGreaterThan(0) // Desktop and Mobile views
      
      const subtitles = screen.getAllByText(/Añade un activo y registra tu primera operación/i)
      expect(subtitles.length).toBeGreaterThan(0)
    })
  })

  describe('AllocationChart', () => {
    it('renders empty state when positions are 0', () => {
      renderWithProviders(<AllocationChart positions={emptyPositions} />)
      expect(screen.getByText(/Añade activos con transacciones para ver la distribución/i)).toBeInTheDocument()
    })
  })

  describe('PortfolioSummary', () => {
    it('renders the zero-value portfolio summary without inventing data', () => {
      renderWithProviders(<PortfolioSummary totals={emptyTotals} loading={false} />)
      expect(screen.getByText('Valor del Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Invertido')).toBeInTheDocument()
      expect(screen.getByText('Sin datos de hoy')).toBeInTheDocument()
    })
  })

  describe('MobileDashboard', () => {
    it('renders correctly with 0 positions without crashing', () => {
      const { container } = renderWithProviders(
        <MobileDashboard
          positions={emptyPositions}
          totals={emptyTotals}
          isLoading={false}
        />
      )
      expect(screen.getByText('Valor de la cartera')).toBeInTheDocument()
      expect(screen.getByText('Sin posiciones abiertas')).toBeInTheDocument()
      expect(container).toBeInTheDocument()
    })
  })

  describe('DashboardErrorState', () => {
    it('offers an accessible retry action', () => {
      const onRetry = vi.fn()
      renderWithProviders(<DashboardErrorState onRetry={onRetry} />)

      expect(screen.getByRole('heading', { name: /no hemos podido cargar/i })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
      expect(onRetry).toHaveBeenCalledOnce()
    })
  })
})
