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
      {/* iOS Style Bottom Tab Bar */}
      <div className="w-full bg-background/75 backdrop-blur-[40px] backdrop-saturate-[180%] border-t border-border/40 pb-[env(safe-area-inset-bottom)] pointer-events-auto">
        <div className="flex items-center justify-between px-2 h-[56px] relative">
          
          {tabs.map((tab) => {
            const isActive = pathname === tab.href

            if (tab.isFab) {
              return (
                <div key="fab-container" className="relative flex justify-center flex-1 h-full shrink-0">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      handlePress()
                      hapticFeedback.medium()
                      onAddPress()
                    }}
                    className="absolute -top-5 flex items-center justify-center outline-none"
                  >
                    <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-lg dark:shadow-primary/40 border-[4px] border-background backdrop-blur-xl transition-transform">
                      <Plus className="h-6 w-6 text-primary-foreground stroke-[2.5]" />
                    </div>
                  </motion.button>
                </div>
              )
            }

            return (
              <Link
                key={tab.name}
                href={tab.href}
                onClick={handlePress}
                className="relative flex-1 flex flex-col items-center justify-center h-full transition-colors duration-200 tap-highlight-transparent"
              >
                <div className="relative mb-1">
                  <motion.div
                    initial={false}
                    animate={{ scale: isActive ? 1.1 : 1, y: isActive ? -2 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <tab.icon className={`h-[22px] w-[22px] ${isActive ? "text-primary drop-shadow-sm" : "text-muted-foreground/60"}`} strokeWidth={isActive ? 2.5 : 2} />
                  </motion.div>
                </div>
                <span className={`text-[10px] font-medium tracking-wide transition-all ${
                  isActive ? "text-primary" : "text-muted-foreground/60"
                }`}>
                  {tab.name}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
