"use client"

import { useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"

export function MacBadgeUpdater({ dailyPnl }: { dailyPnl: number }) {
  useEffect(() => {
    // Only run if we are in Tauri
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      if (Math.abs(dailyPnl) > 0) {
        const label = dailyPnl > 0 ? "↑" : "↓";
        // Use the explicit IPC call since setBadgeLabel might not be typed in all versions
        invoke("plugin:window|set_badge_label", { label }).catch(() => {
           // Fallback to setting a simple count if label fails
           getCurrentWindow().setBadgeCount(1).catch(console.error)
        })
      } else {
        // Clear badge
        getCurrentWindow().setBadgeCount(undefined).catch(console.error)
      }
    }
  }, [dailyPnl])

  return null
}
