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
    const quote = await yahoo.quoteSummary(ticker, { 
      modules: ['price', 'summaryDetail', 'summaryProfile', 'defaultKeyStatistics'] 
    })
    
    if (!quote) return null
    
    return {
      symbol: quote.price?.symbol ?? ticker,
      shortName: quote.price?.shortName ?? null,
      longName: quote.price?.longName ?? null,
      currency: quote.price?.currency ?? null,
      exchange: quote.price?.exchangeName ?? null,
      quoteType: quote.price?.quoteType ?? null,
      
      regularMarketPrice: quote.price?.regularMarketPrice ?? null,
      regularMarketChange: quote.price?.regularMarketChange ?? null,
      regularMarketChangePercent: quote.price?.regularMarketChangePercent ?? null,
      regularMarketPreviousClose: quote.summaryDetail?.previousClose ?? null,
      
      fiftyTwoWeekHigh: quote.summaryDetail?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: quote.summaryDetail?.fiftyTwoWeekLow ?? null,
      marketCap: quote.price?.marketCap ?? null,
      trailingPE: quote.summaryDetail?.trailingPE ?? null,
      dividendYield: quote.summaryDetail?.dividendYield ?? null,
      beta: quote.summaryDetail?.beta ?? quote.defaultKeyStatistics?.beta ?? null,
      
      longBusinessSummary: quote.summaryProfile?.longBusinessSummary ?? null,
      sector: quote.summaryProfile?.sector ?? null,
      industry: quote.summaryProfile?.industry ?? null,
      website: quote.summaryProfile?.website ?? null,
      country: quote.summaryProfile?.country ?? null,
    }
  } catch (error) {
    console.error(`Error fetching asset details for ${ticker}:`, error)
    return null
  }
}
