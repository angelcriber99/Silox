export interface Posicion {
  activo_id: string
  ticker: string
  isin: string | null
  nombre: string | null
  tipo: string
  estrategia: string
  moneda: string
  sector: string
  geografia: string
  unidades: number
  coste_total: number
  dinero_invertido?: number
  coste_total_eur_historico?: number
  dinero_invertido_eur_historico?: number
  comisiones_total: number
  num_operaciones: number
  ultima_operacion: string | null
  notas: string | null
  has_daily_activity?: boolean
  daily_net_units?: number
  daily_net_flow_nativo?: number
  daily_net_flow_eur?: number | null
  accounting_unit_mismatch?: boolean
}

export type Currency = 'EUR' | 'USD' | string

export interface Money {
  amount: number
  currency: Currency
}

export interface EnrichedPosition extends Posicion {
  precio_actual: number | null
  precio_actual_nativo: number | null
  precio_actual_usd?: number | null
  original_currency: string | null
  
  nativeValue: Money | null
  displayValue: Money | null
  nativeCost: Money
  displayCost: Money
  nativeInvested: Money | null
  displayInvested: Money | null
  nativePnl: Money | null
  displayPnl: Money | null
  
  nativeDailyPnL: Money | null
  displayDailyPnL: Money | null
  
  nativeDailyBaseline: Money | null
  displayDailyBaseline: Money | null
  pnl_percent: number | null // based on EUR
  precio_medio: number // in native currency
  sparkline: number[] // in EUR
  change_percent_24h: number | null // active market-session percentage
  daily_change_percent_24h: number | null // cumulative trading-day percentage
  market_state?: string
  price_updated_at?: string
  price_is_stale?: boolean
  market_session_ends_at?: string
  market_timezone?: string
  price_kind?: 'INTRADAY' | 'NAV' | 'FIXED'
  price_source?: string
}

export interface Transaccion {
  id: string
  activo_id: string
  tipo_operacion: 'Compra' | 'Venta' | 'Dividendo' | 'Traspaso Salida' | 'Traspaso Entrada' | 'Retirada'
  cantidad: number
  precio_unitario: number
  comision: number
  retencion_origen?: number
  retencion_origen_moneda?: string
  retencion_destino?: number
  retencion_destino_moneda?: string
  estado?: 'Completada' | 'Pendiente'
  fecha: string
  tipo_cambio_eur?: number | null
  notas: string | null
  created_at: string
  activo?: {
    ticker: string
    isin: string | null
    nombre: string | null
    tipo: string
    moneda: string
  }
}

export interface Activo {
  id: string
  ticker: string
  isin: string | null
  nombre: string | null
  tipo: string
  estrategia: string
  moneda: string
  sector: string
  geografia: string
  notas: string | null
  created_at: string
  updated_at: string
}

export interface EventoRecurrente {
  id: string
  activo_id: string
  titulo: string
  dia_del_mes: number
  tipo: string
  created_at: string
  activo?: {
    ticker: string
    nombre: string | null
    tipo: string
  }
}

export interface PortfolioTotals {
  valueMoney: Money
  costMoney: Money
  netContributionsMoney?: Money
  pnlMoney: Money
  pnl24hMoney: Money
  sessionPnlMoney: Money
  
  totalPnlPercent: number
  totalPnlPercent24h: number
  totalDailyPnlPercent: number
  dailyPerformancePositionCount: number
  positionCount: number
  hasAllPrices: boolean
  estimatedPositionCount: number
  /** Ledger/database unit divergences. A non-zero value requires reconciliation. */
  accountingIssueCount?: number
}

export interface PriceData {
  price: number | null
  sparkline: number[]
  originalPrice?: number | null
  priceUsd?: number | null
  originalCurrency?: string
  changePercent24h?: number | null // active market-session percentage
  dailyChangePercent24h?: number | null // cumulative trading-day percentage
  marketState?: string
  latestTime?: string
  exchangeTimezone?: string
  sessionStart?: string
  sessionEnd?: string
  nextTransition?: string
  isStale?: boolean
  marketDate?: string
  priceKind?: 'INTRADAY' | 'NAV' | 'FIXED'
  priceSource?: string
}
