import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

const fixture = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/mobile-api-contract.json'), 'utf8'))

const Envelope = <T extends z.ZodType>(data: T) => z.object({ data })
const MoneyString = z.string().regex(/^-?\d+(\.\d+)?$/)

describe('shared backend/Swift contract fixture', () => {
  it('keeps mobile success responses enveloped and money decimal-safe', () => {
    const portfolio = Envelope(z.object({
      asOf: z.iso.datetime(),
      displayCurrency: z.string().length(3),
      marketState: z.string(),
      totals: z.object({
        value: MoneyString.nullable(), cost: MoneyString.nullable(),
        profitLoss: MoneyString.nullable(), profitLossPercent: z.number(),
        dailyProfitLoss: MoneyString.nullable(),
      }).passthrough(),
      positions: z.array(z.object({ ticker: z.string(), currency: z.string().length(3) }).passthrough()),
    })).parse(fixture.portfolio)
    expect(portfolio.data.positions[0].ticker).toBe('AAPL')

    const transactions = Envelope(z.object({
      items: z.array(z.object({ id: z.uuid(), assetId: z.uuid(), date: z.iso.date() }).passthrough()),
      page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative(),
    })).parse(fixture.transactions)
    expect(transactions.data.items).toHaveLength(1)
  })

  it('keeps normalized news enveloped while widget endpoints remain raw', () => {
    Envelope(z.array(z.object({
      id: z.string(), title: z.string(), source: z.string(), publishedAt: z.iso.datetime(),
      url: z.url(), ticker: z.string().nullable(),
    }))).parse(fixture.news)

    expect(fixture.widgetSummary).not.toHaveProperty('data')
    expect(fixture.widgetSummary).toMatchObject({ netSession: 145.5, totalValue: 12540.2 })
    expect(fixture.widgetCredential.token).toMatch(/^swx_widget_/)
  })
})
