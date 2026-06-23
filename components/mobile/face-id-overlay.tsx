"use client"

import { useState, useEffect } from "react"
import { usePreferences } from "@/lib/stores/use-preferences"
import { motion, AnimatePresence } from "framer-motion"
import { Fingerprint, Smartphone } from "lucide-react"

export function FaceIdOverlay() {
  const { biometrics } = usePreferences()
  const [unlocked, setUnlocked] = useState(!biometrics)

  useEffect(() => {
    if (!biometrics) {
      setUnlocked(true)
    } else {
      setUnlocked(false)
    }
  }, [biometrics])

  const handleUnlock = () => {
    setUnlocked(true)
  }

  if (!biometrics || unlocked) return null

  return (
    <AnimatePresence>
      {!unlocked && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-3xl flex flex-col items-center justify-center p-6 md:hidden"
        >
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center gap-8 text-center"
          >
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
              <Fingerprint className="w-12 h-12 text-primary" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Silox Pro Bloqueado</h2>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                Usa FaceID o TouchID para acceder a tu portfolio de forma segura.
              </p>
            </div>

            <button
              onClick={handleUnlock}
              className="mt-8 px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-2xl flex items-center gap-3 shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              <Smartphone className="w-5 h-5" />
              Desbloquear Ahora
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
