"use client"

import { useCallback } from "react"

import { usePortfolioContext } from "@/lib/context/portfolio-context"
import { usePreferences } from "@/lib/stores/use-preferences"
import { convertCurrency } from "@/lib/utils/currency"
import { formatCurrency } from "@/lib/utils/formatters"

export function useDisplayCurrency() {
  const displayCurrency = usePreferences((state) => state.displayCurrency)
  const { fxRates } = usePortfolioContext()

  const convert = useCallback((amount: number, fromCurrency = "EUR") => {
    return convertCurrency(amount, fromCurrency, displayCurrency, fxRates) ?? amount
  }, [displayCurrency, fxRates])

  const format = useCallback((amount: number, fromCurrency = "EUR", decimals = 2) => {
    const converted = convertCurrency(amount, fromCurrency, displayCurrency, fxRates)
    if (converted === null) return formatCurrency(amount, fromCurrency, decimals)
    return formatCurrency(converted, displayCurrency, decimals)
  }, [displayCurrency, fxRates])

  return {
    displayCurrency,
    fxRates,
    convert,
    format,
  }
}
