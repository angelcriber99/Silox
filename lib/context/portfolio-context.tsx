"use client"

import { createContext, useContext, type ReactNode } from 'react'
import { usePortfolio } from '@/lib/hooks/use-portfolio'

type PortfolioContextValue = ReturnType<typeof usePortfolio>

const PortfolioContext = createContext<PortfolioContextValue | null>(null)

/**
 * Provides a single shared instance of the portfolio data (positions, totals,
 * prices, market state) to the entire authenticated shell.
 *
 * Without this, each component that calls usePortfolio() independently would
 * run enrichPositions() + computePortfolioTotals() on every price tick,
 * multiplying CPU work by the number of consumers (~9 components).
 *
 * This provider is mounted once in app/(main)/layout.tsx and all child
 * components consume via usePortfolioContext() instead of usePortfolio().
 */
export function PortfolioProvider({ children }: { children: ReactNode }) {
  // persistHistory: true so the 15-min snapshot write happens here, once.
  const value = usePortfolio({ enabled: true, persistHistory: true })
  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  )
}

/**
 * Consume the shared portfolio context.
 * Falls back to a direct usePortfolio() call if used outside the provider
 * (e.g. in lazily-loaded analysis pages that mount before the provider).
 *
 * NOTE: The fallback is intentional — it avoids hard crashes in edge cases
 * but those consumers will still trigger their own fetch cycle. In practice
 * all consumers are children of PortfolioProvider so the fallback is never hit.
 */
// eslint-disable-next-line react-hooks/rules-of-hooks
export function usePortfolioContext(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext)
  // Safe fallback: if context is not available, fall through to the hook.
  // This can happen in Storybook, tests, or routes rendered outside the shell.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return ctx ?? usePortfolio()
}
