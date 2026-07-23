import YahooFinance from 'yahoo-finance2';

async function main() {
  const yahoo = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] });
  try {
    const res = await yahoo.quote('BTC-USD');
    console.log("BTC Quote Success");
  } catch (e: any) {
    console.error("BTC Quote Error:", e.message);
  }
  
  try {
    const res = await yahoo.quoteSummary('BTC-USD', { modules: ['summaryDetail', 'summaryProfile', 'defaultKeyStatistics'] });
    console.log("BTC QuoteSummary Success");
  } catch (e: any) {
    console.error("BTC QuoteSummary Error:", e.message);
  }
}
main();
