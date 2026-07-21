import YahooFinance from 'yahoo-finance2';
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
async function run() {
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    try {
      const res = await yf.chart("0P0001CJGV.F", { interval: "1m", period1: new Date(Date.now() - 86400000), includePrePost: true });
      console.log("OK", Date.now() - start);
    } catch(e) {
      console.log("ERR", Date.now() - start, e.message);
    }
  }
}
run();
