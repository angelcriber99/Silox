import YahooFinance from 'yahoo-finance2';

async function run() {
  try {
    const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
    const q = await yf.quote('MSCI');
    console.log(JSON.stringify({
      preMarketPrice: q.preMarketPrice,
      preMarketChangePercent: q.preMarketChangePercent,
      regularMarketPrice: q.regularMarketPrice,
      regularMarketPreviousClose: q.regularMarketPreviousClose,
      postMarketPrice: q.postMarketPrice,
      marketState: q.marketState
    }, null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
