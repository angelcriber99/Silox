"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getNotificationPreferencesAction,
  updateNotificationPreferencesAction,
  type NotificationPreferences,
} from "@/lib/actions/notification-preferences"

export function useNotificationPreferences() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: getNotificationPreferencesAction,
    staleTime: 5 * 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: updateNotificationPreferencesAction,
    onSuccess: (data) => {
      queryClient.setQueryData(["notification-preferences"], data)
    },
  })

  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => mutation.mutateAsync({ [key]: value } as Partial<NotificationPreferences>)

  return {
    preferences: query.data,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    error: query.error,
    updatePreference,
  }
}
