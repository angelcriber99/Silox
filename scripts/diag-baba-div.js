const yf = require('yahoo-finance2');
const yahooFinance = yf.default || yf;

async function main() {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 365);

  const historicalDivs = await yahooFinance.historical('BABA', {
    period1: startDate,
    events: 'dividends'
  });
  
  console.log("Yahoo Finance Dividends:", JSON.stringify(historicalDivs, null, 2));
}
main();
