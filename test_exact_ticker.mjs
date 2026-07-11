import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function run() {
  const ticker = '0P0001CJGV'; // NO .F
  try {
    const result = await yahooFinance.quoteSummary(ticker, {
      modules: ['topHoldings', 'fundProfile', 'price', 'assetProfile', 'summaryProfile']
    });
    console.log("Success with no validation error!");
    console.log("Has sectorWeightings?", !!result.topHoldings?.sectorWeightings);
  } catch (e) {
    if (e.name === 'FailedYahooValidationError' && e.result) {
      console.log("Validation error, but got result!");
      console.log("Has sectorWeightings?", !!e.result.topHoldings?.sectorWeightings);
    } else {
      console.error("Failed completely:", e.message);
    }
  }
}

run();
