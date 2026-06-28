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
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none pb-[env(safe-area-inset-bottom,0px)]">
      <div className="px-4 pb-4 pt-2">
        {/* Floating pill background */}
        <div className="relative mx-auto max-w-[400px] h-[64px] bg-background/80 backdrop-blur-3xl backdrop-saturate-150 border border-border/40 shadow-2xl rounded-[32px] pointer-events-auto flex items-center justify-between px-2">
          
          {tabs.map((tab) => {
            const isActive = pathname === tab.href

            if (tab.isFab) {
              return (
                <div key="fab-container" className="relative flex justify-center w-16 h-full shrink-0">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => {
                      handlePress()
                      hapticFeedback.medium()
                      onAddPress()
                    }}
                    className="absolute -top-4 flex items-center justify-center outline-none"
                  >
                    <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.2)] dark:shadow-primary/40 border-[4px] border-background/90 backdrop-blur-xl">
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
                className="relative flex-1 flex flex-col items-center justify-center h-full transition-colors duration-200"
              >
                {isActive && (
                  <motion.div 
                    layoutId="bottom-nav-pill"
                    className="absolute inset-x-2 inset-y-2 bg-muted/50 rounded-2xl -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <div className="relative mb-0.5">
                  <motion.div
                    initial={false}
                    animate={{ scale: isActive ? 1.1 : 1, y: isActive ? -1 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <tab.icon className={`h-5 w-5 ${isActive ? "text-foreground drop-shadow-md" : "text-muted-foreground/50"}`} />
                  </motion.div>
                </div>
                <span className={`text-[10px] font-semibold tracking-wide transition-all ${
                  isActive ? "text-foreground" : "text-muted-foreground/50"
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
