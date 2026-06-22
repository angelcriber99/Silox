import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PositionsTable } from '@/components/transactions/positions-table'
import { AllocationChart } from '@/components/dashboard/allocation-chart'
import { PortfolioSummary } from '@/components/dashboard/portfolio-summary'
import { MobileDashboard } from '@/components/mobile/mobile-dashboard'
import type { PortfolioTotals } from '@/lib/types'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

// Mocks to avoid external library errors in JSDOM
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => children,
  PieChart: () => <div data-testid="pie-chart" />,
  Pie: () => <div />,
  Cell: () => <div />,
  Tooltip: () => <div />
}))

describe('Empty States UI Verification', () => {
  const emptyPositions: any[] = []
  const emptyTotals: PortfolioTotals = {
    totalValue: 0,
    totalCost: 0,
    totalPnl: 0,
    totalPnlPercent: 0,
    positionCount: 0,
    hasAllPrices: true,
  }

  describe('PositionsTable', () => {
    it('renders empty state correctly on desktop and mobile', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <PositionsTable
            positions={emptyPositions}
            loading={false}
            onAddTransaction={vi.fn()}
            onEditAsset={vi.fn()}
          />
        </QueryClientProvider>
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
      render(<AllocationChart positions={emptyPositions} />)
      expect(screen.getByText(/Añade activos con transacciones para ver la distribución/i)).toBeInTheDocument()
    })
  })

  describe('PortfolioSummary', () => {
    it('renders dashes (—) when totalCost is 0', () => {
      render(<PortfolioSummary totals={emptyTotals} loading={false} />)
      // There should be 4 cards, the last 3 should show "—" when there's no data
      // Actually, totalValue can be "—" if 0, totalCost "—", totalPnl "—", totalPnlPercent "—"
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBe(4) // One for each card
    })
  })

  describe('MobileDashboard', () => {
    it('renders correctly with 0 positions without crashing', () => {
      const { container } = render(
        <MobileDashboard
          positions={emptyPositions}
          totals={emptyTotals}
          isLoading={false}
        />
      )
      // Dashboard should render its main KPI card. Rent. Hoy will show +0.00%
      expect(screen.getByText('Rent. Hoy')).toBeInTheDocument()
      expect(container).toBeInTheDocument()
    })
  })
})
