"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRightLeft, X, Loader2 } from "lucide-react"
import { useTransferToInvestments } from "@/lib/hooks/use-expenses"
import { hapticFeedback } from "@/lib/utils/haptics"

interface TransferInvestmentsModalProps {
  isOpen: boolean
  onClose: () => void
  availableBalance: number
}

export function TransferInvestmentsModal({ isOpen, onClose, availableBalance }: TransferInvestmentsModalProps) {
  const [amount, setAmount] = useState("")
  const { mutateAsync: transfer, isPending } = useTransferToInvestments()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || isNaN(Number(amount))) return

    try {
      hapticFeedback.medium()
      const numAmount = Math.abs(parseFloat(amount))
      
      await transfer(numAmount)
      
      hapticFeedback.success()
      setAmount("")
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
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <ArrowRightLeft className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Invertir Excedente</h2>
                  <p className="text-xs text-muted-foreground">Envía liquidez al Patrimonio</p>
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
              
              <div className="bg-background rounded-2xl p-4 border border-border/50 flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Disponible Actual</span>
                <span className="text-lg font-bold">
                  {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(availableBalance)}
                </span>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Importe a traspasar (€)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground/50">€</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={availableBalance}
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full h-16 bg-background rounded-2xl pl-12 pr-4 text-3xl font-bold font-tabular placeholder:text-muted-foreground/20 border border-border/50 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
                {Number(amount) > availableBalance && (
                  <p className="text-xs text-rose-500 font-medium">No tienes suficiente disponible.</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isPending || !amount || Number(amount) > availableBalance}
                className="w-full h-14 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 text-white rounded-2xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>Confirmar Traspaso</>
                )}
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
