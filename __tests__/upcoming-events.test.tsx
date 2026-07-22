import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { UpcomingEvents } from "@/components/market/upcoming-events"
import { fetchEventosRecurrentes } from "@/lib/api/market"
import type { EnrichedPosition } from "@/lib/types"
import { renderWithProviders } from "@/__tests__/test-utils"

vi.mock("@/lib/api/market", () => ({
  fetchEventosRecurrentes: vi.fn(),
}))

const position: EnrichedPosition = {
  activo_id: "asset-1",
  ticker: "AAPL",
  isin: null,
  nombre: "Apple",
  tipo: "Acción",
  estrategia: "Core",
  moneda: "USD",
  sector: "Tecnología",
  geografia: "Estados Unidos",
  unidades: 2,
  coste_total: 300,
  comisiones_total: 1,
  num_operaciones: 1,
  ultima_operacion: "2026-07-01",
  notas: null,
  precio_actual: 200,
  precio_actual_nativo: 200,
  original_currency: "USD",
  displayValue: { amount: 400, currency: 'EUR' },
  valor_actual_nativo: 400,
  displayCost: { amount: 300, currency: 'EUR' },
  pnl: 100,
  pnl_percent: 33.33,
  precio_medio: 150,
  sparkline: [],
  change_percent_24h: 1,
  daily_change_percent_24h: 1,
  displayDailyPnL: { amount: 4, currency: 'EUR' },
}

describe("UpcomingEvents", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 6, 13, 12))
    vi.mocked(fetchEventosRecurrentes).mockResolvedValue([{
      id: "manual-1",
      activo_id: "asset-1",
      titulo: "Aportación mensual",
      dia_del_mes: 15,
      tipo: "Aportación",
      created_at: "2026-07-01T00:00:00.000Z",
    }])
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      events: [{
        id: "aapl-dividend-2026-07-20",
        ticker: "AAPL",
        date: "2026-07-20",
        type: "DIVIDEND",
        title: "Dividendo",
        certainty: "scheduled",
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("combina eventos automáticos y manuales y permite editar el manual", async () => {
    const onEditEvent = vi.fn()
    renderWithProviders(
      <UpcomingEvents positions={[position]} onAddEvent={vi.fn()} onEditEvent={onEditEvent} />,
    )

    await waitFor(() => expect(screen.getByText("Aportación mensual")).toBeInTheDocument())
    expect(screen.getByText("Dividendo · AAPL")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /aportación mensual/i }))
    expect(onEditEvent).toHaveBeenCalledWith(expect.objectContaining({ id: "manual-1" }))
  })

  it("no consulta la API de mercado cuando no hay posiciones activas", () => {
    renderWithProviders(<UpcomingEvents positions={[]} onAddEvent={vi.fn()} />)

    expect(fetch).not.toHaveBeenCalled()
    expect(fetchEventosRecurrentes).not.toHaveBeenCalled()
    expect(screen.getByText("No hay eventos próximos")).toBeInTheDocument()
  })
})
