import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function test() {
  try {
    let result;
    try {
      result = await yahooFinance.quoteSummary('0P0001CJGV.F', { modules: ['topHoldings'] });
    } catch (e) {
      if (e.name === 'FailedYahooValidationError' && e.result) {
        result = e.result;
      }
    }
    console.log("sectorWeightings:", JSON.stringify(result.topHoldings.sectorWeightings, null, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
