"use client"

import { useEffect, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Plus, UserCircle, ArrowLeftRight, LineChart } from "lucide-react"
import { hapticFeedback } from "@/lib/utils/haptics"

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
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [optimisticPath, setOptimisticPath] = useState(pathname)

  useEffect(() => {
    setOptimisticPath(pathname)
  }, [pathname])

  useEffect(() => {
    const prewarm = () => {
      tabs.forEach((tab) => {
        if (!tab.isFab) router.prefetch(tab.href)
      })
      void import("@/components/analysis/comprehensive-analysis")
    }

    const idle = window.requestIdleCallback?.(prewarm, { timeout: 1200 })
    const timer = idle ? null : window.setTimeout(prewarm, 400)

    return () => {
      if (idle) window.cancelIdleCallback(idle)
      if (timer) window.clearTimeout(timer)
    }
  }, [router])

  const navigate = (href: string) => {
    if (href === pathname) return
    setOptimisticPath(href)
    router.prefetch(href)
    window.requestAnimationFrame(() => hapticFeedback.light())
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <div className="md:hidden fixed z-50 left-0 right-0 bottom-0 pointer-events-none">
      <div
        className="absolute inset-x-0 bottom-0 h-28"
        style={{
          background: "linear-gradient(to top, var(--background) 0%, color-mix(in oklch, var(--background) 78%, transparent) 52%, transparent 100%)",
        }}
      />

      <div
        className="relative mx-auto mb-[calc(env(safe-area-inset-bottom,0px)+10px)] flex h-[68px] w-[calc(100%-28px)] max-w-[430px] items-center justify-between rounded-lg border border-border/70 bg-background/90 px-2 shadow-[0_18px_48px_oklch(0_0_0/0.34)] backdrop-blur-2xl pointer-events-auto"
      >
        {tabs.map((tab) => {
          const isActive = optimisticPath === tab.href

          if (tab.isFab) {
            return (
              <div key="fab-container" className="relative flex w-[58px] items-center justify-center">
                <button
                  onClick={() => {
                    hapticFeedback.heavy()
                    onAddPress()
                  }}
                  className="mobile-focus-ring flex h-[52px] w-[52px] items-center justify-center rounded-lg border border-primary/30 bg-primary text-primary-foreground transition-transform active:scale-95"
                  style={{ boxShadow: "0 12px 30px color-mix(in oklch, var(--primary) 34%, transparent)" }}
                  aria-label="Añadir transacción"
                >
                  <Plus className="h-6 w-6 stroke-[2.6]" />
                </button>
              </div>
            )
          }

          return (
            <button
              key={tab.name}
              type="button"
              onPointerDown={() => navigate(tab.href)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") navigate(tab.href)
              }}
              className="mobile-focus-ring relative flex h-[54px] min-w-[58px] flex-col items-center justify-center rounded-lg transition-colors active:bg-muted/70"
              aria-label={tab.name}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <span
                  className="absolute inset-0 rounded-lg"
                  style={{
                    background: "color-mix(in oklch, var(--primary) 12%, transparent)",
                    border: "1px solid color-mix(in oklch, var(--primary) 20%, transparent)",
                  }}
                />
              )}
              <div
                className="relative z-10 transition-transform duration-100 ease-out"
                style={{
                  transform: isActive ? "translateY(-1px) scale(1.02)" : "translateY(0) scale(1)",
                }}
              >
                <tab.icon
                  className="h-5 w-5 transition-colors duration-200"
                  strokeWidth={isActive ? 2.4 : 2}
                  style={{
                    color: isActive ? "var(--primary)" : "var(--muted-foreground)",
                  }}
                />
              </div>
              <span
                className="relative z-10 mt-1 max-w-[56px] truncate text-[9px] font-bold leading-none tracking-[0.02em]"
                style={{ color: isActive ? "var(--foreground)" : "color-mix(in oklch, var(--muted-foreground) 72%, transparent)" }}
              >
                {tab.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
