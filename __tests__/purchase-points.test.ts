import { describe, expect, it } from "vitest"

import { calculatePurchasePoints } from "@/lib/utils/purchase-points"

describe("calculatePurchasePoints", () => {
  it("detecta soportes por debajo del precio actual y devuelve niveles USD ordenados", () => {
    const prices = [100, 98, 94, 90, 94, 99, 103, 99, 95, 90.5, 96, 102, 108, 103, 97, 90.2, 98, 106, 112]
    const chart = prices.map((price, index) => ({
      date: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      price,
    }))

    const points = calculatePurchasePoints(chart, 112, 3)

    expect(points).toHaveLength(3)
    expect(points.every((point) => point.price < 112 && point.price > 0)).toBe(true)
    expect(points[0].price).toBeGreaterThan(points[1].price)
    expect(points.some((point) => Math.abs(point.price - 90.2) < 1)).toBe(true)
  })

  it("rechaza series insuficientes o precios inválidos", () => {
    expect(calculatePurchasePoints([], 100)).toEqual([])
    expect(calculatePurchasePoints(Array.from({ length: 10 }, (_, index) => ({ date: `${index}`, price: 10 })), 0)).toEqual([])
  })
})
