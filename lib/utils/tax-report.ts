import type { Transaccion } from "@/lib/types"
import { calculateFIFO, type TaxEvent } from "@/lib/utils/fifo-calculator"

export type TaxReportCategory = "stocks" | "funds" | "crypto" | "dividends"
export type TaxReportWarningCode =
  | "no_transactions"
  | "no_tax_activity"
  | "missing_cost_basis"
  | "insufficient_fifo_lots"

export interface TaxReportTotals {
  gains: number
  losses: number
  net: number
  saleValue: number
  purchaseValue: number
  retencionOrigen: number
  retencionDestino: number
}

export interface TaxReportDividend {
  transactionId: string
  ticker: string
  nombre: string
  fecha: string
  gross: number
  fees: number
  retencionOrigen: number
  retencionDestino: number
  baseImponible: number
  net: number
}

export interface TaxReportDividendTotals {
  gross: number
  fees: number
  retencionOrigen: number
  retencionDestino: number
  baseImponible: number
  net: number
}

export interface TaxReportWarning {
  code: TaxReportWarningCode
  message: string
  assetId?: string
  ticker?: string
  transactionId?: string
  quantity?: number
  availableQuantity?: number
}

export interface TaxReport {
  schemaVersion: "silox.tax-report.v1"
  generatedAt: string
  year: number
  transactionCount: number
  fiscalEventCount: number
  totals: TaxReportTotals
  categories: Record<TaxReportCategory, TaxReportTotals | TaxReportDividendTotals>
  events: TaxEvent[]
  dividends: TaxReportDividend[]
  warnings: TaxReportWarning[]
}

function zeroTotals(): TaxReportTotals {
  return {
    gains: 0,
    losses: 0,
    net: 0,
    saleValue: 0,
    purchaseValue: 0,
    retencionOrigen: 0,
    retencionDestino: 0,
  }
}

function getTotalsForEvents(events: TaxEvent[]): TaxReportTotals {
  return events.reduce((totals, event) => {
    if (event.gananciaPatrimonial > 0) totals.gains += event.gananciaPatrimonial
    else totals.losses += Math.abs(event.gananciaPatrimonial)

    totals.saleValue += event.ingresoVenta || 0
    totals.purchaseValue += event.costeAdquisicion || 0
    totals.retencionOrigen += event.retencionOrigen || 0
    totals.retencionDestino += event.retencionDestino || 0
    totals.net = totals.gains - totals.losses
    return totals
  }, zeroTotals())
}

function getDividendAmount(transaction: Transaccion): number {
  return Number(transaction.precio_unitario || 0)
}

function getDividendReport(transaction: Transaccion): TaxReportDividend {
  const gross = getDividendAmount(transaction)
  const fees = Number(transaction.comision || 0)
  const retencionOrigen = Number(transaction.retencion_origen || 0)
  const retencionDestino = Number(transaction.retencion_destino || 0)
  const baseImponible = gross - fees

  return {
    transactionId: transaction.id,
    ticker: transaction.activo?.ticker ?? "N/A",
    nombre: transaction.activo?.nombre ?? transaction.activo?.ticker ?? "Activo desconocido",
    fecha: transaction.fecha,
    gross,
    fees,
    retencionOrigen,
    retencionDestino,
    baseImponible,
    net: baseImponible - retencionOrigen - retencionDestino,
  }
}

function getDividendTotals(dividends: TaxReportDividend[]): TaxReportDividendTotals {
  return dividends.reduce(
    (totals, dividend) => {
      totals.gross += dividend.gross
      totals.fees += dividend.fees
      totals.retencionOrigen += dividend.retencionOrigen
      totals.retencionDestino += dividend.retencionDestino
      totals.baseImponible += dividend.baseImponible
      totals.net += dividend.net
      return totals
    },
    { gross: 0, fees: 0, retencionOrigen: 0, retencionDestino: 0, baseImponible: 0, net: 0 },
  )
}

function isFund(event: TaxEvent): boolean {
  return event.tipoActivo === "Fondo Indexado" || event.tipoActivo === "Fondo Monetario"
}

