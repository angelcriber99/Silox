import YahooFinance from 'yahoo-finance2';
(async () => {
  const yf = new YahooFinance();
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const res = await yf.chart('NVO', { period1: d, interval: '1m', includePrePost: true });
  console.log(Object.keys(res.meta));
})();
