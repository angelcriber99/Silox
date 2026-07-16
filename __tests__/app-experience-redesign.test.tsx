import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AlertsWorkspace } from "@/components/alerts/alerts-workspace"
import { allNavigation } from "@/components/layout/navigation"
import { renderWithProviders } from "@/__tests__/test-utils"

const removeAlert = vi.fn()

vi.mock("@/lib/hooks/use-alerts", () => ({
  useAlerts: () => ({
    alerts: [
      { id: "active", user_id: "user", ticker: "MSFT", target_price: 500, condition: "above", triggered: false, created_at: "2026-07-16" },
      { id: "done", user_id: "user", ticker: "NVDA", target_price: 120, condition: "below", triggered: true, created_at: "2026-07-15" },
    ],
    isLoading: false,
    addAlert: vi.fn(),
    removeAlert,
  }),
}))

describe("Arquitectura de experiencia", () => {
  it("expone cada destino principal una sola vez", () => {
    const routes = allNavigation.map((item) => item.href)
    expect(new Set(routes).size).toBe(routes.length)
    expect(routes).toEqual(expect.arrayContaining(["/", "/movimientos", "/analisis", "/historial", "/declarar", "/alertas", "/perfil", "/settings"]))
  })

  it("permite alternar entre alertas activas y cumplidas", () => {
    renderWithProviders(<AlertsWorkspace positions={[]} compact />)

    expect(screen.getByText("MSFT")).toBeInTheDocument()
    expect(screen.queryByText("NVDA")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Cumplidas" }))
    expect(screen.getByText("NVDA")).toBeInTheDocument()
    expect(screen.queryByText("MSFT")).not.toBeInTheDocument()
  })
})
