import yf from 'yahoo-finance2';
(async () => {
  const quote = await yf.quote('ASTS');
  console.log('MarketState:', quote.marketState);
  console.log('RegularPrice:', quote.regularMarketPrice);
  console.log('PrePrice:', quote.preMarketPrice);
  console.log('RegularPreviousClose:', quote.regularMarketPreviousClose);
})();
