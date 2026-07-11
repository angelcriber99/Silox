import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
async function test() {
  const quote = await yahooFinance.quote('ASTS');
  console.log("ASTS Quote prev close:", quote.regularMarketPreviousClose);
}
test();
