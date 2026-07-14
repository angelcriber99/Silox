import { fetchMarketPrices } from './lib/actions/market.ts';

async function run() {
  const data = await fetchMarketPrices(['NVO']);
  console.log(JSON.stringify(data.prices, null, 2));
}
run();
