"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, History, Plus, Settings, FileText } from "lucide-react"
import { hapticFeedback } from "@/lib/utils/haptics"
import { motion } from "framer-motion"

interface MobileBottomNavProps {
  onAddPress: () => void
}

export function MobileBottomNav({ onAddPress }: MobileBottomNavProps) {
  const pathname = usePathname()

  const tabs = [
    { name: "Inicio", href: "/", icon: LayoutDashboard },
    { name: "Movimientos", href: "/movimientos", icon: History },
    { name: "Añadir", href: "#", icon: Plus, isFab: true },
    { name: "Declarar", href: "/declarar", icon: FileText },
    { name: "Ajustes", href: "/settings", icon: Settings },
  ]

  const handlePress = () => {
    hapticFeedback.light()
  }

  return (
    <div className="md:hidden fixed bottom-5 left-4 right-4 z-50 pointer-events-none">
      {/* iOS 17 Style Floating Island Tab Bar */}
      <div className="w-full bg-background/60 dark:bg-zinc-900/60 backdrop-blur-[40px] backdrop-saturate-[200%] border border-black/5 dark:border-white/10 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.3)] rounded-[2rem] pointer-events-auto">
        <div className="flex items-center justify-between px-3 h-[64px] relative">
          
          {tabs.map((tab) => {
            const isActive = pathname === tab.href

            if (tab.isFab) {
              return (
                <div key="fab-container" className="relative flex justify-center flex-1 h-full shrink-0">
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={() => {
                      handlePress()
                      hapticFeedback.heavy()
                      onAddPress()
                    }}
                    className="absolute -top-3 flex items-center justify-center outline-none"
                  >
                    <div className="h-[52px] w-[52px] rounded-full bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)] dark:shadow-[0_0_20px_rgba(16,185,129,0.3)] border-[3px] border-background dark:border-zinc-900 transition-transform">
                      <Plus className="h-6 w-6 text-primary-foreground stroke-[3]" />
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
                    animate={{ scale: isActive ? 1.15 : 1, y: isActive ? -2 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <tab.icon className={`h-[24px] w-[24px] ${isActive ? "text-foreground drop-shadow-sm" : "text-muted-foreground/50"}`} strokeWidth={isActive ? 2.5 : 2} />
                  </motion.div>
                </div>
                <span className={`text-[9px] font-semibold tracking-wide transition-all ${
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
