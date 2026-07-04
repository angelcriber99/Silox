"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useExpenses, useBudgetSettings } from "@/lib/hooks/use-expenses"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { motion } from "framer-motion"
import { usePreferences } from "@/lib/stores/use-preferences"
import { ArrowLeft, Plus } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ApplePaySetup } from "@/components/expenses/apple-pay-setup"
import { hapticFeedback } from "@/lib/utils/haptics"

// Helper to format currency natively
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

// Format the large balance with small decimals
const FormatLargeBalance = ({ amount }: { amount: number }) => {
  const parts = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount).split(',')
  
  return (
    <div className="flex items-baseline tracking-tighter">
      <span className="text-4xl font-extrabold">{parts[0]}</span>
      <span className="text-xl font-bold">,{parts[1]} €</span>
    </div>
  )
}

// Helper to get initials and colors
const getMerchantInitials = (name: string) => {
  return name.substring(0, 2).toUpperCase()
}

const getMerchantColor = (name: string) => {
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export default function DailyHub() {
  const { data: budget } = useBudgetSettings()
  const [mounted, setMounted] = useState(false)
  const [currentMonth, setCurrentMonth] = useState("")
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  
  useEffect(() => {
    setMounted(true)
    setCurrentMonth(new Date().toISOString().slice(0, 7))
  }, [])

  const { data: expenses } = useExpenses(currentMonth) 
  const { hideBalances } = usePreferences()

  const allowance = budget?.monthly_allowance || 500
  // Sum of all expenses (positive numbers are expenses, negative are incomes)
  const totalSpent = expenses?.reduce((acc, exp) => acc + exp.amount, 0) || 0
  const remaining = allowance - totalSpent

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

  // Months array for the horizontal selector
  const months = ['Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio']

  return (
    <div className="min-h-full bg-black text-white pb-28">
      
      {/* Header */}
      <div className="px-5 pt-safe-top pt-6 pb-4">
        <Link href="/investments">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            className="h-10 w-10 rounded-full bg-zinc-900 flex items-center justify-center mb-6"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </motion.button>
        </Link>
        
        <div className="mb-1">
          {hideBalances ? (
            <span className="text-4xl font-extrabold tracking-tighter">**** €</span>
          ) : (
            <FormatLargeBalance amount={remaining} />
          )}
        </div>
        <p className="text-zinc-500 text-[15px] font-medium">Saldo actual</p>
      </div>

      {/* Month Selector */}
      <div className="w-full overflow-x-auto hide-scrollbar mb-8 mt-2 border-b border-zinc-900 pb-4">
        <div className="flex gap-6 px-5 min-w-max items-center">
          {months.map((m, i) => (
            <button 
              key={m}
              className={`text-[15px] font-medium transition-colors ${
                m === 'Julio' 
                  ? 'bg-zinc-800 text-white px-4 py-1.5 rounded-full' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      <div className="px-4 space-y-8">
        {Object.entries(groupedExpenses).map(([date, dayExpenses]) => {
          const dayTotal = dayExpenses!.reduce((acc, exp) => acc + exp.amount, 0)
          
          return (
            <div key={date}>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-white text-lg font-semibold">{date}</h3>
                <span className="text-zinc-400 text-sm font-medium">
                  {formatNativeCurrency(dayTotal)}
                </span>
              </div>
              
              <div className="bg-[#121212] rounded-3xl overflow-hidden">
                {dayExpenses!.map((exp, idx) => {
                  const isIncome = exp.amount < 0
                  
                  return (
                    <motion.div 
                      key={exp.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`flex items-center justify-between p-4 ${
                        idx !== dayExpenses!.length - 1 ? 'border-b border-zinc-900/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          {/* Main Icon */}
                          <div className={`h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold text-white shadow-inner ${getMerchantColor(exp.merchant)}`}>
                            {getMerchantInitials(exp.merchant)}
                          </div>
                          
                          {/* Automated Badge overlay */}
                          {exp.is_automated && (
                            <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-zinc-800 rounded-full flex items-center justify-center border-2 border-[#121212]">
                              <Plus className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <p className="text-white font-medium text-[16px]">{exp.merchant}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-zinc-500 text-[13px]">
                              {new Date(exp.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {exp.notes && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                <p className="text-zinc-500 text-[13px] truncate max-w-[120px]">{exp.notes}</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className={`text-[16px] font-medium tracking-tight ${isIncome ? 'text-emerald-500' : 'text-white'}`}>
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
          <div className="text-center py-20">
            <p className="text-zinc-500 font-medium">No hay movimientos este mes</p>
          </div>
        )}
      </div>

      <ApplePaySetup isOpen={isSetupOpen} onClose={() => setIsSetupOpen(false)} />
    </div>
  )
}
