"use client"

import { useEffect, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { App } from "@capacitor/app"
import { NativeBiometric } from "capacitor-native-biometric"
import { Lock, ScanFace } from "lucide-react"

export function BiometricLocker({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false)
  const [isNative, setIsNative] = useState(false)

  // Initialization & Native Check
  useEffect(() => {
    const checkNative = async () => {
      const native = Capacitor.isNativePlatform()
      setIsNative(native)
      if (native) {
        // Lock instantly when app starts
        setIsLocked(true)
        verify()
      }
    }
    checkNative()
  }, [])

  // App State Change Listener (Background/Foreground)
  useEffect(() => {
    if (!isNative) return

    const listener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        // When coming back to the app, lock it again
        setIsLocked(true)
        verify()
      } else {
        // When going to background, lock it so the app switcher shows it locked
        setIsLocked(true)
      }
    })

    return () => {
      listener.then(l => l.remove())
    }
  }, [isNative])

  const verify = async () => {
    try {
      const available = await NativeBiometric.isAvailable()
      if (!available.isAvailable) {
        // If device has no FaceID/TouchID, just unlock
        setIsLocked(false)
        return
      }

      await NativeBiometric.verifyIdentity({
        reason: "Desbloquea Silox para continuar",
        title: "Seguridad de Silox",
      })

      // If we reach here, verification succeeded!
      setIsLocked(false)
    } catch (error) {
      console.error("Biometric error:", error)
      // Stay locked if there is an error or user cancelled
    }
  }

  // If not locked, just render the app
  if (!isLocked) {
    return <>{children}</>
  }

  // If locked, render the Splash/Lock Screen (covers everything)
  return (
    <>
      <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
        <div className="flex flex-col items-center gap-8">
          {/* Logo / Icon */}
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
            <div className="h-24 w-24 rounded-3xl bg-card border border-border/50 shadow-2xl flex items-center justify-center relative z-10">
              <ScanFace className="w-12 h-12 text-primary" strokeWidth={1.5} />
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Silox Bloqueado</h1>
            <p className="text-muted-foreground text-sm">Autentícate para ver tu patrimonio</p>
          </div>

          <button
            onClick={verify}
            className="mt-8 flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full font-bold active:scale-95 transition-transform"
          >
            <Lock className="w-4 h-4" />
            Reintentar Desbloqueo
          </button>
        </div>
      </div>
      
      {/* 
        We still render the children hidden underneath so that React Query fetches data 
        in the background while the user is authenticating. This makes the app feel instant!
      */}
      <div className="hidden pointer-events-none opacity-0">
        {children}
      </div>
    </>
  )
}
