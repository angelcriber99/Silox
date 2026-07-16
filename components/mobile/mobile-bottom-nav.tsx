"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { hapticFeedback } from "@/lib/utils/haptics"
import {
  LayoutDashboard,
  LineChart,
  Plus,
  ArrowLeftRight,
  UserCircle,
} from "lucide-react"

interface MobileBottomNavProps {
  onAddPress: () => void
}

const tabs = [
  { name: "Cartera",     href: "/",           Icon: LayoutDashboard, label: "Cartera" },
  { name: "Análisis",    href: "/analisis",    Icon: LineChart,       label: "Análisis" },
  { name: "fab",         href: "#",            Icon: Plus,            label: "Añadir",   isFab: true },
  { name: "Movimientos", href: "/movimientos", Icon: ArrowLeftRight,  label: "Historial" },
  { name: "Perfil",      href: "/settings",    Icon: UserCircle,      label: "Perfil" },
]

export function MobileBottomNav({ onAddPress }: MobileBottomNavProps) {
  const pathname = usePathname()

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden">
      {/* Frosted glass background */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: "calc(82px + env(safe-area-inset-bottom, 0px))",
          background: "rgba(10,10,12,0.88)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "0.5px solid rgba(255,255,255,0.09)",
          boxShadow: "0 -1px 0 rgba(255,255,255,0.04), 0 -20px 40px rgba(0,0,0,0.30)",
        }}
      />

      {/* Tab row */}
      <div
        className="pointer-events-auto relative flex w-full items-stretch justify-around"
        style={{
          height: "calc(68px + env(safe-area-inset-bottom, 0px))",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {tabs.map((tab) => {
          const isActive = pathname === tab.href

          if (tab.isFab) {
            return (
              <div key="fab" className="flex items-center justify-center px-2">
                <motion.button
                  whileTap={{ scale: 0.86 }}
                  onClick={() => {
                    hapticFeedback.heavy()
                    onAddPress()
                  }}
                  className="flex items-center justify-center"
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    background: "linear-gradient(135deg, oklch(0.68 0.17 192), oklch(0.65 0.19 155))",
                    boxShadow: "0 4px 20px rgba(48,209,88,0.35), 0 0 0 1px rgba(48,209,88,0.15)",
                  }}
                  aria-label="Añadir transacción"
                >
                  <Plus
                    className="h-6 w-6"
                    strokeWidth={2.5}
                    style={{ color: "#FFFFFF" }}
                  />
                </motion.button>
              </div>
            )
          }

          const { Icon } = tab

          return (
            <Link
              key={tab.name}
              href={tab.href}
              onClick={() => hapticFeedback.light()}
              className="relative flex flex-col items-center justify-center gap-[3px] flex-1 py-2"
              aria-label={tab.name}
            >
              {/* Active pill background */}
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-x-3 top-1.5 bottom-1.5 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.07)" }}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}

              {/* Icon */}
              <motion.div
                animate={{
                  scale: isActive ? 1.05 : 1,
                  y: isActive ? -0.5 : 0,
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <Icon
                  style={{
                    width: 22,
                    height: 22,
                    strokeWidth: isActive ? 2.2 : 1.7,
                    color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.38)",
                    transition: "color 0.2s ease, stroke-width 0.2s ease",
                  }}
                />
              </motion.div>

              {/* Label */}
              <motion.span
                animate={{ opacity: isActive ? 1 : 0.45 }}
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.45)",
                  letterSpacing: "0.01em",
                  lineHeight: 1,
                  transition: "all 0.2s ease",
                }}
              >
                {tab.label}
              </motion.span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
