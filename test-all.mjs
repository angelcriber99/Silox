import YahooFinance from 'yahoo-finance2';

async function run() {
  const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  const tickers = ['NVO', 'GRRR', 'ZETA', 'ASTS', 'UNH', 'BABA'];
  for (const t of tickers) {
    try {
      const q = await yf.quote(t);
      console.log(t, q.preMarketPrice, q.regularMarketPrice);
    } catch (e) {
      console.error(t, 'Error');
    }
  }
}
run();
