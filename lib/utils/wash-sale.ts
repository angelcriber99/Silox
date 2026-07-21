import { calculateFIFO } from './fifo-calculator'
import type { Transaccion } from '@/lib/types'

export interface WashSaleWarning {
  hasWarning: boolean
  safeBuyDate?: string
  saleDate?: string
}

export function checkPendingWashSale(transactions: Transaccion[], newBuyDate: string): WashSaleWarning {
  if (!transactions || transactions.length === 0) return { hasWarning: false }

  // 1. Calculamos las ventas históricas y sus ganancias/pérdidas
  const events = calculateFIFO(transactions)
  
  const buyDateMs = new Date(newBuyDate).getTime()
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000

  // 2. Buscamos si hay alguna venta con pérdida en los últimos 60 días
  // Los eventos de calculateFIFO vienen ordenados por fecha descendente (más recientes primero)
  for (const event of events) {
    if (event.gananciaPatrimonial < -0.01) {
      const saleDateMs = new Date(event.fechaVenta).getTime()
      
      // La regla aplica si compramos dentro de los 2 meses siguientes a la venta
      if (saleDateMs <= buyDateMs && (buyDateMs - saleDateMs) <= sixtyDaysMs) {
        // La fecha segura es 61 días después de la venta
        const safeDateMs = saleDateMs + (61 * 24 * 60 * 60 * 1000)
        const safeBuyDate = new Date(safeDateMs).toISOString().split('T')[0]
        
        return {
          hasWarning: true,
          safeBuyDate,
          saleDate: event.fechaVenta
        }
      }
    }
  }

  return { hasWarning: false }
}
