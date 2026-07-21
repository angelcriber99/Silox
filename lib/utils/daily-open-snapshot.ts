/**
 * Utility for persisting the true "start of day" price across page unloads.
 * 
 * Why this is needed:
 * Yahoo Finance's `regularMarketPreviousClose` correctly represents the closing
 * price of the PREVIOUS trading session. However, when the market is CLOSED
 * (e.g. at night or weekends), if we only rely on the live API, any transient
 * API failure would make us lose the reference baseline to calculate "Today's P&L".
 * 
 * By saving a snapshot locally whenever we observe a fresh `exchangeDate`,
 * we guarantee that "Today's P&L" is always calculated against a stable baseline.
 */

const SNAPSHOT_KEY = 'silox_daily_open'

interface DailyOpenSnapshot {
  price: number
  date: string // e.g., "YYYY-MM-DD" or similar identifier representing the trading session
}

export function saveDailyOpenSnapshot(ticker: string, price: number, exchangeDate: string) {
  if (typeof window === 'undefined') return

  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    const stored: Record<string, DailyOpenSnapshot> = raw ? JSON.parse(raw) : {}
    
    // Only update if the date has changed to avoid unnecessary writes
    if (!stored[ticker] || stored[ticker].date !== exchangeDate) {
      stored[ticker] = { price, date: exchangeDate }
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(stored))
    }
  } catch (error) {
    console.error('Failed to save daily open snapshot', error)
  }
}

export function getDailyOpenSnapshot(ticker: string): DailyOpenSnapshot | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return null
    const stored: Record<string, DailyOpenSnapshot> = JSON.parse(raw)
    return stored[ticker] ?? null
  } catch (error) {
    console.error('Failed to read daily open snapshot', error)
    return null
  }
}
