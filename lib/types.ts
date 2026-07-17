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
  comisiones_total: number
  num_operaciones: number
  ultima_operacion: string | null
  notas: string | null
}

export interface EnrichedPosition extends Posicion {
  precio_actual: number | null
  precio_actual_nativo: number | null
  precio_actual_usd?: number | null
  original_currency: string | null
  valor_actual: number | null // in EUR
  valor_actual_nativo: number | null
  coste_total_eur: number
  pnl: number | null // in EUR
  pnl_percent: number | null // based on EUR
  precio_medio: number // in native currency
  sparkline: number[] // in EUR
  change_percent_24h: number | null // active market-session percentage
  daily_change_percent_24h: number | null // cumulative trading-day percentage
  change_amount_24h: number | null // cumulative trading-day amount
  change_amount_24h_nativo?: number | null
  market_state?: string
  price_updated_at?: string
  price_is_stale?: boolean
  market_session_ends_at?: string
  market_timezone?: string
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
  notas: string | null
  created_at: string
  activo?: {
    ticker: string
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
  totalValue: number
  totalCost: number
  totalPnl: number
  totalPnlPercent: number
  totalPnl24h: number
  /** Rendimiento del periodo activo (pre, regular o post). */
  totalPnlPercent24h: number
  totalSessionPnl: number
  totalDailyPnlPercent: number
  positionCount: number
  hasAllPrices: boolean
  estimatedPositionCount: number
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
}
