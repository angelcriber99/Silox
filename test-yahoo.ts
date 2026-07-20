import yahooFinance from 'yahoo-finance2'

async function test() {
  const chart = await yahooFinance.chart('ASTS', { interval: '1m', period1: new Date(Date.now() - 24 * 60 * 60 * 1000), includePrePost: true })
  console.log('chartPreviousClose:', chart.meta.chartPreviousClose)
  console.log('previousClose:', chart.meta.previousClose)
  console.log('regularMarketPrice:', chart.meta.regularMarketPrice)
}
test().catch(console.error)
