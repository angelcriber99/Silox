"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, History, Plus, Settings, TrendingUp } from "lucide-react"
import { hapticFeedback } from "@/lib/utils/haptics"
import { motion } from "framer-motion"

interface MobileBottomNavProps {
  onAddPress: () => void
}

const tabs = [
  { name: "Inicio",       href: "/",           icon: LayoutDashboard },
  { name: "Histórico",    href: "/historial",   icon: TrendingUp },
  { name: "Añadir",       href: "#",            icon: Plus, isFab: true },
  { name: "Movimientos",  href: "/movimientos", icon: History },
  { name: "Ajustes",      href: "/settings",    icon: Settings },
]

export function MobileBottomNav({ onAddPress }: MobileBottomNavProps) {
  const pathname = usePathname()

  return (
    <div
      className="md:hidden fixed left-3 right-3 z-50"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      {/* Floating pill container */}
      <div
        className="w-full rounded-[28px] flex items-center px-2 relative overflow-visible"
        style={{
          height: 62,
          background: "oklch(0.125 0.014 235 / 0.85)",
          backdropFilter: "blur(28px) saturate(200%)",
          WebkitBackdropFilter: "blur(28px) saturate(200%)",
          border: "1px solid oklch(0.68 0.17 192 / 0.15)",
          boxShadow:
            "0 20px 48px -12px oklch(0 0 0 / 0.55), 0 0 0 1px oklch(0.68 0.17 192 / 0.08) inset",
        }}
      >
        {tabs.map((tab) => {
          const isActive = pathname === tab.href

          if (tab.isFab) {
            return (
              <div
                key="fab-container"
                className="relative flex justify-center flex-1 h-full items-center"
              >
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  whileHover={{ scale: 1.04 }}
                  onClick={() => {
                    hapticFeedback.heavy()
                    onAddPress()
                  }}
                  className="absolute flex items-center justify-center outline-none"
                  style={{ top: -20 }}
                  aria-label="Añadir transacción"
                >
                  <div
                    className="h-14 w-14 rounded-full flex items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(135deg, oklch(0.68 0.17 192) 0%, oklch(0.65 0.19 155) 100%)",
                      boxShadow:
                        "0 8px 28px oklch(0.68 0.17 192 / 0.55), 0 0 0 3px oklch(0.125 0.014 235 / 0.9)",
                    }}
                  >
                    <Plus
                      className="h-6 w-6 stroke-[3]"
                      style={{ color: "oklch(0.06 0.01 235)" }}
                    />
                  </div>
                </motion.button>
              </div>
            )
          }

          return (
            <Link
              key={tab.name}
              href={tab.href}
              onClick={() => hapticFeedback.light()}
              className="relative flex-1 flex flex-col items-center justify-center h-full gap-1 select-none"
              aria-label={tab.name}
            >
              {/* Active indicator pill */}
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-x-1 inset-y-1.5 rounded-2xl"
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.68 0.17 192 / 0.18), oklch(0.65 0.19 155 / 0.12))",
                    border: "1px solid oklch(0.68 0.17 192 / 0.25)",
                  }}
                />
              )}

              <motion.div
                animate={{
                  scale: isActive ? 1.1 : 1,
                  y: isActive ? -1 : 0,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="relative z-10"
              >
                <tab.icon
                  className="h-[22px] w-[22px] transition-colors duration-200"
                  strokeWidth={isActive ? 2.3 : 1.8}
                  style={{
                    color: isActive
                      ? "var(--primary)"
                      : "oklch(0.60 0.016 230)",
                  }}
                />
              </motion.div>

              <span
                className="text-[9px] font-semibold tracking-wide relative z-10 transition-colors duration-200"
                style={{
                  color: isActive
                    ? "var(--primary)"
                    : "oklch(0.50 0.01 230)",
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
