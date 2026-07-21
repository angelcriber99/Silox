import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getYahooFinance } from '@/lib/server/yahoo-finance'
import { mapSettledWithConcurrency } from '@/lib/utils/async'

export type RadarCertainty = 'confirmed' | 'scheduled' | 'estimated' | 'speculative' | 'manual'
export type RadarImpact = 'high' | 'medium' | 'low'
export type RadarDatePrecision = 'exact' | 'range' | 'month' | 'quarter'

export interface RadarAsset {
  id: string
  ticker: string
  name: string
  type: string
  currency: string
}

export interface RadarNewsItem {
  id: string
  title: string
  source: string
  publishedAt: string
  url: string
  ticker: string
}

export interface PortfolioRadarEvent {
  id: string
  assetId?: string
  ticker: string
  date: string
  endDate?: string
  datePrecision: RadarDatePrecision
  type: 'EARNINGS' | 'DIVIDEND' | 'EX_DIVIDEND' | 'CATALYST' | 'MANUAL'
  title: string
  description?: string
  certainty: RadarCertainty
  impact: RadarImpact
  sourceName?: string
  sourceUrl?: string
  sourcePublishedAt?: string
}

export interface PortfolioRadarResponse {
  assets: RadarAsset[]
  events: PortfolioRadarEvent[]
  news: RadarNewsItem[]
  updatedAt: string
}

interface RadarContext {
  user: { id: string }
  supabase: SupabaseClient<Database>
}

export interface RadarNewsCandidate {
  id: string
  title: string
  source: string
  publishedAt: Date
  url: string
  ticker: string
  assetId: string
}

interface EventWindow {
  start: Date
  end: Date
  precision: RadarDatePrecision
}

const MONTHS = [
  { index: 0, names: ['january', 'jan', 'enero'] },
  { index: 1, names: ['february', 'feb', 'febrero'] },
  { index: 2, names: ['march', 'mar', 'marzo'] },
  { index: 3, names: ['april', 'apr', 'abril'] },
  { index: 4, names: ['may', 'mayo'] },
  { index: 5, names: ['june', 'jun', 'junio'] },
  { index: 6, names: ['july', 'jul', 'julio'] },
  { index: 7, names: ['august', 'aug', 'agosto'] },
  { index: 8, names: ['september', 'sep', 'sept', 'septiembre'] },
  { index: 9, names: ['october', 'oct', 'octubre'] },
  { index: 10, names: ['november', 'nov', 'noviembre'] },
  { index: 11, names: ['december', 'dec', 'diciembre'] },
] as const

const MONTH_PATTERN = MONTHS
  .flatMap((month) => month.names)
  .sort((left, right) => right.length - left.length)
  .join('|')

const CATALYST_PATTERN = /\b(launch|lanz\w*|mission|mision\w*|fda|approval|aprobaci\w*|clinical trial|trial results|ensayo clinico|resultados? de ensayo|product event|product launch|keynote|investor day|merger|acquisition|takeover|fusion|adquisici\w*|contract award|adjudicaci\w*|regulatory decision|decision regulatoria|stock split|desdoblamiento|shareholder meeting|junta de accionistas|court decision|decision judicial)\b/i
const EXCLUDED_CATALYST_PATTERN = /\b(earnings|resultados financieros|dividend|dividendo|ex-dividend)\b/i
const FUTURE_SIGNAL_PATTERN = /\b(confirmed|confirma\w*|announces?|announced|anuncia\w*|scheduled|programad\w*|sets? date|set for|will|expected|expects|likely|plans?|planned|targets?|previst\w*|espera\w*|planea\w*|objetivo|probable|rumou?r|could|may|might|potential|possible|posible|podria\w*|upcoming|proxim\w*)\b/i

function normalized(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function validExternalUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function atUtcNoon(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12, 0, 0))
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

function monthIndex(token: string): number | null {
  const clean = normalized(token)
  return MONTHS.find((month) => month.names.some((name) => name === clean))?.index ?? null
}

function inferredYear(text: string, month: number, publishedAt: Date): number {
  const explicitYear = /\b(20\d{2})\b/.exec(text)?.[1]
  if (explicitYear) return Number(explicitYear)
  const publishedMonth = publishedAt.getUTCMonth()
  return publishedAt.getUTCFullYear() + (month + 1 < publishedMonth ? 1 : 0)
}

