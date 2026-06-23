"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { 
  LayoutDashboard, 
  Settings, 
  LogOut,
  TrendingUp,
  History,
  Activity
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Cartera", href: "#", icon: TrendingUp },
  { name: "Movimientos", href: "#", icon: History },
  { name: "Alertas", href: "#", icon: Activity },
  { name: "Ajustes", href: "/settings", icon: Settings },
]

export function ProSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-64 border-r border-border/50 bg-card/30 backdrop-blur-xl flex flex-col h-screen sticky top-0 left-0 hidden md:flex">
      <div className="p-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary/20 p-2 rounded-xl">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <span className="font-bold text-xl tracking-tight">Silox<span className="text-primary">Pro</span></span>
        </Link>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative ${
                isActive 
                  ? "text-primary font-medium" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
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
              <item.icon className="h-5 w-5 z-10" />
              <span className="z-10">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border/50">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  )
}
