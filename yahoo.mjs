import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function main() {
  try {
    const period1 = new Date('2024-06-17');
    const period2 = new Date('2024-06-27');
    const chart = await yahooFinance.chart('EURUSD=X', {
      period1,
      period2,
      interval: '1d',
    });
    console.log(chart.quotes.map(q => ({ date: q.date.toISOString(), close: q.close })));
  } catch (e) {
    console.error(e);
  }
}
main();
