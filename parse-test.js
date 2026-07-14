import fs from 'fs'

const METAL_SYMBOLS = new Set(['XAG', 'XAU', 'XPD', 'XPT'])
const METAL_NAMES = {
  XAG: 'Silver',
  XAU: 'Gold',
  XPD: 'Palladium',
  XPT: 'Platinum',
}
const METAL_YAHOO_TICKERS = {
  XAG: 'SI=F',
  XAU: 'GC=F',
  XPD: 'PA=F',
  XPT: 'PL=F',
}
const METAL_RATE_CODES = {
  XAG: 'xag',
  XAU: 'xau',
  XPD: 'xpd',
  XPT: 'xpt',
}

function normalizeText(value) {
  return String(value ?? '').trim()
}
function normalizeHeader(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}
function parseNumber(value) {
  const raw = normalizeText(value)
  if (!raw) return Number.NaN
  const cleaned = raw.replace(/\s/g, '').replace(/[^\d,.\-]/g, '')
  if (!cleaned) return Number.NaN
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  const decimalSeparator = lastComma > lastDot ? ',' : '.'
  const normalized = cleaned
    .replace(new RegExp(`\\${decimalSeparator === ',' ? '.' : ','}`, 'g'), '')
    .replace(decimalSeparator, '.')
  return parseFloat(normalized)
}
function parseDate(value) {
  const raw = normalizeText(value)
  if (!raw) return null
  const isoLike = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoLike) return `${isoLike[1]}-${isoLike[2]}-${isoLike[3]}`
  return null
}
function parseCsv(text) {
  const rows = []
  let row = []
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
function findIndex(headers, candidates) {
  return headers.findIndex(header => candidates.includes(header))
}
function getConversionTargetCurrency(description) {
  const normalized = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()
  const match = normalized.match(/CONVERSION A ([A-Z]{3})/)
  return match?.[1] ?? null
}

async function testParse() {
  const fileData = fs.readFileSync('/Users/angel/Downloads/metales.csv', 'utf-8')
  const rows = parseCsv(fileData)
  const headers = rows[0].map(normalizeHeader)
  
  const dateIdx = findIndex(headers, ['fechadefinalizacion', 'fechadeinicio', 'date', 'fecha'])
  const amountIdx = findIndex(headers, ['importe', 'amount'])
  const feeIdx = findIndex(headers, ['comision', 'commission', 'fee', 'fees'])
  const currencyIdx = findIndex(headers, ['divisa', 'currency', 'moneda'])
  const descriptionIdx = findIndex(headers, ['descripcion', 'description'])
  const stateIdx = findIndex(headers, ['state', 'estado'])

  const parsed = []
  for (const row of rows.slice(1)) {
    const state = normalizeText(row[stateIdx]).toUpperCase()
    if (state && state !== 'COMPLETADO' && state !== 'COMPLETED') continue

    const metalSymbol = normalizeText(row[currencyIdx]).toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!METAL_SYMBOLS.has(metalSymbol)) continue

    const amount = parseNumber(row[amountIdx])
    const feeInUnits = Math.abs(parseNumber(row[feeIdx]))
    const date = parseDate(row[dateIdx])
    const description = normalizeText(row[descriptionIdx])
    const operation = amount > 0 ? 'Compra' : amount < 0 ? 'Venta' : null

    if (!date || !operation || !Number.isFinite(amount) || amount === 0) continue

    const grossQuantity = Math.abs(amount)
    const quantity = operation === 'Compra' && Number.isFinite(feeInUnits) ? grossQuantity - feeInUnits : grossQuantity

    const name = METAL_NAMES[metalSymbol] ?? metalSymbol
    
    // Simulate API fetch
    const response = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/eur.json`)
    let valueEur = null
    if (response.ok) {
        const data = await response.json()
        const rate = data.eur[METAL_RATE_CODES[metalSymbol]]
        if (rate > 0) valueEur = (1 / rate) * (operation === 'Compra' ? grossQuantity : quantity)
    }

    const conversionTarget = getConversionTargetCurrency(description)
    if (operation === 'Venta' && conversionTarget && METAL_SYMBOLS.has(conversionTarget)) {
       // logic for paired row...
    }

    const effectiveUnitPriceEur = valueEur && valueEur > 0 ? valueEur / quantity : Number.NaN

    if (!Number.isFinite(effectiveUnitPriceEur) || effectiveUnitPriceEur <= 0) {
      console.log(`Skipped row because of invalid unit price: valueEur=${valueEur} qty=${quantity}`)
      continue
    }

    parsed.push({
      ticker: METAL_YAHOO_TICKERS[metalSymbol] ?? metalSymbol,
      operation,
      quantity,
      price: effectiveUnitPriceEur,
      date
    })
  }
  
  console.log('Parsed:', parsed)
}

testParse()
