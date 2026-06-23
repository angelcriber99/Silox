"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  LayoutDashboard, 
  Settings, 
  LogOut,
  TrendingUp,
  History,
  Activity,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { usePreferences } from "@/lib/stores/use-preferences"

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Movimientos", href: "/movimientos", icon: History },
  { name: "Historial", href: "/historial", icon: TrendingUp },
  { name: "Ajustes", href: "/settings", icon: Settings },
]

export function ProSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { sidebarCollapsed, setSidebarCollapsed } = usePreferences()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <motion.aside 
      animate={{ width: sidebarCollapsed ? 80 : 256 }}
      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
      className="border-r border-border/50 bg-card/30 backdrop-blur-xl flex flex-col h-screen sticky top-0 left-0 hidden md:flex relative z-40 overflow-hidden"
    >
      <button 
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute top-6 -right-3.5 z-50 bg-primary text-primary-foreground rounded-full p-1 shadow-lg border-2 border-background hover:scale-110 transition-transform"
      >
        {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div className="p-6 h-20 flex items-center">
        <Link href="/" className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
          <div className="bg-primary/20 p-2 rounded-xl flex-shrink-0">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span 
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="font-bold text-xl tracking-tight"
              >
                Silox<span className="text-primary">Pro</span>
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto hide-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative ${
                sidebarCollapsed ? "justify-center px-0" : ""
              } ${
                isActive 
                  ? "text-primary font-medium" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              title={sidebarCollapsed ? item.name : undefined}
            >
              {isActive && (
                <motion.div 
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-primary/10 rounded-xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                />
              )}
              <item.icon className="h-5 w-5 z-10 flex-shrink-0" />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="z-10 whitespace-nowrap"
                  >
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border/50">
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 py-3 w-full rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors ${
            sidebarCollapsed ? "justify-center px-0" : "px-4"
          }`}
          title={sidebarCollapsed ? "Cerrar Sesión" : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span 
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="whitespace-nowrap"
              >
                Cerrar Sesión
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  )
}
