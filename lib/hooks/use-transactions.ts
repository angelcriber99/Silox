"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { insertActivoAction, updateActivoAction } from '@/lib/actions/assets'
import { insertTransaccionAction, updateTransaccionAction, deleteTransaccionAction } from '@/lib/actions/transactions'
import { fetchTransacciones, fetchAllTransactionsForTax } from '@/lib/api/transactions'

export function useTransactions(limit = 15) {
  return useQuery({
    queryKey: ["transactions", limit],
    queryFn: () => fetchTransacciones(limit),
  })
}

export function useAllTransactions() {
  return useQuery({
    queryKey: ["transactions", "all"],
    queryFn: () => fetchAllTransactionsForTax(),
  })
}

export function useAddTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: insertTransaccionAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      updateTransaccionAction(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteTransaccionAction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
  })
}

export function useAddAsset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: insertActivoAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] })
      queryClient.invalidateQueries({ queryKey: ["activos"] })
    },
  })
}

export function useUpdateAsset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      updateActivoAction(id, updates),
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
      activo: any
      transaccion: any
    }) => {
      // 1. Insertar el activo
      const newActivo = await insertActivoAction(activo)

      // 2. Insertar la transacción inicial
      const newTx = await insertTransaccionAction({
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
