"use server"

import yahooFinance from 'yahoo-finance2';
import { unstable_cache } from 'next/cache';

// Tipos extraídos de la doc de yahoo-finance2
export interface SectorWeightings {
  realestate?: number;
  consumer_cyclical?: number;
  basic_materials?: number;
  consumer_defensive?: number;
  technology?: number;
  communication_services?: number;
  financial_services?: number;
  utilities?: number;
  industrials?: number;
  energy?: number;
  healthcare?: number;
}

export interface FundHoldingsResponse {
  symbol: string;
  name: string;
  sectorWeightings: SectorWeightings | null;
  topHoldings: Array<{ symbol: string; holdingName: string; holdingPercent: number }> | null;
  assetClass: string | null;
}

// Caching the API call to Yahoo Finance so we don't spam them and get rate limited
export const getFundHoldings = unstable_cache(
  async (identifier: string, isin?: string | null): Promise<FundHoldingsResponse | null> => {
    try {
      // @ts-ignore: suppressNotices might not be in the type definitions depending on the version
      yahooFinance.suppressNotices(['yahooFinanceIsAModule']);
      let tickerToFetch = identifier;

      // 1. Si tenemos un ISIN pero el identificador no parece un ticker válido,
      // intentamos buscar el Ticker a partir del ISIN
      if (isin && isin.length === 12) {
        const searchRes: any = await yahooFinance.search(isin);
        if (searchRes.quotes && searchRes.quotes.length > 0) {
          tickerToFetch = searchRes.quotes[0].symbol;
        }
      } else {
        // En caso de que identifier sea el ISIN
        if (identifier.length === 12 && !identifier.includes('.')) {
          const searchRes: any = await yahooFinance.search(identifier);
          if (searchRes.quotes && searchRes.quotes.length > 0) {
            tickerToFetch = searchRes.quotes[0].symbol;
          }
        }
      }

      console.log(`Fetching Yahoo Finance data for Ticker: ${tickerToFetch}`);

      // 2. Fetch the topHoldings and fundProfile
      const result: any = await yahooFinance.quoteSummary(tickerToFetch, { 
        modules: ['topHoldings', 'fundProfile', 'price'] 
      });

      if (!result) return null;

      // Parse and normalize the result
      const topHoldings = result.topHoldings;
      const fundProfile = result.fundProfile;
      const price = result.price;

      // sectorWeightings is an array of objects in Yahoo Finance: [{ realestate: 0.05 }, { technology: 0.20 }]
      let normalizedSectors: SectorWeightings | null = null;
      if (topHoldings?.sectorWeightings && Array.isArray(topHoldings.sectorWeightings)) {
        normalizedSectors = {};
        topHoldings.sectorWeightings.forEach((sectorObj: any) => {
          for (const [key, value] of Object.entries(sectorObj)) {
            // value is a fraction (e.g. 0.2312 for 23.12%)
            (normalizedSectors as any)[key] = Number(value);
          }
        });
      }

      const holdingsList = topHoldings?.holdings?.map((h: any) => ({
        symbol: h.symbol,
        holdingName: h.holdingName,
        holdingPercent: h.holdingPercent
      })) || null;

      return {
        symbol: tickerToFetch,
        name: price?.longName || price?.shortName || tickerToFetch,
        sectorWeightings: normalizedSectors,
        topHoldings: holdingsList,
        assetClass: fundProfile?.legalType || null
      };

    } catch (error) {
      console.error(`Error fetching holdings for ${identifier}:`, error);
      return null;
    }
  },
  ['yahoo-finance-holdings'],
  {
    revalidate: 604800, // Cache for 7 days (60 * 60 * 24 * 7) since ETF composition rarely changes fast
    tags: ['market-data']
  }
);
