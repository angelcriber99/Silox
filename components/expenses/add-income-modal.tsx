"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, X, Loader2 } from "lucide-react"
import { useAddExpense } from "@/lib/hooks/use-expenses"
import { hapticFeedback } from "@/lib/utils/haptics"

interface AddIncomeModalProps {
  isOpen: boolean
  onClose: () => void
  currentMonth: string
}

export function AddIncomeModal({ isOpen, onClose, currentMonth }: AddIncomeModalProps) {
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const { mutateAsync: addIncome, isPending } = useAddExpense()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || isNaN(Number(amount))) return

    try {
      hapticFeedback.medium()
      // We parse the amount and negate it so it's recorded as an income (negative expense)
      const numAmount = -Math.abs(parseFloat(amount))
      
      // We want to add it to the first day of the currently selected month
      // Or just today's date if they are looking at the current month
      const isCurrentMonth = currentMonth === new Date().toISOString().slice(0, 7)
      const dateToUse = isCurrentMonth 
        ? new Date().toISOString() 
        : new Date(`${currentMonth}-01T12:00:00Z`).toISOString()

      await addIncome({
        amount: numAmount,
        merchant: "Nómina / Ingreso",
        category: "Ingreso",
        notes: notes || null,
        date: dateToUse,
        is_automated: true
      })
      
      hapticFeedback.success()
      setAmount("")
      setNotes("")
      onClose()
    } catch (error) {
      console.error(error)
      hapticFeedback.error()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="fixed bottom-0 md:bottom-auto md:top-1/2 left-0 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:w-[400px] bg-card border-t md:border border-border/50 md:rounded-3xl rounded-t-3xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 border-b border-border/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Añadir Ingreso</h2>
                  <p className="text-xs text-muted-foreground">Suma fondos a tu disponible</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Importe (€)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground/50">€</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full h-16 bg-background rounded-2xl pl-12 pr-4 text-3xl font-bold font-tabular placeholder:text-muted-foreground/20 border border-border/50 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Nota (Opcional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-12 bg-background rounded-xl px-4 text-sm font-medium border border-border/50 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none"
                  placeholder="Ej: Nómina Julio"
                />
              </div>

              <button
                type="submit"
                disabled={isPending || !amount}
                className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-white rounded-2xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>Guardar Ingreso</>
                )}
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
