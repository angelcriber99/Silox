"use server"

import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });


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

export interface Holding {
  symbol: string;
  holdingName: string;
  holdingPercent: number;
}

export interface FundHoldingsResponse {
  symbol: string;
  name: string;
  sectorWeightings: Record<string, number> | null;
  topHoldings: Holding[] | null;
  assetClass: string | null;
  geographicWeightings?: Record<string, number> | null;
  country?: string | null;
  sector?: string | null;
}
