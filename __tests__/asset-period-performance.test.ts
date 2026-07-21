import { describe, expect, it } from "vitest"

import { calculateAssetPeriodPerformance } from "@/lib/utils/asset-period-performance"

describe("asset period performance", () => {
  const prices = [
    { date: "2026-07-01T16:00:00.000Z", price: 10 },
    { date: "2026-07-10T16:00:00.000Z", price: 11 },
  ]

  it("does not report an in-period purchase as profit", () => {
    const result = calculateAssetPeriodPerformance(prices, [{
      fecha: "2026-07-05T16:00:00.000Z",
      tipo_operacion: "Compra",
      cantidad: 100,
      precio_unitario: 10.5,
      comision: 0,
    }])
    expect(result?.absolute).toBeCloseTo(50)
    expect(result?.endValue).toBeCloseTo(1_100)
    expect(result?.netFlow).toBeCloseTo(1_050)
  })

  it("keeps a sale as a cash flow instead of treating it as a loss", () => {
    const result = calculateAssetPeriodPerformance(prices, [
      { fecha: "2026-06-01T16:00:00.000Z", tipo_operacion: "Compra", cantidad: 100, precio_unitario: 8 },
      { fecha: "2026-07-05T16:00:00.000Z", tipo_operacion: "Venta", cantidad: 50, precio_unitario: 10.5 },
    ])
    expect(result?.startValue).toBeCloseTo(1_000)
    expect(result?.endValue).toBeCloseTo(550)
    expect(result?.netFlow).toBeCloseTo(-525)
    expect(result?.absolute).toBeCloseTo(75)
  })

  it("adds a dividend to the period result", () => {
    const result = calculateAssetPeriodPerformance(prices, [
      { fecha: "2026-06-01T16:00:00.000Z", tipo_operacion: "Compra", cantidad: 10, precio_unitario: 8 },
      { fecha: "2026-07-05T16:00:00.000Z", tipo_operacion: "Dividendo", cantidad: 1, precio_unitario: 5 },
    ])
    expect(result?.absolute).toBeCloseTo(15)
  })
})
