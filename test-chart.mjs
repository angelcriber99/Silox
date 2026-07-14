import yf from 'yahoo-finance2';
(async () => {
  const quote = await yf.quote('ASTS');
  console.log('--- QUOTE ---');
  console.log('RegularPrice:', quote.regularMarketPrice);
  console.log('RegularTime:', quote.regularMarketTime);
  console.log('PrePrice:', quote.preMarketPrice);
  console.log('PreTime:', quote.preMarketTime);
  
  const chart = await yf.chart('ASTS', { period1: new Date(Date.now() - 24*3600*1000), interval: '1m', includePrePost: true });
  console.log('--- CHART ---');
  if (chart.quotes.length > 0) {
    console.log('Last Quote:', chart.quotes[chart.quotes.length - 1]);
  }
})();
