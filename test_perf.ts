import YahooFinance from 'yahoo-finance2';
import { getMarketDateKey } from './lib/utils/market-performance';

async function run() {
  const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  const chart1m = await yf.chart("0P0001CJGV.F", { interval: "1m", period1: new Date(Date.now() - 86400000), includePrePost: true }).catch(()=>null);
  const chart1d = await yf.chart("0P0001CJGV.F", { interval: "1d", period1: new Date(Date.now() - 7 * 86400000) }).catch(()=>null);
  
  const meta = chart1m?.meta as any;
  const exchangeTimezone = meta.exchangeTimezoneName || meta.timezone || 'America/New_York';
  
  // What is marketDate inside extractMarketPerformance?!
  const marketDate = getMarketDateKey(meta.regularMarketTime ?? new Date(), exchangeTimezone);
  console.log("marketDate:", marketDate);
  
  const dailyQuotes = chart1d?.quotes as any[];
  const validDailyQuotes = dailyQuotes.filter(q => q.close != null && Number.isFinite(q.close));
  
  const latestQuoteDateStr = marketDate;
  
  console.log("latestQuoteDateStr:", latestQuoteDateStr);
  const previousDays = validDailyQuotes.filter(q => {
     const k = getMarketDateKey(q.date, exchangeTimezone);
     console.log(`Checking q.date: ${q.date} -> key: ${k} < ${latestQuoteDateStr} ? ${k < latestQuoteDateStr}`);
     return k < latestQuoteDateStr;
  });
  
  console.log("previousDays.length:", previousDays.length);
  if (previousDays.length > 0) {
    console.log("dailyBaseline:", previousDays.at(-1)?.close);
  }
}
run();
