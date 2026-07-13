import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildTransactionGroups,
  getTransactionCandidates,
} from '@/lib/domain/imports/transaction-index'

export const runtime = 'nodejs'

type ImportOperation = 'Compra' | 'Venta'
type AssetKind = 'Acción' | 'Crypto' | 'Metal'

interface ParsedImportTransaction {
  user_id: string
  ticker: string
  rawTicker: string
  nombre: string
  tipoActivo: AssetKind
  moneda: string
  tipo_operacion: ImportOperation
  cantidad: number
  precio_unitario: number
  fecha: string
  comision: number
}

const CRYPTO_SYMBOLS = new Set([
  '1INCH', 'AAVE', 'ADA', 'ALGO', 'ATOM', 'AVAX', 'BCH', 'BNB', 'BONK', 'BTC',
  'DOGE', 'DOT', 'ENA', 'EOS', 'ETC', 'ETH', 'FIL', 'FLR', 'LINK', 'LMWR', 'LTC',
  'MATIC', 'MEW', 'MON', 'NEAR', 'POL', 'PYTH', 'ROSE', 'SEI', 'SOL', 'TRX',
  'UNI', 'USDC', 'USDT', 'VET', 'WAXL', 'XLM', 'XMR', 'XRP', 'XTZ', 'ZKJ',
])
const FIAT_SYMBOLS = new Set(['EUR', 'USD', 'GBP', 'CHF', 'JPY'])
const METAL_SYMBOLS = new Set(['XAG', 'XAU', 'XPD', 'XPT'])

const CRYPTO_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  ADA: 'Cardano',
  XRP: 'XRP',
  DOGE: 'Dogecoin',
  DOT: 'Polkadot',
  AVAX: 'Avalanche',
  LINK: 'Chainlink',
  MATIC: 'Polygon',
  POL: 'Polygon',
  LTC: 'Litecoin',
  BCH: 'Bitcoin Cash',
  USDC: 'USD Coin',
  USDT: 'Tether',
}

const METAL_NAMES: Record<string, string> = {
  XAG: 'Silver',
  XAU: 'Gold',
  XPD: 'Palladium',
  XPT: 'Platinum',
}

const METAL_YAHOO_TICKERS: Record<string, string> = {
  XAG: 'SI=F',
  XAU: 'GC=F',
  XPD: 'PA=F',
  XPT: 'PL=F',
}

const LEGACY_METAL_YAHOO_TICKERS: Record<string, string[]> = {
  XAG: ['XAGUSD=X', 'XAGEUR=X'],
  XAU: ['XAUUSD=X', 'XAUEUR=X'],
  XPD: ['XPDUSD=X', 'XPDEUR=X'],
  XPT: ['XPTUSD=X', 'XPTEUR=X'],
}

type MetalRateCode = 'xag' | 'xau' | 'xpd' | 'xpt'
type MetalRates = Partial<Record<MetalRateCode, number>>

const METAL_RATE_API_BASE = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api'
const METAL_RATE_CODES: Record<string, MetalRateCode> = {
  XAG: 'xag',
  XAU: 'xau',
  XPD: 'xpd',
  XPT: 'xpt',
}

