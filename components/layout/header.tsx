"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus, Activity, LayoutDashboard, History } from "lucide-react"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"

export function Header() {
  const pathname = usePathname()
  const { totals } = usePortfolio()

  const pnlColor =
    totals.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Movimientos", href: "/movimientos", icon: History },
  ]

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-800/60 bg-[#09090b]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-center gap-4">
          {/* Left – branding + nav + value */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-6 justify-center w-full">
            <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                Silox
              </span>
            </Link>

            {/* Navigation (Desktop Only) */}
            <nav className="hidden md:flex items-center gap-1 border-l border-zinc-800 pl-6">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-zinc-800/80 text-white"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>

            {/* Quick stats in header */}
            {totals.totalCost > 0 && (
              <div className="hidden lg:flex items-center gap-5 border-l border-zinc-800 pl-5 flex-1">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    Portfolio
                  </p>
                  <p className="text-sm font-bold font-tabular text-white">
                    {formatCurrency(totals.totalValue)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    P&L
                  </p>
                  <p className={`text-sm font-bold font-tabular ${pnlColor}`}>
                    {formatPnl(totals.totalPnl)} ({formatPercent(totals.totalPnlPercent)})
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-4 ml-auto pl-5 border-l border-zinc-800">
              <button 
                onClick={async () => {
                  const { createClient } = await import("@/lib/supabase/client")
                  const supabase = createClient()
                  await supabase.auth.signOut()
                  window.location.href = "/login"
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/40 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
