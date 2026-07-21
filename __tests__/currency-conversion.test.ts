import { describe, expect, it } from "vitest"

import { convertCurrency } from "@/lib/utils/currency"

describe("convertCurrency", () => {
  const rates = { EUR: 1, USD: 1.17, GBP: 0.86 }

  it("keeps amounts unchanged when source and target match", () => {
    expect(convertCurrency(63.91, "USD", "USD", rates)).toBe(63.91)
  })

  it("converts EUR portfolio values to USD", () => {
    expect(convertCurrency(100, "EUR", "USD", rates)).toBeCloseTo(117, 8)
  })

  it("converts USD asset results to EUR", () => {
    expect(convertCurrency(117, "USD", "EUR", rates)).toBeCloseTo(100, 8)
  })

  it("converts cross currency values through EUR", () => {
    expect(convertCurrency(86, "GBP", "USD", rates)).toBeCloseTo(117, 8)
  })

  it("does not invent a conversion when a rate is unavailable", () => {
    expect(convertCurrency(100, "CHF", "USD", rates)).toBeNull()
  })
})
