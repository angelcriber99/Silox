"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Settings, History, Search } from "lucide-react"
import { motion } from "framer-motion"

const navItems = [
  { name: "Home", href: "/", icon: LayoutDashboard },
  { name: "Historial", href: "#", icon: History },
  { name: "Buscar", href: "#", icon: Search },
  { name: "Ajustes", href: "/settings", icon: Settings },
]

export function ProBottomNav() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-50 md:hidden">
      <div className="bg-card/70 backdrop-blur-2xl border border-border/50 shadow-2xl shadow-black/20 rounded-3xl px-6 py-3 flex justify-between items-center relative overflow-hidden">
        {/* Subtle inner glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent opacity-50 pointer-events-none" />

        {navItems.map((item) => {
          const isActive = pathname === item.href

          return (
            <Link
              key={item.name}
              href={item.href}
              className="relative p-2 flex flex-col items-center gap-1 z-10"
            >
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-active"
                  className="absolute inset-0 bg-primary/20 rounded-2xl"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                />
              )}
              <item.icon
                className={`h-6 w-6 transition-colors duration-300 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <span 
                className={`text-[10px] font-medium transition-colors duration-300 ${
                  isActive ? "text-primary" : "text-muted-foreground/0 scale-75 opacity-0 absolute -bottom-4"
                }`}
              >
                {item.name}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
