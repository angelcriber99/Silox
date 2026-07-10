import yahooFinance from 'yahoo-finance2';

async function test() {
  try {
    const searchRes = await yahooFinance.search('IE00B4L5Y983');
    console.log("SEARCH:", searchRes.quotes[0]);
    if (searchRes.quotes.length > 0) {
      const ticker = searchRes.quotes[0].symbol;
      const result = await yahooFinance.quoteSummary(ticker, { modules: ['topHoldings', 'fundProfile', 'defaultKeyStatistics'] });
      console.log("QUOTE SUMMARY:");
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (e) {
    console.error(e);
  }
}
test();
