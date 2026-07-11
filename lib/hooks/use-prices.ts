"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchPrices } from '@/lib/api/market'
import { useRef, useEffect } from 'react'
import type { PriceData } from '@/lib/types'

export function usePrices(tickers: string[], options?: { enabled?: boolean }) {
  const lastKnownPrices = useRef<Record<string, PriceData>>({})

  // Cargar de localStorage al inicio
  useEffect(() => {
    try {
      const saved = localStorage.getItem('silox_last_prices')
      if (saved) {
        lastKnownPrices.current = JSON.parse(saved)
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
            ...lastKnownPrices.current[ticker],
            // keep the current market state or anything else if needed, but restore price
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
          localStorage.setItem('silox_last_prices', JSON.stringify(lastKnownPrices.current))
        } catch (e) {
          // ignore quota errors
        }
      }
      
      return { ...data, prices: mergedPrices }
    },
    enabled: tickers.length > 0 && (options?.enabled ?? true),
    staleTime: 15_000,
    refetchInterval: 15_000, // Auto-refresh every 15 seconds
  })
}
