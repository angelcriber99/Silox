"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import WidgetStorage from "@/lib/plugins/WidgetStorage"

export function ClientSessionSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const supabase = createClient()
    
    const syncToken = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          // If we are on native iOS, this will save the token to the App Group
          await WidgetStorage.saveToken({ token: session.access_token })
        }
      } catch {
        // Plugin might not be available if running on web, ignore
      }
    }

    syncToken()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) {
        WidgetStorage.saveToken({ token: session.access_token }).catch(() => {})
      }
      if (event === "SIGNED_OUT") {
        queryClient.clear()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [queryClient])

  return null
}
