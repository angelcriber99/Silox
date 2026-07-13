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
  { name: "Cartera",     href: "/",           lucideIcon: LayoutDashboard, label: "Cartera" },
  { name: "Análisis",    href: "/analisis",    lucideIcon: LineChart,       label: "Análisis" },
  { name: "fab",         href: "#",            lucideIcon: Plus,            label: "Añadir",    isFab: true },
  { name: "Movimientos", href: "/movimientos", lucideIcon: ArrowLeftRight,  label: "Historial" },
  { name: "Perfil",      href: "/settings",    lucideIcon: UserCircle,      label: "Yo" },
]

export function MobileBottomNav({ onAddPress }: MobileBottomNavProps) {
  const pathname = usePathname()

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden">
      {/* Frosted glass background */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: "calc(78px + env(safe-area-inset-bottom, 0px))",
          background: "rgba(0,0,0,0.82)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "0.5px solid rgba(255,255,255,0.12)",
          boxShadow: "0 -18px 34px rgba(0,0,0,0.28)",
        }}
      />

      {/* Tab row */}
      <div
        className="pointer-events-auto relative flex w-full items-end justify-around"
        style={{
          height: "calc(64px + env(safe-area-inset-bottom, 0px))",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {tabs.map((tab) => {
          const isActive = pathname === tab.href

          if (tab.isFab) {
            return (
              <div key="fab" className="flex justify-center items-center pb-1">
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => {
                    hapticFeedback.heavy()
                    onAddPress()
                  }}
                  className="flex items-center justify-center"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    background: "#30D158",
                    boxShadow: "0 4px 20px rgba(48,209,88,0.40)",
                  }}
                  aria-label="Añadir transacción"
                >
                  <Plus
                    className="h-6 w-6"
                    strokeWidth={2.5}
                    style={{ color: "#000000" }}
                  />
                </motion.button>
              </div>
            )
          }

          const Icon = tab.lucideIcon

          return (
            <Link
              key={tab.name}
              href={tab.href}
              onClick={() => hapticFeedback.light()}
              className="relative flex flex-col items-center justify-end gap-[3px] pb-2"
              style={{ minWidth: 56, paddingTop: 6 }}
              aria-label={tab.name}
            >
              {/* Icon */}
              <motion.div
                animate={{
                  scale: isActive ? 1.08 : 1,
                  y: isActive ? -1 : 0,
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <Icon
                  style={{
                    width: 24,
                    height: 24,
                    strokeWidth: isActive ? 2.2 : 1.8,
                    color: isActive ? "#30D158" : "rgba(255,255,255,0.45)",
                    transition: "color 0.2s ease",
                  }}
                />
              </motion.div>

              {/* Active dot indicator */}
              <motion.div
                animate={{ opacity: isActive ? 1 : 0, scale: isActive ? 1 : 0.4 }}
                transition={{ duration: 0.2 }}
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  background: "#30D158",
                }}
              />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
