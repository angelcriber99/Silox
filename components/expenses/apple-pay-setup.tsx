"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { SmartphoneNfc, X, Check, Copy, AlertCircle, Apple } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export function ApplePaySetup({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [copied, setCopied] = useState<"url" | "secret" | "json" | null>(null)

  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (data.user) setUserId(data.user.id)
    }
    if (isOpen) getUser()
  }, [isOpen])

  const copyToClipboard = (text: string, type: "url" | "secret" | "json") => {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const webhookUrl = "https://silox-chi.vercel.app/api/webhooks/expenses"
  const jsonPayload = `{
  "amount": "Variables del Atajo (Importe)",
  "merchant": "Variables del Atajo (Comercio)",
  "category": "Apple Pay",
  "user_id": "${userId || 'CARGANDO...'}"
}`

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="fixed inset-x-4 bottom-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-2xl md:w-full bg-zinc-950/80 border border-white/10 p-6 rounded-3xl z-[101] shadow-2xl backdrop-blur-xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-emerald-500/20 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-zinc-800 to-zinc-700 flex items-center justify-center border border-white/10 shadow-inner">
                    <Apple className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white">Configurar Apple Pay</h2>
                    <p className="text-sm text-zinc-400">Automatiza tus gastos desde iOS</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                  <X className="h-5 w-5 text-zinc-400" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Paso 1 */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">1</div>
                    <h3 className="font-semibold text-white">El Atajo de iOS</h3>
                  </div>
                  <p className="text-sm text-zinc-400 mb-3 leading-relaxed">
                    Abre la app <strong>Atajos</strong> en tu iPhone. Crea un nuevo atajo llamado "Registrar Gasto Silox". Añade la acción <em>Obtener contenido de URL</em>.
                  </p>
                  <div className="bg-black/50 p-3 rounded-xl border border-white/10 flex items-center justify-between">
                    <code className="text-xs text-emerald-400 font-mono truncate mr-4">{webhookUrl}</code>
                    <button onClick={() => copyToClipboard(webhookUrl, "url")} className="text-zinc-500 hover:text-white transition-colors">
                      {copied === "url" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Paso 2 */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">2</div>
                    <h3 className="font-semibold text-white">Configurar Cabeceras</h3>
                  </div>
                  <p className="text-sm text-zinc-400 mb-3 leading-relaxed">
                    Cambia el método de la URL a <strong>POST</strong> y añade una cabecera de tipo <code>Authorization</code> con tu clave secreta:
                  </p>
                  <div className="bg-black/50 p-3 rounded-xl border border-white/10 flex items-center justify-between">
                    <code className="text-xs text-purple-400 font-mono truncate mr-4">Bearer tu_secreto_WEBHOOK_SECRET</code>
                    <button onClick={() => copyToClipboard("Bearer tu_secreto", "secret")} className="text-zinc-500 hover:text-white transition-colors">
                      {copied === "secret" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Paso 3 */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">3</div>
                    <h3 className="font-semibold text-white">El JSON (Cuerpo de la petición)</h3>
                  </div>
                  <p className="text-sm text-zinc-400 mb-3 leading-relaxed">
                    En el cuerpo de la petición (JSON), pega exactamente este código. Tu ID personal ya está inyectado para que Silox sepa que eres tú:
                  </p>
                  <div className="relative group">
                    <pre className="bg-black/50 p-4 rounded-xl border border-white/10 text-xs text-sky-300 font-mono overflow-x-auto">
                      {jsonPayload}
                    </pre>
                    <button 
                      onClick={() => copyToClipboard(jsonPayload, "json")} 
                      className="absolute top-3 right-3 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors backdrop-blur-md opacity-0 md:group-hover:opacity-100"
                    >
                      {copied === "json" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-white" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-500/90 leading-relaxed">
                    Asegúrate de cambiar "TU_DOMINIO_VERCEL" por el link real de tu app cuando la subas a internet (el que acaba en .vercel.app). En local no funcionará porque tu iPhone no puede entrar a tu ordenador.
                  </p>
                </div>

              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
