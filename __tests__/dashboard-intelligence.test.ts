import { describe, expect, it } from "vitest"

import type { EnrichedPosition } from "@/lib/types"
import { buildDashboardIntelligence } from "@/lib/utils/dashboard-intelligence"

function position(overrides: Partial<EnrichedPosition>): EnrichedPosition {
  return {
    activo_id: "asset",
    ticker: "TEST",
    isin: null,
    nombre: "Test",
    tipo: "Acción",
    estrategia: "Core",
    moneda: "USD",
    sector: "Tecnología",
    geografia: "Estados Unidos",
    unidades: 1,
    coste_total: 80,
    comisiones_total: 0,
    num_operaciones: 1,
    ultima_operacion: null,
    notas: null,
    precio_actual: 100,
    precio_actual_nativo: 100,
    original_currency: "USD",
    displayValue: { amount: 100, currency: 'EUR' },
    valor_actual_nativo: 100,
    displayCost: { amount: 80, currency: 'EUR' },
    pnl: 20,
    pnl_percent: 25,
    precio_medio: 80,
    sparkline: [95, 100],
    change_percent_24h: 1,
    daily_change_percent_24h: 1,
    displayDailyPnL: { amount: 1, currency: 'EUR' },
    market_state: "REGULAR",
    price_is_stale: false,
    ...overrides,
  }
}

describe("buildDashboardIntelligence", () => {
  it("separates cash and summarizes live portfolio signals", () => {
    const result = buildDashboardIntelligence(
      [
        position({ activo_id: "winner", ticker: "WIN", displayValue: { amount: 600, currency: 'EUR' } }),
        position({ activo_id: "loser", ticker: "LOSE", displayValue: { amount: 300, currency: 'EUR' }, daily_change_percent_24h: -2, market_state: "POST", price_is_stale: true }),
        position({ activo_id: "cash", ticker: "CASH", tipo: "Liquidez", moneda: "EUR", original_currency: "EUR", displayValue: { amount: 100, currency: 'EUR' } }),
      ],
      1_000,
    )

    expect(result.cash).toBe(100)
    expect(result.cashPercent).toBe(10)
    expect(result.concentration).toBe(60)
    expect(result.best?.ticker).toBe("WIN")
    expect(result.worst?.ticker).toBe("LOSE")
    expect(result.winners).toBe(1)
    expect(result.losers).toBe(1)
    expect(result.freshPrices).toBe(1)
    expect(result.sessions).toEqual([
      { state: "REGULAR", count: 1 },
      { state: "POST", count: 1 },
    ])
  })
})
