import YahooFinance from 'yahoo-finance2';
(async () => {
  const yf = new YahooFinance();
  try {
    const q = await yf.quote('NVO', { fetchOptions: { cache: 'no-store' } });
    console.log(q.preMarketPrice);
  } catch (e) {
    console.error(e.message);
  }
})();
