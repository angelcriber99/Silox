"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getBudgetSettingsAction,
  updateBudgetSettingsAction,
  type BudgetSettings,
} from "@/lib/actions/budget-settings"

export function useBudgetSettings() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["budget-settings"],
    queryFn: getBudgetSettingsAction,
    staleTime: 5 * 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: updateBudgetSettingsAction,
    onSuccess: (data) => {
      queryClient.setQueryData(["budget-settings"], data)
    },
  })

  const updateBudget = <K extends keyof BudgetSettings>(
    key: K,
    value: BudgetSettings[K]
  ) => mutation.mutateAsync({ [key]: value } as Partial<BudgetSettings>)

  return {
    settings: query.data,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    error: query.error,
    updateBudget,
  }
}
