"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, History, Plus, Settings, FileText } from "lucide-react"
import { playSound } from "@/lib/utils/sounds"
import { usePreferences } from "@/lib/stores/use-preferences"
import { hapticFeedback } from "@/lib/utils/haptics"
import { motion } from "framer-motion"

interface MobileBottomNavProps {
  onAddPress: () => void
}

export function MobileBottomNav({ onAddPress }: MobileBottomNavProps) {
  const pathname = usePathname()
  const { soundEffects } = usePreferences()

  const tabs = [
    { name: "Inicio", href: "/", icon: LayoutDashboard },
    { name: "Historial", href: "/movimientos", icon: History },
    { name: "Añadir", href: "#", icon: Plus, isFab: true },
    { name: "Declarar", href: "/declarar", icon: FileText },
    { name: "Ajustes", href: "/settings", icon: Settings },
  ]

  const handlePress = () => {
    if (soundEffects) playSound('click')
    hapticFeedback.light()
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      {/* Background layer with pointer-events-auto */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-2xl border-t border-white/5 dark:border-white/5 pointer-events-auto shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)]" />
      
      <div className="relative flex items-end justify-between px-2 pb-[env(safe-area-inset-bottom,0px)] h-16 pointer-events-auto">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href

          if (tab.isFab) {
            return (
              <div key="fab-container" className="relative flex-1 flex justify-center h-full">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => {
                    handlePress()
                    hapticFeedback.medium()
                    onAddPress()
                  }}
                  className="absolute -top-6 flex items-center justify-center outline-none"
                >
                  <div className="h-[52px] w-[52px] rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 border-[3px] border-background/80 dark:border-background/50 backdrop-blur-md">
                    <Plus className="h-6 w-6 text-primary-foreground stroke-[2.5]" />
                  </div>
                </motion.button>
                {/* Space holder for the FAB text */}
                <span className="absolute bottom-1.5 text-[9px] font-semibold text-muted-foreground/50 tracking-wide">
                  {tab.name}
                </span>
              </div>
            )
          }

          return (
            <Link
              key={tab.name}
              href={tab.href}
              onClick={handlePress}
              className={`relative flex-1 flex flex-col items-center justify-center h-full transition-colors duration-200 pb-1.5 ${
                isActive ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"
              }`}
            >
              <div className="relative mb-1">
                <motion.div
                  initial={false}
                  animate={{ scale: isActive ? 1.15 : 1, y: isActive ? -2 : 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <tab.icon className="h-[22px] w-[22px]" />
                </motion.div>
              </div>
              <span className={`text-[9px] font-semibold tracking-wide transition-all ${
                isActive ? "text-foreground font-bold" : ""
              }`}>
                {tab.name}
              </span>
              {isActive && (
                <motion.div 
                  layoutId="bottom-nav-indicator"
                  className="absolute -top-0.5 w-10 h-1 rounded-b-full bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