function isCash(transaction: Transaccion): boolean {
  return transaction.activo?.tipo === "Efectivo"
    || transaction.activo?.ticker === "EFECTIVO"
    || transaction.activo?.ticker === "CASH"
}

function getInsufficientLotWarnings(transactions: Transaccion[], year: number): TaxReportWarning[] {
  const warnings: TaxReportWarning[] = []
  const txByAsset = transactions.reduce<Record<string, Transaccion[]>>((acc, transaction) => {
    if (isCash(transaction)) return acc
    if (!acc[transaction.activo_id]) acc[transaction.activo_id] = []
    acc[transaction.activo_id].push(transaction)
    return acc
  }, {})

  for (const [assetId, assetTransactions] of Object.entries(txByAsset)) {
    let availableQuantity = 0
    const sorted = [...assetTransactions].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

    for (const transaction of sorted) {
      if (transaction.tipo_operacion === "Compra" || transaction.tipo_operacion === "Traspaso Entrada") {
        availableQuantity += Number(transaction.cantidad || 0)
        continue
      }

      if (transaction.tipo_operacion !== "Venta" && transaction.tipo_operacion !== "Traspaso Salida") {
        continue
      }

      const quantity = Number(transaction.cantidad || 0)
      const fiscalYear = new Date(transaction.fecha).getFullYear()
      if (quantity > availableQuantity + 0.000001 && fiscalYear === year) {
        warnings.push({
          code: "insufficient_fifo_lots",
          message: "La venta supera las unidades compradas registradas antes de esa fecha.",
          assetId,
          ticker: transaction.activo?.ticker,
          transactionId: transaction.id,
          quantity,
          availableQuantity,
        })
      }

      availableQuantity = Math.max(0, availableQuantity - quantity)
    }
  }

  return warnings
}

export function buildTaxReport(transactions: Transaccion[], year: number, generatedAt = new Date()): TaxReport {
  const allEvents = calculateFIFO(transactions)
  const events = allEvents.filter((event) => event.añoFiscal === year)
  const stockEvents = events.filter((event) => !isFund(event) && event.tipoActivo !== "Crypto")
  const fundEvents = events.filter(isFund)
  const cryptoEvents = events.filter((event) => event.tipoActivo === "Crypto")
  const dividends = transactions
    .filter((transaction) => (
      transaction.tipo_operacion === "Dividendo"
      && new Date(transaction.fecha).getFullYear() === year
      && transaction.activo?.tipo !== "Fondo Monetario"
    ))
    .map(getDividendReport)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  const warnings: TaxReportWarning[] = []
  if (transactions.length === 0) {
    warnings.push({ code: "no_transactions", message: "No hay transacciones registradas para generar el informe." })
  }

  if (events.length === 0 && dividends.length === 0) {
    warnings.push({ code: "no_tax_activity", message: "No hay ventas ni dividendos fiscales para el ano seleccionado." })
  }

  events
    .filter((event) => event.ingresoVenta > 0 && event.costeAdquisicion <= 0)
    .forEach((event) => {
      warnings.push({
        code: "missing_cost_basis",
        message: "El evento fiscal tiene ingreso de venta pero base de coste cero.",
        assetId: event.activoId,
        ticker: event.ticker,
      })
    })

  warnings.push(...getInsufficientLotWarnings(transactions, year))

  return {
    schemaVersion: "silox.tax-report.v1",
    generatedAt: generatedAt.toISOString(),
    year,
    transactionCount: transactions.length,
    fiscalEventCount: events.length,
    totals: getTotalsForEvents(events),
    categories: {
      stocks: getTotalsForEvents(stockEvents),
      funds: getTotalsForEvents(fundEvents),
      crypto: getTotalsForEvents(cryptoEvents),
      dividends: getDividendTotals(dividends),
    },
    events,
    dividends,
    warnings,
  }
}

export function buildTaxReportFilename(year: number, generatedAt = new Date()): string {
  return `silox-informe-fiscal-${year}-${generatedAt.toISOString().slice(0, 10)}.json`
}
