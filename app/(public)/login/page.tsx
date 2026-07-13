"use client"

import { useState } from "react"
import { Activity, Eye, EyeOff, LineChart, LockKeyhole, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const [loading, setLoading] = useState<'google' | 'email' | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleGoogleLogin = async () => {
    try {
      setLoading('google')
      const supabase = createClient()
      const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()

      if (isNative) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'com.angelcriber.silox://auth/callback',
            skipBrowserRedirect: true,
          },
        })
        if (error) throw error
        if (data?.url) await Browser.open({ url: data.url })
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${location.origin}/auth/callback` },
        })
        if (error) throw error
      }
    } catch (error) {
      console.error('Error logging in:', error)
      toast.error('No se pudo iniciar sesión con Google')
    } finally {
      setLoading(null)
    }
  }

  const handleEmailLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      setLoading('email')
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      window.location.href = '/'
    } catch (error) {
      console.error('Error logging in:', error)
      toast.error('No se pudo iniciar sesión. Revisa tus credenciales.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-background selection:bg-primary/20">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--color-primary),transparent_32%)] opacity-[0.08]" />
      <div aria-hidden="true" className="absolute -right-24 top-1/3 size-80 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative mx-auto grid min-h-full w-full max-w-6xl items-center gap-10 px-4 py-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-12">
        <section className="hidden max-w-xl lg:block" aria-labelledby="login-intro-title">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Patrimonio bajo tu control
          </div>
          <h1 id="login-intro-title" className="text-5xl font-bold tracking-[-0.04em] text-foreground">
            Una vista clara de todo tu patrimonio.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">
            Sigue posiciones, movimientos y rendimiento diario desde un espacio privado, consistente y pensado para decidir mejor.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-xl">
              <LineChart aria-hidden="true" className="mb-4 size-5 text-primary" />
              <p className="font-semibold text-foreground">Rendimiento legible</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Premercado, sesión regular y postmercado en contexto.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-xl">
              <LockKeyhole aria-hidden="true" className="mb-4 size-5 text-primary" />
              <p className="font-semibold text-foreground">Acceso privado</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Tus datos permanecen vinculados exclusivamente a tu cuenta.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-[2rem] border border-border/80 bg-card/90 p-6 shadow-2xl shadow-black/10 backdrop-blur-2xl sm:p-8" aria-labelledby="login-title">
          <div className="mb-8">
            <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Activity aria-hidden="true" className="size-6" />
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Silox</p>
            <h2 id="login-title" className="text-2xl font-bold tracking-tight text-foreground">Bienvenido de nuevo</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Accede para consultar y gestionar tu cartera.</p>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading !== null}
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading === 'google' ? (
              <div aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
            ) : (
              <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            <span>Continuar con Google</span>
          </button>

          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-3 text-muted-foreground">O usa tu correo</span></div>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                required
                className="min-h-12 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="password">Contraseña</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  required
                  className="min-h-12 w-full rounded-xl border border-border bg-background py-3 pl-4 pr-12 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading !== null || !email || !password}
              className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading === 'email' ? 'Iniciando...' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
            Tus datos financieros se almacenan de forma segura y vinculados exclusivamente a tu identificador de usuario.
          </p>
        </section>
      </div>
    </div>
  )
}
