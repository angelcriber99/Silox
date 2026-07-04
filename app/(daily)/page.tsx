"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useExpenses, useGlobalBalance } from "@/lib/hooks/use-expenses"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { motion } from "framer-motion"
import { usePreferences } from "@/lib/stores/use-preferences"
import { ArrowRight, Plus, Receipt, SmartphoneNfc, ArrowRightLeft, Landmark } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ApplePaySetup } from "@/components/expenses/apple-pay-setup"
import { AddIncomeModal } from "@/components/expenses/add-income-modal"
import { TransferInvestmentsModal } from "@/components/expenses/transfer-investments-modal"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { hapticFeedback } from "@/lib/utils/haptics"
import { formatCurrency } from "@/lib/utils/formatters"

// Helper to format currency natively for the transaction list
const formatNativeCurrency = (amount: number, forceSign: boolean = false) => {
  const formatted = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
  
  if (amount === 0) return formatted
  if (amount < 0) return `+${formatted}` // In our DB, negative expense = income
  return `-${formatted}` // Positive expense = money spent
}

// Helper to get initials and colors
const getMerchantInitials = (name: string) => {
  return name.substring(0, 2).toUpperCase()
}

const getMerchantColor = (name: string) => {
  const colors = [
    'bg-red-500/10 text-red-500', 
    'bg-blue-500/10 text-blue-500', 
    'bg-green-500/10 text-green-500', 
    'bg-yellow-500/10 text-yellow-500', 
    'bg-purple-500/10 text-purple-500', 
    'bg-pink-500/10 text-pink-500', 
    'bg-indigo-500/10 text-indigo-500', 
    'bg-teal-500/10 text-teal-500'
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export default function DailyHub() {
  const [mounted, setMounted] = useState(false)
  const [currentMonth, setCurrentMonth] = useState("")
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  const [isIncomeOpen, setIsIncomeOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  
  useEffect(() => {
    setMounted(true)
    setCurrentMonth(new Date().toISOString().slice(0, 7))
  }, [])

  const { data: expenses } = useExpenses(currentMonth) 
  const { data: globalBalance } = useGlobalBalance()
  const { totals } = usePortfolio()
  const { hideBalances } = usePreferences()

  // The global balance computed from all-time income and expenses
  const remaining = globalBalance || 0

  // Optional: calculating the total spent IN THIS MONTH just for info
  const monthExpenses = expenses?.filter(e => e.amount > 0).reduce((acc, exp) => acc + exp.amount, 0) || 0
  const monthIncome = expenses?.filter(e => e.amount < 0).reduce((acc, exp) => acc + Math.abs(exp.amount), 0) || 0

  // Safe Patrimonio (Total Value)
  const patrimonio = totals?.totalValue
  const safePatrimonio = Number.isNaN(patrimonio) || patrimonio === undefined ? 0 : patrimonio

  if (!mounted) return null 

  // Group expenses by date
  const groupedExpenses: Record<string, typeof expenses> = {}
  expenses?.forEach(exp => {
    // Check if it's today or yesterday
    const expDate = new Date(exp.date)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    let dateKey = ''
    if (expDate.toDateString() === today.toDateString()) {
      dateKey = 'Hoy'
    } else if (expDate.toDateString() === yesterday.toDateString()) {
      dateKey = 'Ayer'
    } else {
      dateKey = expDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
    }
    
    if (!groupedExpenses[dateKey]) groupedExpenses[dateKey] = []
    groupedExpenses[dateKey]!.push(exp)
  })

  // Generate last 6 months for the selector
  const generateMonths = () => {
    const result = []
    const d = new Date()
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(d.getFullYear(), d.getMonth() - i, 1)
      result.push({
        value: monthDate.toISOString().slice(0, 7),
        label: monthDate.toLocaleDateString('es-ES', { month: 'long' }),
        year: monthDate.getFullYear()
      })
    }
    return result
  }
  const months = generateMonths()

  return (
    <div className="min-h-full bg-background text-foreground pb-28">
      
      {/* ─── Sticky Header (Connected to Investments) ─────────────────────────── */}
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
            <span className="text-muted-foreground/60 text-lg font-medium">total</span>
          </div>
          
          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/30 text-muted-foreground">
              <span className="text-[14px] font-bold font-tabular">
                {hideBalances ? "••••" : formatCurrency(monthExpenses)}
              </span>
              <span className="text-[12px] font-semibold opacity-70">
                gastado este mes
              </span>
            </div>
            {monthIncome > 0 && (
              <div className="text-emerald-500/80 text-[12px] font-medium ml-1">
                +{formatCurrency(monthIncome)} ingresos
              </div>
            )}
          </div>
          
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full pt-6">
        
        {/* ─── Month Selector ─── */}
        <div className="w-full overflow-x-auto hide-scrollbar mb-6">
          <div className="flex gap-4 px-5 min-w-max items-center">
            {months.map((m) => {
              const isActive = currentMonth === m.value
              return (
                <button 
                  key={m.value}
                  onClick={() => setCurrentMonth(m.value)}
                  className={`flex items-center gap-1.5 transition-colors ${
                    isActive 
                      ? 'bg-foreground text-background px-4 py-1.5 rounded-full' 
                      : 'text-muted-foreground hover:text-foreground px-2'
                  }`}
                >
                  <span className="text-[15px] font-semibold capitalize">{m.label}</span>
                  {isActive && <span className="text-[12px] opacity-70 font-medium">{m.year}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── Quick Actions (Desktop & Mobile) ─── */}
        <div className="px-5 mb-8">
          <div className="grid grid-cols-4 gap-2 md:gap-4 max-w-md mx-auto md:max-w-none md:flex md:flex-wrap">
            <motion.button 
              onClick={() => { hapticFeedback.light(); setIsIncomeOpen(true) }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="h-14 w-14 rounded-2xl bg-card border border-border/30 hover:border-border transition-colors flex items-center justify-center text-emerald-500 shadow-sm">
                <Plus className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">Sueldo</span>
            </motion.button>
            
            <motion.button 
              onClick={() => { hapticFeedback.light(); setIsTransferOpen(true) }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="h-14 w-14 rounded-2xl bg-card border border-border/30 hover:border-border transition-colors flex items-center justify-center text-blue-500 shadow-sm">
                <ArrowRightLeft className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">Invertir</span>
            </motion.button>
            
            <motion.button 
              onClick={() => { hapticFeedback.light(); setIsSetupOpen(true) }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="h-14 w-14 rounded-2xl bg-card border border-border/30 hover:border-border transition-colors flex items-center justify-center text-foreground shadow-sm">
                <SmartphoneNfc className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">Apple Pay</span>
            </motion.button>
            
            <motion.button 
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-2 opacity-50 cursor-not-allowed"
            >
              <div className="h-14 w-14 rounded-2xl bg-card border border-border/30 transition-colors flex items-center justify-center text-muted-foreground shadow-sm">
                <Receipt className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">Manual</span>
            </motion.button>
          </div>
        </div>

        {/* ─── Transactions List (Grouped) ─── */}
        <div className="px-5 space-y-8 pb-10">
          {Object.entries(groupedExpenses).map(([date, dayExpenses]) => {
            const dayTotal = dayExpenses!.reduce((acc, exp) => acc + exp.amount, 0)
            
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-foreground text-[15px] font-semibold tracking-tight">{date}</h3>
                  <span className="text-muted-foreground text-[13px] font-medium">
                    {formatNativeCurrency(dayTotal)}
                  </span>
                </div>
                
                <div className="bg-card border border-border/30 rounded-3xl overflow-hidden shadow-sm">
                  {dayExpenses!.map((exp, idx) => {
                    const isIncome = exp.amount < 0
                    
                    return (
                      <motion.div 
                        key={exp.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`flex items-center justify-between p-4 ${
                          idx !== dayExpenses!.length - 1 ? 'border-b border-border/20' : ''
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            {/* Main Icon */}
                            <div className={`h-11 w-11 rounded-full flex items-center justify-center text-[15px] font-bold ${getMerchantColor(exp.merchant)}`}>
                              {getMerchantInitials(exp.merchant)}
                            </div>
                            
                            {/* Automated Badge overlay */}
                            {exp.is_automated && (
                              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-emerald-500/10 rounded-full flex items-center justify-center border-[1.5px] border-card">
                                <Plus className="h-[9px] w-[9px] text-emerald-500" />
                              </div>
                            )}
                          </div>
                          
                          <div>
                            <p className="text-foreground font-semibold text-[15px] leading-tight">{exp.merchant}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <p className="text-muted-foreground text-[12px] font-medium">
                                {new Date(exp.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              {exp.notes && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-border" />
                                  <p className="text-muted-foreground text-[12px] truncate max-w-[120px]">{exp.notes}</p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className={`text-[15px] font-bold font-tabular tracking-tight ${isIncome ? 'text-emerald-500' : 'text-foreground'}`}>
                            {formatNativeCurrency(exp.amount)}
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {expenses?.length === 0 && (
            <div className="text-center py-20 px-8">
              <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                <Receipt className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground/60">Sin gastos este mes</p>
              <p className="text-[13px] text-muted-foreground/40 mt-1 max-w-[200px] mx-auto">Selecciona otro mes o configura Apple Pay para registrar pagos.</p>
            </div>
          )}
        </div>
      </div>

      <ApplePaySetup isOpen={isSetupOpen} onClose={() => setIsSetupOpen(false)} />
      <AddIncomeModal isOpen={isIncomeOpen} onClose={() => setIsIncomeOpen(false)} currentMonth={currentMonth} />
      <TransferInvestmentsModal isOpen={isTransferOpen} onClose={() => setIsTransferOpen(false)} availableBalance={remaining} />
    </div>
  )
}
