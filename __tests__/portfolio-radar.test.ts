import { describe, expect, it } from 'vitest'
import {
  extractCatalystEvents,
  parseRadarEventWindow,
  type RadarNewsCandidate,
} from '@/lib/server/portfolio-radar'

const article = (title: string, publishedAt = '2026-06-25T10:00:00.000Z'): RadarNewsCandidate => ({
  id: 'news-1',
  assetId: 'asts-id',
  ticker: 'ASTS',
  title,
  source: 'Business Wire',
  publishedAt: new Date(publishedAt),
  url: 'https://example.com/source-backed-event',
})

describe('portfolio radar catalyst extraction', () => {
  it('keeps the first half of a month as a range instead of inventing one date', () => {
    const window = parseRadarEventWindow(
      'AST SpaceMobile Announces BlueBirds 11, 12 and 13 Orbital Launch in the First Half of August',
      new Date('2026-06-25T10:00:00.000Z'),
    )

    expect(window?.start.toISOString()).toBe('2026-08-01T12:00:00.000Z')
    expect(window?.end.toISOString()).toBe('2026-08-15T12:00:00.000Z')
    expect(window?.precision).toBe('range')
  })

  it('creates a source-backed scheduled catalyst for the ASTS launch example', () => {
    const events = extractCatalystEvents([
      article('AST SpaceMobile Announces BlueBirds 11, 12 and 13 Orbital Launch in the First Half of August'),
    ], new Date('2026-07-18T12:00:00.000Z'))

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      ticker: 'ASTS',
      date: '2026-08-01T12:00:00.000Z',
      endDate: '2026-08-15T12:00:00.000Z',
      type: 'CATALYST',
      certainty: 'scheduled',
      impact: 'high',
      sourceName: 'Business Wire',
      sourceUrl: 'https://example.com/source-backed-event',
    })
  })

  it('labels rumor language as speculative and keeps the source', () => {
    const events = extractCatalystEvents([
      article('ASTS could launch another satellite batch in September 2026'),
    ], new Date('2026-07-18T12:00:00.000Z'))

    expect(events[0]).toMatchObject({ certainty: 'speculative', datePrecision: 'month' })
  })

  it('does not create calendar entries without an explicit date window', () => {
    const events = extractCatalystEvents([
      article('AST SpaceMobile plans another major satellite launch'),
    ], new Date('2026-07-18T12:00:00.000Z'))

    expect(events).toEqual([])
  })

  it('supports quarter windows for estimated regulatory catalysts', () => {
    const events = extractCatalystEvents([
      article('Biotech company targets FDA approval in Q4 2026'),
    ], new Date('2026-07-18T12:00:00.000Z'))

    expect(events[0]).toMatchObject({
      date: '2026-10-01T12:00:00.000Z',
      endDate: '2026-12-31T12:00:00.000Z',
      datePrecision: 'quarter',
      certainty: 'estimated',
    })
  })
})
