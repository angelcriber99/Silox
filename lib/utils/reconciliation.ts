import type { EnrichedPosition, Transaccion } from "@/lib/types"

export type ReconciliationSeverity = "info" | "warning" | "critical"

export interface ReconciliationIssue {
  id: string
  severity: ReconciliationSeverity
  title: string
  description: string
}

function transactionAmount(tx: Transaccion): number {
  const gross = tx.tipo_operacion === "Dividendo"
    ? tx.precio_unitario
    : tx.cantidad * tx.precio_unitario

  if (tx.tipo_operacion === "Compra" || tx.tipo_operacion === "Traspaso Entrada") {
    return gross + tx.comision
  }

  return Math.max(0, gross - tx.comision - (tx.retencion_origen ?? 0) - (tx.retencion_destino ?? 0))
}

export function getAvailableCashEur(positions: EnrichedPosition[]): number {
  return positions
    .filter((position) => position.ticker.startsWith("CASH") || position.tipo === "Liquidez")
    .reduce((sum, position) => sum + (position.valor_actual ?? position.coste_total_eur ?? 0), 0)
}

export function getPendingCashUseEur(pendingTxs: Transaccion[]): number {
  return pendingTxs.reduce((sum, tx) => {
    if (tx.tipo_operacion !== "Compra" && tx.tipo_operacion !== "Traspaso Entrada") return sum
    const fx = tx.activo?.moneda === "USD" ? 1.07 : 1
    return sum + (transactionAmount(tx) / fx)
  }, 0)
}

export function findOversoldAssets(transactions: Transaccion[]): ReconciliationIssue[] {
  const byAsset = new Map<string, Transaccion[]>()

  for (const tx of transactions) {
    if (tx.activo?.ticker === "CASH" || tx.activo?.ticker === "EFECTIVO" || tx.activo?.tipo === "Efectivo") continue
    const list = byAsset.get(tx.activo_id) ?? []
    list.push(tx)
    byAsset.set(tx.activo_id, list)
  }

  const issues: ReconciliationIssue[] = []

  for (const [assetId, txs] of byAsset) {
    let runningUnits = 0
    const sorted = [...txs].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

    for (const tx of sorted) {
      if (tx.estado === "Pendiente") continue

      if (tx.tipo_operacion === "Compra" || tx.tipo_operacion === "Traspaso Entrada") {
        runningUnits += tx.cantidad
      } else if (tx.tipo_operacion === "Venta" || tx.tipo_operacion === "Traspaso Salida") {
        runningUnits -= tx.cantidad
      }

      if (runningUnits < -0.000001) {
        const ticker = tx.activo?.ticker ?? assetId
        // Ignore negative cash in this critical check; it's handled as a warning below
        if (ticker.startsWith('CASH') || tx.activo?.tipo === 'Liquidez' || tx.activo?.tipo === 'Fondo Monetario') {
          continue
        }
        issues.push({
          id: `oversold-${assetId}`,
          severity: "critical",
          title: `Venta sin unidades suficientes en ${ticker}`,
          description: `El histórico queda en ${runningUnits.toFixed(6)} unidades tras la operación del ${tx.fecha}. Revisa compras, traspasos o duplicados.`,
        })
        break
      }
    }
  }

  return issues
}

export function reconcilePortfolio({
  positions,
  transactions,
  pendingTxs = [],
}: {
  positions: EnrichedPosition[]
  transactions: Transaccion[]
  pendingTxs?: Transaccion[]
}): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = []

  const negativeCash = positions.filter((position) =>
    (position.ticker.startsWith("CASH") || position.tipo === "Liquidez") &&
    (position.unidades < -0.000001 || position.coste_total_eur < -0.01)
  )

  if (negativeCash.length > 0) {
    issues.push({
      id: "negative-cash",
      severity: "warning",
      title: "Liquidez negativa detectada",
      description: "Silox oculta la liquidez negativa en el total para no distorsionar la cartera. Revisa ingresos, retiradas o compras pagadas con efectivo.",
    })
  }

  const availableCash = getAvailableCashEur(positions)
  const pendingCashUse = getPendingCashUseEur(pendingTxs)

  if (pendingCashUse > availableCash + 0.01) {
    issues.push({
      id: "pending-cash-overuse",
      severity: "warning",
      title: "Órdenes pendientes por encima de la liquidez",
      description: `Las órdenes pendientes consumen ${pendingCashUse.toFixed(2)} EUR frente a ${availableCash.toFixed(2)} EUR disponibles.`,
    })
  }

  issues.push(...findOversoldAssets(transactions))

  return issues
}