/**
 * Extracts only date windows explicitly present in a source headline. A window
 * is kept as a range instead of inventing a single day for phrases such as
 * "first half of August" or "Q3".
 */
export function parseRadarEventWindow(title: string, publishedAt: Date): EventWindow | null {
  const text = normalized(title)
  const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(text)
  if (iso) {
    const date = atUtcNoon(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    return { start: date, end: date, precision: 'exact' }
  }

  const quarter = /\bq([1-4])\s*(20\d{2})?\b/.exec(text)
  if (quarter) {
    const value = Number(quarter[1])
    const year = quarter[2] ? Number(quarter[2]) : publishedAt.getUTCFullYear()
    const startMonth = (value - 1) * 3
    return {
      start: atUtcNoon(year, startMonth, 1),
      end: atUtcNoon(year, startMonth + 2, daysInMonth(year, startMonth + 2)),
      precision: 'quarter',
    }
  }

  const firstHalf = new RegExp(`\\b(?:first half|primera quincena)(?: of| de)? (${MONTH_PATTERN})\\b`).exec(text)
  const secondHalf = new RegExp(`\\b(?:second half|segunda quincena)(?: of| de)? (${MONTH_PATTERN})\\b`).exec(text)
  const relativePart = new RegExp(`\\b(early|mid|late|principios|mediados|finales)(?: of| de)? (${MONTH_PATTERN})\\b`).exec(text)
  const exactMonthFirst = new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(20\\d{2}))?\\b`).exec(text)
  const exactDayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?: of| de)?\\s+(${MONTH_PATTERN})(?:,?\\s*(20\\d{2}))?\\b`).exec(text)

  if (exactMonthFirst || exactDayFirst) {
    const match = exactMonthFirst ?? exactDayFirst!
    const monthToken = exactMonthFirst ? match[1] : match[2]
    const day = Number(exactMonthFirst ? match[2] : match[1])
    const month = monthIndex(monthToken)
    if (month == null) return null
    const explicitYear = exactMonthFirst ? match[3] : match[3]
    const year = explicitYear ? Number(explicitYear) : inferredYear(text, month, publishedAt)
    if (day < 1 || day > daysInMonth(year, month)) return null
    const date = atUtcNoon(year, month, day)
    return { start: date, end: date, precision: 'exact' }
  }

  const rangeMatch = firstHalf ?? secondHalf ?? relativePart
  if (rangeMatch) {
    const monthToken = relativePart ? rangeMatch[2] : rangeMatch[1]
    const month = monthIndex(monthToken)
    if (month == null) return null
    const year = inferredYear(text, month, publishedAt)
    const lastDay = daysInMonth(year, month)
    let startDay = 1
    let endDay = lastDay

    if (firstHalf) endDay = 15
    else if (secondHalf) startDay = 16
    else if (relativePart) {
      const part = relativePart[1]
      if (part === 'early' || part === 'principios') endDay = 10
      else if (part === 'mid' || part === 'mediados') { startDay = 11; endDay = 20 }
      else startDay = 21
    }

    return {
      start: atUtcNoon(year, month, startDay),
      end: atUtcNoon(year, month, endDay),
      precision: 'range',
    }
  }

  const monthOnly = new RegExp(`\\b(${MONTH_PATTERN})\\b`).exec(text)
  if (monthOnly) {
    const month = monthIndex(monthOnly[1])
    if (month == null) return null
    const year = inferredYear(text, month, publishedAt)
    return {
      start: atUtcNoon(year, month, 1),
      end: atUtcNoon(year, month, daysInMonth(year, month)),
      precision: 'month',
    }
  }

  return null
}

function catalystCertainty(title: string): RadarCertainty {
  const text = normalized(title)
  if (/\b(confirmed|confirma\w*)\b/.test(text)) return 'confirmed'
  if (/\b(rumou?r|could|may|might|potential|possible|posible|podria\w*)\b/.test(text)) return 'speculative'
  if (/\b(expected|expects|likely|plans?|planned|target|previst\w*|espera\w*|planea\w*|objetivo|probable)\b/.test(text)) return 'estimated'
  if (/\b(announces?|announced|scheduled|sets? date|will|anuncia\w*|programad\w*|fijad\w*)\b/.test(text)) return 'scheduled'
  return 'estimated'
}

