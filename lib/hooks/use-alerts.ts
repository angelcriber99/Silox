import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchAlerts } from "@/lib/api/alerts"
import { addAlertAction, deleteAlertAction, markAlertTriggeredAction } from "@/lib/actions/alerts"

export function useAlerts() {
  const queryClient = useQueryClient()

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: fetchAlerts,
  })

  const addMutation = useMutation({
    mutationFn: addAlertAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: deleteAlertAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] })
    },
  })

  const markTriggeredMutation = useMutation({
    mutationFn: markAlertTriggeredAction,
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
