"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Plus, UserCircle, ArrowLeftRight, LineChart } from "lucide-react"
import { hapticFeedback } from "@/lib/utils/haptics"
import { motion } from "framer-motion"

interface MobileBottomNavProps {
  onAddPress: () => void
}

const tabs = [
  { name: "Inicio",      href: "/",           icon: LayoutDashboard },
  { name: "Análisis",    href: "/analisis",    icon: LineChart },
  { name: "Añadir",      href: "#",            icon: Plus, isFab: true },
  { name: "Movimientos", href: "/movimientos", icon: ArrowLeftRight },
  { name: "Perfil",      href: "/settings",    icon: UserCircle },
]

export function MobileBottomNav({ onAddPress }: MobileBottomNavProps) {
  const pathname = usePathname()

  return (
    <div
      className="md:hidden fixed z-50 bottom-0 left-0 right-0"
    >
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/40"
      />

      <div 
        className="relative flex items-center justify-around w-full h-[64px]"
        style={{
          paddingTop: "4px"
        }}
      >
        {tabs.map((tab) => {
          const isActive = pathname === tab.href

          if (tab.isFab) {
            return (
              <div key="fab-container" className="relative flex justify-center items-center px-2">
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  whileHover={{ scale: 1.04 }}
                  onClick={() => {
                    hapticFeedback.heavy()
                    onAddPress()
                  }}
                  className="flex items-center justify-center outline-none z-50 h-14 w-14 rounded-full shadow-lg shadow-primary/25"
                  style={{ background: "var(--primary)" }}
                  aria-label="Añadir transacción"
                >
                  <Plus className="h-7 w-7 stroke-[2.5]" style={{ color: "var(--primary-foreground)" }} />
                </motion.button>
              </div>
            )
          }

          return (
            <Link
              key={tab.name}
              href={tab.href}
              onClick={() => hapticFeedback.light()}
              className="relative flex flex-col items-center justify-center min-w-[56px] h-12"
              aria-label={tab.name}
            >
              {isActive && (
                <motion.div
                  layoutId="activeBottomTab"
                  className="absolute inset-0 rounded-2xl bg-muted/60"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <motion.div
                className="relative z-10 flex items-center justify-center"
                animate={{
                  scale: isActive ? 1.05 : 1,
                  y: isActive ? -1 : 0,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <tab.icon
                  className="h-6 w-6 transition-colors duration-200"
                  strokeWidth={isActive ? 2.5 : 2}
                  style={{
                    color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
                  }}
                />
              </motion.div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
