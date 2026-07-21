import { fetchPrices } from './lib/actions/market';

async function main() {
  const res = await fetchPrices(['ASTS', 'GRRR', 'UNH', 'BABA', 'ADUR']);
  console.log(JSON.stringify(res, null, 2));
}
main();