function catalystTitle(headline: string): string {
  const text = normalized(headline)
  if (/\b(launch|lanz\w*|mission|mision\w*)\b/.test(text)) return 'Lanzamiento o misión relevante'
  if (/\b(fda|approval|aprobaci\w*|regulatory decision|decision regulatoria)\b/.test(text)) return 'Decisión regulatoria'
  if (/\b(clinical trial|trial results|ensayo clinico|resultados? de ensayo)\b/.test(text)) return 'Hito de ensayo clínico'
  if (/\b(merger|acquisition|takeover|fusion|adquisici\w*)\b/.test(text)) return 'Operación corporativa potencial'
  if (/\b(stock split|desdoblamiento)\b/.test(text)) return 'Desdoblamiento de acciones'
  if (/\b(shareholder meeting|junta de accionistas)\b/.test(text)) return 'Junta de accionistas'
  if (/\b(product event|product launch|keynote)\b/.test(text)) return 'Presentación o lanzamiento de producto'
  return 'Catalizador corporativo'
}

function stableHash(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function extractCatalystEvents(
  articles: RadarNewsCandidate[],
  now = new Date(),
): PortfolioRadarEvent[] {
  const today = atUtcNoon(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const horizon = new Date(today)
  horizon.setUTCFullYear(horizon.getUTCFullYear() + 1)
  const unique = new Map<string, PortfolioRadarEvent>()

  for (const article of articles) {
    const cleanTitle = normalized(article.title)
    if (!CATALYST_PATTERN.test(cleanTitle)
      || EXCLUDED_CATALYST_PATTERN.test(cleanTitle)
      || !FUTURE_SIGNAL_PATTERN.test(cleanTitle)) continue
    const window = parseRadarEventWindow(article.title, article.publishedAt)
    if (!window || window.end < today || window.start > horizon || !validExternalUrl(article.url)) continue

    const category = catalystTitle(article.title)
    const key = `${article.ticker.toUpperCase()}-${category}-${window.start.toISOString().slice(0, 10)}`
    const candidate: PortfolioRadarEvent = {
      id: `catalyst-${stableHash(`${key}-${article.title}`)}`,
      assetId: article.assetId,
      ticker: article.ticker,
      date: window.start.toISOString(),
      ...(window.end.getTime() === window.start.getTime() ? {} : { endDate: window.end.toISOString() }),
      datePrecision: window.precision,
      type: 'CATALYST',
      title: category,
      description: article.title,
      certainty: catalystCertainty(article.title),
      impact: 'high',
      sourceName: article.source,
      sourceUrl: article.url,
      sourcePublishedAt: article.publishedAt.toISOString(),
    }

    const existing = unique.get(key)
    const rank: Record<RadarCertainty, number> = { confirmed: 5, scheduled: 4, manual: 3, estimated: 2, speculative: 1 }
    if (!existing || rank[candidate.certainty] > rank[existing.certainty]) unique.set(key, candidate)
  }

  return Array.from(unique.values())
}

function calendarSourceUrl(ticker: string): string {
  return `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}/calendar/`
}

function announcementSearchQuery(asset: RadarAsset): string {
  const company = asset.name
    .replace(/[,\s]+(incorporated|inc|corporation|corp|limited|ltd|plc|s\.a\.?|adr)\.?$/i, '')
    .trim()
  const subject = company.length >= 3 ? company : asset.ticker
  return `${subject} announces`
}

function futureEvent(event: PortfolioRadarEvent, now: Date): boolean {
  const end = new Date(event.endDate ?? event.date)
  const startToday = atUtcNoon(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Number.isFinite(end.getTime()) && end >= startToday
}

async function loadActiveAssets(context: RadarContext): Promise<RadarAsset[]> {
  const { data, error } = await context.supabase
    .from('posiciones')
    .select('activo_id, ticker, nombre, tipo, moneda, unidades')
    .eq('user_id', context.user.id)
    .gt('unidades', 0)

  if (error) throw new Error('No se pudieron cargar las posiciones activas del radar')

  const unique = new Map<string, RadarAsset>()
  for (const row of data ?? []) {
    const type = normalized(row.tipo)
    if (row.ticker === 'CASH' || type.includes('liquidez') || type.includes('monetario')) continue
    unique.set(row.activo_id, {
      id: row.activo_id,
      ticker: row.ticker,
      name: row.nombre || row.ticker,
      type: row.tipo,
      currency: row.moneda,
    })
  }
  return Array.from(unique.values())
}

async function loadManualEvents(context: RadarContext, assets: RadarAsset[], now: Date): Promise<PortfolioRadarEvent[]> {
  if (assets.length === 0) return []
  const assetById = new Map(assets.map((asset) => [asset.id, asset]))
  const { data, error } = await context.supabase
    .from('eventos_recurrentes')
    .select('id, activo_id, titulo, dia_del_mes, tipo')
    .eq('user_id', context.user.id)
    .in('activo_id', assets.map((asset) => asset.id))

  if (error) {
    console.warn('[portfolio-radar] No se pudieron cargar los eventos manuales:', error.message)
    return []
  }

  return (data ?? []).flatMap((row) => {
    const asset = assetById.get(row.activo_id)
    if (!asset) return []
    let year = now.getUTCFullYear()
    let month = now.getUTCMonth()
    const day = Math.min(row.dia_del_mes, daysInMonth(year, month))
    let date = atUtcNoon(year, month, day)
    const today = atUtcNoon(year, month, now.getUTCDate())
    if (date < today) {
      month += 1
      if (month > 11) { month = 0; year += 1 }
      date = atUtcNoon(year, month, Math.min(row.dia_del_mes, daysInMonth(year, month)))
    }
    return [{
      id: `manual-${row.id}`,
      assetId: asset.id,
      ticker: asset.ticker,
      date: date.toISOString(),
      datePrecision: 'exact' as const,
      type: 'MANUAL' as const,
      title: row.titulo,
      description: row.tipo,
      certainty: 'manual' as const,
      impact: 'medium' as const,
      sourceName: 'Silox',
    }]
  })
}

async function loadMarketData(assets: RadarAsset[], now: Date, langCode: string) {
  const yahoo = getYahooFinance()
  const searchOptions = {
    newsCount: 20,
    lang: langCode === 'es' ? 'es-ES' : langCode === 'en' ? 'en-US' : langCode === 'fr' ? 'fr-FR' : 'en-US',
    region: langCode === 'es' ? 'ES' : langCode === 'en' ? 'US' : langCode === 'fr' ? 'FR' : 'US',
  }
  
  const batches = await mapSettledWithConcurrency(assets, 4, async (asset) => {
    const announcementQuery = announcementSearchQuery(asset)
    const [summaryResult, newsResult, announcementResult] = await Promise.allSettled([
      yahoo.quoteSummary(asset.ticker, { modules: ['calendarEvents'] }),
      yahoo.search(asset.ticker, searchOptions),
      yahoo.search(announcementQuery, searchOptions),
    ])
    const calendar = summaryResult.status === 'fulfilled' ? summaryResult.value.calendarEvents : undefined
    const news = [newsResult, announcementResult].flatMap((result) =>
      result.status === 'fulfilled' ? result.value.news : [])
    const events: PortfolioRadarEvent[] = []
    const sourceUrl = calendarSourceUrl(asset.ticker)

    const earningsDates = calendar?.earnings?.earningsDate
      ?.filter(Boolean)
      .map((date) => new Date(date))
      .filter((date) => Number.isFinite(date.getTime())) ?? []
    if (earningsDates.length > 0) {
      const start = earningsDates[0]
      const end = earningsDates[earningsDates.length - 1]
      events.push({
        id: `${asset.ticker}-earnings-${start.toISOString().slice(0, 10)}`,
        assetId: asset.id,
        ticker: asset.ticker,
        date: start.toISOString(),
        ...(end.getTime() === start.getTime() ? {} : { endDate: end.toISOString() }),
        datePrecision: end.getTime() === start.getTime() ? 'exact' : 'range',
        type: 'EARNINGS',
        title: 'Resultados financieros',
        description: 'Fecha publicada por el proveedor de mercado; puede estar sujeta a cambios.',
        certainty: 'estimated',
        impact: 'high',
        sourceName: 'Yahoo Finance',
        sourceUrl,
      })
    }
    if (calendar?.exDividendDate && Number.isFinite(new Date(calendar.exDividendDate).getTime())) {
      const date = new Date(calendar.exDividendDate)
      events.push({
        id: `${asset.ticker}-ex-dividend-${date.toISOString().slice(0, 10)}`,
        assetId: asset.id,
        ticker: asset.ticker,
        date: date.toISOString(),
        datePrecision: 'exact',
        type: 'EX_DIVIDEND',
        title: 'Fecha ex-dividendo',
        certainty: 'scheduled',
        impact: 'medium',
        sourceName: 'Yahoo Finance',
        sourceUrl,
      })
    }
    if (calendar?.dividendDate && Number.isFinite(new Date(calendar.dividendDate).getTime())) {
      const date = new Date(calendar.dividendDate)
      events.push({
        id: `${asset.ticker}-dividend-${date.toISOString().slice(0, 10)}`,
        assetId: asset.id,
        ticker: asset.ticker,
        date: date.toISOString(),
        datePrecision: 'exact',
        type: 'DIVIDEND',
        title: 'Pago de dividendo',
        certainty: 'scheduled',
        impact: 'medium',
        sourceName: 'Yahoo Finance',
        sourceUrl,
      })
    }

    const articles: RadarNewsCandidate[] = news.flatMap((article) => {
      if (!article.title || !validExternalUrl(article.link)) return []
      
      const related = article.relatedTickers ?? []
      const baseTicker = asset.ticker.split('.')[0]
      
      const isRelatedByTicker = related.includes(asset.ticker) || related.includes(baseTicker)
      const titleLower = article.title.toLowerCase()
      const nameWords = asset.name.toLowerCase().split(' ').filter(w => w.length > 3)
      const isRelatedByName = titleLower.includes(baseTicker.toLowerCase()) || nameWords.some(w => titleLower.includes(w))

      // If Yahoo returned it, we trust it unless it has related tickers and NONE of them match our asset
      if (related.length > 0 && !isRelatedByTicker && !isRelatedByName) {
        return []
      }
      
      // If no related tickers, require at least a name or ticker match in the title
      if (related.length === 0 && !isRelatedByName) {
        return []
      }

      return [{
        id: `${asset.id}-${article.uuid || `news-${stableHash(article.link)}`}`,
        title: article.title,
        source: article.publisher || 'Yahoo Finance',
        publishedAt: article.providerPublishTime ? new Date(article.providerPublishTime) : now,
        url: article.link,
        ticker: asset.ticker,
        assetId: asset.id,
      }]
    })
    return { events, articles }
  })

  const events: PortfolioRadarEvent[] = []
  const articles: RadarNewsCandidate[] = []
  for (const batch of batches) {
    if (batch.status !== 'fulfilled') continue
    events.push(...batch.value.events)
    articles.push(...batch.value.articles)
  }
  return { events: events.filter((event) => futureEvent(event, now)), articles }
}

export async function buildPortfolioRadar(context: RadarContext, now = new Date(), langCode = 'es'): Promise<PortfolioRadarResponse> {
  const assets = await loadActiveAssets(context)
  if (assets.length === 0) return { assets: [], events: [], news: [], updatedAt: now.toISOString() }

  const [market, manualEvents] = await Promise.all([
    loadMarketData(assets, now, langCode),
    loadManualEvents(context, assets, now),
  ])
  const catalysts = extractCatalystEvents(market.articles, now)
  const eventMap = new Map<string, PortfolioRadarEvent>()
  for (const event of [...market.events, ...catalysts, ...manualEvents]) eventMap.set(event.id, event)

  const newsMap = new Map<string, RadarNewsItem>()
  for (const article of market.articles) {
    newsMap.set(article.id, {
      id: article.id,
      title: article.title,
      source: article.source,
      publishedAt: article.publishedAt.toISOString(),
      url: article.url,
      ticker: article.ticker,
    })
  }

  return {
    assets,
    events: Array.from(eventMap.values()).sort((left, right) => left.date.localeCompare(right.date)),
    news: Array.from(newsMap.values())
      .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
      .slice(0, 60),
    updatedAt: now.toISOString(),
  }
}
