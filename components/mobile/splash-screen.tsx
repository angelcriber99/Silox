"use client"

import { useEffect, useState } from "react"
import { Activity } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [isSplashing, setIsSplashing] = useState(true)

  // Initialization: Only runs on fresh mount (cold start)
  useEffect(() => {
    // Splash screen timer for initial load
    const timer = setTimeout(() => {
      setIsSplashing(false)
    }, 2200)

    return () => clearTimeout(timer)
  }, [])

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

      {/* ─── APP CONTENT ───────────────────────────────────────────── */}
      <div
        className="w-full h-full transition-opacity duration-500"
        style={{
          opacity: !isSplashing ? 1 : 0,
          pointerEvents: !isSplashing ? "auto" : "none",
        }}
      >
        {children}
      </div>
    </>
  )
}
