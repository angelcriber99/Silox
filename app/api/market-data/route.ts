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
        modules: ['topHoldings', 'fundProfile', 'price', 'assetProfile', 'summaryProfile'],
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
    const assetProfile = result.assetProfile || result.summaryProfile;

    let sectorWeightings: Record<string, number> | null = null;
    if (topHoldings?.sectorWeightings && Array.isArray(topHoldings.sectorWeightings)) {
      // It's a fund
      sectorWeightings = {};
      for (const sectorObj of topHoldings.sectorWeightings) {
        for (const [key, value] of Object.entries(sectorObj)) {
          if (typeof value === 'number' && value > 0) {
            sectorWeightings[key] = value;
          }
        }
      }
    } else if (assetProfile?.sector) {
      // It's a single stock
      sectorWeightings = {};
      const sectorKey = assetProfile.sector.toLowerCase().replace(/ /g, '_');
      sectorWeightings[sectorKey] = 1.0; // 100% of this stock is in its own sector
    }

    let geographicWeightings: Record<string, number> | null = null;

    // --- FALLBACK LOGIC FOR INDEX FUNDS ---
    // If we couldn't get sector or country data, check if it's a known index fund by name or ticker
    const identLower = (identifier || tickerToFetch).toLowerCase();
    
    // MSCI World Fallback
    if (identLower.includes('msci world') || identLower.includes('msci-world') || identLower.includes('msci') && identLower.includes('world')) {
      if (!sectorWeightings || Object.keys(sectorWeightings).length === 0) {
        sectorWeightings = {
          technology: 0.24,
          financial_services: 0.15,
          healthcare: 0.12,
          industrials: 0.11,
          consumer_cyclical: 0.11,
          communication_services: 0.07,
          consumer_defensive: 0.06,
          energy: 0.04,
          basic_materials: 0.04,
          utilities: 0.03,
          realestate: 0.02
        };
      }
      geographicWeightings = {
        'USA': 0.70,
        'Japan': 0.06,
        'United Kingdom': 0.04,
        'France': 0.03,
        'Canada': 0.03,
        'Switzerland': 0.02,
        'Germany': 0.02,
        'Otros': 0.10
      };
    } 
    // S&P 500 Fallback
    else if (identLower.includes('s&p 500') || identLower.includes('sp500') || identLower.includes('s&p500') || identLower.includes('s&p')) {
      if (!sectorWeightings || Object.keys(sectorWeightings).length === 0) {
        sectorWeightings = {
          technology: 0.30,
          financial_services: 0.13,
          healthcare: 0.13,
          consumer_cyclical: 0.10,
          communication_services: 0.09,
          industrials: 0.09,
          consumer_defensive: 0.06,
          energy: 0.04,
          utilities: 0.02,
          realestate: 0.02,
          basic_materials: 0.02
        };
      }
      geographicWeightings = {
        'USA': 1.0
      };
    }

    let holdingsList: any[] = [];
    if (topHoldings?.holdings && Array.isArray(topHoldings.holdings)) {
      holdingsList = topHoldings.holdings;
    }

    const responseData = {
      symbol: tickerToFetch,
      name: price?.longName || price?.shortName || tickerToFetch,
      sectorWeightings,
      topHoldings: holdingsList,
      assetClass: fundProfile?.legalType || null,
      country: assetProfile?.country || null,
      sector: assetProfile?.sector || null,
      geographicWeightings
    };

    // Store in cache
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('[market-data] API error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
