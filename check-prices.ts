import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function test() {
  const tickers = ['NVO', 'UNH.DE', 'CRM', 'GRRR', 'ZETA'];
  for (const ticker of tickers) {
    try {
      const quote = await yahooFinance.quote(ticker);
      console.log(`${ticker}: ${quote.regularMarketPrice} ${quote.currency}`);
    } catch (e) {
      console.log(`${ticker}: Error`);
    }
  }
}

test().catch(console.error);
