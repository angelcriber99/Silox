import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function test() {
  try {
    const res = await yahooFinance.search('0P0001CJGV');
    console.log("Search 0P0001CJGV:", JSON.stringify(res.quotes, null, 2));
    
    if (res.quotes && res.quotes.length > 0) {
      const ticker = res.quotes[0].symbol;
      const quote = await yahooFinance.quoteSummary(ticker, { modules: ['topHoldings', 'fundProfile', 'assetProfile'] });
      console.log("QuoteSummary:", JSON.stringify(quote, null, 2));
    }
  } catch (e) {
    console.error(e);
  }
}
test();
