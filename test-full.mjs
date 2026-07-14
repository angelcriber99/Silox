import { _fetchMarketPrices } from './lib/actions/market.ts';

async function run() {
  const data = await _fetchMarketPrices(['NVO'], true);
  console.log(JSON.stringify(data.prices['NVO'], null, 2));
}
run();
