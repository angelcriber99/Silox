"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useExpenses, useBudgetSettings } from "@/lib/hooks/use-expenses"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { motion } from "framer-motion"
import { usePreferences } from "@/lib/stores/use-preferences"
import { ArrowRight, CreditCard, Coffee, ShoppingBag, Car, Plus, Send, Receipt, SmartphoneNfc } from "lucide-react"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils/formatters"
import { useEffect, useState } from "react"
import { ApplePaySetup } from "@/components/expenses/apple-pay-setup"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { hapticFeedback } from "@/lib/utils/haptics"

export default function DailyHub() {
  const { data: budget } = useBudgetSettings()
  const [mounted, setMounted] = useState(false)
  const [currentMonth, setCurrentMonth] = useState("")
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  
  useEffect(() => {
    setMounted(true)
    setCurrentMonth(new Date().toISOString().slice(0, 7))
  }, [])

  const queryClient = useQueryClient()
  const { data: expenses, refetch } = useExpenses(currentMonth)
  
  useEffect(() => {
    console.log("Expenses for", currentMonth, ":", expenses)
  }, [expenses, currentMonth])
  const { totals } = usePortfolio()
  const { hideBalances } = usePreferences()

  const allowance = budget?.monthly_allowance || 500
  const totalSpent = expenses?.reduce((acc, exp) => acc + exp.amount, 0) || 0
  const remaining = allowance - totalSpent
  const progress = Math.min((totalSpent / allowance) * 100, 100)

  // Safe Patrimonio (Total Value)
  const patrimonio = totals?.totalValue
  const safePatrimonio = Number.isNaN(patrimonio) || patrimonio === undefined ? 0 : patrimonio

  // SVG Ring Chart Logic
  const radius = 90
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference
  const isOverBudget = progress > 100
  const ringColor = isOverBudget ? 'text-rose-500' : progress > 80 ? 'text-amber-500' : 'text-emerald-500'

  const getCategoryIcon = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'comida': return <Coffee className="h-4 w-4" />
      case 'transporte': return <Car className="h-4 w-4" />
      case 'compras': return <ShoppingBag className="h-4 w-4" />
      case 'bizum': return <Send className="h-4 w-4" />
      case 'apple pay': return <SmartphoneNfc className="h-4 w-4" />
      default: return <CreditCard className="h-4 w-4" />
    }
  }

  if (!mounted) return null 

  return (
    <div className="pb-28 flex flex-col min-h-screen bg-background text-foreground">
      
      {/* ─── Sticky Header (Like Investments) ─────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-2xl border-b border-border/30 shadow-sm">
        <div className="px-5 pt-safe-top pt-5 pb-4 max-w-5xl mx-auto w-full">
          
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
                Gastos Mensuales
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 text-muted-foreground/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">En Presupuesto</span>
              </div>
            </div>

            <Link href="/investments">
              <motion.button
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 bg-muted/30 hover:bg-muted/50 border border-border/40 rounded-full pl-3 pr-2 py-1.5 transition-colors"
              >
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">Patrimonio</span>
                  <span className="text-xs font-bold text-foreground">
                    {hideBalances ? "****" : formatCurrency(safePatrimonio, 'EUR')}
                  </span>
                </div>
                <div className="h-6 w-6 rounded-full bg-background flex items-center justify-center">
                  <ArrowRight className="h-3 w-3 text-foreground/70" />
                </div>
              </motion.button>
            </Link>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <h1 className="text-[52px] font-extrabold tracking-tighter text-foreground leading-[1.1]">
              <AnimatedNumber value={remaining} format="currency" hide={hideBalances} />
            </h1>
            <span className="text-muted-foreground/60 text-lg font-medium">disp.</span>
          </div>
          
          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/30 text-muted-foreground">
              <span className="text-[14px] font-bold font-tabular">
                {hideBalances ? "••••" : formatCurrency(totalSpent)}
              </span>
              <span className="text-[12px] font-semibold opacity-70">
                gastado
              </span>
            </div>
            <div className="text-muted-foreground/60 text-[12px] font-medium ml-1">
              de {formatCurrency(allowance)}
            </div>
          </div>
          
        </div>
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full w-full">
        <div className="grid grid-cols-1 md:grid-cols-12 md:gap-10 pt-6">
          
          {/* ─── LEFT COLUMN: BUDGET VISUALS ─── */}
          <div className="md:col-span-5 flex flex-col px-4">
            
            <div className="flex flex-col items-center justify-center py-6 mb-4">
              <div className="relative w-[220px] h-[220px] md:w-[260px] md:h-[260px] flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90 absolute inset-0">
                  <circle cx="50%" cy="50%" r="40%" className="stroke-muted/30" strokeWidth="16" fill="transparent" />
                  <motion.circle
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    cx="50%"
                    cy="50%"
                    r="40%"
                    className={`stroke-current ${ringColor}`}
                    strokeWidth="16"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeLinecap="round"
                  />
                </svg>
                
                <div className="flex flex-col items-center text-center z-10">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">Presupuesto</span>
                  <span className="text-4xl font-black tracking-tighter text-foreground">
                    {Math.round(progress)}%
                  </span>
                  <span className="text-xs text-muted-foreground/60 mt-1 font-medium">
                    Consumido
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions (iOS Settings style grid) */}
            <div className="grid grid-cols-4 gap-2 md:gap-3 mb-8">
              <motion.button 
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center gap-1.5"
              >
                <div className="h-14 w-14 rounded-2xl bg-muted/40 hover:bg-muted/60 transition-colors flex items-center justify-center text-sky-500">
                  <Send className="h-6 w-6" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">Bizum</span>
              </motion.button>
              
              <motion.button 
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center gap-1.5"
              >
                <div className="h-14 w-14 rounded-2xl bg-muted/40 hover:bg-muted/60 transition-colors flex items-center justify-center text-indigo-400">
                  <Receipt className="h-6 w-6" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">Gasto</span>
              </motion.button>
              
              <motion.button 
                onClick={() => { hapticFeedback.light(); setIsSetupOpen(true) }}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center gap-1.5"
              >
                <div className="h-14 w-14 rounded-2xl bg-muted/40 hover:bg-muted/60 transition-colors flex items-center justify-center text-foreground">
                  <SmartphoneNfc className="h-6 w-6" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">Apple Pay</span>
              </motion.button>
              
              <motion.button 
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center gap-1.5"
              >
                <div className="h-14 w-14 rounded-2xl bg-muted/40 hover:bg-muted/60 transition-colors flex items-center justify-center text-muted-foreground">
                  <Plus className="h-6 w-6" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">Más</span>
              </motion.button>
            </div>
          </div>

          {/* ─── RIGHT COLUMN: TRANSACTIONS LIST ─── */}
          <div className="md:col-span-7 flex flex-col pb-8">
            <div className="flex items-center justify-between px-5 py-2 bg-muted/20 md:bg-transparent md:px-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Movimientos Recientes</span>
              <span className="text-[10px] font-medium text-muted-foreground/40">{expenses?.length || 0} pagos</span>
            </div>

            <div className="divide-y divide-border/10 md:divide-border/20 md:border-t md:border-border/20">
              {expenses?.length === 0 ? (
                <div className="text-center py-16 px-8">
                  <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                    <Receipt className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground/60">Sin gastos este mes</p>
                  <p className="text-xs text-muted-foreground/40 mt-1">Configura Apple Pay para registrar pagos al instante.</p>
                </div>
              ) : (
                expenses?.slice(0, 20).map((expense) => (
                  <div 
                    key={expense.id} 
                    className="flex items-center justify-between px-5 py-3 hover:bg-muted/10 transition-colors md:px-2"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground">
                        {getCategoryIcon(expense.category)}
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-foreground leading-tight">{expense.merchant}</p>
                        <p className="text-[13px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          {expense.category}
                          {expense.is_automated && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-emerald-500/50" />
                              <span className="text-emerald-500/80 text-[11px] font-medium">Auto</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[15px] font-bold font-tabular text-foreground">-{formatCurrency(expense.amount)}</p>
                      <p className="text-[12px] font-medium text-muted-foreground/50 mt-0.5 uppercase tracking-wider">
                        {new Date(expense.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
        </div>
      </div>

      <ApplePaySetup isOpen={isSetupOpen} onClose={() => setIsSetupOpen(false)} />
    </div>
  )
}
