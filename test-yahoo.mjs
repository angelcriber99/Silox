import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

async function test() {
  const quote = await yahooFinance.quote('AAPL')
  let changePercent24h = quote.regularMarketChangePercent ?? null
  let latestTime = quote.regularMarketTime ? new Date(quote.regularMarketTime) : null
  if (quote.preMarketTime) {
    const preTime = new Date(quote.preMarketTime)
    if (!latestTime || preTime > latestTime) latestTime = preTime
  }
  if (quote.postMarketTime) {
    const postTime = new Date(quote.postMarketTime)
    if (!latestTime || postTime > latestTime) latestTime = postTime
  }
  
  let wasReset = false
  if (latestTime) {
    const tz = quote.exchangeTimezoneName || 'America/New_York'
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' })
    const nowStr = formatter.format(new Date())
    const latestStr = formatter.format(latestTime)
    
    if (nowStr !== latestStr && latestTime < new Date()) {
      changePercent24h = 0
      wasReset = true
    }
    console.log({ tz, nowStr, latestStr })
  }
  
  console.log({ 
    changePercent24h, 
    wasReset 
  })
}

test()
