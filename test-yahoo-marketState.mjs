import YahooFinance from 'yahoo-finance2';
(async () => {
  const yf = new YahooFinance();
  const q1 = await yf.quote('NVO');
  console.log("NVO:", q1.marketState, q1.preMarketPrice);
  const q2 = await yf.quote('VERALLIA.PA');
  console.log("VERALLIA.PA:", q2.marketState, q2.preMarketPrice);
})();
