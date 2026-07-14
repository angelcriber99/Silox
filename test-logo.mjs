import YahooFinance from 'yahoo-finance2';

async function run() {
  const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  try {
    const quote = await yf.quoteSummary('AAPL', { modules: ['summaryProfile'] });
    console.log(quote.summaryProfile?.website);
  } catch (e) {
    console.error(e);
  }
}
run();
