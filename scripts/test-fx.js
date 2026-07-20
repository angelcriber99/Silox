const yahooFinance = require('yahoo-finance2').default;
async function test() {
  const usdEur = await yahooFinance.quote('USDEUR=X');
  const eurUsd = await yahooFinance.quote('EURUSD=X');
  console.log('USDEUR:', usdEur.regularMarketPrice);
  console.log('EURUSD:', eurUsd.regularMarketPrice);
}
test();
