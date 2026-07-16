"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Plus,
  Radio,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { usePreferences } from "@/lib/stores/use-preferences"
import { useQuickAdd } from "@/lib/stores/use-quick-add"
import { cn } from "@/lib/utils"
import {
  accountNavigation,
  planningNavigation,
  primaryNavigation,
} from "@/components/layout/navigation"

type NavigationItem = (typeof primaryNavigation)[number] | (typeof planningNavigation)[number] | (typeof accountNavigation)[number]

function isCurrentRoute(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
}

function NavigationGroup({
  label,
  items,
  collapsed,
  pathname,
}: {
  label: string
  items: readonly NavigationItem[]
  collapsed: boolean
  pathname: string
}) {
  return (
    <div className="space-y-1">
      {!collapsed && (
        <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
          {label}
        </p>
      )}
      {items.map((item) => {
        const active = isCurrentRoute(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              "group relative flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring",
              collapsed && "justify-center px-0",
              active
                ? "border-primary/20 bg-primary/10 text-foreground shadow-sm"
                : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />}
            <item.icon className={cn("size-[18px] shrink-0", active && "text-primary")} strokeWidth={active ? 2.35 : 1.9} />
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate font-semibold">{item.label}</span>
                <span className="block truncate text-[10px] font-medium text-muted-foreground">{item.description}</span>
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, setSidebarCollapsed } = usePreferences()
  const openQuickAdd = useQuickAdd((state) => state.openEmpty)

  return (
    <aside
      className={cn(
        "sticky top-0 z-40 hidden h-dvh shrink-0 flex-col border-r border-border/70 bg-card/75 p-3 backdrop-blur-2xl transition-[width] duration-200 xl:flex",
        sidebarCollapsed ? "w-[76px]" : "w-[248px]",
      )}
    >
      <div className={cn("flex h-12 items-center gap-3 px-2", sidebarCollapsed && "justify-center px-0")}>
        <Link href="/" className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-400 text-primary-foreground shadow-lg shadow-primary/15">
            <Activity className="size-4.5" strokeWidth={2.5} />
          </span>
          {!sidebarCollapsed && (
            <span className="min-w-0">
              <span className="block text-base font-black tracking-[-0.04em]">Silox</span>
              <span className="block text-[9px] font-bold uppercase tracking-[0.17em] text-muted-foreground">Wealth cockpit</span>
            </span>
          )}
        </Link>
      </div>

      <Button
        type="button"
        onClick={openQuickAdd}
        className={cn("mt-3 h-11 justify-start gap-3 rounded-xl", sidebarCollapsed && "justify-center px-0")}
        aria-label="Añadir operación o activo"
      >
        <Plus className="size-4.5" />
        {!sidebarCollapsed && <span>Nueva operación</span>}
      </Button>

      <nav aria-label="Navegación principal" className="mt-5 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto hide-scrollbar">
        <NavigationGroup label="Principal" items={primaryNavigation} collapsed={sidebarCollapsed} pathname={pathname} />
        <NavigationGroup label="Planificación" items={planningNavigation} collapsed={sidebarCollapsed} pathname={pathname} />
        <NavigationGroup label="Cuenta" items={accountNavigation} collapsed={sidebarCollapsed} pathname={pathname} />
      </nav>

      {!sidebarCollapsed && (
        <Link href="/" className="mt-3 rounded-2xl border border-border/70 bg-background/65 p-3 shadow-sm transition-colors hover:bg-muted/50" aria-label="Abrir centro de cartera en tiempo real">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400">
            <Radio className="size-3" /> Centro en tiempo real
          </div>
          <p className="mt-2 text-xs font-semibold text-foreground">Tu cartera, de un vistazo</p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Precios, sesión, rentabilidad y exposición en el dashboard.</p>
        </Link>
      )}

      <Button
        type="button"
        variant="ghost"
        size={sidebarCollapsed ? "icon" : "default"}
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className={cn("mt-2 h-9 text-muted-foreground", !sidebarCollapsed && "justify-start")}
        aria-label={sidebarCollapsed ? "Expandir navegación" : "Contraer navegación"}
      >
        {sidebarCollapsed ? <ChevronRight /> : <><ChevronLeft /><span>Contraer menú</span></>}
      </Button>
    </aside>
  )
}
