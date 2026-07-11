import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function checkFund(identifier) {
  let tickerToFetch = identifier;
  if (identifier.length === 12 && !identifier.includes('.')) {
    const searchRes = await yahooFinance.search(identifier);
    if (searchRes.quotes && searchRes.quotes.length > 0) {
      tickerToFetch = searchRes.quotes[0].symbol;
      console.log(`Found ticker ${tickerToFetch} for ISIN ${identifier}`);
    }
  }

  try {
    const result = await yahooFinance.quoteSummary(tickerToFetch, { 
      modules: ['topHoldings', 'fundProfile', 'price', 'assetProfile'] 
    });
    console.log(`\n--- Data for ${identifier} (${tickerToFetch}) ---`);
    console.log("Top Holdings Module exists:", !!result.topHoldings);
    console.log("Sector Weightings:", result.topHoldings?.sectorWeightings ? "Yes" : "No");
    console.log("Asset Profile exists:", !!result.assetProfile);
    console.log("Country:", result.assetProfile?.country);
  } catch (e) {
    if (e.name === 'FailedYahooValidationError' && e.result) {
      const result = e.result;
      console.log(`\n--- Validation Error Data for ${identifier} (${tickerToFetch}) ---`);
      console.log("Sector Weightings:", result.topHoldings?.sectorWeightings ? "Yes" : "No");
    } else {
      console.error(`Error for ${identifier}:`, e.message);
    }
  }
}

async function run() {
  await checkFund('IE00B8G0NQ27'); // Fidelity MSCI World
  await checkFund('IE00B03HCZ61'); // Vanguard S&P 500
  await checkFund('LU0996182563'); // Amundi MSCI World
  await checkFund('IE00B4L5Y983'); // iShares Core MSCI World ETF
}

run();