const SPANISH_MONTHS: Record<string, string> = {
  ene: '01',
  enero: '01',
  feb: '02',
  febrero: '02',
  mar: '03',
  marzo: '03',
  abr: '04',
  abril: '04',
  may: '05',
  mayo: '05',
  jun: '06',
  junio: '06',
  jul: '07',
  julio: '07',
  ago: '08',
  agosto: '08',
  sep: '09',
  sept: '09',
  septiembre: '09',
  oct: '10',
  octubre: '10',
  nov: '11',
  noviembre: '11',
  dic: '12',
  diciembre: '12',
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeHeader(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function parseNumber(value: unknown): number {
  const raw = normalizeText(value)
  if (!raw) return Number.NaN

  const cleaned = raw
    .replace(/\s/g, '')
    .replace(/[^\d,.\-]/g, '')

  if (!cleaned) return Number.NaN

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  const decimalSeparator = lastComma > lastDot ? ',' : '.'

  const normalized = cleaned
    .replace(new RegExp(`\\${decimalSeparator === ',' ? '.' : ','}`, 'g'), '')
    .replace(decimalSeparator, '.')

  return parseFloat(normalized)
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split('T')[0]
  }

  const raw = normalizeText(value)
  if (!raw) return null

  const isoLike = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoLike) {
    const [, y, m, d] = isoLike
    return `${y}-${m}-${d}`
  }

  const date = new Date(raw)
  if (!Number.isNaN(date.getTime())) return date.toISOString().split('T')[0]

  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const spanishDate = normalized.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})/)
  if (spanishDate) {
    const [, d, monthName, y] = spanishDate
    const month = SPANISH_MONTHS[monthName]
    if (month) return `${y}-${month}-${d.padStart(2, '0')}`
  }

  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (!match) return null

  const [, d, m, y] = match
  const year = y.length === 2 ? `20${y}` : y
  const parsed = new Date(`${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0]
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      cell += '"'
      i++
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim())
      cell = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function cellToString(value: any): string {
  if (value instanceof Date) return value.toISOString()
  if (value?.text) return String(value.text)
  if (value?.result !== undefined) return cellToString(value.result)
  if (value?.richText) return value.richText.map((part: any) => part.text).join('')
  if (value?.hyperlink && value?.text) return String(value.text)
  return normalizeText(value)
}

async function parseWorkbook(buffer: Buffer): Promise<string[][]> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as any)

  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  const rows: string[][] = []
  sheet.eachRow((row) => {
    const values = row.values as any[]
    const cells = values.slice(1).map(cellToString)
    if (cells.some(Boolean)) rows.push(cells)
  })

  return rows
}

function findIndex(headers: string[], candidates: string[]): number {
  return headers.findIndex(header => candidates.includes(header))
}

function normalizeCryptoTicker(symbol: string): string {
  const clean = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return `${clean}-USD`
}

function normalizeMetalTicker(symbol: string): string {
  const clean = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return METAL_YAHOO_TICKERS[clean] ?? clean
}

function getLegacyMetalTickers(symbol: string): string[] {
  const clean = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return LEGACY_METAL_YAHOO_TICKERS[clean] ?? []
}

function getAssetSector(kind: AssetKind): string {
  if (kind === 'Crypto') return 'Crypto'
  if (kind === 'Metal') return 'Metales'
  return 'Desconocido'
}

function getDatabaseAssetType(kind: AssetKind): 'Acción' | 'Crypto' {
  if (kind === 'Metal') return 'Crypto'
  return kind
}

function getAssetGeography(kind: AssetKind): string {
  if (kind === 'Crypto' || kind === 'Metal') return 'Global'
  return 'Desconocida'
}

function inferAsset(rawTicker: string, rowText: string): {
  ticker: string
  rawTicker: string
  nombre: string
  tipoActivo: AssetKind
  moneda: string
} {
  const upper = rawTicker.toUpperCase().trim()
  const symbol = upper.replace(/[-/].*$/, '').replace(/[^A-Z0-9]/g, '')
  const isCrypto =
    CRYPTO_SYMBOLS.has(symbol) ||
    upper.endsWith('-USD') ||
    /crypto|criptomoneda|bitcoin|ethereum|solana|cardano|dogecoin/i.test(rowText)

  if (METAL_SYMBOLS.has(symbol) || upper.endsWith('USD=X') || /metal|metales|gold|silver|palladium|platinum|oro|plata/i.test(rowText)) {
    const base = upper.endsWith('USD=X') ? upper.replace('USD=X', '') : symbol
    return {
      ticker: normalizeMetalTicker(base),
      rawTicker: base,
      nombre: METAL_NAMES[base] ?? base,
      tipoActivo: 'Metal',
      moneda: 'EUR',
    }
  }

  if (isCrypto) {
    const base = upper.endsWith('-USD') ? upper.replace('-USD', '') : symbol
    return {
      ticker: upper.endsWith('-USD') ? upper : normalizeCryptoTicker(base),
      rawTicker: base,
      nombre: CRYPTO_NAMES[base] ?? base,
      tipoActivo: 'Crypto',
      moneda: 'USD',
    }
  }

  return {
    ticker: upper,
    rawTicker: upper,
    nombre: upper,
    tipoActivo: 'Acción',
    moneda: 'USD',
  }
}

function inferOperation(typeValue: string, description: string, quantity: number): ImportOperation | null {
  const normalizedType = normalizeOperationText(typeValue)
  const text = `${normalizedType} ${normalizeOperationText(description)}`

  if (normalizedType === 'staking') return null

  if (/(^|\s)(buy|bought|compra|comprar|comprado)(\s|$)/.test(text)) return 'Compra'
  if (/(^|\s)(sell|sold|venta|vender|vendido)(\s|$)/.test(text)) return 'Venta'
  if (/(recepcion|received|staking|recompensa|reward|learn)/.test(text)) return 'Compra'
  if (/(envio|sent|withdrawal|retirada)/.test(text)) return 'Venta'
  if (/exchanged\s+to|cambiado\s+a|convertido\s+a/.test(text)) return 'Compra'
  if (/exchanged\s+from|cambiado\s+desde|convertido\s+desde/.test(text)) return 'Venta'

  if (text.includes('exchange') || text.includes('intercambio')) {
    if (quantity > 0) return 'Compra'
    if (quantity < 0) return 'Venta'
  }

  return null
}

function normalizeOperationText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function findPairedFiatTotal(
  rows: string[][],
  currentRowIndex: number,
  dateIdx: number,
  tickerIdx: number,
  qtyIdx: number,
  descriptionIdx: number,
  currentDate: string,
  currentDescription: string
): number {
  if (tickerIdx < 0 || qtyIdx < 0) return Number.NaN

  for (let i = 0; i < rows.length; i++) {
    if (i === currentRowIndex) continue

    const candidate = rows[i]
    const candidateCurrency = normalizeText(candidate[tickerIdx]).toUpperCase()
    if (!FIAT_SYMBOLS.has(candidateCurrency)) continue

    const candidateDate = parseDate(candidate[dateIdx])
    if (candidateDate !== currentDate) continue

    const candidateDescription = normalizeText(candidate[descriptionIdx])
    if (currentDescription && candidateDescription && candidateDescription !== currentDescription) continue

    const amount = parseNumber(candidate[qtyIdx])
    if (Number.isFinite(amount) && amount !== 0) return Math.abs(amount)
  }

  return Number.NaN
}

async function fetchMetalRatesForDate(
  date: string,
  cache: Map<string, Promise<MetalRates | null>>
): Promise<MetalRates | null> {
  if (!cache.has(date)) {
    cache.set(date, (async () => {
      try {
        const response = await fetch(`${METAL_RATE_API_BASE}@${date}/v1/currencies/eur.json`, {
          next: { revalidate: 86400 },
        })
        if (!response.ok) return null

        const data = await response.json() as { eur?: MetalRates }
        return data.eur ?? null
      } catch {
        return null
      }
    })())
  }

  return cache.get(date) ?? null
}

async function fetchMetalUnitPriceEur(
  metalSymbol: string,
  date: string,
  cache: Map<string, Promise<MetalRates | null>>
): Promise<number | null> {
  const metalCode = METAL_RATE_CODES[metalSymbol]
  if (!metalCode) return null

  const datedRates = await fetchMetalRatesForDate(date, cache)
  const datedUnitsPerEur = datedRates?.[metalCode]
  if (datedUnitsPerEur && datedUnitsPerEur > 0) return 1 / datedUnitsPerEur

  const latestRates = await fetchMetalRatesForDate('latest', cache)
  const latestUnitsPerEur = latestRates?.[metalCode]
  return latestUnitsPerEur && latestUnitsPerEur > 0 ? 1 / latestUnitsPerEur : null
}

async function parseRows(rows: string[][], userId: string): Promise<ParsedImportTransaction[]> {
  if (rows.length < 2) return []

  const headers = rows[0].map(normalizeHeader)
  if (isMetalAccountStatement(headers)) return parseMetalRows(rows, userId)

  const hasHeaders = headers.some(header =>
    ['ticker', 'symbol', 'asset', 'instrument', 'date', 'fecha', 'type', 'quantity', 'price'].includes(header)
  )

  if (!hasHeaders) return parseFixedRows(rows, userId)

  const dateIdx = findIndex(headers, ['date', 'fecha', 'completeddate', 'completed', 'executeddate', 'starteddate'])
  const tickerIdx = findIndex(headers, ['ticker', 'symbol', 'asset', 'instrument', 'crypto', 'currency', 'moneda'])
  const typeIdx = findIndex(headers, ['type', 'tipo', 'transactiontype', 'operation', 'operacion'])
  const qtyIdx = findIndex(headers, ['quantity', 'cantidad', 'units', 'shares', 'amount'])
  const priceIdx = findIndex(headers, ['price', 'precio', 'unitprice', 'priceperunit', 'pricepershare', 'shareprice', 'averageprice', 'avgprice', 'rate'])
  const totalIdx = findIndex(headers, ['total', 'value', 'totalamount', 'totalvalue', 'fiatamount', 'fiatamountincfees', 'amountfiat', 'executedvalue'])
  const feeIdx = findIndex(headers, ['fee', 'fees', 'commission', 'comision'])
  const nameIdx = findIndex(headers, ['name', 'nombre', 'instrumentname', 'assetname', 'product'])
  const descriptionIdx = findIndex(headers, ['description', 'descripcion', 'details', 'concept'])
  const isCryptoAccountStatement =
    headers.includes('symbol') &&
    headers.includes('type') &&
    headers.includes('quantity') &&
    headers.includes('price') &&
    headers.includes('value') &&
    headers.includes('fees') &&
    headers.includes('date')

  const parsed: ParsedImportTransaction[] = []

  const dataRows = rows.slice(1)

  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
    const row = dataRows[rowIndex]
    const rowText = row.join(' ')
    const rawTicker = normalizeText(row[tickerIdx >= 0 ? tickerIdx : nameIdx])
    const date = parseDate(row[dateIdx])
    const quantityRaw = parseNumber(row[qtyIdx])
    const quantity = Math.abs(quantityRaw)
    const typeValue = normalizeText(row[typeIdx])
    const description = normalizeText(row[descriptionIdx])
    const operation = inferOperation(typeValue, description, quantityRaw)

    if (!rawTicker || !date || !operation || !Number.isFinite(quantity) || quantity <= 0) continue

    const asset = isCryptoAccountStatement
      ? {
          ticker: normalizeCryptoTicker(rawTicker),
          rawTicker: rawTicker.toUpperCase().replace(/[^A-Z0-9]/g, ''),
          nombre: CRYPTO_NAMES[rawTicker.toUpperCase().replace(/[^A-Z0-9]/g, '')] ?? rawTicker.toUpperCase(),
          tipoActivo: 'Crypto' as const,
          moneda: 'USD',
        }
      : inferAsset(rawTicker, rowText)
    const price = parseNumber(row[priceIdx])
    const total = parseNumber(row[totalIdx])
    const pairedFiatTotal = asset.tipoActivo === 'Crypto'
      ? findPairedFiatTotal(dataRows, rowIndex, dateIdx, tickerIdx, qtyIdx, descriptionIdx, date, description)
      : Number.NaN
    const isZeroCostCryptoInflow = asset.tipoActivo === 'Crypto' && operation === 'Compra' && /recepcion|staking|recompensa|reward|learn/i.test(
      typeValue
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    )
    const precioUnitario = Number.isFinite(price) && price > 0
      ? price
      : Number.isFinite(total) && total !== 0
        ? Math.abs(total) / quantity
        : Number.isFinite(pairedFiatTotal) && pairedFiatTotal > 0
          ? pairedFiatTotal / quantity
          : isZeroCostCryptoInflow
            ? 0
            : Number.NaN

    if (!Number.isFinite(precioUnitario) || precioUnitario < 0) continue

    const displayName = normalizeText(row[nameIdx]) || asset.nombre

    parsed.push({
      user_id: userId,
      ticker: asset.ticker,
      rawTicker: asset.rawTicker,
      nombre: displayName,
      tipoActivo: asset.tipoActivo,
      moneda: asset.moneda,
      tipo_operacion: operation,
      cantidad: quantity,
      precio_unitario: precioUnitario,
      fecha: date,
      comision: Number.isFinite(parseNumber(row[feeIdx])) ? Math.abs(parseNumber(row[feeIdx])) : 0,
    })
  }

  return parsed
}

function isMetalAccountStatement(headers: string[]): boolean {
  return (
    headers.includes('tipo') &&
    headers.includes('producto') &&
    headers.includes('fechadeinicio') &&
    headers.includes('descripcion') &&
    headers.includes('importe') &&
    headers.includes('comision') &&
    headers.includes('divisa') &&
    headers.includes('saldo')
  )
}

async function parseMetalRows(rows: string[][], userId: string): Promise<ParsedImportTransaction[]> {
  const headers = rows[0].map(normalizeHeader)
  const dateIdx = findIndex(headers, ['fechadefinalizacion', 'fechadeinicio', 'date', 'fecha'])
  const amountIdx = findIndex(headers, ['importe', 'amount'])
  const feeIdx = findIndex(headers, ['comision', 'commission', 'fee', 'fees'])
  const currencyIdx = findIndex(headers, ['divisa', 'currency', 'moneda'])
  const stateIdx = findIndex(headers, ['state', 'estado'])

  if (dateIdx < 0 || amountIdx < 0 || currencyIdx < 0) return []

  const parsed: ParsedImportTransaction[] = []
  const metalRateCache = new Map<string, Promise<MetalRates | null>>()

  for (const row of rows.slice(1)) {
    const state = normalizeText(row[stateIdx]).toUpperCase()
    if (state && state !== 'COMPLETADO' && state !== 'COMPLETED') continue

    const metalSymbol = normalizeText(row[currencyIdx]).toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!METAL_SYMBOLS.has(metalSymbol)) continue

    const amount = parseNumber(row[amountIdx])
    const feeInUnits = Math.abs(parseNumber(row[feeIdx]))
    const date = parseDate(row[dateIdx])
    const operation: ImportOperation | null = amount > 0 ? 'Compra' : amount < 0 ? 'Venta' : null

    if (!date || !operation || !Number.isFinite(amount) || amount === 0) continue

    const grossQuantity = Math.abs(amount)
    const quantity = operation === 'Compra' && Number.isFinite(feeInUnits)
      ? grossQuantity - feeInUnits
      : grossQuantity

    if (!Number.isFinite(quantity) || quantity <= 0) continue

    const name = METAL_NAMES[metalSymbol] ?? metalSymbol
    const historicalUnitPriceEur = await fetchMetalUnitPriceEur(metalSymbol, date, metalRateCache)
    if (!historicalUnitPriceEur || historicalUnitPriceEur <= 0) continue

    const effectiveUnitPriceEur = operation === 'Compra'
      ? historicalUnitPriceEur * (grossQuantity / quantity)
      : historicalUnitPriceEur

    parsed.push({
      user_id: userId,
      ticker: normalizeMetalTicker(metalSymbol),
      rawTicker: metalSymbol,
      nombre: name,
      tipoActivo: 'Metal',
      moneda: 'EUR',
      tipo_operacion: operation,
      cantidad: quantity,
      precio_unitario: effectiveUnitPriceEur,
      fecha: date,
      comision: 0,
    })
  }

  return parsed
}

function parseInternalCryptoMovements(rows: string[][], userId: string): ParsedImportTransaction[] {
  if (rows.length < 2) return []

  const headers = rows[0].map(normalizeHeader)
  const dateIdx = findIndex(headers, ['date', 'fecha', 'completeddate', 'completed', 'executeddate', 'starteddate'])
  const tickerIdx = findIndex(headers, ['ticker', 'symbol', 'asset', 'instrument', 'crypto', 'currency', 'moneda'])
  const typeIdx = findIndex(headers, ['type', 'tipo', 'transactiontype', 'operation', 'operacion'])
  const qtyIdx = findIndex(headers, ['quantity', 'cantidad', 'units', 'shares', 'amount'])
  const priceIdx = findIndex(headers, ['price', 'precio', 'unitprice', 'priceperunit', 'pricepershare', 'shareprice', 'averageprice', 'avgprice', 'rate'])
  const totalIdx = findIndex(headers, ['total', 'value', 'totalamount', 'totalvalue', 'fiatamount', 'fiatamountincfees', 'amountfiat', 'executedvalue'])
  const feeIdx = findIndex(headers, ['fee', 'fees', 'commission', 'comision'])
  const isCryptoAccountStatement =
    headers.includes('symbol') &&
    headers.includes('type') &&
    headers.includes('quantity') &&
    headers.includes('price') &&
    headers.includes('value') &&
    headers.includes('fees') &&
    headers.includes('date')

  if (!isCryptoAccountStatement || dateIdx < 0 || tickerIdx < 0 || typeIdx < 0 || qtyIdx < 0) return []

  const internalMovements: ParsedImportTransaction[] = []

  for (const row of rows.slice(1)) {
    const typeValue = normalizeText(row[typeIdx])
    if (normalizeOperationText(typeValue) !== 'staking') continue

    const rawTicker = normalizeText(row[tickerIdx])
    const date = parseDate(row[dateIdx])
    const quantity = Math.abs(parseNumber(row[qtyIdx]))

    if (!rawTicker || !date || !Number.isFinite(quantity) || quantity <= 0) continue

    const rawSymbol = rawTicker.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const price = parseNumber(row[priceIdx])
    const total = parseNumber(row[totalIdx])
    const precioUnitario = Number.isFinite(price) && price > 0
      ? price
      : Number.isFinite(total) && total !== 0
        ? Math.abs(total) / quantity
        : 0

    internalMovements.push({
      user_id: userId,
      ticker: normalizeCryptoTicker(rawTicker),
      rawTicker: rawSymbol,
      nombre: CRYPTO_NAMES[rawSymbol] ?? rawSymbol,
      tipoActivo: 'Crypto',
      moneda: 'USD',
      tipo_operacion: 'Compra',
      cantidad: quantity,
      precio_unitario: precioUnitario,
      fecha: date,
      comision: Number.isFinite(parseNumber(row[feeIdx])) ? Math.abs(parseNumber(row[feeIdx])) : 0,
    })
  }

  return internalMovements
}

function parseFixedRows(rows: string[][], userId: string): ParsedImportTransaction[] {
  const parsed: ParsedImportTransaction[] = []

  for (const cols of rows.slice(1)) {
    if (cols.length < 5) continue

    const rawDate = cols[0]
    const rawTicker = normalizeText(cols[1])
    const type = normalizeText(cols[2])
    const quantity = Math.abs(parseNumber(cols[3]))
    const price = parseNumber(cols[4])
    const date = parseDate(rawDate)
    const operation = inferOperation(type, '', quantity)

    if (!rawTicker || !date || !operation || !Number.isFinite(quantity) || quantity <= 0) continue
    if (!Number.isFinite(price) || price <= 0) continue

    const asset = inferAsset(rawTicker, cols.join(' '))

    parsed.push({
      user_id: userId,
      ticker: asset.ticker,
      rawTicker: asset.rawTicker,
      nombre: asset.nombre,
      tipoActivo: asset.tipoActivo,
      moneda: asset.moneda,
      tipo_operacion: operation,
      cantidad: quantity,
      precio_unitario: price,
      fecha: date,
      comision: 0,
    })
  }

  return parsed
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 413 })
    }

    const lowerName = file.name.toLowerCase()
    const isCsv = lowerName.endsWith('.csv') || file.type === 'text/csv'
    const isExcel = lowerName.endsWith('.xlsx')

    if (!isCsv && !isExcel) {
      return NextResponse.json({ error: 'Invalid file format. CSV or XLSX allowed.' }, { status: 415 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const rows = isExcel
      ? await parseWorkbook(buffer)
      : parseCsv(buffer.toString('utf-8'))

    const parsedTransactions = await parseRows(rows, user.id)
    const internalCryptoMovements = parseInternalCryptoMovements(rows, user.id)

    let { data: activos } = await supabase
      .from('activos')
      .select('id, ticker, tipo, sector, moneda')
      .eq('user_id', user.id)

    let { data: existingTransactions } = await supabase
      .from('transacciones')
      .select('id, activo_id, tipo_operacion, cantidad, precio_unitario, comision, fecha')
      .eq('user_id', user.id)

    const assetsByTicker = new Map<string, NonNullable<typeof activos>[number]>()
    for (const asset of activos ?? []) {
      if (!assetsByTicker.has(asset.ticker)) assetsByTicker.set(asset.ticker, asset)
    }

    let transactionGroups = buildTransactionGroups(existingTransactions ?? [])

    let removedInternalMovements = 0
    if (internalCryptoMovements.length > 0 && activos && existingTransactions) {
      const idsToDelete = new Set<string>()

      for (const movement of internalCryptoMovements) {
        const existingActivo = assetsByTicker.get(movement.ticker)
          ?? (movement.tipoActivo === 'Crypto'
            ? assetsByTicker.get(movement.rawTicker)
            : undefined)
        if (!existingActivo) continue

        const candidates = getTransactionCandidates(
          transactionGroups,
          existingActivo.id,
          movement.tipo_operacion,
          movement.fecha,
        )

        for (const existing of candidates) {
          const isSameQty = Math.abs(existing.cantidad - movement.cantidad) < 0.00000001
          const isSamePrice = Math.abs(existing.precio_unitario - movement.precio_unitario) < 0.01

          if (isSameQty && isSamePrice) {
            idsToDelete.add(existing.id)
          }
        }
      }

      if (idsToDelete.size > 0) {
        const ids = Array.from(idsToDelete)
        const { error: deleteError } = await supabase
          .from('transacciones')
          .delete()
          .in('id', ids)

        if (deleteError) {
          return NextResponse.json({
            error: `No se pudieron limpiar movimientos internos de staking: ${deleteError.message}`,
          }, { status: 500 })
        }

        removedInternalMovements = ids.length
        existingTransactions = existingTransactions.filter(tx => !idsToDelete.has(tx.id))
        transactionGroups = buildTransactionGroups(existingTransactions)
      }
    }

    if (parsedTransactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No se encontraron operaciones de compra/venta en este archivo.',
        newTransactions: 0,
        updatedTransactions: 0,
        ignoredDuplicates: 0,
        removedInternalMovements,
        imported: [],
        ignored: [],
      })
    }

    let newTxCount = 0
    let ignoredCount = 0
    let updatedTxCount = 0
    const toInsert = []
    const imported = []
    const ignored = []

    for (const tx of parsedTransactions) {
      let activo_id = null
      const candidateTickers = [tx.ticker]
      if (tx.tipoActivo === 'Crypto' || tx.tipoActivo === 'Metal') {
        candidateTickers.push(tx.rawTicker)
      }
      if (tx.tipoActivo === 'Metal') {
        candidateTickers.push(...getLegacyMetalTickers(tx.rawTicker))
      }
      let existingActivo = candidateTickers
        .map((ticker) => assetsByTicker.get(ticker))
        .find((asset) => asset !== undefined)

      if (existingActivo) {
        activo_id = existingActivo.id
        const dbTipo = getDatabaseAssetType(tx.tipoActivo)
        if ((tx.tipoActivo === 'Crypto' || tx.tipoActivo === 'Metal') && (existingActivo.ticker !== tx.ticker || existingActivo.tipo !== dbTipo || existingActivo.sector !== getAssetSector(tx.tipoActivo) || existingActivo.moneda !== tx.moneda)) {
          await supabase
            .from('activos')
            .update({
              ticker: tx.ticker,
              nombre: tx.nombre,
              tipo: dbTipo,
              moneda: tx.moneda,
              sector: getAssetSector(tx.tipoActivo),
              geografia: getAssetGeography(tx.tipoActivo),
            })
            .eq('id', existingActivo.id)

          existingActivo.ticker = tx.ticker
          existingActivo.tipo = dbTipo
          existingActivo.sector = getAssetSector(tx.tipoActivo)
          existingActivo.moneda = tx.moneda
          assetsByTicker.set(tx.ticker, existingActivo)
        }
      } else {
        const dbTipo = getDatabaseAssetType(tx.tipoActivo)
        const { data: newActivo, error: createError } = await supabase
          .from('activos')
          .insert({
            user_id: user.id,
            ticker: tx.ticker,
            nombre: tx.nombre,
            tipo: dbTipo,
            estrategia: 'Satellite',
            moneda: tx.moneda,
            sector: getAssetSector(tx.tipoActivo),
            geografia: getAssetGeography(tx.tipoActivo),
          })
          .select('id, ticker, tipo, sector, moneda')
          .single()

        if (createError) {
          return NextResponse.json({
            error: `No se pudo crear el activo ${tx.ticker}: ${createError.message}`,
          }, { status: 500 })
        }

        if (newActivo) {
          activo_id = newActivo.id
          if (!activos) activos = []
          activos.push(newActivo)
          assetsByTicker.set(newActivo.ticker, newActivo)
        }
      }

      if (!activo_id) continue

      const matchingExisting = getTransactionCandidates(
          transactionGroups,
          activo_id,
          tx.tipo_operacion,
          tx.fecha,
        ).find(existing => {
        const isSameQty = Math.abs(existing.cantidad - tx.cantidad) < 0.00000001
        return isSameQty
      })

      if (matchingExisting && tx.tipoActivo === 'Metal') {
        const shouldUpdate =
          Math.abs(matchingExisting.precio_unitario - tx.precio_unitario) >= 0.01 ||
          Math.abs((matchingExisting.comision ?? 0) - tx.comision) >= 0.01

        if (shouldUpdate) {
          const { error: updateError } = await supabase
            .from('transacciones')
            .update({
              precio_unitario: tx.precio_unitario,
              comision: tx.comision,
            })
            .eq('id', matchingExisting.id)
            .eq('user_id', user.id)

          if (updateError) {
            return NextResponse.json({
              error: `No se pudo actualizar el histórico de ${tx.ticker}: ${updateError.message}`,
            }, { status: 500 })
          }

          matchingExisting.precio_unitario = tx.precio_unitario
          matchingExisting.comision = tx.comision
          imported.push(tx)
          updatedTxCount++
        } else {
          ignoredCount++
          ignored.push(tx)
        }
      } else if (matchingExisting && Math.abs(matchingExisting.precio_unitario - tx.precio_unitario) < 0.01) {
        ignoredCount++
        ignored.push(tx)
      } else {
        const { ticker, rawTicker, nombre, tipoActivo, moneda, ...dbTx } = tx
        toInsert.push({ ...dbTx, activo_id, estado: 'Completada' })
        imported.push(tx)
        newTxCount++
      }
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('transacciones')
        .insert(toInsert)

      if (insertError) {
        return NextResponse.json({ error: 'Error al insertar transacciones en la base de datos' }, { status: 500 })
      }
    }

    if (parsedTransactions.length > 0 && newTxCount === 0 && ignoredCount === 0) {
      return NextResponse.json({
        error: `Se leyeron ${parsedTransactions.length} movimientos, pero no se pudo asociar ninguno a un activo.`,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      newTransactions: newTxCount,
      updatedTransactions: updatedTxCount,
      ignoredDuplicates: ignoredCount,
      removedInternalMovements,
      imported,
      ignored,
    })

  } catch (error: any) {
    console.error('Revolut Import Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
