import yahooFinance from 'yahoo-finance2';

async function main() {
  const res = await yahooFinance.search('AAPL');
  console.log(res.news.slice(0, 2));
}
main();
