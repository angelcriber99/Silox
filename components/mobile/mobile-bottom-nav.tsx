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

    <div
      className="md:hidden fixed z-50 bottom-0 left-0 right-0"
    >
      <div 
        className="absolute inset-0 bg-background/80 dark:bg-[#13141c]/80 border-t border-border/50"
        style={{
          backdropFilter: "blur(20px) saturate(150%)",
          WebkitBackdropFilter: "blur(20px) saturate(150%)",
        }}
      />

      <div 
        className="relative flex items-center justify-around w-full"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
          paddingTop: "8px",
          height: "calc(60px + env(safe-area-inset-bottom, 0px))"
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
                  className="flex items-center justify-center outline-none z-50 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  style={{ width: "44px", height: "44px" }}
                  aria-label="Añadir transacción"
                >
                  <Plus className="h-6 w-6 stroke-[2.5]" />
                </motion.button>
              </div>
            )
          }

          return (
            <Link
              key={tab.name}
              href={tab.href}
              onClick={() => hapticFeedback.light()}
              className="relative flex flex-col items-center justify-center gap-1 min-w-[64px]"
              aria-label={tab.name}
            >
              <motion.div
                animate={{
                  scale: isActive ? 1.1 : 1,
                  y: isActive ? -2 : 0,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <tab.icon
                  className="h-6 w-6 transition-colors duration-200"
                  strokeWidth={isActive ? 2.5 : 2}
                  style={{
                    color: isActive ? "var(--primary)" : "var(--muted-foreground)",
                  }}
                />
              </motion.div>
              <span
                className="text-[10px] font-medium tracking-wide transition-colors duration-200"
                style={{
                  color: isActive ? "var(--primary)" : "var(--muted-foreground)",
                  opacity: isActive ? 1 : 0.8
                }}
              >
                {tab.name}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
