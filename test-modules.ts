import yahooFinance from 'yahoo-finance2';

async function main() {
  try {
    const res = await yahooFinance.quoteSummary('AAPL', {
      modules: ['price', 'summaryDetail', 'summaryProfile', 'defaultKeyStatistics']
    });
    console.log("AAPL Success:", !!res);
  } catch (e: any) {
    console.error("AAPL Error:", e.message);
  }

  try {
    const res = await yahooFinance.quoteSummary('BTC-USD', {
      modules: ['price', 'summaryDetail', 'summaryProfile', 'defaultKeyStatistics']
    });
    console.log("BTC Success:", !!res);
  } catch (e: any) {
    console.error("BTC Error:", e.message);
  }
}

main();
