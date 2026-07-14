"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import {
  LayoutDashboard,
  Settings,
  History,
  FileText,
  TrendingUp,
  PieChart,
} from "lucide-react"
import { useTranslations } from "next-intl"

const navItems = [
  { key: "dashboard", href: "/", icon: LayoutDashboard },
  { key: "portfolio", href: "/movimientos", icon: History },
  { key: "analisis-page", href: "/analisis", icon: PieChart },
  { key: "analisis", href: "/historial", icon: TrendingUp },
  { key: "declarar", href: "/declarar", icon: FileText },
  { key: "settings", href: "/settings", icon: Settings },
]

export function DesktopDock() {
  const pathname = usePathname()
  const t = useTranslations('Nav')

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 hidden md:flex items-end justify-center gap-2 px-4 py-3 rounded-2xl bg-card/40 backdrop-blur-2xl border border-border/40 shadow-2xl">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
        return (
          <Link href={item.href} key={item.key} className="group relative">
            <motion.div
              whileHover={{ y: -8, scale: 1.15 }}
              whileTap={{ scale: 0.95 }}
              className={`relative flex items-center justify-center w-12 h-12 rounded-xl transition-colors duration-300 ${
                isActive 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                  : "bg-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              
              {/* Tooltip */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md bg-foreground text-background text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">
                {t(item.key)}
              </div>
              
              {isActive && (
                <motion.div 
                  layoutId="dock-indicator"
                  className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
              )}
            </motion.div>
          </Link>
        )
      })}
    </div>
  )
}
