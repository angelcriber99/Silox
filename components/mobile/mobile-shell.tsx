"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, ChevronRight } from "lucide-react"

import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav"
import { MobileBottomSheet } from "@/components/mobile/mobile-bottom-sheet"
import { useQuickAdd } from "@/lib/stores/use-quick-add"
import { accountNavigation, planningNavigation, primaryNavigation } from "@/components/layout/navigation"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const navigationGroups = [
  { label: "Principal", items: primaryNavigation },
  { label: "Planificación", items: planningNavigation },
  { label: "Cuenta", items: accountNavigation },
] as const

export function MobileShell() {
  const { isOpen, preselectedAsset, openEmpty, close } = useQuickAdd()
  const { positions } = usePortfolio()
  const [navigationOpen, setNavigationOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <MobileBottomNav onAddPress={openEmpty} onMorePress={() => setNavigationOpen(true)} />
      <MobileBottomSheet
        open={isOpen}
        onClose={close}
        positions={positions}
        preselectedAsset={preselectedAsset}
      />

      <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
        <SheetContent side="bottom" className="max-h-[82dvh] gap-0 rounded-t-[28px] border-border/70 bg-background p-0 pb-[env(safe-area-inset-bottom,0px)]">
          <SheetHeader className="border-b border-border/60 px-5 py-5 text-left">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-400 text-primary-foreground"><Activity className="size-4.5" /></span>
              <div>
                <SheetTitle className="text-lg font-black tracking-tight">Explorar Silox</SheetTitle>
                <SheetDescription className="text-xs">Accede a todas las herramientas de tu cartera.</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <nav aria-label="Todas las secciones" className="overflow-y-auto px-3 py-4">
            {navigationGroups.map((group) => (
              <div key={group.label} className="mb-5 last:mb-1">
                <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{group.label}</p>
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card divide-y divide-border/60">
                  {group.items.map((item) => {
                    const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setNavigationOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className="flex min-h-[58px] items-center gap-3 px-4 outline-none transition-colors active:bg-muted focus-visible:bg-muted"
                      >
                        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground", active && "bg-primary/10 text-primary")}><item.icon className="size-4.5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm font-bold", active && "text-primary")}>{item.label}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{item.description}</span>
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground/60" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
