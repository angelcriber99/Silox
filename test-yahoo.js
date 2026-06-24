const yahooFinance = require('yahoo-finance2').default;

async function run() {
  try {
    const results = await yahooFinance.search('IE00BYX5P602');
    console.log("Search results for ISIN:");
    console.log(JSON.stringify(results.quotes, null, 2));

    const symbolResults = await yahooFinance.search('MSCI');
    console.log("Search results for MSCI:");
    console.log(JSON.stringify(symbolResults.quotes.slice(0, 3), null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
