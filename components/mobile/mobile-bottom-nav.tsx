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
        className="absolute inset-0 bg-background border-t border-border/20"
      />

      <div 
        className="relative flex items-center justify-around w-full"
        style={{
          paddingBottom: "16px",
          paddingTop: "12px",
          height: "64px"
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
                  className="flex items-center justify-center outline-none z-50"
                  aria-label="Añadir transacción"
                >
                  <Plus className="h-[28px] w-[28px] stroke-[2.5] text-foreground" />
                </motion.button>
              </div>
            )
          }

          return (
            <Link
              key={tab.name}
              href={tab.href}
              onClick={() => hapticFeedback.light()}
              className="relative flex flex-col items-center justify-center min-w-[64px]"
              aria-label={tab.name}
            >
              <motion.div
                animate={{
                  scale: isActive ? 1.15 : 1,
                  y: isActive ? -2 : 0,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <tab.icon
                  className="h-[26px] w-[26px] transition-colors duration-200"
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
