import YahooFinance from 'yahoo-finance2';
(async () => {
  const yf = new YahooFinance();
  const res = await yf.chart('NVO', { interval: '1m', includePrePost: true, range: '1d' });
  const meta = res.meta;
  console.log("regularMarketPrice:", meta.regularMarketPrice);
  console.log("chartPreviousClose:", meta.chartPreviousClose);
  console.log("previousClose:", meta.previousClose);
  
  if (res.quotes.length > 0) {
    const lastQuote = res.quotes[res.quotes.length - 1];
    console.log("Last quote price:", lastQuote.close, lastQuote.date);
  }
})();
