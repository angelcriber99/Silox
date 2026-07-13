interface TransactionIndexEntry {
  activo_id: string
  tipo_operacion: string
  fecha: string
}

function transactionGroupKey(activoId: string, operation: string, date: string) {
  return `${activoId}\u0000${operation}\u0000${date}`
}

export function buildTransactionGroups<T extends TransactionIndexEntry>(
  transactions: readonly T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>()

  for (const transaction of transactions) {
    const key = transactionGroupKey(
      transaction.activo_id,
      transaction.tipo_operacion,
      transaction.fecha,
    )
    const group = groups.get(key)
    if (group) group.push(transaction)
    else groups.set(key, [transaction])
  }

  return groups
}

export function getTransactionCandidates<T extends TransactionIndexEntry>(
  groups: ReadonlyMap<string, T[]>,
  activoId: string,
  operation: string,
  date: string,
): readonly T[] {
  return groups.get(transactionGroupKey(activoId, operation, date)) ?? []
}
