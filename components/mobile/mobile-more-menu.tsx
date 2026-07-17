"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, History, PieChart, Settings, TrendingUp } from "lucide-react"

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
  { href: "/analisis", label: "Análisis", description: "Riesgo y distribución", Icon: PieChart },
  { href: "/historial", label: "Rendimiento", description: "Histórico y fiscalidad", Icon: TrendingUp },
  { href: "/declarar", label: "Declarar", description: "Resumen para la renta", Icon: FileText },
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
        <SheetHeader className="px-0 pb-2 pt-3">
          <SheetTitle className="text-xl font-semibold">Más</SheetTitle>
          <SheetDescription>Accede a todas las herramientas de la versión web.</SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-2">
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
                className={`rounded-2xl border p-3.5 transition-colors active:bg-muted ${isActive ? "border-primary/40 bg-primary/8" : "border-border bg-card"}`}
              >
                <div className={`mb-3 grid h-9 w-9 place-items-center rounded-xl ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{description}</p>
              </Link>
            )
          })}
        </div>

        <Link
          href="/movimientos"
          onClick={() => onOpenChange(false)}
          className="mt-1 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium text-muted-foreground active:bg-muted"
        >
          <History className="h-4 w-4" /> Ver todos los movimientos
        </Link>
      </SheetContent>
    </Sheet>
  )
}
