"use client"

import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"

export function SilentDividendSync() {
  const hasRun = useRef(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    // Fire and forget, completely silent
    fetch("/api/cron/sync-dividends", {
      headers: {
        "x-silent-sync": "true"
      }
    }).then(res => res.json())
      .then(data => {
        if (data && data.dividendsAdded && data.dividendsAdded > 0) {
          // If it added something, softly invalidate transactions so the UI updates
          queryClient.invalidateQueries({ queryKey: ["transactions"] })
          queryClient.invalidateQueries({ queryKey: ["positions"] })
        }
      })
      .catch(() => {
        // Ignore errors silently as requested
      })
  }, [queryClient])

  return null
}
