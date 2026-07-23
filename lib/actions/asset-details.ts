'use server'

import { getYahooFinance } from '@/lib/server/yahoo-finance'

export interface AssetDetails {
  symbol: string
  shortName?: string | null
  longName?: string | null
  currency?: string | null
  exchange?: string | null
  quoteType?: string | null
  regularMarketPrice?: number | null
  regularMarketChange?: number | null
  regularMarketChangePercent?: number | null
  regularMarketPreviousClose?: number | null
  fiftyTwoWeekHigh?: number | null
  fiftyTwoWeekLow?: number | null
  marketCap?: number | null
  trailingPE?: number | null
  dividendYield?: number | null
  beta?: number | null
  longBusinessSummary?: string | null
  sector?: string | null
  industry?: string | null
  website?: string | null
  country?: string | null
}

export async function getAssetDetails(ticker: string): Promise<AssetDetails | null> {
  if (!ticker) return null
  
  try {
    const yahoo = getYahooFinance()
    
    // First try to get the basic quote. If this fails, the asset really doesn't exist.
    const quote = await yahoo.quote(ticker)
    
    // Then try to get additional details, which might fail for certain assets (like crypto or some ETFs)
    let summary: any = {}
    try {
      summary = await yahoo.quoteSummary(ticker, { 
        modules: ['summaryDetail', 'summaryProfile', 'defaultKeyStatistics'] 
      })
    } catch (e) {
      console.warn(`Could not fetch full summary for ${ticker}, using basic quote data instead.`)
    }
    
    return {
      symbol: quote.symbol ?? ticker,
      shortName: quote.shortName ?? null,
      longName: quote.longName ?? null,
      currency: quote.currency ?? null,
      exchange: quote.exchange ?? null,
      quoteType: quote.quoteType ?? null,
      
      regularMarketPrice: quote.regularMarketPrice ?? null,
      regularMarketChange: quote.regularMarketChange ?? null,
      regularMarketChangePercent: quote.regularMarketChangePercent ?? null,
      regularMarketPreviousClose: quote.regularMarketPreviousClose ?? summary.summaryDetail?.previousClose ?? null,
      
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? summary.summaryDetail?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? summary.summaryDetail?.fiftyTwoWeekLow ?? null,
      marketCap: quote.marketCap ?? null,
      trailingPE: quote.trailingPE ?? summary.summaryDetail?.trailingPE ?? null,
      dividendYield: summary.summaryDetail?.dividendYield ?? null,
      beta: summary.summaryDetail?.beta ?? summary.defaultKeyStatistics?.beta ?? null,
      
      longBusinessSummary: summary.summaryProfile?.longBusinessSummary ?? null,
      sector: summary.summaryProfile?.sector ?? null,
      industry: summary.summaryProfile?.industry ?? null,
      website: summary.summaryProfile?.website ?? null,
      country: summary.summaryProfile?.country ?? null,
    }
  } catch (error) {
    console.error(`Error fetching asset details for ${ticker}:`, error)
    return null
  }
}
