export interface Posicion {
  activo_id: string
  ticker: string
  isin: string | null
  nombre: string | null
  tipo: string
  estrategia: string
  moneda: string
  unidades: number
  coste_total: number
  comisiones_total: number
  num_operaciones: number
  ultima_operacion: string | null
}

export interface EnrichedPosition extends Posicion {
  precio_actual: number | null
  precio_actual_nativo: number | null
  original_currency: string | null
  valor_actual: number | null // in EUR
  valor_actual_nativo: number | null
  coste_total_eur: number
  pnl: number | null // in EUR
  pnl_percent: number | null // based on EUR
  precio_medio: number // in native currency
  sparkline: number[] // in EUR
}

export interface Transaccion {
  id: string
  activo_id: string
  tipo_operacion: 'Compra' | 'Venta'
  cantidad: number
  precio_unitario: number
  comision: number
  fecha: string
  notas: string | null
  created_at: string
  activo?: {
    ticker: string
    nombre: string | null
    tipo: string
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
  positionCount: number
  hasAllPrices: boolean
}

export interface PriceData {
  price: number | null
  sparkline: number[]
  originalPrice?: number | null
  originalCurrency?: string
}
