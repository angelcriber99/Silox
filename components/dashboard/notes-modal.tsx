"use client"

import { useNotes } from "@/lib/stores/use-notes"
import { X, StickyNote, Save } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export function NotesModal() {
  const { isOpen, setIsOpen, content, setContent } = useNotes()
  const [localContent, setLocalContent] = useState(content)

  // Sync with store when opening
  useEffect(() => {
    if (isOpen) {
      setLocalContent(content)
    }
  }, [isOpen, content])

  const handleSave = () => {
    setContent(localContent)
    toast.success("Plan estratégico guardado")
    setIsOpen(false)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 p-4"
          >
            <div className="bg-card/90 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between bg-card/50">
                <div className="flex items-center gap-2 text-amber-500">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <StickyNote className="w-5 h-5" />
                  </div>
                  <h2 className="font-semibold text-lg">Plan Estratégico</h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 flex-1 overflow-hidden flex flex-col">
                <p className="text-sm text-muted-foreground mb-4">
                  Anota aquí tus planes de entrada, salida, tesis de inversión y alarmas. 
                  Se guarda automáticamente en tu navegador.
                </p>
                <textarea
                  value={localContent}
                  onChange={(e) => {
                    setLocalContent(e.target.value)
                    // Auto-save logic (debounced implicitly by just updating the local state, but we also save to store)
                    setContent(e.target.value)
                  }}
                  placeholder="Ej: Si BABA toca los 87$, comprar 1.000€. Stop loss en 85$..."
                  className="w-full flex-1 min-h-[400px] p-4 bg-background/50 rounded-xl border border-border/50 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all resize-none font-mono text-[13px] leading-relaxed"
                />
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border/30 bg-card/50 flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-amber-950 hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
                >
                  <Save className="w-4 h-4" />
                  Guardar Plan
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
