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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-28px)] max-w-sm z-50 md:hidden">
      <div className="relative flex items-center justify-between overflow-hidden rounded-lg border border-border/70 bg-background/90 px-3 py-2 shadow-2xl shadow-black/20 backdrop-blur-2xl">
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
                  className="absolute inset-0 rounded-md bg-primary/15"
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
