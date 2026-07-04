"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Activity } from "lucide-react"

import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      
      const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
      
      if (isNative) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'com.angelcriber.silox://auth/callback',
            skipBrowserRedirect: true,
          }
        })
        if (error) throw error;
        if (data?.url) {
          await Browser.open({ url: data.url });
        }
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${location.origin}/auth/callback`
          }
        })
        if (error) throw error
      }
    } catch (error) {
      console.error('Error logging in:', error)
      alert('Error al iniciar sesión con Google.')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      if (error) throw error
      window.location.href = '/'
    } catch (error) {
      console.error('Error logging in:', error)
      alert('Error al iniciar sesión. Revisa tus credenciales.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full bg-background flex flex-col justify-center items-center p-4 selection:bg-purple-500/30">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 backdrop-blur-xl shadow-2xl animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/20 mb-4">
            <Activity className="h-6 w-6 text-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Bienvenido a Silox</h1>
          <p className="text-muted-foreground text-sm mt-2 text-center">
            Inicia sesión para gestionar tu patrimonio de forma segura y privada.
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-900 font-semibold py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="h-5 w-5 rounded-full border-2 border-zinc-900 border-t-transparent animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          <span>Continuar con Google</span>
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">O inicia con tu correo</span>
          </div>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="sr-only" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="sr-only" htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              required
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Iniciando..." : "Iniciar Sesión"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground/80 mt-6">
          Al iniciar sesión, aceptas que tus datos financieros se guarden de forma cifrada en la base de datos vinculados a tu ID único.
        </p>
      </div>
    </div>
  )
}
