import yf from 'yahoo-finance2';
(async () => {
  const chart = await yf.chart('ASTS', { period1: '2023-01-01', interval: '1d' });
  console.log(chart.meta.regularMarketPrice);
})();
