'use server'

import { getYahooFinance } from '@/lib/server/yahoo-finance'

export async function getAssetHistory(ticker: string, range: '1d' | '5d' | '1mo' | 'ytd' | '1y' | '5y' | 'max') {
  if (!ticker) return []
  
  try {
    const yahoo = getYahooFinance()
    
    // Map ranges to intervals and start times
    const now = new Date()
    let period1: string | Date = new Date(0)
    let interval: '1d' | '1wk' | '1mo' | '1m' | '5m' | '15m' | '30m' | '90m' | '1h' = '1d'
    
    switch (range) {
      case '1d':
        period1 = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        interval = '5m'
        break
      case '5d':
      case '1wk':
        period1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        interval = '15m'
        break
      case '1mo':
        period1 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        interval = '1d'
        break
      case 'ytd':
        period1 = new Date(now.getFullYear(), 0, 1)
        interval = '1d'
        break
      case '1y':
        period1 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        interval = '1d'
        break
      case '5y':
        period1 = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000)
        interval = '1wk'
        break
      case 'max':
        period1 = new Date('1970-01-01')
        interval = '1mo'
        break
    }

    const result = await yahoo.historical(ticker, {
      period1,
      period2: now,
      interval,
    })
    
    return result.map(p => ({
      date: p.date.toISOString(),
      close: p.close,
      open: p.open,
      high: p.high,
      low: p.low,
      volume: p.volume
    }))
  } catch (error) {
    console.error(`Error fetching history for ${ticker}:`, error)
    return []
  }
}
