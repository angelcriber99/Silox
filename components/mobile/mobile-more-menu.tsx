"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, FileText, History, PieChart, Settings, TrendingUp } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { hapticFeedback } from "@/lib/utils/haptics"

interface MobileMoreMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const routes = [
  { href: "/analisis", label: "Análisis", description: "Distribución y riesgo", Icon: PieChart },
  { href: "/historial", label: "Rendimiento", description: "Evolución histórica", Icon: TrendingUp },
  { href: "/declarar", label: "Declarar", description: "Fiscalidad y exportación", Icon: FileText },
  { href: "/settings", label: "Ajustes", description: "Cuenta y preferencias", Icon: Settings },
] as const

export function MobileMoreMenu({ open, onOpenChange }: MobileMoreMenuProps) {
  const pathname = usePathname()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-border bg-background px-4 pb-[calc(18px+env(safe-area-inset-bottom,0px))] pt-2 md:hidden"
      >
        <div className="mx-auto mt-1 h-1 w-9 rounded-full bg-muted-foreground/30" />
        <SheetHeader className="px-0 pb-3 pt-3">
          <SheetTitle className="text-xl font-semibold">Más</SheetTitle>
          <SheetDescription>Todas las herramientas de tu cartera.</SheetDescription>
        </SheetHeader>

        <nav className="overflow-hidden rounded-2xl border border-border bg-card" aria-label="Herramientas secundarias">
          {routes.map(({ href, label, description, Icon }) => {
            const isActive = pathname.startsWith(href)

            return (
              <Link
                key={href}
                href={href}
                onClick={() => {
                  hapticFeedback.light()
                  onOpenChange(false)
                }}
                className="flex min-h-[64px] items-center gap-3 border-b border-border/60 px-3.5 py-2.5 transition-colors last:border-b-0 active:bg-muted"
                aria-current={isActive ? "page" : undefined}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              </Link>
            )
          })}
        </nav>

        <Link
          href="/movimientos"
          onClick={() => onOpenChange(false)}
          className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium text-muted-foreground active:bg-muted"
        >
          <History className="h-4 w-4" /> Ver todos los movimientos
        </Link>
      </SheetContent>
    </Sheet>
  )
}
