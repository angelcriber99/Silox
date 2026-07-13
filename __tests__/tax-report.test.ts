import { describe, expect, it } from "vitest"
import type { Transaccion } from "@/lib/types"
import { buildTaxReport, buildTaxReportFilename } from "@/lib/utils/tax-report"

function transaction(overrides: Partial<Transaccion>): Transaccion {
  return {
    id: "tx",
    activo_id: "asset-1",
    tipo_operacion: "Compra",
    cantidad: 1,
    precio_unitario: 10,
    comision: 0,
    retencion_origen: 0,
    retencion_destino: 0,
    estado: "Completada",
    fecha: "2026-01-01",
    notas: null,
    created_at: "2026-01-01T00:00:00.000Z",
    activo: {
      ticker: "ABC",
      nombre: "ABC SA",
      tipo: "Accion",
      moneda: "EUR",
    },
    ...overrides,
  }
}

describe("tax report", () => {
  it("builds reproducible totals for sales and dividends", () => {
    const report = buildTaxReport([
      transaction({ id: "buy", tipo_operacion: "Compra", cantidad: 2, precio_unitario: 10, comision: 1, fecha: "2025-01-10" }),
      transaction({ id: "sell", tipo_operacion: "Venta", cantidad: 1, precio_unitario: 15, comision: 0.5, fecha: "2026-02-10" }),
      transaction({ id: "div", tipo_operacion: "Dividendo", cantidad: 0, precio_unitario: 4, comision: 0.25, retencion_origen: 0.5, retencion_destino: 0.7, fecha: "2026-03-10" }),
    ], 2026, new Date("2026-07-13T10:00:00.000Z"))

    expect(report.schemaVersion).toBe("silox.tax-report.v1")
    expect(report.generatedAt).toBe("2026-07-13T10:00:00.000Z")
    expect(report.fiscalEventCount).toBe(1)
    expect(report.totals.saleValue).toBe(14.5)
    expect(report.totals.purchaseValue).toBe(10.5)
    expect(report.totals.net).toBe(4)
    expect(report.categories.dividends.net).toBe(2.55)
    expect(report.warnings).toEqual([])
  })

  it("warns when sales exceed available FIFO lots", () => {
    const report = buildTaxReport([
      transaction({ id: "buy", tipo_operacion: "Compra", cantidad: 1, precio_unitario: 10, fecha: "2026-01-10" }),
      transaction({ id: "sell", tipo_operacion: "Venta", cantidad: 2, precio_unitario: 15, fecha: "2026-02-10" }),
    ], 2026, new Date("2026-07-13T10:00:00.000Z"))

    expect(report.warnings.some((warning) => warning.code === "insufficient_fifo_lots")).toBe(true)
  })

  it("builds stable dated filenames", () => {
    expect(buildTaxReportFilename(2026, new Date("2026-07-13T10:00:00.000Z"))).toBe("silox-informe-fiscal-2026-2026-07-13.json")
  })
})
