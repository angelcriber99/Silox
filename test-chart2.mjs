import YahooFinance from 'yahoo-finance2';
(async () => {
  const yf = new YahooFinance();
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const res = await yf.chart('NVO', { period1: d, interval: '1m', includePrePost: true });
  const meta = res.meta;
  console.log("regularMarketPrice:", meta.regularMarketPrice);
  console.log("previousClose:", meta.previousClose);
  
  if (res.quotes.length > 0) {
    const lastQuote = res.quotes[res.quotes.length - 1];
    console.log("Last quote price:", lastQuote.close, lastQuote.date);
  }
})();
