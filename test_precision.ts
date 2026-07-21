import { fetchPosiciones, fetchPortfolioFunding, enrichPositions, computePortfolioTotals } from './lib/api/assets.ts';
import { fetchMarketPrices } from './lib/actions/market.ts';

async function run() {
  const positions = await fetchPosiciones();
  const tickers = positions.filter(p => p.unidades > 0 || p.has_daily_activity).map(p => p.ticker);
  
  const pricePayload = await fetchMarketPrices(tickers, true);
  const enriched = enrichPositions(positions, pricePayload ?? { prices: {} });
  
  const funding = await fetchPortfolioFunding();
  const totals = computePortfolioTotals(enriched, funding);
  
  console.log("totals.totalValue", totals.totalValue);
  console.log("totals.totalCost", totals.totalCost);
  console.log("totals.totalPnl", totals.totalPnl);
  console.log(totals.totalCost + totals.totalPnl, "should equal", totals.totalValue);
}

run();
