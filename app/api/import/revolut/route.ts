import { NextResponse } from 'next/server'
import { MobileApiError } from '@/lib/mobile/api'
import { requireMobileUser } from '@/lib/mobile/auth'
import type { CellValue } from 'exceljs'
import { getYahooFinance } from '@/lib/server/yahoo-finance'
import {
  isMyInvestorStatement,
  parseMyInvestorStatement,
  type ResolvedMyInvestorAsset,
} from '@/lib/domain/imports/myinvestor'
import {
  externalFlowNote,
  isNonCashReward,
  nonCashRewardNote,
} from '@/lib/domain/portfolio/contributions'
import { collectAllPages } from '@/lib/utils/pagination'

export const runtime = 'nodejs'

type ImportOperation = 'Compra' | 'Venta' | 'Dividendo'
type AssetKind = 'Acción' | 'ETF' | 'Fondo Indexado' | 'Crypto' | 'Metal' | 'Liquidity'

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
  retencion_origen?: number
  retencion_destino?: number
  isin?: string
  sourceTimestamp?: string
  notas?: string
  includeInSummary?: boolean
}

const MAX_XLSX_ENTRIES = 2_500
const MAX_XLSX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024
const MAX_XLSX_COMPRESSION_RATIO = 100
const MAX_XLSX_SHEETS = 32
const MAX_XLSX_ROWS = 50_000
const MAX_XLSX_CELLS = 500_000
const MAX_XLSX_TEXT_BYTES = 8 * 1024 * 1024

