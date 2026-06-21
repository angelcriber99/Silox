"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { insertActivo, updateActivo } from '@/lib/api/assets'
import { fetchTransacciones, insertTransaccion } from '@/lib/api/transactions'

export function useTransactions(limit = 15) {
  return useQuery({
    queryKey: ["transactions", limit],
    queryFn: () => import("@/lib/api/transactions").then(m => m.fetchTransacciones(limit)),
  })
}

export function useAllTransactions() {
  return useQuery({
    queryKey: ["transactions", "all"],
    queryFn: () => import("@/lib/api/transactions").then(m => m.fetchAllTransactionsForTax()),
  })
}

export function useAddTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: insertTransaccion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof import("@/lib/api/transactions").updateTransaccion>[1] }) =>
      import("@/lib/api/transactions").then(m => m.updateTransaccion(id, updates)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => import("@/lib/api/transactions").then(m => m.deleteTransaccion(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
  })
}

export function useAddAsset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: insertActivo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] })
      queryClient.invalidateQueries({ queryKey: ["activos"] })
    },
  })
}

export function useUpdateAsset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateActivo>[1] }) =>
      updateActivo(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] })
      queryClient.invalidateQueries({ queryKey: ["activos"] })
    },
  })
}

export function useAddInvestment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      activo,
      transaccion,
    }: {
      activo: Parameters<typeof insertActivo>[0]
      transaccion: Omit<Parameters<typeof insertTransaccion>[0], "activo_id">
    }) => {
      // 1. Insertar el activo
      const newActivo = await insertActivo(activo)

      // 2. Insertar la transacción inicial
      const newTx = await insertTransaccion({
        ...transaccion,
        activo_id: newActivo.id,
      })

      return { activo: newActivo, transaccion: newTx }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] })
      queryClient.invalidateQueries({ queryKey: ["activos"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
  })
}
