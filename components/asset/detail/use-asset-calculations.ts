import { useMemo, useState } from "react"
import type { EnrichedPosition } from '@/lib/types'

export interface RawTransaction {
  id: string
  fecha: string
  tipo_operacion: string  // 'Compra' | 'Venta' | 'Dividendo'
  cantidad: number
  precio_unitario: number
  comision: number
  notas: string | null
  created_at: string
  estado?: string
}

function buildTransactionTable(transactions: RawTransaction[], currentNativePrice: number | null) {
  let accumulated = 0
  return transactions.map((tx) => {
    const qty = Number(tx.cantidad) || 0
    const price = Number(tx.precio_unitario) || 0
    const total = qty * price
    const comision = Number(tx.comision) || 0

    if (tx.tipo_operacion === "Compra") accumulated += total
    else if (tx.tipo_operacion === "Venta") accumulated -= total

    const pnlPerUnit = currentNativePrice !== null ? currentNativePrice - price : null
    const pnlTotal = pnlPerUnit !== null ? pnlPerUnit * qty : null
    const pnlPct = price > 0 && pnlPerUnit !== null ? (pnlPerUnit / price) * 100 : null

    return {
      ...tx,
      total,
      comision,
      accumulated,
      pnlTotal: tx.tipo_operacion === "Compra" ? pnlTotal : null,
      pnlPct: tx.tipo_operacion === "Compra" ? pnlPct : null,
    }
  })
}

