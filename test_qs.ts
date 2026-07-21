import YahooFinance from 'yahoo-finance2';
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
async function run() {
  const start = Date.now();
  try {
    const res = await yf.quoteSummary("0P0001CJGV.F", { modules: ['price', 'summaryDetail', 'assetProfile'] });
    console.log("OK QS", Date.now() - start);
  } catch(e) {
    console.log("ERR QS", Date.now() - start, e.message);
  }
}
run();
