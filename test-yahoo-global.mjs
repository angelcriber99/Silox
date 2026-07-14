import yahooFinance from 'yahoo-finance2';
yahooFinance.setGlobalConfig({ fetchOptions: { cache: 'no-store' } });
(async () => {
  const q = await yahooFinance.quote('NVO');
  console.log(q.preMarketPrice);
})();
