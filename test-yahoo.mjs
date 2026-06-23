import yahooFinance from 'yahoo-finance2';

async function test() {
  try {
    const res = await yahooFinance.chart('AMD.DE', { range: '1mo', interval: '1d' });
    console.log(Object.keys(res));
    console.log(Array.isArray(res.quotes) ? 'quotes is array' : typeof res.quotes);
  } catch (err) {
    console.error(err);
  }
}
test();
