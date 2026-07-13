import type { Transaccion } from "@/lib/types"

const CSV_HEADERS = [
  "id",
  "fecha",
  "tipo_operacion",
  "estado",
  "ticker",
  "nombre",
  "tipo_activo",
  "moneda",
  "cantidad",
  "precio_unitario",
  "comision",
  "retencion_origen",
  "retencion_destino",
  "notas",
  "created_at",
] as const

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  const raw = String(value)
  if (!/[",\n\r]/.test(raw)) return raw
  return `"${raw.replace(/"/g, '""')}"`
}

export function transactionsToCsv(transactions: Transaccion[]): string {
  const rows = transactions.map((tx) => [
    tx.id,
    tx.fecha,
    tx.tipo_operacion,
    tx.estado ?? "Completada",
    tx.activo?.ticker ?? "",
    tx.activo?.nombre ?? "",
    tx.activo?.tipo ?? "",
    tx.activo?.moneda ?? "",
    tx.cantidad,
    tx.precio_unitario,
    tx.comision,
    tx.retencion_origen ?? "",
    tx.retencion_destino ?? "",
    tx.notas ?? "",
    tx.created_at,
  ])

  return [
    CSV_HEADERS.join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n")
}

export function buildTransactionsCsvFilename(date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `silox-transacciones-${yyyy}-${mm}-${dd}.csv`
}
