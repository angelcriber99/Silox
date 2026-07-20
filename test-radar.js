import { fetchMarketPrices } from './lib/actions/market'

async function test() {
  const result = await fetchMarketPrices(['ASTS'], false)
  console.log(result.prices['ASTS'].dailyChangePercent24h)
}
test().catch(console.error)
