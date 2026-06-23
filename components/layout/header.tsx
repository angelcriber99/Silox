"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, LayoutDashboard, History, Settings } from "lucide-react"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"
import { usePreferences } from "@/lib/stores/use-preferences"

export function Header() {
  const pathname = usePathname()
  const { totals } = usePortfolio()
  const { hideBalances } = usePreferences()

  const pnlColor =
    totals.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Movimientos", href: "/movimientos", icon: History },
    { name: "Historial", href: "/historial", icon: Activity },
  ]

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          {/* Left - Branding */}
          <div className="flex items-center w-1/4">
            <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <Activity className="h-4 w-4 text-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground">
                Silox
              </span>
            </Link>
          </div>

          {/* Center - Navigation & Stats */}
          <div className="flex-1 flex justify-center items-center gap-6">
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground/90 hover:bg-muted/50"
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
              <div className="hidden lg:flex items-center gap-5 border-l border-border pl-6">
                <div>
                  <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider">
                    Portfolio
                  </p>
                  <p className="text-sm font-bold font-tabular text-foreground">
                    {hideBalances ? "****" : formatCurrency(totals.totalValue)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    P&L
                  </p>
                  <p className={`text-sm font-bold font-tabular ${pnlColor}`}>
                    {hideBalances ? "****" : `${formatPnl(totals.totalPnl)} (${formatPercent(totals.totalPnlPercent)})`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right - Profile */}
          <div className="flex items-center justify-end w-1/4 gap-4">
            <Link
              href="/perfil"
              className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                pathname === "/perfil"
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </header>
    </>
  )
}
