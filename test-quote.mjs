import YahooFinance from 'yahoo-finance2';

async function run() {
  const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  try {
    const q = await yf.quote('ASTS');
    console.log('quote preMarketPrice:', q.preMarketPrice);
    console.log('quote preMarketChangePercent:', q.preMarketChangePercent);
  } catch (e) {
    console.error(e);
  }
}
run();
