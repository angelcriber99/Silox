import YahooFinance from 'yahoo-finance2';

async function run() {
  const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  try {
    const qs = await yf.quoteSummary('ASTS', { modules: ['price'] });
    console.log('quoteSummary price module:', JSON.stringify(qs.price, null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
