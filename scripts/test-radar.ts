import { getYahooFinance } from '../lib/server/yahoo-finance'

async function main() {
  const yahoo = getYahooFinance()
  const result = await yahoo.search("0P0001CJGV", { newsCount: 5 })
  for (const n of result.news || []) {
    console.log("-", n.title)
    console.log("  Tickers:", n.relatedTickers)
  }
}
main()
