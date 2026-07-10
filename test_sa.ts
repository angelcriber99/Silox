import { getFundHoldings } from './lib/actions/market-data';

async function test() {
  const result = await getFundHoldings('IE00B4L5Y983');
  console.log(JSON.stringify(result, null, 2));
}

test();
