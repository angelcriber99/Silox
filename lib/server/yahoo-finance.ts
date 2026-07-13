import 'server-only'

import YahooFinance from 'yahoo-finance2'

const createYahooFinanceClient = () =>
  new YahooFinance({ suppressNotices: ['yahooSurvey'] })

let yahooFinance: ReturnType<typeof createYahooFinanceClient> | null = null

export function getYahooFinance(): ReturnType<typeof createYahooFinanceClient> {
  if (!yahooFinance) {
    yahooFinance = createYahooFinanceClient()
  }

  return yahooFinance
}
