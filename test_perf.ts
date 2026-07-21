import YahooFinance from 'yahoo-finance2';
import { extractMarketPerformance } from './lib/utils/market-performance';

async function run() {
  const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  const d = new Date(); d.setDate(d.getDate() - 7);
  const chart1m = await yf.chart("0P0001CJGV.F", { interval: "1m", period1: new Date(Date.now() - 86400000), includePrePost: true }).catch(()=>null);
  const chart1d = await yf.chart("0P0001CJGV.F", { interval: "1d", period1: d }).catch(()=>null);
  
  const meta = chart1m?.meta;
  const quotes1m = chart1m?.quotes || [];
  const quotes1d = chart1d?.quotes || [];
  
  if (meta) {
      const perf = extractMarketPerformance(meta as any, quotes1m as any, quotes1d as any);
      console.log(JSON.stringify(perf, null, 2));
  } else {
      console.log("No meta");
  }
}
run();
