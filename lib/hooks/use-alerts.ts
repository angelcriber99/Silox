import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchAlerts, addAlert, deleteAlert, markAlertTriggered, type PriceAlert } from "@/lib/api/alerts"

export function useAlerts() {
  const queryClient = useQueryClient()

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: fetchAlerts,
  })

  const addMutation = useMutation({
    mutationFn: addAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] })
    },
  })

  const markTriggeredMutation = useMutation({
    mutationFn: markAlertTriggered,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] })
    },
  })

  return {
    alerts,
    isLoading,
    addAlert: addMutation.mutateAsync,
    removeAlert: removeMutation.mutateAsync,
    markTriggered: markTriggeredMutation.mutateAsync,
  }
}
