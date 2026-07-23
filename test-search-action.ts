import { searchAssets } from './lib/actions/search.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const data = await searchAssets('Bitcoin');
  console.log("Search result length:", data.length);
  data.forEach((item, index) => {
    console.log(`[${index}] symbol: ${item.symbol}, type: ${typeof item.symbol}`);
    if (!item.symbol) console.log("UNDEFINED SYMBOL FOUND:", item);
  });
}
main();
