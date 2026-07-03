"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AlertOctagon, LogOut } from "lucide-react"

const PROTECTED_EMAILS = ["angelcriber99@gmail.com", "micenor88@gmail.com"]

export function DevSafeguard() {
  const [isBlocked, setIsBlocked] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  
  useEffect(() => {
    // Solo se activa en entorno de desarrollo
    if (process.env.NODE_ENV !== "development") return

    const supabase = createClient()
    
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email && PROTECTED_EMAILS.includes(session.user.email.toLowerCase())) {
        setIsBlocked(true)
        setEmail(session.user.email)
      } else {
        setIsBlocked(false)
      }
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email && PROTECTED_EMAILS.includes(session.user.email.toLowerCase())) {
        setIsBlocked(true)
        setEmail(session.user.email)
      } else {
        setIsBlocked(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  if (!isBlocked) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-rose-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-rose-900 border border-rose-500/30 rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-rose-500" />
        
        <div className="mx-auto w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mb-6">
          <AlertOctagon className="w-10 h-10 text-rose-500" />
        </div>
        
        <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-wide">Acceso Bloqueado</h1>
        <p className="text-rose-200 mb-6 font-medium">
          Estás intentando usar una cuenta de Producción (<strong className="text-white">{email}</strong>) en un entorno local (<code className="bg-rose-950/50 px-2 py-1 rounded">localhost</code>).
        </p>
        
        <div className="bg-rose-950/50 rounded-xl p-4 mb-8 text-sm text-rose-300 text-left space-y-2 border border-rose-500/20">
          <p>⚠️ <strong>Peligro de corrupción de datos:</strong></p>
          <p>Para evitar alterar los datos reales de Silox por error, el acceso con cuentas PRO está restringido durante el desarrollo.</p>
          <p className="pt-2">👉 <strong>Solución:</strong> Cierra sesión y utiliza la cuenta <code className="text-white font-bold">test@silox.dev</code>.</p>
        </div>

        <button
          onClick={handleLogout}
          className="w-full bg-white text-rose-950 font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors shadow-lg shadow-black/20"
        >
          <LogOut className="w-5 h-5" />
          Cerrar Sesión Inmediatamente
        </button>
      </div>
    </div>
  )
}
