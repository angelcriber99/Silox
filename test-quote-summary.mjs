import YahooFinance from 'yahoo-finance2';
(async () => {
  const yf = new YahooFinance();
  const res = await yf.quoteSummary('NVO', { modules: ['price'] });
  console.log(res.price);
})();
