"use client"

import { useEffect, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { App } from "@capacitor/app"
import { NativeBiometric } from "capacitor-native-biometric"
import { Lock, ScanFace, Activity } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export function BiometricLocker({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false)
  const [isNative, setIsNative] = useState(false)
  const [isSplashing, setIsSplashing] = useState(true)

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

    // Splash screen timer for initial load
    const timer = setTimeout(() => {
      setIsSplashing(false)
    }, 2200)

    return () => clearTimeout(timer)
  }, [])

  // App State Change Listener (Background/Foreground)
  useEffect(() => {
    if (!isNative) return

    const listener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        // When coming back to the app, lock it again (no splash screen here)
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

  // Determine what to show
  const showLockScreen = !isSplashing && isLocked
  const showApp = !isSplashing && !isLocked

  return (
    <>
      {/* ─── SPLASH SCREEN ───────────────────────────────────────── */}
      <AnimatePresence>
        {isSplashing && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, filter: "blur(20px)", scale: 1.1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[10000] bg-background flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="flex flex-col items-center gap-6"
            >
              <div className="relative">
                <motion.div
                  animate={{
                    boxShadow: [
                      "0px 0px 0px 0px rgba(16, 185, 129, 0)",
                      "0px 0px 100px 30px rgba(16, 185, 129, 0.2)",
                      "0px 0px 0px 0px rgba(16, 185, 129, 0)",
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full"
                />
                <div className="h-28 w-28 rounded-[2rem] bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-2xl relative z-10 overflow-hidden">
                  <Activity className="w-14 h-14 text-white" strokeWidth={2.5} />
                </div>
              </div>

              <motion.h1
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                className="text-4xl font-bold tracking-tighter"
              >
                Silox
              </motion.h1>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── FACE ID LOCK SCREEN ───────────────────────────────────── */}
      <AnimatePresence>
        {showLockScreen && (
          <motion.div
            key="lock"
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] bg-background/80 flex flex-col items-center justify-center p-6"
          >
            <div className="flex flex-col items-center gap-8">
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── APP CONTENT ───────────────────────────────────────────── */}
      <div
        className="w-full h-full transition-opacity duration-500"
        style={{
          opacity: showApp ? 1 : 0,
          pointerEvents: showApp ? "auto" : "none",
        }}
      >
        {children}
      </div>
    </>
  )
}
