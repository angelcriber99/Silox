"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  Settings,
  LogOut,
  History,
  ChevronLeft,
  ChevronRight,
  FileText,
  Activity,
  TrendingUp,
  PieChart,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { usePreferences } from "@/lib/stores/use-preferences"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

const navItems = [
  { key: "dashboard",  label: "Dashboard",   href: "/",            icon: LayoutDashboard, group: "main" },
  { key: "portfolio",  label: "Movimientos", href: "/movimientos", icon: History,          group: "main" },
  { key: "analisis-page", label: "Análisis", href: "/analisis", icon: PieChart,         group: "analysis" },
  { key: "analisis",   label: "Histórico",   href: "/historial",   icon: TrendingUp,       group: "analysis" },
  { key: "declarar",   label: "Declarar",    href: "/declarar",    icon: FileText,         group: "analysis" },
  { key: "settings",   label: "Ajustes",     href: "/settings",    icon: Settings,         group: "system" },
]

const groupLabels: Record<string, string> = {
  main: "Principal",
  analysis: "Análisis",
  system: "Sistema",
}

export function ProSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { sidebarCollapsed, setSidebarCollapsed, zenMode } = usePreferences()
  const t = useTranslations("Navigation")
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUserEmail(user?.email || null)
    }
    getUser()
  }, [])

  if (zenMode) return null

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  const userInitial = userEmail ? userEmail[0].toUpperCase() : "U"
  const userName = userEmail ? userEmail.split("@")[0] : "Usuario"

  // Group nav items
  const groups = ["main", "analysis", "system"] as const
  const grouped = groups.reduce((acc, g) => {
    acc[g] = navItems.filter(i => i.group === g)
    return acc
  }, {} as Record<string, typeof navItems>)

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 68 : 236 }}
      transition={{ type: "spring", bounce: 0, duration: 0.28 }}
      className="flex flex-col h-screen sticky top-0 left-0 hidden md:flex relative z-40"
      style={{
        background: "var(--sidebar)",
        borderRight: "1px solid oklch(0.68 0.17 192 / 0.08)",
      }}
    >
      {/* Subtle mesh background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 0% 0%, oklch(0.68 0.17 192 / 0.06) 0%, transparent 60%)",
        }}
      />

      {/* Collapse toggle */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute top-1/2 -translate-y-1/2 -right-3 z-50 h-6 w-6 rounded-full flex items-center justify-center shadow-lg border transition-all duration-200 hover:scale-110 hidden md:flex"
        style={{
          background: "var(--primary)",
          borderColor: "oklch(0.68 0.17 192 / 0.3)",
          color: "var(--primary-foreground)",
        }}
      >
        {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* ── Logo ────────────────────────────────── */}
      <div
        className={`h-[60px] flex items-center flex-shrink-0 border-b relative z-10 ${
          sidebarCollapsed ? "justify-center px-0" : "px-4"
        }`}
        style={{ borderColor: "oklch(0.68 0.17 192 / 0.10)" }}
      >
        <Link href="/" className="flex items-center gap-3 min-w-0">
          {/* Logo icon */}
          <div
            className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 glow-primary"
            style={{
              background: "linear-gradient(135deg, oklch(0.68 0.17 192) 0%, oklch(0.65 0.19 155) 100%)",
            }}
          >
            <Activity className="h-4 w-4" style={{ color: "oklch(0.08 0.01 235)" }} />
          </div>

          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <span className="font-bold text-[15px] tracking-tight" style={{ color: "var(--foreground)" }}>
                  Silox
                  <span className="gradient-wealth-text font-extrabold">Pro</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* ── Navigation ──────────────────────────── */}
      <nav className={`flex-1 py-3 overflow-y-auto hide-scrollbar relative z-10 ${sidebarCollapsed ? "px-2" : "px-2"}`}>
        {groups.map((group) => {
          const items = grouped[group]
          if (!items || items.length === 0) return null
          return (
            <div key={group} className="mb-1">
              {/* Group label */}
              <AnimatePresence>
                {!sidebarCollapsed && group !== "main" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="px-3 pt-3 pb-1"
                  >
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.15em]"
                      style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
                    >
                      {groupLabels[group]}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href))

                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={`group relative flex items-center rounded-xl transition-all duration-200 ${
                        sidebarCollapsed
                          ? "justify-center h-10 w-10 mx-auto"
                          : "gap-3 px-3 py-2.5"
                      }`}
                    >
                      {/* Active background */}
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute inset-0 rounded-xl"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                          style={{
                            background: "linear-gradient(135deg, oklch(0.68 0.17 192 / 0.15), oklch(0.65 0.19 155 / 0.10))",
                            border: "1px solid oklch(0.68 0.17 192 / 0.25)",
                          }}
                        />
                      )}

                      {/* Hover background */}
                      {!isActive && (
                        <div
                          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          style={{ background: "oklch(0.68 0.17 192 / 0.06)" }}
                        />
                      )}

                      {/* Active left accent bar */}
                      {isActive && !sidebarCollapsed && (
                        <motion.div
                          layoutId="sidebar-bar"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4/5 rounded-full"
                          style={{
                            background: "linear-gradient(to bottom, oklch(0.68 0.17 192), oklch(0.65 0.19 155))",
                          }}
                          transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                        />
                      )}

                      <item.icon
                        className="h-[17px] w-[17px] relative z-10 flex-shrink-0 transition-colors duration-200"
                        style={{ color: isActive ? "var(--primary)" : "var(--muted-foreground)" }}
                      />

                      <AnimatePresence>
                        {!sidebarCollapsed && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.18 }}
                            className="text-[13px] font-medium relative z-10 whitespace-nowrap overflow-hidden"
                            style={{ color: isActive ? "var(--foreground)" : "var(--muted-foreground)" }}
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* ── User + Logout ─────────────────────── */}
      <div
        className="border-t p-2 space-y-0.5 flex-shrink-0 relative z-10"
        style={{ borderColor: "oklch(0.68 0.17 192 / 0.10)" }}
      >
        {/* User info */}
        <AnimatePresence>
          {!sidebarCollapsed && userEmail && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2.5 px-3 py-2.5 mb-1 rounded-xl"
              style={{ background: "oklch(0.68 0.17 192 / 0.06)" }}
            >
              {/* Avatar */}
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[11px]"
                style={{
                  background: "linear-gradient(135deg, oklch(0.68 0.17 192 / 0.3), oklch(0.65 0.19 155 / 0.3))",
                  color: "var(--primary)",
                  border: "1px solid oklch(0.68 0.17 192 / 0.3)",
                }}
              >
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
                  {userName}
                </p>
                <p className="text-[10px] truncate" style={{ color: "var(--muted-foreground)", opacity: 0.6 }}>
                  {userEmail}
                </p>
              </div>
              {/* Online dot */}
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-dot-blink"
                style={{ background: "oklch(0.65 0.19 155)" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed avatar */}
        {sidebarCollapsed && userEmail && (
          <div
            className="h-10 w-10 rounded-full mx-auto flex items-center justify-center font-bold text-[12px]"
            title={userEmail}
            style={{
              background: "linear-gradient(135deg, oklch(0.68 0.17 192 / 0.25), oklch(0.65 0.19 155 / 0.25))",
              color: "var(--primary)",
              border: "1px solid oklch(0.68 0.17 192 / 0.25)",
            }}
          >
            {userInitial}
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={sidebarCollapsed ? "Cerrar Sesión" : undefined}
          className={`group relative flex items-center rounded-xl transition-all duration-200 ${
            sidebarCollapsed
              ? "justify-center h-10 w-10 mx-auto"
              : "gap-3 px-3 py-2.5 w-full"
          }`}
        >
          <div
            className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ background: "oklch(0.62 0.20 20 / 0.08)" }}
          />
          <LogOut
            className="h-[17px] w-[17px] relative z-10 flex-shrink-0 transition-colors duration-200"
            style={{ color: "var(--muted-foreground)" }}
          />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.18 }}
                className="text-[13px] font-medium relative z-10 whitespace-nowrap overflow-hidden group-hover:text-rose-400 transition-colors"
                style={{ color: "var(--muted-foreground)" }}
              >
                Cerrar sesión
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  )
}
