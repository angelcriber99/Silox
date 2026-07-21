import yahooFinance from 'yahoo-finance2';

async function main() {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 150);

  const historicalDivs = await yahooFinance.historical('BABA', {
    period1: startDate,
    events: 'dividends'
  });
  
  console.log("Yahoo Finance Dividends:", JSON.stringify(historicalDivs, null, 2));
}
main();
