"use client"

import { useEffect } from 'react'
import { App, URLOpenListenerEvent } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { useRouter } from 'next/navigation'

export function CapacitorProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) return

    const setupListener = async () => {
      const listener = await App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
        const url = event.url
        if (url.includes('auth/callback')) {
          Browser.close().catch(console.error)
          
          try {
            const urlObj = new URL(url)
            router.push(`/auth/callback${urlObj.search}${urlObj.hash}`)
          } catch (e) {
            console.error('Error parsing deep link URL:', e)
          }
        }
      })
      return listener
    }

    const listenerPromise = setupListener()

    return () => {
      listenerPromise.then(l => l.remove())
    }
  }, [router])

  return <>{children}</>
}