function toDatabaseTransaction(transaction: ParsedImportTransaction) {
  return {
    user_id: transaction.user_id,
    tipo_operacion: transaction.tipo_operacion,
    cantidad: transaction.cantidad,
    precio_unitario: transaction.precio_unitario,
    fecha: transaction.fecha,
    comision: transaction.comision,
    ...(transaction.retencion_origen !== undefined ? { retencion_origen: transaction.retencion_origen } : {}),
    ...(transaction.retencion_destino !== undefined ? { retencion_destino: transaction.retencion_destino } : {}),
    ...(transaction.notas ? { notas: transaction.notas } : {}),
    ...(transaction.sourceTimestamp ? { created_at: transaction.sourceTimestamp } : {}),
  }
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

function parseSourceTimestamp(value: unknown): string | undefined {
  const raw = normalizeText(value)
  if (!raw || (!raw.includes('T') && !/\d{2}:\d{2}/.test(raw))) return undefined

  const normalized = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`
  const timestamp = new Date(normalized)
  return Number.isNaN(timestamp.getTime()) ? undefined : timestamp.toISOString()
}

function timestampsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return left === right
  const leftTime = new Date(left).getTime()
  const rightTime = new Date(right).getTime()
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime
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

function cellToString(value: CellValue): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null) {
    if ('richText' in value) return value.richText.map((part) => part.text).join('')
    if ('result' in value && value.result !== undefined) return cellToString(value.result)
    if ('text' in value) return value.text
    if ('error' in value) return value.error
  }
  return normalizeText(value)
}

function xlsxLimitError(message: string): MobileApiError {
  return new MobileApiError(413, 'xlsx_limits_exceeded', message)
}

/**
 * Reads ZIP central-directory metadata before ExcelJS expands an XLSX archive.
 * ZIP64 and encrypted archives are deliberately rejected because their sizes
 * cannot be bounded with this lightweight preflight.
 */
export function validateXlsxArchive(buffer: ArrayBuffer): void {
  const bytes = new Uint8Array(buffer)
  const minimumEocdSize = 22
  if (bytes.byteLength < minimumEocdSize) throw xlsxLimitError('El archivo XLSX no contiene un índice ZIP válido.')

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocdOffset = -1
  const searchStart = Math.max(0, bytes.byteLength - 65_557)
  for (let offset = bytes.byteLength - minimumEocdSize; offset >= searchStart; offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocdOffset = offset
      break
    }
  }
  if (eocdOffset < 0) throw xlsxLimitError('El archivo XLSX no contiene un índice ZIP válido.')

  const entries = view.getUint16(eocdOffset + 10, true)
  const centralDirectorySize = view.getUint32(eocdOffset + 12, true)
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true)
  if (
    entries === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff ||
    entries > MAX_XLSX_ENTRIES || centralDirectoryOffset + centralDirectorySize > bytes.byteLength
  ) {
    throw xlsxLimitError('El archivo XLSX supera los límites de estructura permitidos.')
  }

  let offset = centralDirectoryOffset
  let totalUncompressed = 0
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > centralDirectoryOffset + centralDirectorySize || view.getUint32(offset, true) !== 0x02014b50) {
      throw xlsxLimitError('El índice ZIP del XLSX no es válido.')
    }
    const flags = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const uncompressedSize = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    if (flags & 0x1 || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw xlsxLimitError('El XLSX usa una estructura ZIP no admitida.')
    }
    if (uncompressedSize > 0 && (compressedSize === 0 || uncompressedSize / compressedSize > MAX_XLSX_COMPRESSION_RATIO)) {
      throw xlsxLimitError('El XLSX supera el límite de compresión permitido.')
    }
    totalUncompressed += uncompressedSize
    if (totalUncompressed > MAX_XLSX_UNCOMPRESSED_BYTES) {
      throw xlsxLimitError('El XLSX supera el tamaño descomprimido permitido.')
    }
    offset += 46 + nameLength + extraLength + commentLength
  }
  if (offset > centralDirectoryOffset + centralDirectorySize) {
    throw xlsxLimitError('El índice ZIP del XLSX no es válido.')
  }
}

async function parseWorkbook(buffer: ArrayBuffer): Promise<string[][]> {
  validateXlsxArchive(buffer)
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  if (workbook.worksheets.length > MAX_XLSX_SHEETS) {
    throw xlsxLimitError('El XLSX contiene demasiadas hojas.')
  }
  let totalRows = 0
  let totalCells = 0
  let totalTextBytes = 0
  const sheets = workbook.worksheets.map((sheet) => {
    const rows: string[][] = []
    sheet.eachRow((row) => {
      totalRows += 1
      if (totalRows > MAX_XLSX_ROWS) throw xlsxLimitError('El XLSX contiene demasiadas filas.')
      const values = row.values
      if (!Array.isArray(values)) return
      const cells = values.slice(1).map(cellToString)
      totalCells += cells.length
      totalTextBytes += cells.reduce((sum, cell) => sum + Buffer.byteLength(cell, 'utf8'), 0)
      if (totalCells > MAX_XLSX_CELLS || totalTextBytes > MAX_XLSX_TEXT_BYTES) {
        throw xlsxLimitError('El XLSX contiene demasiadas celdas o texto.')
      }
      if (cells.some(Boolean)) rows.push(cells)
    })
    return rows
  }).filter((rows) => rows.length > 0)

  return sheets.find(isMyInvestorStatement) ?? sheets[0] ?? []
}

function findIndex(headers: string[], candidates: string[]): number {
  return headers.findIndex(header => candidates.includes(header))
}

interface DividendAmounts {
  gross: number
  net: number
  commission: number
  withholdingOrigin: number
  withholdingDestination: number
  netOnly: boolean
}

function parseOptionalAmount(row: string[], index: number): number {
  if (index < 0) return 0
  const amount = Math.abs(parseNumber(row[index]))
  return Number.isFinite(amount) ? amount : 0
}

function parseDividendAmounts(headers: string[], row: string[]): DividendAmounts | null {
  const grossIdx = findIndex(headers, ['grossamount', 'grossdividend', 'grossvalue', 'importebruto', 'dividendobruto', 'bruto'])
  const netIdx = findIndex(headers, ['netamount', 'netdividend', 'netvalue', 'importeneto', 'dividendoneto', 'neto'])
  const totalIdx = findIndex(headers, ['totalamount', 'total', 'value', 'totalvalue', 'fiatamount', 'fiatamountincfees', 'amountfiat', 'executedvalue'])
  const feeIdx = findIndex(headers, ['fee', 'fees', 'commission', 'comision'])
  const originIdx = findIndex(headers, [
    'withholdingtax', 'withholding', 'taxwithheld', 'foreigntax', 'sourcetax',
    'retencion', 'retencionorigen', 'impuestoorigen', 'impuestoextranjero', 'tax', 'taxes',
  ])
  const destinationIdx = findIndex(headers, [
    'destinationtax', 'domestictax', 'retenciondestino', 'impuestodestino', 'impuestonacional',
  ])

  const commission = parseOptionalAmount(row, feeIdx)
  const withholdingOrigin = parseOptionalAmount(row, originIdx)
  const withholdingDestination = parseOptionalAmount(row, destinationIdx)
  const deductions = commission + withholdingOrigin + withholdingDestination
  const explicitGross = grossIdx >= 0 ? Math.abs(parseNumber(row[grossIdx])) : Number.NaN
  const explicitNet = netIdx >= 0 ? Math.abs(parseNumber(row[netIdx])) : Number.NaN
  const reportedTotal = totalIdx >= 0 ? Math.abs(parseNumber(row[totalIdx])) : Number.NaN

  if (Number.isFinite(explicitGross) && explicitGross > 0) {
    const net = Number.isFinite(explicitNet) && explicitNet >= 0
      ? explicitNet
      : Math.max(0, explicitGross - deductions)
    return { gross: explicitGross, net, commission, withholdingOrigin, withholdingDestination, netOnly: false }
  }

  const net = Number.isFinite(explicitNet) && explicitNet > 0 ? explicitNet : reportedTotal
  if (!Number.isFinite(net) || net <= 0) return null

  return {
    gross: net + deductions,
    net,
    commission,
    withholdingOrigin,
    withholdingDestination,
    netOnly: deductions === 0,
  }
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
  if (kind === 'Liquidity') return 'Liquidez'
  if (kind === 'Crypto') return 'Crypto'
  if (kind === 'Metal') return 'Metales'
  if (kind === 'ETF' || kind === 'Fondo Indexado') return 'Fondos'
  return 'Desconocido'
}

function getDatabaseAssetType(kind: AssetKind): 'Acción' | 'ETF' | 'Fondo Indexado' | 'Fondo Monetario' | 'Crypto' {
  if (kind === 'Metal') return 'Crypto'
  if (kind === 'Liquidity') return 'Fondo Monetario'
  return kind
}

function getAssetGeography(kind: AssetKind): string {
  if (kind === 'Crypto' || kind === 'Metal' || kind === 'ETF' || kind === 'Fondo Indexado' || kind === 'Liquidity') return 'Global'
  return 'Desconocida'
}

async function resolveMyInvestorAsset(isin: string, statementName: string): Promise<ResolvedMyInvestorAsset> {
  const yahoo = getYahooFinance()

  for (const query of [isin, statementName]) {
    try {
      const result = await yahoo.search(query)
      const candidates = result.quotes.filter((candidate) => candidate.isYahooFinance && candidate.symbol)
      const preferredType = /\bETF\b/i.test(statementName) ? 'ETF' : 'MUTUALFUND'
      const quote = candidates.find((candidate) => String(candidate.quoteType).toUpperCase() === preferredType)
        ?? candidates.find((candidate) => String(candidate.quoteType).toUpperCase() === 'ETF')
        ?? candidates[0]
      if (!quote?.symbol) continue

      const quoteType = String(quote.quoteType ?? '').toUpperCase()
      return {
        ticker: String(quote.symbol),
        name: String(quote.longname || quote.shortname || statementName),
        type: quoteType === 'ETF' ? 'ETF' : quoteType === 'EQUITY' ? 'Acción' : 'Fondo Indexado',
        currency: 'EUR',
      }
    } catch {
      // Try the descriptive fund name before falling back to the ISIN.
    }
  }

  return { ticker: isin, name: statementName, type: 'Fondo Indexado', currency: 'EUR' }
}

function inferAsset(rawTicker: string, rowText: string, statementCurrency?: string): {
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

  const currency = normalizeText(statementCurrency).toUpperCase()

  return {
    ticker: upper,
    rawTicker: upper,
    nombre: upper,
    tipoActivo: 'Acción',
    moneda: FIAT_SYMBOLS.has(currency) ? currency : 'USD',
  }
}

function inferOperation(typeValue: string, description: string, quantity: number): ImportOperation | null {
  const normalizedType = normalizeOperationText(typeValue)
  const text = `${normalizedType} ${normalizeOperationText(description)}`

  if (normalizedType === 'staking') return null

  if (/(^|\s)(dividend|dividendo)(\s|$)/.test(text)) return 'Dividendo'

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

function isNonInvestmentMovement(typeValue: string): boolean {
  const type = normalizeOperationText(typeValue)
  return /^(cash\s+(top-up|withdrawal)|reward)$/.test(type)
}

function isCryptoRewardType(typeValue: string): boolean {
  const type = normalizeOperationText(typeValue)
  return type !== 'staking' && /recompensa|reward|learn/.test(type)
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

export interface SkippedImportTransaction {
  ticker?: string
  fecha?: string
  reason: string
}

export interface ParseResult {
  parsed: ParsedImportTransaction[]
  skipped: SkippedImportTransaction[]
  cashMovements?: ParsedImportTransaction[]
}

function cashTicker(currency: string): string {
  return currency === 'EUR' ? 'CASH' : `CASH-${currency}`
}

function createCashMovement(input: {
  userId: string
  currency: string
  operation: 'Compra' | 'Venta'
  amount: number
  date: string
  sourceTimestamp?: string
  notes: string
}): ParsedImportTransaction {
  const ticker = cashTicker(input.currency)
  return {
    user_id: input.userId,
    ticker,
    rawTicker: ticker,
    nombre: input.currency === 'EUR' ? 'Efectivo' : `Efectivo ${input.currency}`,
    tipoActivo: 'Liquidity',
    moneda: input.currency,
    tipo_operacion: input.operation,
    cantidad: input.amount,
    precio_unitario: 1,
    fecha: input.date,
    comision: 0,
    sourceTimestamp: input.sourceTimestamp,
    notas: input.notes,
    includeInSummary: false,
  }
}

function parseBrokerCashMovements(rows: string[][], userId: string): ParsedImportTransaction[] {
  if (rows.length < 2) return []

  const headers = rows[0].map(normalizeHeader)
  const dateIdx = findIndex(headers, ['date', 'fecha'])
  const typeIdx = findIndex(headers, ['type', 'tipo'])
  const totalIdx = findIndex(headers, ['totalamount', 'netamount', 'grossamount', 'total', 'value'])
  const currencyIdx = findIndex(headers, ['currency', 'divisa', 'moneda'])
  const fxIdx = findIndex(headers, ['fxrate', 'tipodecambio', 'exchangerate'])
  if (dateIdx < 0 || typeIdx < 0 || totalIdx < 0 || currencyIdx < 0) return []

  const cashMovements: ParsedImportTransaction[] = []
  for (const row of rows.slice(1)) {
    const date = parseDate(row[dateIdx])
    const sourceTimestamp = parseSourceTimestamp(row[dateIdx])
    const type = normalizeOperationText(normalizeText(row[typeIdx]))
    const dividendAmounts = type === 'dividend' ? parseDividendAmounts(headers, row) : null
    const amount = dividendAmounts?.net ?? Math.abs(parseNumber(row[totalIdx]))
    const currency = normalizeText(row[currencyIdx]).toUpperCase()
    const fxRate = parseNumber(row[fxIdx])
    if (!date || !Number.isFinite(amount) || amount <= 0 || !FIAT_SYMBOLS.has(currency)) continue

    let operation: 'Compra' | 'Venta' | null = null
    let notes = `[REVOLUT_CASH] ${normalizeText(row[typeIdx])}`

    if (type === 'cash top-up') {
      operation = 'Compra'
      const eurAmount = currency === 'EUR' ? amount : amount / fxRate
      if (!Number.isFinite(eurAmount) || eurAmount <= 0) continue
      notes = externalFlowNote(eurAmount, 'Aportación a la cuenta de inversión')
    } else if (type === 'cash withdrawal') {
      operation = 'Venta'
      const eurAmount = currency === 'EUR' ? amount : amount / fxRate
      if (!Number.isFinite(eurAmount) || eurAmount <= 0) continue
      notes = externalFlowNote(eurAmount, 'Retirada de la cuenta de inversión')
    } else if (type.startsWith('buy')) {
      operation = 'Venta'
    } else if (type.startsWith('sell') || type === 'dividend' || type === 'reward') {
      operation = 'Compra'
    }

    if (!operation) continue
    cashMovements.push(createCashMovement({
      userId,
      currency,
      operation,
      amount,
      date,
      sourceTimestamp,
      notes,
    }))
  }

  return cashMovements
}

async function fetchCryptoRewardPricesEur(
  rows: string[][],
  tickerIdx: number,
  typeIdx: number,
  qtyIdx: number,
  priceIdx: number,
  totalIdx: number,
  dateIdx: number,
): Promise<Map<string, number>> {
  const datesBySymbol = new Map<string, Set<string>>()

  for (const row of rows) {
    if (!isCryptoRewardType(normalizeText(row[typeIdx]))) continue

    const quantity = Math.abs(parseNumber(row[qtyIdx]))
    const price = parseNumber(row[priceIdx])
    const total = parseNumber(row[totalIdx])
    const date = parseDate(row[dateIdx])
    const symbol = normalizeText(row[tickerIdx]).toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (
      !symbol || !date || !Number.isFinite(quantity) || quantity <= 0
      || (Number.isFinite(price) && price > 0)
      || (Number.isFinite(total) && total !== 0)
    ) continue

    const dates = datesBySymbol.get(symbol) ?? new Set<string>()
    dates.add(date)
    datesBySymbol.set(symbol, dates)
  }

  const prices = new Map<string, number>()
  await Promise.all(Array.from(datesBySymbol, async ([symbol, dates]) => {
    const orderedDates = Array.from(dates).sort()
    const period1 = new Date(`${orderedDates[0]}T00:00:00.000Z`)
    const period2 = new Date(`${orderedDates.at(-1)}T00:00:00.000Z`)
    period2.setUTCDate(period2.getUTCDate() + 2)

    try {
      const chart = await getYahooFinance().chart(`${symbol}-EUR`, {
        period1,
        period2,
        interval: '1d',
      })
      for (const quote of chart.quotes) {
        const date = quote.date.toISOString().slice(0, 10)
        if (dates.has(date) && Number.isFinite(quote.close) && quote.close! > 0) {
          prices.set(`${symbol}:${date}`, quote.close!)
        }
      }
    } catch {
      // The affected rewards are reported as skipped below instead of using a zero basis.
    }
  }))

  return prices
}

async function parseRows(rows: string[][], userId: string): Promise<ParseResult> {
  if (rows.length < 2) return { parsed: [], skipped: [] }

  if (isMyInvestorStatement(rows)) {
    const parsed = await parseMyInvestorStatement(rows, userId, resolveMyInvestorAsset)
    return { parsed, skipped: [] }
  }

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
  const totalIdx = findIndex(headers, ['total', 'value', 'totalamount', 'netamount', 'grossamount', 'totalvalue', 'fiatamount', 'fiatamountincfees', 'amountfiat', 'executedvalue'])
  const feeIdx = findIndex(headers, ['fee', 'fees', 'commission', 'comision'])
  const currencyIdx = findIndex(headers, ['currency', 'divisa', 'moneda'])
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
  const skipped: SkippedImportTransaction[] = []

  const dataRows = rows.slice(1)
  const cryptoRewardPricesEur = isCryptoAccountStatement
    ? await fetchCryptoRewardPricesEur(dataRows, tickerIdx, typeIdx, qtyIdx, priceIdx, totalIdx, dateIdx)
    : new Map<string, number>()

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

    if (isNonInvestmentMovement(typeValue)) continue
    if (normalizeOperationText(typeValue) === 'staking') continue

    const isDividend = operation === 'Dividendo'
    const effectiveQuantity = isDividend ? 1 : quantity
    const dividendAmounts = isDividend ? parseDividendAmounts(headers, row) : null

    if (!rawTicker || !date || !operation || !Number.isFinite(effectiveQuantity) || effectiveQuantity <= 0) {
      if (rawTicker || normalizeText(row[dateIdx])) {
        skipped.push({ ticker: rawTicker || 'Desconocido', fecha: normalizeText(row[dateIdx]), reason: 'Datos incompletos o cantidad inválida' })
      }
      continue
    }

    const asset = isCryptoAccountStatement
      ? {
          ticker: normalizeCryptoTicker(rawTicker),
          rawTicker: rawTicker.toUpperCase().replace(/[^A-Z0-9]/g, ''),
          nombre: CRYPTO_NAMES[rawTicker.toUpperCase().replace(/[^A-Z0-9]/g, '')] ?? rawTicker.toUpperCase(),
          tipoActivo: 'Crypto' as const,
          moneda: 'EUR',
        }
      : inferAsset(rawTicker, rowText, normalizeText(row[currencyIdx]))
    const price = parseNumber(row[priceIdx])
    const total = parseNumber(row[totalIdx])
    const pairedFiatTotal = asset.tipoActivo === 'Crypto'
      ? findPairedFiatTotal(dataRows, rowIndex, dateIdx, tickerIdx, qtyIdx, descriptionIdx, date, description)
      : Number.NaN
    const isNonCashCryptoReward = asset.tipoActivo === 'Crypto' && operation === 'Compra' && isCryptoRewardType(typeValue)
    const historicalRewardPrice = isNonCashCryptoReward
      ? cryptoRewardPricesEur.get(`${asset.rawTicker}:${date}`)
      : undefined
    const precioUnitario = isDividend && dividendAmounts
      ? dividendAmounts.gross
      : Number.isFinite(total) && total !== 0
        ? Math.abs(total) / effectiveQuantity
        : Number.isFinite(price) && price > 0
          ? price
        : Number.isFinite(pairedFiatTotal) && pairedFiatTotal > 0
          ? pairedFiatTotal / effectiveQuantity
          : historicalRewardPrice !== undefined
            ? historicalRewardPrice
            : Number.NaN

    if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
      skipped.push({ ticker: asset.ticker, fecha: date, reason: 'Precio unitario o total inválido' })
      continue
    }

    const displayName = normalizeText(row[nameIdx]) || asset.nombre

    parsed.push({
      user_id: userId,
      ticker: asset.ticker,
      rawTicker: asset.rawTicker,
      nombre: displayName,
      tipoActivo: asset.tipoActivo,
      moneda: asset.moneda,
      tipo_operacion: operation,
      cantidad: effectiveQuantity,
      precio_unitario: precioUnitario,
      fecha: date,
      comision: dividendAmounts?.commission
        ?? (Number.isFinite(parseNumber(row[feeIdx])) ? Math.abs(parseNumber(row[feeIdx])) : 0),
      ...(dividendAmounts ? {
        retencion_origen: dividendAmounts.withholdingOrigin,
        retencion_destino: dividendAmounts.withholdingDestination,
        notas: dividendAmounts.netOnly
          ? '[REVOLUT_DIVIDEND_NET] Importe neto; el CSV no desglosa comisiones ni retenciones.'
          : `[REVOLUT_DIVIDEND] Neto ${dividendAmounts.net.toFixed(8)} ${asset.moneda}`,
      } : {}),
      sourceTimestamp: parseSourceTimestamp(row[dateIdx]),
      ...(isNonCashCryptoReward ? { notas: nonCashRewardNote(typeValue) } : {}),
    })
  }

  return { parsed, skipped, cashMovements: parseBrokerCashMovements(rows, userId) }
}

function isMetalAccountStatement(headers: string[]): boolean {
  return (
    (headers.includes('tipo') || headers.includes('type')) &&
    (headers.includes('producto') || headers.includes('product')) &&
    (headers.includes('fechadeinicio') || headers.includes('starteddate')) &&
    (headers.includes('descripcion') || headers.includes('description')) &&
    (headers.includes('importe') || headers.includes('amount')) &&
    (headers.includes('comision') || headers.includes('fee')) &&
    (headers.includes('divisa') || headers.includes('currency')) &&
    (headers.includes('saldo') || headers.includes('balance'))
  )
}

function getMetalFiatValue(headers: string[], row: string[]): number {
  const valueIdx = findIndex(headers, [
    'valor',
    'value',
    'total',
    'importeeneur',
    'importeeneuros',
    'valoreur',
    'valoreuros',
    'contravalor',
    'contravaloreur',
    'fiatamount',
    'amountfiat',
    'executedvalue',
  ])

  if (valueIdx < 0) return Number.NaN

  const value = Math.abs(parseNumber(row[valueIdx]))
  return Number.isFinite(value) && value > 0 ? value : Number.NaN
}

function getConversionTargetCurrency(description: string): string | null {
  const normalized = normalizeOperationText(description).toUpperCase()
  const match = normalized.match(/CONVERSION A ([A-Z]{3})/)
  return match?.[1] ?? null
}

async function getMetalRowValueEur(
  metalSymbol: string,
  quantity: number,
  feeInUnits: number,
  operation: ImportOperation,
  date: string,
  headers: string[],
  row: string[],
  cache: Map<string, Promise<MetalRates | null>>
): Promise<number | null> {
  const fiatValueEur = getMetalFiatValue(headers, row)
  if (Number.isFinite(fiatValueEur)) return fiatValueEur

  const historicalUnitPriceEur = await fetchMetalUnitPriceEur(metalSymbol, date, cache)
  if (!historicalUnitPriceEur || historicalUnitPriceEur <= 0) return null

  const grossQuantity = operation === 'Compra' && Number.isFinite(feeInUnits)
    ? quantity + feeInUnits
    : quantity

  return grossQuantity * historicalUnitPriceEur
}

async function parseMetalRows(rows: string[][], userId: string): Promise<ParseResult> {
  const headers = rows[0].map(normalizeHeader)
  const dateIdx = findIndex(headers, ['fechadefinalizacion', 'fechadeinicio', 'date', 'fecha'])
  const amountIdx = findIndex(headers, ['importe', 'amount'])
  const feeIdx = findIndex(headers, ['comision', 'commission', 'fee', 'fees'])
  const currencyIdx = findIndex(headers, ['divisa', 'currency', 'moneda'])
  const descriptionIdx = findIndex(headers, ['descripcion', 'description'])
  const stateIdx = findIndex(headers, ['state', 'estado'])

  if (dateIdx < 0 || amountIdx < 0 || currencyIdx < 0) return { parsed: [], skipped: [] }

  const parsed: ParsedImportTransaction[] = []
  const skipped: SkippedImportTransaction[] = []
  const cashMovements: ParsedImportTransaction[] = []
  const metalRateCache = new Map<string, Promise<MetalRates | null>>()

  for (const row of rows.slice(1)) {
    const state = normalizeText(row[stateIdx]).toUpperCase()
    if (state && state !== 'COMPLETADO' && state !== 'COMPLETED') continue

    const metalSymbol = normalizeText(row[currencyIdx]).toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!METAL_SYMBOLS.has(metalSymbol)) continue

    const amount = parseNumber(row[amountIdx])
    const feeInUnits = Math.abs(parseNumber(row[feeIdx]))
    const rawDateKey = normalizeText(row[dateIdx])
    const date = parseDate(rawDateKey)
    const sourceTimestamp = parseSourceTimestamp(rawDateKey)
    const description = normalizeText(row[descriptionIdx])
    const operation: ImportOperation | null = amount > 0 ? 'Compra' : amount < 0 ? 'Venta' : null

    if (!date || !operation || !Number.isFinite(amount) || amount === 0) {
      if (rawDateKey || Number.isFinite(amount)) {
        skipped.push({ ticker: metalSymbol, fecha: normalizeText(row[dateIdx]), reason: 'Datos incompletos o cantidad cero' })
      }
      continue
    }

    const grossQuantity = Math.abs(amount)
    const quantity = operation === 'Compra' && Number.isFinite(feeInUnits)
      ? grossQuantity - feeInUnits
      : grossQuantity

    if (!Number.isFinite(quantity) || quantity <= 0) {
      skipped.push({ ticker: metalSymbol, fecha: date, reason: 'Cantidad neta inválida' })
      continue
    }

    const name = METAL_NAMES[metalSymbol] ?? metalSymbol
    let valueEur = await getMetalRowValueEur(
      metalSymbol,
      quantity,
      feeInUnits,
      operation,
      date,
      headers,
      row,
      metalRateCache
    )

    const conversionTarget = getConversionTargetCurrency(description)
    if (operation === 'Venta' && conversionTarget && METAL_SYMBOLS.has(conversionTarget)) {
      const pairedBuyRow = rows.slice(1).find(candidate => {
        const candidateState = normalizeText(candidate[stateIdx]).toUpperCase()
        if (candidateState && candidateState !== 'COMPLETADO' && candidateState !== 'COMPLETED') return false

        const candidateCurrency = normalizeText(candidate[currencyIdx]).toUpperCase().replace(/[^A-Z0-9]/g, '')
        const candidateAmount = parseNumber(candidate[amountIdx])
        const candidateRawDateKey = normalizeText(candidate[dateIdx])
        const candidateDate = parseDate(candidateRawDateKey)

        return (
          candidate !== row &&
          candidateCurrency === conversionTarget &&
          (candidateRawDateKey === rawDateKey || candidateDate === date) &&
          Number.isFinite(candidateAmount) &&
          candidateAmount > 0
        )
      })

      if (pairedBuyRow) {
        const pairedFeeInUnits = Math.abs(parseNumber(pairedBuyRow[feeIdx]))
        const pairedGrossQuantity = Math.abs(parseNumber(pairedBuyRow[amountIdx]))
        const pairedQuantity = Number.isFinite(pairedFeeInUnits)
          ? pairedGrossQuantity - pairedFeeInUnits
          : pairedGrossQuantity
        const pairedValueEur = await getMetalRowValueEur(
          conversionTarget,
          pairedQuantity,
          pairedFeeInUnits,
          'Compra',
          date,
          headers,
          pairedBuyRow,
          metalRateCache
        )
        if (pairedValueEur && pairedValueEur > 0) valueEur = pairedValueEur
      }
    }

    const effectiveUnitPriceEur = valueEur && valueEur > 0
      ? valueEur / quantity
      : Number.NaN

    if (!Number.isFinite(effectiveUnitPriceEur) || effectiveUnitPriceEur <= 0) {
      skipped.push({ ticker: metalSymbol, fecha: date, reason: 'No se pudo obtener el precio en EUR para esta fecha' })
      continue
    }

    const isMetalToMetal = conversionTarget != null
      && METAL_SYMBOLS.has(conversionTarget)
      && (
        conversionTarget !== metalSymbol
        || rows.slice(1).some((candidate) => {
          if (candidate === row) return false
          const candidateCurrency = normalizeText(candidate[currencyIdx]).toUpperCase().replace(/[^A-Z0-9]/g, '')
          const candidateAmount = parseNumber(candidate[amountIdx])
          const candidateTarget = getConversionTargetCurrency(normalizeText(candidate[descriptionIdx]))
          return candidateCurrency !== metalSymbol
            && METAL_SYMBOLS.has(candidateCurrency)
            && candidateAmount < 0
            && candidateTarget === metalSymbol
            && normalizeText(candidate[dateIdx]) === rawDateKey
        })
      )

    if (!isMetalToMetal && conversionTarget === metalSymbol && operation === 'Compra') {
      cashMovements.push(
        createCashMovement({
          userId,
          currency: 'EUR',
          operation: 'Compra',
          amount: valueEur!,
          date,
          sourceTimestamp,
          notes: externalFlowNote(valueEur!, `Compra de ${metalSymbol}`),
        }),
        createCashMovement({
          userId,
          currency: 'EUR',
          operation: 'Venta',
          amount: valueEur!,
          date,
          sourceTimestamp,
          notes: `[REVOLUT_CASH] Compra de ${metalSymbol}`,
        }),
      )
    } else if (!isMetalToMetal && conversionTarget && FIAT_SYMBOLS.has(conversionTarget) && operation === 'Venta') {
      cashMovements.push(
        createCashMovement({
          userId,
          currency: 'EUR',
          operation: 'Compra',
          amount: valueEur!,
          date,
          sourceTimestamp,
          notes: `[REVOLUT_CASH] Venta de ${metalSymbol}`,
        }),
        createCashMovement({
          userId,
          currency: 'EUR',
          operation: 'Venta',
          amount: valueEur!,
          date,
          sourceTimestamp,
          notes: externalFlowNote(valueEur!, `Retirada tras venta de ${metalSymbol}`),
        }),
      )
    }

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
      sourceTimestamp,
    })
  }

  return { parsed, skipped, cashMovements }
}

function parseInternalCryptoMovements(rows: string[][], userId: string): ParseResult {
  if (rows.length < 2) return { parsed: [], skipped: [] }

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

  if (!isCryptoAccountStatement || dateIdx < 0 || tickerIdx < 0 || typeIdx < 0 || qtyIdx < 0) return { parsed: [], skipped: [] }

  const parsed: ParsedImportTransaction[] = []
  const skipped: SkippedImportTransaction[] = []

  for (const row of rows.slice(1)) {
    const typeValue = normalizeText(row[typeIdx])
    if (normalizeOperationText(typeValue) !== 'staking') continue

    const rawTicker = normalizeText(row[tickerIdx])
    const date = parseDate(row[dateIdx])
    const quantity = Math.abs(parseNumber(row[qtyIdx]))

    if (!rawTicker || !date || !Number.isFinite(quantity) || quantity <= 0) {
      if (rawTicker || normalizeText(row[dateIdx])) {
        skipped.push({ ticker: rawTicker || 'Desconocido', fecha: normalizeText(row[dateIdx]), reason: 'Datos de staking incompletos' })
      }
      continue
    }

    const rawSymbol = rawTicker.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const price = parseNumber(row[priceIdx])
    const total = parseNumber(row[totalIdx])
    const precioUnitario = Number.isFinite(price) && price > 0
      ? price
      : Number.isFinite(total) && total !== 0
        ? Math.abs(total) / quantity
        : 0

    parsed.push({
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

  return { parsed, skipped }
}

function parseFixedRows(rows: string[][], userId: string): ParseResult {
  const parsed: ParsedImportTransaction[] = []
  const skipped: SkippedImportTransaction[] = []

  for (const cols of rows.slice(1)) {
    if (cols.length < 5) continue

    const rawDate = cols[0]
    const rawTicker = normalizeText(cols[1])
    const type = normalizeText(cols[2])
    const quantity = Math.abs(parseNumber(cols[3]))
    const price = parseNumber(cols[4])
    const date = parseDate(rawDate)
    const operation = inferOperation(type, '', quantity)

    if (!rawTicker || !date || !operation || !Number.isFinite(quantity) || quantity <= 0) {
      if (rawTicker || rawDate) {
        skipped.push({ ticker: rawTicker || 'Desconocido', fecha: normalizeText(rawDate), reason: 'Faltan datos requeridos (fecha, ticker, operación, cantidad)' })
      }
      continue
    }

    if (!Number.isFinite(price) || price <= 0) {
      skipped.push({ ticker: rawTicker, fecha: date, reason: 'Precio inválido o cero' })
      continue
    }

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

  return { parsed, skipped }
}

export async function POST(request: Request) {
  try {
    // Keep the existing parser/persistence engine as the single accounting source
    // of truth while allowing both cookie-authenticated web and bearer-authenticated
    // native clients to use it.
    const { supabase, user } = await requireMobileUser(request)

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
    const rows = isExcel
      ? await parseWorkbook(arrayBuffer)
      : parseCsv(new TextDecoder().decode(arrayBuffer))

    const mainResult = await parseRows(rows, user.id)
    const parsedTransactions = mainResult.parsed
    const cashMovements = mainResult.cashMovements ?? []
    const transactionsToProcess = [...parsedTransactions, ...cashMovements]
    let skippedTransactions = mainResult.skipped

    const cryptoResult = parseInternalCryptoMovements(rows, user.id)
    const internalCryptoMovements = cryptoResult.parsed
    skippedTransactions = skippedTransactions.concat(cryptoResult.skipped)

    let activos = await collectAllPages((from, to) => supabase
      .from('activos')
      .select('id, ticker, isin, tipo, sector, moneda')
      .eq('user_id', user.id)
      .order('id', { ascending: true })
      .range(from, to))

    let existingTransactions = await collectAllPages((from, to) => supabase
      .from('transacciones')
      .select('id, activo_id, tipo_operacion, cantidad, precio_unitario, comision, retencion_origen, retencion_destino, fecha, created_at, notas')
      .eq('user_id', user.id)
      .order('id', { ascending: true })
      .range(from, to))

    let removedInternalMovements = 0
    if (internalCryptoMovements.length > 0 && activos && existingTransactions) {
      const idsToDelete = new Set<string>()

      for (const movement of internalCryptoMovements) {
        const existingActivo = activos.find(a =>
          a.ticker === movement.ticker ||
          (movement.tipoActivo === 'Crypto' && a.ticker === movement.rawTicker)
        )
        if (!existingActivo) continue

        for (const existing of existingTransactions) {
          const isSameActivo = existing.activo_id === existingActivo.id
          const isSameType = existing.tipo_operacion === movement.tipo_operacion
          const isSameQty = Math.abs(existing.cantidad - movement.cantidad) < 0.00000001
          const isSamePrice = Math.abs(existing.precio_unitario - movement.precio_unitario) < 0.01
          const isSameDate = existing.fecha === movement.fecha

          if (isSameActivo && isSameType && isSameQty && isSamePrice && isSameDate) {
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
      }
    }

    if (transactionsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No se encontraron compraventas ni dividendos en este archivo.',
        newTransactions: 0,
        updatedTransactions: 0,
        ignoredDuplicates: 0,
        accountingMovements: 0,
        removedInternalMovements,
        imported: [],
        ignored: [],
      })
    }

    let newTxCount = 0
    let ignoredCount = 0
    let updatedTxCount = 0
    let accountingMovementsCount = 0
    let ignoredAccountingMovements = 0
    let updatedAccountingMovements = 0
    const toInsert = []
    const imported = []
    const ignored = []

    for (const tx of transactionsToProcess) {
      const includeInSummary = tx.includeInSummary !== false
      let activo_id = null
      const existingActivo = activos?.find(a =>
        a.ticker === tx.ticker ||
        (tx.isin != null && a.isin === tx.isin) ||
        ((tx.tipoActivo === 'Crypto' || tx.tipoActivo === 'Metal') && a.ticker === tx.rawTicker) ||
        (tx.tipoActivo === 'Metal' && getLegacyMetalTickers(tx.rawTicker).includes(a.ticker))
      )

      if (existingActivo) {
        activo_id = existingActivo.id
        const dbTipo = getDatabaseAssetType(tx.tipoActivo)
        if (existingActivo.ticker !== tx.ticker || (tx.isin != null && existingActivo.isin !== tx.isin) || existingActivo.tipo !== dbTipo || existingActivo.sector !== getAssetSector(tx.tipoActivo) || existingActivo.moneda !== tx.moneda) {
          await supabase
            .from('activos')
            .update({
              ticker: tx.ticker,
              ...(tx.isin ? { isin: tx.isin } : {}),
              nombre: tx.nombre,
              tipo: dbTipo,
              moneda: tx.moneda,
              sector: getAssetSector(tx.tipoActivo),
              geografia: getAssetGeography(tx.tipoActivo),
            })
            .eq('id', existingActivo.id)

          existingActivo.ticker = tx.ticker
          if (tx.isin) existingActivo.isin = tx.isin
          existingActivo.tipo = dbTipo
          existingActivo.sector = getAssetSector(tx.tipoActivo)
          existingActivo.moneda = tx.moneda
        }
      } else {
        const dbTipo = getDatabaseAssetType(tx.tipoActivo)
        const { data: newActivo, error: createError } = await supabase
          .from('activos')
          .insert({
            user_id: user.id,
            ticker: tx.ticker,
            isin: tx.isin ?? null,
            nombre: tx.nombre,
            tipo: dbTipo,
            estrategia: tx.tipoActivo === 'Liquidity' ? 'Core' : 'Satellite',
            moneda: tx.moneda,
            sector: getAssetSector(tx.tipoActivo),
            geografia: getAssetGeography(tx.tipoActivo),
          })
          .select('id, ticker, isin, tipo, sector, moneda')
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
        }
      }

      if (!activo_id) continue

      const matchingExisting = existingTransactions?.find(existing => {
        const isSameActivo = existing.activo_id === activo_id
        const isSameType = existing.tipo_operacion === tx.tipo_operacion
        const isSameQty = !includeInSummary || tx.tipo_operacion === 'Dividendo'
          || Math.abs(existing.cantidad - tx.cantidad) < 0.00000001
        const isSameDate = existing.fecha === tx.fecha
        const isSameSource = includeInSummary
          || !tx.sourceTimestamp
          || timestampsMatch(existing.created_at, tx.sourceTimestamp)
        return isSameActivo && isSameType && isSameQty && isSameDate && isSameSource
      })

      if (matchingExisting && !includeInSummary) {
        const shouldUpdate = Math.abs(matchingExisting.cantidad - tx.cantidad) >= 0.00000001
          || matchingExisting.notas !== tx.notas

        if (shouldUpdate) {
          const { error: updateError } = await supabase
            .from('transacciones')
            .update({ cantidad: tx.cantidad, notas: tx.notas ?? null })
            .eq('id', matchingExisting.id)
            .eq('user_id', user.id)

          if (updateError) {
            return NextResponse.json({
              error: `No se pudo actualizar la conciliación de efectivo: ${updateError.message}`,
            }, { status: 500 })
          }

          matchingExisting.cantidad = tx.cantidad
          matchingExisting.notas = tx.notas ?? null
          updatedAccountingMovements++
        } else {
          ignoredAccountingMovements++
        }
      } else if (matchingExisting && (tx.tipoActivo === 'Metal' || isNonCashReward(tx) || tx.tipo_operacion === 'Dividendo')) {
        const shouldUpdate =
          Math.abs(matchingExisting.precio_unitario - tx.precio_unitario) >= 0.01 ||
          Math.abs((matchingExisting.comision ?? 0) - tx.comision) >= 0.01 ||
          Math.abs((matchingExisting.retencion_origen ?? 0) - (tx.retencion_origen ?? 0)) >= 0.01 ||
          Math.abs((matchingExisting.retencion_destino ?? 0) - (tx.retencion_destino ?? 0)) >= 0.01 ||
          (tx.tipo_operacion !== 'Dividendo' && matchingExisting.notas !== tx.notas)

        if (shouldUpdate) {
          const { error: updateError } = await supabase
            .from('transacciones')
            .update({
              precio_unitario: tx.precio_unitario,
              comision: tx.comision,
              retencion_origen: tx.retencion_origen ?? 0,
              retencion_destino: tx.retencion_destino ?? 0,
              notas: tx.notas ?? null,
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
          matchingExisting.retencion_origen = tx.retencion_origen ?? 0
          matchingExisting.retencion_destino = tx.retencion_destino ?? 0
          matchingExisting.notas = tx.notas ?? null
          if (includeInSummary) {
            imported.push(tx)
            updatedTxCount++
          }
        } else {
          if (includeInSummary) {
            ignoredCount++
            ignored.push(tx)
          } else {
            ignoredAccountingMovements++
          }
        }
      } else if (matchingExisting && Math.abs(matchingExisting.precio_unitario - tx.precio_unitario) < 0.01) {
        if (includeInSummary) {
          ignoredCount++
          ignored.push(tx)
        } else {
          ignoredAccountingMovements++
        }
      } else {
        toInsert.push({
          ...toDatabaseTransaction(tx),
          activo_id,
          estado: 'Completada',
        })
        if (includeInSummary) {
          imported.push(tx)
          newTxCount++
        } else {
          accountingMovementsCount++
        }
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

    if (
      transactionsToProcess.length > 0
      && newTxCount === 0
      && ignoredCount === 0
      && updatedTxCount === 0
      && accountingMovementsCount === 0
      && ignoredAccountingMovements === 0
      && updatedAccountingMovements === 0
    ) {
      return NextResponse.json({
        error: `Se leyeron ${parsedTransactions.length} movimientos, pero no se pudo asociar ninguno a un activo.`,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      newTransactions: newTxCount,
      updatedTransactions: updatedTxCount,
      ignoredDuplicates: ignoredCount,
      accountingMovements: accountingMovementsCount,
      ignoredAccountingMovements,
      updatedAccountingMovements,
      removedInternalMovements,
      imported,
      ignored,
      skipped: skippedTransactions,
    })

  } catch (error: unknown) {
    console.error('Revolut Import Error:', error)
    if (error instanceof MobileApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unexpected import error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
