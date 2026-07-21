import { getYahooFinance } from '../lib/server/yahoo-finance'

async function main() {
  try {
    const yahoo = getYahooFinance()
    const result = await yahoo.historical('BABA', {
      period1: '2024-01-01',
      events: 'dividends'
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e);
  }
}
main();
