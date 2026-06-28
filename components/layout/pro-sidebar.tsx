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
  User,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { usePreferences } from "@/lib/stores/use-preferences"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

const navItems = [
  { key: "dashboard", label: "Dashboard",   href: "/",           icon: LayoutDashboard },
  { key: "portfolio",  label: "Historial",   href: "/movimientos", icon: History         },
  { key: "declarar",   label: "Declarar",    href: "/declarar",   icon: FileText        },
  { key: "settings",   label: "Ajustes",     href: "/settings",   icon: Settings        },
]

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

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 72 : 240 }}
      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
      className="border-r border-white/5 bg-card/20 backdrop-blur-2xl flex flex-col h-screen sticky top-0 left-0 hidden md:flex relative z-40 overflow-hidden"
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute top-1/2 -translate-y-1/2 -right-3 z-50 bg-primary text-primary-foreground rounded-full p-1 shadow-lg border-2 border-background hover:scale-110 transition-transform hidden md:flex"
      >
        {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Logo */}
      <div className={`h-16 flex items-center border-b border-white/5 flex-shrink-0 ${sidebarCollapsed ? "justify-center px-0" : "px-5"}`}>
        <Link href="/" className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <span className="font-bold text-[15px] tracking-tight text-foreground">
                  Silox<span className="text-primary">Pro</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Nav */}
      <nav className={`flex-1 py-4 space-y-1 overflow-y-auto hide-scrollbar ${sidebarCollapsed ? "px-3" : "px-3"}`}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))

          return (
            <Link
              key={item.key}
              href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              className={`group relative flex items-center rounded-xl transition-all duration-200 ${
                sidebarCollapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-2.5"
              } ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground/60 hover:text-foreground"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-primary/10 rounded-xl border border-primary/20"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              {!isActive && (
                <div className="absolute inset-0 rounded-xl bg-transparent group-hover:bg-muted/30 transition-colors duration-200" />
              )}
              <item.icon className="h-[18px] w-[18px] relative z-10 flex-shrink-0" />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-[13px] font-medium relative z-10 whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )
        })}
      </nav>

      {/* User section + logout */}
      <div className={`border-t border-white/5 p-3 space-y-1 flex-shrink-0`}>
        {/* User info */}
        {!sidebarCollapsed && userEmail && (
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-primary">{userInitial}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-foreground/80 truncate">{userEmail.split("@")[0]}</p>
              <p className="text-[9px] text-muted-foreground/50 truncate">{userEmail}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          title={sidebarCollapsed ? "Cerrar Sesión" : undefined}
          className={`group relative flex items-center rounded-xl text-muted-foreground/50 hover:text-rose-400 transition-all duration-200 ${
            sidebarCollapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-2.5 w-full"
          }`}
        >
          <div className="absolute inset-0 rounded-xl bg-transparent group-hover:bg-rose-500/10 transition-colors duration-200" />
          <LogOut className="h-[18px] w-[18px] relative z-10 flex-shrink-0" />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="text-[13px] font-medium relative z-10 whitespace-nowrap overflow-hidden"
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
