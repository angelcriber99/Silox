import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function testCrypto() {
  const identifier = 'BTC-USD';
  let result;
  try {
    result = await yahooFinance.quoteSummary(identifier, {
      modules: ['topHoldings', 'fundProfile', 'price', 'assetProfile', 'summaryProfile'],
    });
  } catch (e) {
    if (e.name === 'FailedYahooValidationError' && e.result) {
      result = e.result;
    }
  }

  const assetProfile = result?.assetProfile || result?.summaryProfile;
  console.log("Crypto Sector:", assetProfile?.sector);
  console.log("Crypto Country:", assetProfile?.country);
  console.log("Crypto Class:", result?.fundProfile?.legalType);
}

testCrypto();
