"use client"

import { MinimalDashboard } from "@/components/dashboard/minimal-dashboard"
import type { EnrichedPosition, PortfolioTotals } from "@/lib/types"

const updatedAt = "2026-07-16T14:38:12.000Z"

function position(
  overrides: Partial<EnrichedPosition> &
    Pick<EnrichedPosition, "activo_id" | "ticker" | "nombre" | "tipo" | "moneda" | "unidades" | "coste_total" | "valor_actual" | "pnl" | "pnl_percent" | "change_amount_24h" | "daily_change_percent_24h" | "change_percent_24h" | "precio_actual" | "precio_actual_nativo" | "sparkline">,
): EnrichedPosition {
  return {
    isin: null,
    estrategia: "Core",
    sector: "Diversificado",
    geografia: "Global",
    comisiones_total: 0,
    num_operaciones: 1,
    ultima_operacion: "2026-07-14T10:00:00.000Z",
    notas: null,
    original_currency: overrides.moneda,
    valor_actual_nativo: overrides.valor_actual,
    coste_total_eur: overrides.coste_total,
    precio_medio: overrides.coste_total / overrides.unidades,
    change_amount_24h_nativo: overrides.change_amount_24h,
    market_state: "REGULAR",
    price_updated_at: updatedAt,
    price_is_stale: false,
    market_session_ends_at: "2026-07-16T20:00:00.000Z",
    market_timezone: "America/New_York",
    ...overrides,
  }
}

const previewPositions: EnrichedPosition[] = [
  position({
    activo_id: "preview-msci",
    ticker: "MSCI",
    nombre: "MSCI World Index Fund",
    tipo: "Fondo Indexado",
    moneda: "EUR",
    unidades: 2342.435,
    coste_total: 27241.81,
    precio_actual: 11.86,
    precio_actual_nativo: 11.86,
    valor_actual: 27781.04,
    pnl: 539.23,
    pnl_percent: 1.98,
    change_amount_24h: 82.46,
    daily_change_percent_24h: 0.3,
    change_percent_24h: 0.18,
    market_state: "OPEN",
    market_timezone: "Europe/Madrid",
    sparkline: [11.71, 11.73, 11.72, 11.76, 11.78, 11.8, 11.79, 11.83, 11.86],
  }),
  position({
    activo_id: "preview-nvo",
    ticker: "NVO",
    nombre: "Novo Nordisk A/S ADR",
    tipo: "Acción",
    moneda: "USD",
    unidades: 59.349049,
    coste_total: 2529.69,
    precio_actual: 43.38,
    precio_actual_nativo: 50.12,
    valor_actual: 2574.79,
    pnl: 45.1,
    pnl_percent: 1.78,
    change_amount_24h: 26.32,
    daily_change_percent_24h: 1.03,
    change_percent_24h: 0.62,
    sparkline: [48.9, 49.2, 49.05, 49.45, 49.6, 49.42, 49.81, 50.12],
  }),
  position({
    activo_id: "preview-zeta",
    ticker: "ZETA",
    nombre: "Zeta Global Holdings Corp.",
    tipo: "Acción",
    moneda: "USD",
    unidades: 86.268201,
    coste_total: 1490.13,
    precio_actual: 19.14,
    precio_actual_nativo: 22.13,
    valor_actual: 1651.18,
    pnl: 161.05,
    pnl_percent: 10.81,
    change_amount_24h: 38.54,
    daily_change_percent_24h: 2.39,
    change_percent_24h: 1.14,
    sparkline: [20.8, 21.02, 20.95, 21.36, 21.52, 21.4, 21.82, 22.13],
  }),
  position({
    activo_id: "preview-asts",
    ticker: "ASTS",
    nombre: "AST SpaceMobile, Inc.",
    tipo: "Acción",
    moneda: "USD",
    unidades: 26.710299,
    coste_total: 1973.96,
    precio_actual: 60.32,
    precio_actual_nativo: 69.71,
    valor_actual: 1611.18,
    pnl: -362.78,
    pnl_percent: -18.38,
    change_amount_24h: -41.62,
    daily_change_percent_24h: -2.52,
    change_percent_24h: -1.27,
    sparkline: [72.5, 72.1, 71.8, 71.9, 70.82, 70.4, 70.1, 69.71],
  }),
  position({
    activo_id: "preview-baba",
    ticker: "BABA",
    nombre: "Alibaba Group Holding Limited",
    tipo: "Acción",
    moneda: "USD",
    unidades: 13.267213,
    coste_total: 1104.29,
    precio_actual: 99.08,
    precio_actual_nativo: 114.51,
    valor_actual: 1314.41,
    pnl: 210.12,
    pnl_percent: 19.03,
    change_amount_24h: 18.78,
    daily_change_percent_24h: 1.45,
    change_percent_24h: 0.88,
    sparkline: [111.2, 111.9, 112.3, 112.1, 113.25, 113.8, 114.06, 114.51],
  }),
  position({
    activo_id: "preview-wyfi",
    ticker: "WYFI",
    nombre: "WhiteFiber Inc.",
    tipo: "Acción",
    moneda: "USD",
    unidades: 36.864722,
    coste_total: 1189.05,
    precio_actual: 33.12,
    precio_actual_nativo: 38.28,
    valor_actual: 1220.84,
    pnl: 31.79,
    pnl_percent: 2.67,
    change_amount_24h: 12.28,
    daily_change_percent_24h: 1.02,
    change_percent_24h: 0.54,
    sparkline: [37.45, 37.61, 37.52, 37.88, 37.94, 38.08, 38.02, 38.28],
  }),
  position({
    activo_id: "preview-cash",
    ticker: "CASH",
    nombre: "Liquidez disponible",
    tipo: "Liquidez",
    moneda: "EUR",
    unidades: 4280,
    coste_total: 4280,
    precio_actual: 1,
    precio_actual_nativo: 1,
    valor_actual: 4280,
    pnl: 0,
    pnl_percent: 0,
    change_amount_24h: 0,
    daily_change_percent_24h: 0,
    change_percent_24h: 0,
    market_state: "CLOSED",
    market_timezone: "Europe/Madrid",
    sparkline: [1, 1, 1, 1, 1, 1],
  }),
]

const previewTotals: PortfolioTotals = {
  totalValue: previewPositions.reduce((total, item) => total + (item.valor_actual ?? 0), 0),
  totalCost: previewPositions.reduce((total, item) => total + item.coste_total_eur, 0),
  totalPnl: previewPositions.reduce((total, item) => total + (item.pnl ?? 0), 0),
  totalPnlPercent: 1.83,
  totalPnl24h: previewPositions.reduce((total, item) => total + (item.change_amount_24h ?? 0), 0),
  totalPnlPercent24h: 0.42,
  totalDailyPnlPercent: 0.42,
  positionCount: previewPositions.length,
  hasAllPrices: true,
}

export function DashboardPreview() {
  return (
    <MinimalDashboard
      positions={previewPositions}
      totals={previewTotals}
      loading={false}
      marketState="REGULAR"
      pricesUpdatedAt={updatedAt}
      realtimeStatus="connected"
      pendingTransactions={[]}
      onRefresh={() => undefined}
      onAddTransaction={() => undefined}
      onEditAsset={() => undefined}
      onAddEvent={() => undefined}
      onEditEvent={() => undefined}
    />
  )
}
