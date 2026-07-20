const yahooFinance = require('yahoo-finance2').default;
async function main() {
  const query = "0P0001CJGV";
  const result = await yahooFinance.search(query, { newsCount: 5 });
  console.log("Search for:", query);
  for (const item of result.news || []) {
    console.log("- Title:", item.title);
    console.log("  Tickers:", item.relatedTickers);
  }
}
main().catch(console.error);
