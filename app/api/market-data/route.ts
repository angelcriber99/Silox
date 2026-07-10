import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// In-memory cache to avoid hitting Yahoo Finance too often
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function POST(request: NextRequest) {
  try {
    const { identifier, isin } = await request.json();

    if (!identifier) {
      return NextResponse.json({ error: 'identifier is required' }, { status: 400 });
    }

    // Check cache first
    const cacheKey = `${identifier}-${isin || ''}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    let tickerToFetch = identifier;

    // If we have an ISIN or a Morningstar-style ID, search for the Yahoo ticker
    const looksLikeISIN = isin && isin.length === 12;
    const looksLikeMorningstarId = /^[A-Z0-9]{10,}$/.test(identifier) && !identifier.includes('.');

    if (looksLikeISIN || looksLikeMorningstarId) {
      const searchTerm = looksLikeISIN ? isin : identifier;
      try {
        const searchRes: any = await yahooFinance.search(searchTerm);
        if (searchRes?.quotes?.length > 0) {
          tickerToFetch = searchRes.quotes[0].symbol;
        }
      } catch (e) {
        console.warn(`Search failed for ${searchTerm}, trying identifier directly`);
      }
    }

    console.log(`[market-data] Fetching Yahoo Finance for: ${tickerToFetch} (original: ${identifier})`);

    // Fetch quote summary - handle validation errors gracefully
    let result: any;
    try {
      result = await yahooFinance.quoteSummary(tickerToFetch, {
        modules: ['topHoldings', 'fundProfile', 'price'],
      });
    } catch (e: any) {
      if (e.name === 'FailedYahooValidationError' && e.result) {
        console.warn(`[market-data] Validation error for ${tickerToFetch}, using partial result`);
        result = e.result;
      } else {
        console.error(`[market-data] quoteSummary failed for ${tickerToFetch}:`, e.message);
        return NextResponse.json(null);
      }
    }

    if (!result) {
      return NextResponse.json(null);
    }

    // Normalize sector weightings (Yahoo returns array of single-key objects)
    const topHoldings = result.topHoldings;
    const fundProfile = result.fundProfile;
    const price = result.price;

    let sectorWeightings: Record<string, number> | null = null;
    if (topHoldings?.sectorWeightings && Array.isArray(topHoldings.sectorWeightings)) {
      sectorWeightings = {};
      for (const sectorObj of topHoldings.sectorWeightings) {
        for (const [key, value] of Object.entries(sectorObj)) {
          if (typeof value === 'number' && value > 0) {
            sectorWeightings[key] = value;
          }
        }
      }
    }

    const holdingsList = topHoldings?.holdings?.map((h: any) => ({
      symbol: h.symbol || '',
      holdingName: h.holdingName || '',
      holdingPercent: h.holdingPercent || 0,
    })) || null;

    const responseData = {
      symbol: tickerToFetch,
      name: price?.longName || price?.shortName || tickerToFetch,
      sectorWeightings,
      topHoldings: holdingsList,
      assetClass: fundProfile?.legalType || null,
    };

    // Store in cache
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('[market-data] Unhandled error:', error.message);
    return NextResponse.json(null);
  }
}
