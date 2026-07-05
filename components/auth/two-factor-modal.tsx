"use client"

import { useState, useEffect } from "react"
import { usePreferences } from "@/lib/stores/use-preferences"
import { motion, AnimatePresence } from "framer-motion"
import { ShieldCheck, Lock, CheckCircle2 } from "lucide-react"

export function TwoFactorModal() {
  const { twoFactor, setTwoFactor } = usePreferences()
  const [unlocked, setUnlocked] = useState(!twoFactor)
  const [code, setCode] = useState(["", "", "", "", "", ""])
  const [error, setError] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!twoFactor) {
      setUnlocked(true)
    } else {
      setUnlocked(false)
      setCode(["", "", "", "", "", ""])
    }
  }, [twoFactor])

  const handleInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)
    setError(false)

    // Focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`2fa-${index + 1}`)
      nextInput?.focus()
    }

    // Check if complete
    if (newCode.every(v => v !== "")) {
      // Mock validation (accepts "123456" for demo, or anything else to show success)
      if (newCode.join("") === "123456") {
        setSuccess(true)
        setTimeout(() => {
          setUnlocked(true)
          setSuccess(false)
        }, 1000)
      } else {
        setError(true)
        setTimeout(() => {
          setCode(["", "", "", "", "", ""])
          document.getElementById(`2fa-0`)?.focus()
        }, 500)
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const prevInput = document.getElementById(`2fa-${index - 1}`)
      prevInput?.focus()
    }
  }

  if (!twoFactor || unlocked) return null

  return (
    <AnimatePresence>
      {!unlocked && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(10px)" }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 hidden md:flex"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 25 }}
            className="flex flex-col items-center gap-8 text-center max-w-md w-full bg-card p-10 rounded-3xl border border-border shadow-2xl relative overflow-hidden"
          >
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(var(--primary) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 relative z-10">
                {success ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </motion.div>
                ) : (
                  <ShieldCheck className="w-10 h-10 text-primary" />
                )}
              </div>
              {!success && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-[-10px] rounded-full border border-dashed border-primary/30 z-0"
                />
              )}
            </div>
            
            <div className="space-y-2 relative z-10">
              <h2 className="text-2xl font-bold tracking-tight">Verificación en 2 Pasos</h2>
              <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">
                Por favor, introduce el código de 6 dígitos de tu aplicación autenticadora.
              </p>
            </div>

            <div className="flex gap-3 justify-center relative z-10">
              {code.map((v, i) => (
                <motion.input
                  key={i}
                  id={`2fa-${i}`}
                  type="text"
                  inputMode="numeric"
                  value={v}
                  onChange={(e) => handleInput(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className={`w-12 h-14 text-center text-2xl font-bold bg-background border rounded-xl outline-none transition-all duration-200
                    ${error ? "border-destructive text-destructive bg-destructive/10" : "border-border focus:border-primary focus:ring-2 focus:ring-primary/20"}
                    ${v ? "border-primary/50 shadow-sm" : ""}
                  `}
                  animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4 relative z-10 bg-background/50 px-4 py-2 rounded-full border border-border/50">
              <Lock className="w-3 h-3" />
              <span>Conexión encriptada de extremo a extremo</span>
            </div>


          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
