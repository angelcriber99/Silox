import YahooFinance from 'yahoo-finance2';

async function main() {
  const yahoo = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] });
  const result = await yahoo.search('Bitcoin', { quotesCount: 5 });
  console.log(result.quotes);
}
main();
