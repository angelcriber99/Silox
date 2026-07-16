import {
  BellRing,
  ChartNoAxesCombined,
  FileText,
  History,
  LayoutDashboard,
  Settings2,
  Sparkles,
  UserRound,
} from "lucide-react"

export const primaryNavigation = [
  { label: "Dashboard", description: "Visión en tiempo real", href: "/", icon: LayoutDashboard },
  { label: "Movimientos", description: "Compras, ventas y dividendos", href: "/movimientos", icon: History },
  { label: "Análisis", description: "Riesgo y diversificación", href: "/analisis", icon: ChartNoAxesCombined },
] as const

export const planningNavigation = [
  { label: "Historial", description: "Evolución anual", href: "/historial", icon: Sparkles },
  { label: "Fiscalidad", description: "FIFO y declaración", href: "/declarar", icon: FileText },
  { label: "Alertas", description: "Objetivos de precio", href: "/alertas", icon: BellRing },
] as const

export const accountNavigation = [
  { label: "Perfil", description: "Tu cuenta", href: "/perfil", icon: UserRound },
  { label: "Ajustes", description: "Preferencias y conexiones", href: "/settings", icon: Settings2 },
] as const

export const allNavigation = [
  ...primaryNavigation,
  ...planningNavigation,
  ...accountNavigation,
] as const

