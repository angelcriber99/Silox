import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function test() {
  const quote = await yahooFinance.quote('AAPL');
  const summary = await yahooFinance.quoteSummary('AAPL', { modules: ['summaryProfile', 'financialData', 'calendarEvents'] });
  
  console.log("QUOTE KEYS:", Object.keys(quote));
  console.log("EPS:", quote.epsTrailingTwelveMonths, quote.epsForward);
  console.log("PE:", quote.trailingPE, quote.forwardPE);
  console.log("Analyst Rating:", quote.averageAnalystRating);
  console.log("Analyst Target:", quote.targetMeanPrice);
  
  console.log("SUMMARY PROFILE:", summary.summaryProfile ? Object.keys(summary.summaryProfile) : null);
  console.log("FINANCIAL DATA:", summary.financialData ? Object.keys(summary.financialData) : null);
  console.log("CALENDAR:", summary.calendarEvents ? summary.calendarEvents : null);
}

test().catch(console.error);
