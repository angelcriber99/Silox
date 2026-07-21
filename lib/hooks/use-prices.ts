"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchPrices } from '@/lib/api/market'
import { useRef, useEffect } from 'react'
import type { PriceData } from '@/lib/types'
import { usePreferences } from '@/lib/stores/use-preferences'

export function usePrices(tickers: string[], options?: { enabled?: boolean }) {
  const lastKnownPrices = useRef<Record<string, PriceData>>({})
  const { refreshInterval, pauseUpdatesWhenHidden } = usePreferences()

  // Cargar de localStorage al inicio
  useEffect(() => {
    try {
      const saved = localStorage.getItem('silox_last_prices')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Discard prices saved more than 20 hours ago to prevent stale
        // dailyChangePercent from a previous trading day bleeding into today.
        const MAX_AGE_MS = 20 * 60 * 60 * 1000
        if (parsed.savedAt && Date.now() - parsed.savedAt < MAX_AGE_MS) {
          lastKnownPrices.current = parsed.prices ?? parsed
        }
      }
    } catch (e) {
      console.error('Error loading prices from local storage', e)
    }
  }, [])

  return useQuery({
    queryKey: ["prices", tickers.slice().sort().join(",")],
    queryFn: async () => {
      const data = await fetchPrices(tickers)
      
      // Merge with last known good prices for any failed fetches (price === null)
      const mergedPrices = { ...data.prices }
      let hasUpdates = false

      for (const ticker of tickers) {
        if (mergedPrices[ticker]?.price === null && lastKnownPrices.current[ticker]?.price != null) {
          mergedPrices[ticker] = {
            ...mergedPrices[ticker],
            price: lastKnownPrices.current[ticker].price,
            originalPrice: lastKnownPrices.current[ticker].originalPrice,
            originalCurrency: lastKnownPrices.current[ticker].originalCurrency,
            sparkline: lastKnownPrices.current[ticker].sparkline,
            isStale: true,
          }
        } else if (mergedPrices[ticker]?.price != null) {
          // Update last known good price
          lastKnownPrices.current[ticker] = mergedPrices[ticker]
          hasUpdates = true
        }
      }
      
      // Guardar en localStorage para sobrevivir F5
      if (hasUpdates) {
        try {
          localStorage.setItem('silox_last_prices', JSON.stringify({
            savedAt: Date.now(),
            prices: lastKnownPrices.current,
          }))
        } catch {
          // ignore quota errors
        }
      }
      
      return { ...data, prices: mergedPrices }
    },
    enabled: tickers.length > 0 && (options?.enabled ?? true),
    staleTime: Math.min(refreshInterval, 10_000),
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: !pauseUpdatesWhenHidden,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  })
}
