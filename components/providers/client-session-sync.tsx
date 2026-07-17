"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import WidgetStorage from "@/lib/plugins/WidgetStorage"

export function ClientSessionSync() {
  useEffect(() => {
    const supabase = createClient()
    
    const syncToken = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          // If we are on native iOS, this will save the token to the App Group
          await WidgetStorage.saveToken({ token: session.access_token })
        }
      } catch (error) {
        // Plugin might not be available if running on web, ignore
      }
    }

    syncToken()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) {
        WidgetStorage.saveToken({ token: session.access_token }).catch(() => {})
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return null
}
