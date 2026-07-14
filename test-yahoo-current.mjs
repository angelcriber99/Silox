import YahooFinance from 'yahoo-finance2';
(async () => {
  const yf = new YahooFinance();
  const q = await yf.quote('NVO');
  console.log("marketState:", q.marketState);
  console.log("preMarketPrice:", q.preMarketPrice);
  console.log("regularMarketPrice:", q.regularMarketPrice);
})();
