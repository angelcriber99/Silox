export type MyInvestorOperation = 'Compra' | 'Venta'
export type MyInvestorAssetType = 'Acción' | 'ETF' | 'Fondo Indexado'

export interface ResolvedMyInvestorAsset {
  ticker: string
  name: string
  type: MyInvestorAssetType
  currency: string
}

export interface ParsedMyInvestorTransaction {
  user_id: string
  ticker: string
  rawTicker: string
  nombre: string
  tipoActivo: MyInvestorAssetType
  moneda: string
  tipo_operacion: MyInvestorOperation
  cantidad: number
  precio_unitario: number
  fecha: string
  comision: number
  isin: string
}

export type MyInvestorAssetResolver = (isin: string, name: string) => Promise<ResolvedMyInvestorAsset>

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function header(value: unknown): string {
  return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

function column(headers: string[], candidates: string[]): number {
  return headers.findIndex((value) => candidates.includes(value))
}

function number(value: unknown): number {
  const raw = text(value).replace(/\s/g, '').replace(/[^\d,.\-]/g, '')
  if (!raw) return Number.NaN
  const comma = raw.lastIndexOf(',')
  const dot = raw.lastIndexOf('.')
  const decimal = comma > dot ? ',' : '.'
  return Number.parseFloat(raw.replace(new RegExp(`\\${decimal === ',' ? '.' : ','}`, 'g'), '').replace(decimal, '.'))
}

function date(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const raw = text(value)
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const local = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (!local) return null
  const year = local[3].length === 2 ? `20${local[3]}` : local[3]
  const parsed = new Date(`${year}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

function operation(value: string): MyInvestorOperation | null {
  const normalized = header(value)
  if (/compra|suscripcion|aportacion|entrada/.test(normalized)) return 'Compra'
  if (/venta|reembolso|rescate|salida/.test(normalized)) return 'Venta'
  return null
}

function findHeaderIndex(rows: string[][]): number {
  return rows.slice(0, 20).findIndex((row) => {
    const headers = row.map(header)
    const hasIsin = headers.includes('isin') || headers.includes('codigoisin')
    const hasDate = headers.some((value) => ['fechadelaorden', 'fechaorden', 'fechaoperacion', 'fechavalor', 'fecha'].includes(value))
    const hasUnits = headers.some((value) => ['ndeparticipaciones', 'numerodeparticipaciones', 'participaciones', 'titulos', 'cantidad', 'unidades'].includes(value))
    return hasIsin && hasDate && hasUnits
  })
}

export function isMyInvestorStatement(rows: string[][]): boolean {
  return findHeaderIndex(rows) >= 0
}

export async function parseMyInvestorStatement(
  rows: string[][],
  userId: string,
  resolveAsset: MyInvestorAssetResolver,
): Promise<ParsedMyInvestorTransaction[]> {
  const headerIndex = findHeaderIndex(rows)
  if (headerIndex < 0) return []

  const headers = rows[headerIndex].map(header)
  const dateIndex = column(headers, ['fechadelaorden', 'fechaorden', 'fechaoperacion', 'fechavalor', 'fecha'])
  const isinIndex = column(headers, ['isin', 'codigoisin'])
  const nameIndex = column(headers, ['fondo', 'producto', 'valor', 'instrumento', 'nombre', 'descripcion'])
  const operationIndex = column(headers, ['tipodeorden', 'tipoorden', 'tipodeoperacion', 'tipooperacion', 'operacion', 'tipo', 'movimiento', 'concepto'])
  const quantityIndex = column(headers, ['ndeparticipaciones', 'numerodeparticipaciones', 'participaciones', 'titulos', 'cantidad', 'unidades'])
  const amountIndex = column(headers, ['importeestimado', 'importeefectivo', 'importeejecutado', 'importe', 'efectivo', 'total'])
  const priceIndex = column(headers, ['precio', 'preciounitario', 'valorliquidativo', 'valoliquidativo'])
  const feeIndex = column(headers, ['comision', 'comisiones', 'gastos', 'gastosoperacion'])
  const stateIndex = column(headers, ['estado', 'status', 'situacion'])
  const currencyIndex = column(headers, ['divisa', 'moneda', 'currency'])
  const resolvedAssets = new Map<string, Promise<ResolvedMyInvestorAsset>>()
  const parsed: ParsedMyInvestorTransaction[] = []

  for (const row of rows.slice(headerIndex + 1)) {
    const isin = text(row[isinIndex]).toUpperCase().replace(/\s/g, '')
    if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) continue

    const state = header(row[stateIndex])
    if (state && !/finalizad|completad|ejecutad|confirmad|liquidad/.test(state)) continue

    const transactionDate = date(row[dateIndex])
    const transactionOperation = operation(text(row[operationIndex]))
    const quantity = Math.abs(number(row[quantityIndex]))
    const amount = Math.abs(number(row[amountIndex]))
    const explicitPrice = number(row[priceIndex])
    const unitPrice = Number.isFinite(explicitPrice) && explicitPrice > 0
      ? explicitPrice
      : Number.isFinite(amount) && amount > 0 && quantity > 0
        ? amount / quantity
        : Number.NaN

    if (!transactionDate || !transactionOperation || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) continue

    const statementName = text(row[nameIndex]) || isin
    if (!resolvedAssets.has(isin)) resolvedAssets.set(isin, resolveAsset(isin, statementName))
    const asset = await resolvedAssets.get(isin)!
    const currency = text(row[currencyIndex]).toUpperCase() || asset.currency || 'EUR'
    const fee = Math.abs(number(row[feeIndex]))

    parsed.push({
      user_id: userId,
      ticker: asset.ticker,
      rawTicker: isin,
      nombre: asset.name || statementName,
      tipoActivo: asset.type,
      moneda: currency,
      tipo_operacion: transactionOperation,
      cantidad: quantity,
      precio_unitario: unitPrice,
      fecha: transactionDate,
      comision: Number.isFinite(fee) ? fee : 0,
      isin,
    })
  }

  return parsed
}