export function useAssetCalculations(position: EnrichedPosition, transactions: RawTransaction[]) {
  const [calculationTime] = useState(() => Date.now())
  // ── Sparkline 7d ──
  const sparklineData = useMemo(() => {
    if (!position.sparkline || position.sparkline.length < 2) return null
    const data = position.sparkline.map((val, i) => ({ i, price: val }))
    const first = position.sparkline[0]
    const last = position.sparkline[position.sparkline.length - 1]
    const change = first > 0 ? ((last - first) / first) * 100 : 0
    const isPositive = change >= 0
    return { data, change, isPositive, first, last }
  }, [position.sparkline])

  // ── Evolución Histórica ──
  const evolutionData = useMemo(() => {
    if (!transactions || transactions.length === 0) return []

    const sorted = [...transactions].sort((a, b) =>
      `${a.fecha}:${a.created_at}:${a.id}`.localeCompare(`${b.fecha}:${b.created_at}:${b.id}`)
    )

    let accUnits = 0
    let accDividends = 0
    const openLots: Array<{ quantity: number; unitCost: number }> = []
    const points: { date: string; invested: number; value: number; profit: number; isPurchase?: boolean }[] = []

    for (const tx of sorted) {
      const qty = Number(tx.cantidad) || 0
      const price = Number(tx.precio_unitario) || 0
      const comision = Number(tx.comision) || 0
      const total = qty * price

      if (tx.tipo_operacion === "Compra" || tx.tipo_operacion === "Traspaso Entrada") {
        accUnits += qty
        if (qty > 0) openLots.push({ quantity: qty, unitCost: (total + comision) / qty })
      } else if (tx.tipo_operacion === "Venta" || tx.tipo_operacion === "Traspaso Salida" || tx.tipo_operacion === "Retirada") {
        accUnits -= qty
        let remaining = qty
        while (remaining > 0.00000001 && openLots.length > 0) {
          const lot = openLots[0]
          const consumed = Math.min(lot.quantity, remaining)
          lot.quantity -= consumed
          remaining -= consumed
          if (lot.quantity <= 0.00000001) openLots.shift()
        }
      } else if (tx.tipo_operacion === "Dividendo") {
        accDividends += (total - comision)
      }

      const accCost = openLots.reduce((sum, lot) => sum + lot.quantity * lot.unitCost, 0)
      const inv = Math.max(0, Math.round(accCost * 100) / 100)
      const val = Math.max(0, Math.round(accUnits * price * 100) / 100)
      points.push({
        date: new Date(tx.fecha).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
        invested: inv,
        value: val,
        profit: Math.round((val - inv + accDividends) * 100) / 100,
        isPurchase: tx.tipo_operacion === "Compra" || tx.tipo_operacion === "Traspaso Entrada",
      })
    }

    if (position.precio_actual !== null && accUnits > 0) {
      const accCost = openLots.reduce((sum, lot) => sum + lot.quantity * lot.unitCost, 0)
      const inv = Math.max(0, Math.round(accCost * 100) / 100)
      const currentNativePrice = position.precio_actual_nativo ?? position.precio_actual
      const val = Math.max(0, Math.round(accUnits * currentNativePrice * 100) / 100)
      points.push({
        date: "Hoy",
        invested: inv,
        value: val,
        profit: Math.round((val - inv + accDividends) * 100) / 100,
        isPurchase: false,
      })
    }

    return points
  }, [transactions, position.precio_actual, position.precio_actual_nativo])

  // ── Aportaciones por Mes ──
  const monthlyContributionsData = useMemo(() => {
    if (!transactions || transactions.length === 0) return []

    const map = new Map<string, number>()
    for (const tx of transactions) {
      if (tx.tipo_operacion !== "Compra") continue
      const d = new Date(tx.fecha)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const total = (Number(tx.cantidad) || 0) * (Number(tx.precio_unitario) || 0)
      map.set(key, (map.get(key) || 0) + total)
    }

    let data = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => {
        const [y, m] = month.split('-')
        const d = new Date(Number(y), Number(m) - 1)
        return {
          month: d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
          amount: Math.round(amount),
          isInitialLumpSum: false
        }
      })

    if (data.length > 0) {
      if (data[0].amount > 3000) {
        data[0].isInitialLumpSum = true
        data = data.filter((_, i) => i !== 0)
      } else if (data.length > 2) {
        const amounts = data.map(d => d.amount).sort((a, b) => a - b)
        const median = amounts[Math.floor(amounts.length / 2)]
        if (data[0].amount > median * 5) {
          data[0].isInitialLumpSum = true
          data = data.filter((_, i) => i !== 0)
        }
      }
    }

    return data
  }, [transactions])

  // ── Estadísticas avanzadas ──
  const stats = useMemo(() => {
    const compras = transactions.filter(t => t.tipo_operacion === "Compra")
    const ventas = transactions.filter(t => t.tipo_operacion === "Venta")
    const dividendos = transactions.filter(t => t.tipo_operacion === "Dividendo")
    const totalComisiones = transactions.reduce((s, t) => s + (Number(t.comision) || 0), 0)
    const totalCompras = compras.reduce((s, t) => s + (Number(t.cantidad) || 0) * (Number(t.precio_unitario) || 0), 0)
    const totalVentas = ventas.reduce((s, t) => s + (Number(t.cantidad) || 0) * (Number(t.precio_unitario) || 0), 0)
    const totalDividendos = dividendos.reduce((s, t) => s + (Number(t.cantidad) || 0) * (Number(t.precio_unitario) || 0) - (Number(t.comision) || 0), 0)
    const gananciaIntereses = (position.valor_actual_nativo ?? 0) - position.coste_total + totalDividendos

    const precioMedio = position.precio_medio
    const precioActual = position.precio_actual_nativo ?? position.precio_actual ?? precioMedio
    const precioPorcentaje = precioMedio > 0 ? ((precioActual - precioMedio) / precioMedio) * 100 : 0

    const firstTxDate = compras.length > 0
      ? new Date(compras.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())[0].fecha)
      : null
    const yearsInvested = firstTxDate
      ? (calculationTime - firstTxDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      : 0
    const monthsInvested = Math.round(yearsInvested * 12)
    const cagr = yearsInvested > 0 && position.valor_actual_nativo && position.coste_total > 0
      ? (Math.pow(position.valor_actual_nativo / position.coste_total, 1 / yearsInvested) - 1) * 100
      : 0

    const avgMonthly = monthsInvested > 0 ? totalCompras / monthsInvested : 0

    const maxCompra = compras.reduce((max, t) => {
      const total = (Number(t.cantidad) || 0) * (Number(t.precio_unitario) || 0)
      return total > max ? total : max
    }, 0)
    return {
      numCompras: compras.length,
      numVentas: ventas.length,
      numDividendos: dividendos.length,
      totalCompras,
      totalVentas,
      totalDividendos,
      totalComisiones,
      gananciaIntereses,
      precioMedio,
      precioActual,
      precioPorcentaje,
      cagr,
      monthsInvested,
      avgMonthly,
      maxCompra,
      firstTxDate
    }
  }, [transactions, position, calculationTime])

  // ── Donuts ──
  const operacionesDonut = useMemo(() => [
    { name: "Compras", value: stats.numCompras, color: "#10b981" },
    { name: "Ventas", value: stats.numVentas, color: "#f43f5e" },
    { name: "Dividendos", value: stats.numDividendos, color: "#8b5cf6" },
  ].filter(d => d.value > 0), [stats.numCompras, stats.numVentas, stats.numDividendos])

  const capitalDonut = useMemo(() => {
    const invested = position.coste_total
    const interest = Math.max(0, (position.valor_actual_nativo ?? 0) - invested)
    return [
      { name: "Tu Dinero", value: Math.round(invested), color: "#3b82f6" },
      { name: "Intereses", value: Math.round(interest), color: "#10b981" },
    ]
  }, [position])

  // ── Tabla de transacciones con P&L ──
  const txTableData = useMemo(
    () => buildTransactionTable(transactions, position.precio_actual_nativo ?? position.precio_actual),
    [transactions, position.precio_actual, position.precio_actual_nativo],
  )

  return {
    sparklineData,
    evolutionData,
    monthlyContributionsData,
    stats,
    operacionesDonut,
    capitalDonut,
    txTableData
  }
}
