import YahooFinance from 'yahoo-finance2';
import { extractMarketPerformance } from './lib/utils/market-performance';

async function run() {
  const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  const chart1m = await yf.chart("0P0001CJGV.F", { interval: "1m", period1: new Date(Date.now() - 86400000), includePrePost: true }).catch(()=>null);
  
  const d = new Date(); d.setDate(d.getDate() - 7);
  const chart1d = await yf.chart("0P0001CJGV.F", { interval: "1d", period1: d }).catch(()=>null);
  
  let perf = extractMarketPerformance(chart1m?.meta as any, chart1m?.quotes as any || [], chart1d?.quotes as any);
  
  console.log("perf.dailyBaseline:", perf.dailyBaseline);
  console.log("meta.regularMarketTime:", chart1m?.meta?.regularMarketTime);
}
run();
