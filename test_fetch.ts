import { fetchMarketPrices } from './lib/actions/market';
async function run() {
  const res = await fetchMarketPrices(['ASTS', 'ZETA']);
  console.log(JSON.stringify(res, null, 2));
}
run();
