'use server'

import { getYahooFinance } from '@/lib/server/yahoo-finance'

export interface SearchResultItem {
  symbol: string
  shortname: string | null
  longname: string | null
  exchange: string | null
  quoteType: string | null
  industry: string | null
  score: number
}

export async function searchAssets(query: string): Promise<SearchResultItem[]> {
  if (!query || query.trim().length < 1) return []
  
  try {
    const yahoo = getYahooFinance()
    const result = await yahoo.search(query.trim(), {
      quotesCount: 8,
      newsCount: 0,
      enableFuzzyQuery: true,
    })
    
    return result.quotes.map((q: any) => ({
      symbol: q.symbol,
      shortname: q.shortname ?? null,
      longname: q.longname ?? null,
      exchange: q.exchange ?? null,
      quoteType: q.quoteType ?? null,
      industry: q.industry ?? null,
      score: q.score ?? 0,
    }))
  } catch (error) {
    console.error('Error searching assets:', error)
    return []
  }
}
