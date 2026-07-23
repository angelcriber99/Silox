'use server'

import { getYahooFinance } from '@/lib/server/yahoo-finance'

export interface AssetDetails {
  symbol: string
  shortName?: string
  longName?: string
  currency?: string
  exchange?: string
  quoteType?: string
  marketState?: string
  
  // Price Data
  regularMarketPrice?: number
  regularMarketChange?: number
  regularMarketChangePercent?: number
  regularMarketPreviousClose?: number
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
  
  // Summary Data
  marketCap?: number
  trailingPE?: number
  forwardPE?: number
  dividendYield?: number
  beta?: number
  
  // Profile
  sector?: string
  industry?: string
  longBusinessSummary?: string
  website?: string
  country?: string
}

export async function getAssetDetails(ticker: string): Promise<AssetDetails | null> {
  if (!ticker) return null
  
  try {
    const yahoo = getYahooFinance()
    const quote = await yahoo.quoteSummary(ticker, { 
      modules: ['price', 'summaryDetail', 'assetProfile'] 
    })
    
    if (!quote) return null
    
    return {
      symbol: quote.price?.symbol ?? ticker,
      shortName: quote.price?.shortName,
      longName: quote.price?.longName,
      currency: quote.price?.currency,
      exchange: quote.price?.exchangeName,
      quoteType: quote.price?.quoteType,
      marketState: quote.price?.marketState,
      
      regularMarketPrice: quote.price?.regularMarketPrice,
      regularMarketChange: quote.price?.regularMarketChange,
      regularMarketChangePercent: quote.price?.regularMarketChangePercent,
      regularMarketPreviousClose: quote.price?.regularMarketPreviousClose,
      
      fiftyTwoWeekHigh: quote.summaryDetail?.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quote.summaryDetail?.fiftyTwoWeekLow,
      marketCap: quote.summaryDetail?.marketCap,
      trailingPE: quote.summaryDetail?.trailingPE,
      forwardPE: quote.summaryDetail?.forwardPE,
      dividendYield: quote.summaryDetail?.dividendYield,
      beta: quote.summaryDetail?.beta,
      
      sector: quote.assetProfile?.sector,
      industry: quote.assetProfile?.industry,
      longBusinessSummary: quote.assetProfile?.longBusinessSummary,
      website: quote.assetProfile?.website,
      country: quote.assetProfile?.country,
    }
  } catch (error) {
    console.error(`Error fetching asset details for ${ticker}:`, error)
    return null
  }
}
